/**
 * yahooClient.js — Direct Yahoo Finance HTTP client
 *
 * Replaces yahoo-finance2's quoteSummary(), chart(), and options() methods.
 *
 * Key design decisions:
 *  - Crumb acquisition uses fc.yahoo.com (works from datacenter IPs, unlike query2)
 *  - Promise mutex prevents concurrent crumb acquisitions (avoids 429 storms)
 *  - 50-minute TTL — Yahoo crumbs last ~1 hour; refresh well before expiry
 *  - Exponential backoff on 429 with jitter
 *  - All three API methods (quoteSummary, chart, options) share the same crumb
 */

const YF_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TIMEOUT_MS  = 15000;
const CRUMB_TTL   = 50 * 60 * 1000;   // 50 minutes — crumbs last ~1 hour
const CRUMB_RETRY_DELAYS = [2000, 8000, 20000]; // backoff on 429

// ── Crumb state + mutex ───────────────────────────────────────────────────────
let _crumb          = null;
let _cookie         = '';
let _crumbExpires   = 0;
let _acquirePromise = null;   // serialises concurrent acquisition attempts

async function _doAcquire() {
  // Strategy 1: fc.yahoo.com — works from datacenter IPs, no cookie dance needed
  try {
    const r = await fetch('https://fc.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': YF_UA, 'Accept': 'text/plain' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (r.ok) {
      const text = (await r.text()).trim();
      if (text && text.length >= 3 && !text.startsWith('<')) {
        _crumb        = text;
        _crumbExpires = Date.now() + CRUMB_TTL;
        console.log('✓ Yahoo crumb via fc.yahoo.com');
        return true;
      }
    }
  } catch (_) {}

  // Strategy 2: cookie handshake → query1 crumb endpoint
  // (fallback if fc.yahoo.com is blocked)
  try {
    const initRes = await fetch('https://finance.yahoo.com/', {
      headers: { 'User-Agent': YF_UA, 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const rawCookies = initRes.headers.get('set-cookie') || '';
    const pairs = rawCookies.split(/,(?=[^ ])/).map(c => c.split(';')[0].trim()).filter(Boolean);
    _cookie = pairs.join('; ');

    // Try both crumb hosts
    for (const host of ['query1', 'query2']) {
      try {
        const cr = await fetch(`https://${host}.finance.yahoo.com/v1/test/getcrumb`, {
          headers: { 'User-Agent': YF_UA, 'Cookie': _cookie, 'Accept': 'text/plain' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (cr.ok) {
          const text = (await cr.text()).trim();
          if (text && text.length >= 3 && !text.startsWith('<')) {
            _crumb        = text;
            _crumbExpires = Date.now() + CRUMB_TTL;
            console.log(`✓ Yahoo crumb via ${host}.finance.yahoo.com`);
            return true;
          }
        }
        if (cr.status === 429) {
          console.warn(`Yahoo crumb 429 on ${host} — will retry`);
          break;
        }
      } catch (_) {}
    }
  } catch (err) {
    console.warn(`Yahoo cookie handshake failed: ${err.message}`);
  }

  return false;
}

async function _acquireCrumb() {
  for (let i = 0; i < CRUMB_RETRY_DELAYS.length + 1; i++) {
    if (i > 0) {
      const delay = CRUMB_RETRY_DELAYS[i - 1] + Math.floor(Math.random() * 2000);
      console.warn(`Yahoo crumb retry ${i} in ${(delay/1000).toFixed(1)}s…`);
      await new Promise(r => setTimeout(r, delay));
    }
    const ok = await _doAcquire();
    if (ok) return true;
  }
  console.error('Yahoo crumb acquisition exhausted all retries');
  return false;
}

async function _getAuth() {
  if (_crumb && Date.now() < _crumbExpires) return { crumb: _crumb, cookie: _cookie };

  // Mutex: if another caller is already acquiring, wait for that one instead
  if (!_acquirePromise) {
    _acquirePromise = _acquireCrumb().finally(() => { _acquirePromise = null; });
  }
  await _acquirePromise;

  if (!_crumb) throw new Error('Could not obtain Yahoo Finance crumb — all strategies failed');
  return { crumb: _crumb, cookie: _cookie };
}

// ── Helper: fetch with auto-retry on expired crumb ──────────────────────────
async function _yfFetch(urlFn, extraHeaders = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { crumb, cookie } = await _getAuth();
    const url = urlFn(crumb);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': YF_UA,
          'Cookie':     cookie,
          'Accept':     'application/json',
          'Referer':    'https://finance.yahoo.com/',
          ...extraHeaders,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (res.status === 401 || res.status === 403) {
        // Force crumb refresh on next attempt
        _crumb = null;
        if (attempt < 1) continue;
        throw new Error(`HTTP ${res.status} — crumb rejected`);
      }
      if (res.status === 429) {
        throw new Error('HTTP 429 — Yahoo rate limit; slow down requests');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (attempt === 0 && (err.message.includes('401') || err.message.includes('403'))) {
        _crumb = null;
        continue;
      }
      throw err;
    }
  }
}

// ── quoteSummary ──────────────────────────────────────────────────────────────
/**
 * @param {string} symbol
 * @param {{ modules: string[] }} opts
 * @param {*} _ignored — compat with yahoo-finance2 signature
 * @returns {Object} merged module data (same shape as yahoo-finance2 quoteSummary result)
 */
export async function quoteSummary(symbol, { modules = ['price'] } = {}, _ignored = {}) {
  const sym  = encodeURIComponent(symbol);
  const mods = modules.join(',');
  const res  = await _yfFetch(
    c => `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${sym}?modules=${mods}&crumb=${encodeURIComponent(c)}&lang=en-US&region=US&corsDomain=finance.yahoo.com`
  );
  const data   = await res.json();
  const result = data?.quoteSummary?.result?.[0];
  if (!result) {
    const errMsg = data?.quoteSummary?.error?.description || 'no result';
    throw new Error(`quoteSummary ${symbol}: ${errMsg}`);
  }
  return result;
}

// ── chart ─────────────────────────────────────────────────────────────────────
/**
 * @param {string} symbol
 * @param {{ period1, period2, interval }} opts
 * @param {*} _ignored
 * @returns {{ quotes: Array<{date,open,high,low,close,volume,adjclose}>, meta: Object }}
 */
export async function chart(symbol, { period1, period2, interval = '1d' } = {}, _ignored = {}) {
  const sym  = encodeURIComponent(symbol);
  const toTs = v => !v ? Math.floor(Date.now() / 1000) :
               typeof v === 'number' ? v : Math.floor(new Date(v).getTime() / 1000);
  const p1 = toTs(period1);
  const p2 = toTs(period2);

  const res = await _yfFetch(
    c => `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?period1=${p1}&period2=${p2}&interval=${interval}&crumb=${encodeURIComponent(c)}&events=div,splits`
  );
  const data   = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`chart ${symbol}: ${data?.chart?.error?.description || 'no result'}`);

  const timestamps  = result.timestamp || [];
  const ohlcv       = result.indicators?.quote?.[0] || {};
  const adjCloseArr = result.indicators?.adjclose?.[0]?.adjclose || [];

  const quotes = timestamps.map((ts, i) => ({
    date:     new Date(ts * 1000),
    open:     ohlcv.open?.[i]   ?? null,
    high:     ohlcv.high?.[i]   ?? null,
    low:      ohlcv.low?.[i]    ?? null,
    close:    ohlcv.close?.[i]  ?? null,
    volume:   ohlcv.volume?.[i] ?? null,
    adjclose: adjCloseArr[i]    ?? null,
  })).filter(q => q.close != null);

  return { quotes, meta: result.meta };
}

// ── options ───────────────────────────────────────────────────────────────────
/**
 * @param {string} symbol
 * @param {{ date?: number }} opts
 * @returns {{ calls, puts, expirationDates, strikes, quote }}
 */
export async function options(symbol, { date } = {}, _ignored = {}) {
  const sym       = encodeURIComponent(symbol);
  const dateParam = date ? `&date=${date}` : '';
  const res  = await _yfFetch(
    c => `https://query2.finance.yahoo.com/v7/finance/options/${sym}?crumb=${encodeURIComponent(c)}${dateParam}`
  );
  const data  = await res.json();
  const chain = data?.optionChain?.result?.[0];
  if (!chain) throw new Error(`options ${symbol}: no result`);

  const opts = chain.options?.[0] || {};
  return {
    calls:            opts.calls            || [],
    puts:             opts.puts             || [],
    expirationDates:  chain.expirationDates || [],
    strikes:          chain.strikes         || [],
    underlyingSymbol: chain.underlyingSymbol,
    quote:            chain.quote,
  };
}

// Pre-warm crumb on module load (non-blocking, best-effort)
_acquireCrumb().catch(() => {});
