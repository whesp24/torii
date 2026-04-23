import Stock from '../models/Stock.js';

// ── Finnhub live quote (primary — no IP blocking like Yahoo Finance) ───────────
// Requires FINNHUB_API_KEY env var (free at finnhub.io — 60 req/min)
export async function fetchLiveQuote(symbol) {
  const sym = symbol.toUpperCase();
  const KEY = process.env.FINNHUB_API_KEY;

  if (KEY) {
    try {
      const [qRes, pRes] = await Promise.all([
        fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${KEY}`),
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${sym}&token=${KEY}`)
      ]);
      const q = await qRes.json();
      const p = await pRes.json();

      if (q && q.c && q.c > 0) {
        return {
          symbol: sym,
          name: p.name || sym,
          price: q.c,
          change: q.d ?? 0,
          changePercent: q.dp ?? 0,
          volume: 0,
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

  // Fallback: Yahoo Finance chart API with session cookie
  return fetchYahooQuote(sym);
}

// ── Yahoo Finance with cookie (works for indices, forex, ETFs) ────────────────
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

export async function fetchYahooQuote(symbol) {
  const sym = symbol.toUpperCase();
  const cookie = await getYahooCookie();

  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`;
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
  if (!meta?.regularMarketPrice) throw new Error(`No price data for ${sym}`);

  const prev = meta.previousClose || meta.chartPreviousClose || meta.regularMarketPrice;
  const price = meta.regularMarketPrice;
  const change = price - prev;
  const changePercent = prev > 0 ? (change / prev) * 100 : 0;

  return {
    symbol: sym,
    name: meta.shortName || meta.symbol || sym,
    price, change, changePercent,
    volume: meta.regularMarketVolume ?? 0,
    marketCap: null,
    high52Week: meta.fiftyTwoWeekHigh ?? null,
    low52Week: meta.fiftyTwoWeekLow ?? null,
    lastUpdated: new Date()
  };
}

// ── Batch stock update (cron job) ─────────────────────────────────────────────
export async function fetchAndUpdateStocks() {
  const KEY = process.env.FINNHUB_API_KEY;
  const symbols = ['NFLX', 'MSFT', 'GOOGL', 'AAPL', 'NVDA', '7203.T', '9984.T', '6758.T'];

  for (const symbol of symbols) {
    try {
      const data = await fetchLiveQuote(symbol);
      if (data && data.price) {
        await Stock.findOneAndUpdate(
          { symbol },
          { symbol, name: data.name, price: data.price, change: data.change,
            changePercent: data.changePercent, volume: data.volume, lastUpdated: new Date() },
          { upsert: true, new: true }
        );
        console.log(`✓ Updated ${symbol} @ $${data.price}`);
      }
      await new Promise(r => setTimeout(r, 200)); // rate limit buffer
    } catch (err) {
      console.error(`Error fetching ${symbol}:`, err.message);
    }
  }
}
