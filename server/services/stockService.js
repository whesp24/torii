import Stock from '../models/Stock.js';
import yahooFinance from 'yahoo-finance2';

// ── Stooq quote (free, no API key) ────────────────────────────────────────────
// Reliable for TSE stocks from datacenter IPs. Used as first-attempt for Japan.
async function fetchStooqQuote(stooqSymbol) {
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/csv,text/plain,*/*',
      'Referer': 'https://stooq.com/',
    }
  });
  if (!r.ok) throw new Error(`Stooq HTTP ${r.status}`);
  const text = await r.text();

  // Detect HTML error page (Stooq blocks with 200 + HTML when rate-limited)
  if (text.trim().startsWith('<') || text.includes('<html') || text.includes('No data') || text.trim() === '') {
    throw new Error('Stooq: blocked or no data');
  }

  const lines = text.trim().split('\n').filter(l => l && !l.toLowerCase().startsWith('date'));
  if (lines.length < 1) throw new Error('Stooq: empty response');

  const parseRow = (line) => {
    // Stooq CSV: Date,Open,High,Low,Close,Volume
    const p = line.split(',');
    return { close: parseFloat(p[4]) || 0, vol: parseFloat(p[5]) || 0 };
  };
  const current = parseRow(lines[lines.length - 1]);
  const prev    = lines.length >= 2 ? parseRow(lines[lines.length - 2]) : null;
  if (!current.close || isNaN(current.close)) throw new Error('Stooq: bad close');
  const prevClose = prev?.close || current.close;
  const change = current.close - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
  return { price: current.close, change, changePercent, volume: current.vol };
}

// ── yahoo-finance2 quote for Japan stocks ─────────────────────────────────────
// Uses the npm package which handles sessions, crumbs, and retries internally.
async function fetchYahooFinance2Quote(symbol) {
  const q = await yahooFinance.quote(symbol, {}, { validateResult: false });
  if (!q) throw new Error('yahoo-finance2: no result');
  const price = q.regularMarketPrice || q.previousClose || 0;
  if (!price || price <= 0) throw new Error('yahoo-finance2: no price');
  const prev = q.regularMarketPreviousClose || q.previousClose || price;
  const change = q.regularMarketChange ?? (price - prev);
  const changePercent = q.regularMarketChangePercent ?? (prev > 0 ? (change / prev) * 100 : 0);
  return {
    price,
    change,
    changePercent,
    volume: q.regularMarketVolume || 0,
    name: q.shortName || q.longName || symbol,
  };
}

// Convert Yahoo .T symbol to Stooq .jp format (TSE stocks)
function toStooqJapan(sym) {
  // 7203.T → 7203.jp
  return sym.replace(/\.T$/, '.jp');
}

// ── Finnhub live quote (primary for US equities) ───────────────────────────────
export async function fetchLiveQuote(symbol) {
  const sym = symbol.toUpperCase();
  const KEY = process.env.FINNHUB_API_KEY;

  // Finnhub only supports US stocks — skip it for indices/forex/Japan stocks
  const isUsEquity = !sym.startsWith('^') && !sym.includes('=') && !sym.includes('.');

  if (KEY && isUsEquity) {
    try {
      const [qRes, pRes] = await Promise.all([
        fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${KEY}`),
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${sym}&token=${KEY}`)
      ]);
      const q = await qRes.json();
      const p = await pRes.json();

      // q.c = 0 when market is closed — fall back to previous close (q.pc)
      const price = (q.c && q.c > 0) ? q.c : q.pc;
      if (price && price > 0) {
        const change = q.d ?? 0;
        const changePercent = q.dp ?? 0;
        return {
          symbol: sym,
          name: p.name || sym,
          price, change, changePercent,
          volume: q.v || 0,
          avgVolume: 0,
          marketCap: p.marketCapitalization ? p.marketCapitalization * 1e6 : null,
          high52Week: null, low52Week: null,
          lastUpdated: new Date()
        };
      }
    } catch (err) {
      console.warn(`Finnhub failed for ${sym}: ${err.message}`);
    }
  }

  // ── Japan .T stocks: Stooq → yahoo-finance2 → DB cache ─────────────────────
  if (sym.endsWith('.T')) {
    const stooqSym = toStooqJapan(sym);

    // 1️⃣ Try Stooq first (fast, no auth required)
    try {
      const q = await fetchStooqQuote(stooqSym);
      if (q.price > 0) {
        try {
          await Stock.findOneAndUpdate(
            { symbol: sym },
            { symbol: sym, name: sym, price: q.price, change: q.change,
              changePercent: q.changePercent, volume: q.volume || 0,
              avgVolume: 0, lastUpdated: new Date() },
            { upsert: true }
          );
        } catch (_) {}
        return {
          symbol: sym, name: sym,
          price: q.price, change: q.change, changePercent: q.changePercent,
          volume: q.volume || 0, lastUpdated: new Date()
        };
      }
    } catch (err) {
      console.warn(`Stooq failed for ${stooqSym}: ${err.message}`);
    }

    // 2️⃣ Stooq failed — use yahoo-finance2 npm package (handles sessions internally)
    try {
      const q = await fetchYahooFinance2Quote(sym);
      if (q.price > 0) {
        try {
          await Stock.findOneAndUpdate(
            { symbol: sym },
            { symbol: sym, name: q.name || sym, price: q.price, change: q.change,
              changePercent: q.changePercent, volume: q.volume || 0,
              avgVolume: 0, lastUpdated: new Date() },
            { upsert: true }
          );
        } catch (_) {}
        console.log(`✓ ${sym} from yahoo-finance2 @ ${q.price}`);
        return { symbol: sym, name: q.name || sym, price: q.price, change: q.change,
                 changePercent: q.changePercent, volume: q.volume || 0, lastUpdated: new Date() };
      }
    } catch (err) {
      console.warn(`yahoo-finance2 failed for ${sym}: ${err.message}`);
    }

    // 3️⃣ DB cache — serve stale data rather than showing "—"
    try {
      const cached = await Stock.findOne({ symbol: sym });
      if (cached?.price > 0) {
        console.log(`Serving ${sym} from DB cache (stale fallback)`);
        return {
          symbol: sym, name: cached.name || sym, price: cached.price,
          change: cached.change, changePercent: cached.changePercent,
          volume: cached.volume, lastUpdated: cached.lastUpdated
        };
      }
    } catch (_) {}

    throw new Error(`All sources failed for ${sym}`);
  }

  // Fallback for other symbols: Yahoo Finance chart API with session cookie
  return fetchYahooQuote(sym);
}

// ── Finnhub candle chart (detailed intraday + historical for US stocks) ───────
export async function fetchFinnhubChart(symbol, range) {
  const KEY = process.env.FINNHUB_API_KEY;
  if (!KEY) throw new Error('No Finnhub key');

  const now = Math.floor(Date.now() / 1000);
  const rangeMap = {
    '1d':  { res: '5',  from: now - 86400 },
    '5d':  { res: '15', from: now - 86400 * 5 },
    '1mo': { res: 'D',  from: now - 86400 * 30 },
    '3mo': { res: 'D',  from: now - 86400 * 90 },
    '1y':  { res: 'W',  from: now - 86400 * 365 },
    'max': { res: 'M',  from: now - 86400 * 365 * 5 },
  };
  const { res, from } = rangeMap[range] || rangeMap['1mo'];
  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${res}&from=${from}&to=${now}&token=${KEY}`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.s !== 'ok' || !data.t) throw new Error('No Finnhub candle data');
  return data.t.map((t, i) => ({ time: new Date(t * 1000).toISOString(), price: data.c[i] })).filter(d => d.price != null);
}

// ── Yahoo Finance with cookie (works for indices, forex, ETFs, Japan stocks) ──
let _yfCookie = '';
let _yfCookieTime = 0;

async function getYahooCookie() {
  if (_yfCookie && Date.now() - _yfCookieTime < 30 * 60 * 1000) return _yfCookie;
  try {
    const r = await fetch('https://finance.yahoo.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    const raw = r.headers.get('set-cookie') || '';
    _yfCookie = raw.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
    _yfCookieTime = Date.now();
    console.log('✓ Yahoo Finance cookie refreshed');
  } catch (e) {
    console.warn('Could not get Yahoo cookie:', e.message);
  }
  return _yfCookie;
}

// ── Yahoo Finance chart with cookie session ───────────────────────────────────
export async function fetchYahooChart(symbol, range) {
  const sym = symbol.toUpperCase();
  const intervalMap = { '1d':'5m','5d':'30m','1mo':'1d','3mo':'1d','1y':'1wk','max':'1mo' };
  const interval = intervalMap[range] || '1d';
  const cookie = await getYahooCookie();
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=${interval}&range=${range}`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Referer': 'https://finance.yahoo.com/',
      ...(cookie ? { 'Cookie': cookie } : {}),
    }
  });
  if (!r.ok) throw new Error(`Yahoo chart ${r.status}`);
  const data = await r.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('No chart data');
  const ts = result.timestamp || [];
  const cl = result.indicators?.quote?.[0]?.close || [];
  return ts.map((t, i) => ({ time: new Date(t * 1000).toISOString(), price: cl[i] })).filter(d => d.price != null);
}

export async function fetchYahooQuote(symbol) {
  const sym = symbol.toUpperCase();
  const cookie = await getYahooCookie();

  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://finance.yahoo.com/',
      ...(cookie ? { 'Cookie': cookie } : {}),
    }
  });

  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status} for ${sym}`);

  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error(`No meta data for ${sym}`);

  // Use regularMarketPrice when live; fall back to previousClose when market is closed
  const price = (meta.regularMarketPrice && meta.regularMarketPrice > 0)
    ? meta.regularMarketPrice
    : (meta.previousClose || meta.chartPreviousClose || 0);

  if (!price || price <= 0) throw new Error(`No price data for ${sym}`);

  const prev = meta.previousClose || meta.chartPreviousClose || price;
  const isLive = meta.regularMarketPrice && meta.regularMarketPrice > 0;
  const change = isLive ? (meta.regularMarketPrice - prev) : 0;
  const changePercent = prev > 0 ? (change / prev) * 100 : 0;

  return {
    symbol: sym,
    name: meta.shortName || meta.longName || meta.symbol || sym,
    price, change, changePercent,
    volume: meta.regularMarketVolume ?? 0,
    avgVolume: meta.averageDailyVolume10Day || meta.averageDailyVolume3Month || 0,
    marketCap: null,
    high52Week: meta.fiftyTwoWeekHigh ?? null,
    low52Week: meta.fiftyTwoWeekLow ?? null,
    lastUpdated: new Date()
  };
}

const STOCK_CACHE_MS = 12 * 60 * 1000; // 12 min — skip Yahoo fetch if data is fresh

// ── Batch stock update (cron job) ─────────────────────────────────────────────
export async function fetchAndUpdateStocks({ force = false } = {}) {
  const symbols = [
    // US equities (Finnhub — no rate limit risk)
    'NFLX', 'MSFT', 'GOOGL', 'AAPL', 'NVDA', 'AMD', 'QQQ', 'SPY',
    // Japan equities — now uses Stooq (fast, no rate limits)
    '7203.T', '9984.T', '6758.T', '6861.T', '8306.T', '6501.T', '8035.T', '9432.T',
    '6702.T', '7267.T', '6954.T', '4519.T', '9433.T', '8316.T',
  ];

  for (const symbol of symbols) {
    try {
      if (!force) {
        const cached = await Stock.findOne({ symbol }).lean();
        if (cached?.lastUpdated) {
          const age = Date.now() - new Date(cached.lastUpdated).getTime();
          if (age < STOCK_CACHE_MS) {
            console.log(`⏭  ${symbol} cached (${Math.round(age/60000)}m old)`);
            continue;
          }
        }
      }
      const data = await fetchLiveQuote(symbol);
      if (data && data.price) {
        await Stock.findOneAndUpdate(
          { symbol },
          { symbol, name: data.name || symbol, price: data.price, change: data.change,
            changePercent: data.changePercent, volume: data.volume || 0,
            avgVolume: data.avgVolume || 0, lastUpdated: new Date() },
          { upsert: true, new: true }
        );
        console.log(`✓ Updated ${symbol} @ ${data.price}`);
      }
      // Japan stocks may hit multiple sources — give them more breathing room
      const delay = symbol.endsWith('.T') ? 1200 : 400;
      await new Promise(r => setTimeout(r, delay));
    } catch (err) {
      console.error(`Error fetching ${symbol}:`, err.message);
    }
  }
}
