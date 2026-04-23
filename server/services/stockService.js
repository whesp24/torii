import Stock from '../models/Stock.js';

// ── Finnhub live quote (primary — no IP blocking like Yahoo Finance) ───────────
// Requires FINNHUB_API_KEY env var (free at finnhub.io — 60 req/min)
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
          avgVolume: 0, // Finnhub free tier doesn't provide avg volume
          marketCap: p.marketCapitalization ? p.marketCapitalization * 1e6 : null,
          high52Week: null,
          low52Week: null,
          lastUpdated: new Date()
        };
      }
    } catch (err) {
      console.warn(`Finnhub failed for ${sym}: ${err.message}`);
    }
  }

  // DB cache check for .T stocks — served from cron-updated cache
  if (sym.endsWith('.T')) {
    try {
      const cached = await Stock.findOne({ symbol: sym });
      const age = cached ? Date.now() - new Date(cached.lastUpdated).getTime() : Infinity;
      if (cached && age < 20 * 60 * 1000) { // < 20 min old
        console.log(`Serving ${sym} from DB cache (${Math.round(age/60000)}m old)`);
        return {
          symbol: sym, name: cached.name, price: cached.price,
          change: cached.change, changePercent: cached.changePercent,
          volume: cached.volume, lastUpdated: cached.lastUpdated
        };
      }
    } catch (_) {}
  }

  // Fallback: Yahoo Finance chart API with session cookie
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
    // Japan equities (Yahoo Finance — rate-limit sensitive)
    '7203.T', '9984.T', '6758.T', '6861.T', '8306.T', '6501.T', '8035.T', '9432.T',
  ];

  for (const symbol of symbols) {
    try {
      // For .T stocks that depend on Yahoo, check cache first
      if (!force && symbol.endsWith('.T')) {
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
          { symbol, name: data.name, price: data.price, change: data.change,
            changePercent: data.changePercent, volume: data.volume, avgVolume: data.avgVolume,
            lastUpdated: new Date() },
          { upsert: true, new: true }
        );
        console.log(`✓ Updated ${symbol} @ ${data.price}`);
      }
      // Longer delay for .T stocks to avoid Yahoo rate limits
      const delay = symbol.endsWith('.T') ? 1500 : 400;
      await new Promise(r => setTimeout(r, delay));
    } catch (err) {
      console.error(`Error fetching ${symbol}:`, err.message);
    }
  }
}
