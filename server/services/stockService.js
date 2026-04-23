import Stock from '../models/Stock.js';

// Shared helper — uses yahoo-finance2 (handles crumb auth internally, more reliable)
export async function fetchLiveQuote(symbol) {
  const sym = symbol.toUpperCase();

  try {
    // yahoo-finance2 handles Yahoo's crumb/cookie auth automatically
    const yahooFinance = (await import('yahoo-finance2')).default;
    const quote = await yahooFinance.quote(sym);

    if (!quote?.regularMarketPrice) throw new Error(`No price data for ${sym}`);

    const price = quote.regularMarketPrice;
    const prev = quote.regularMarketPreviousClose || price;
    const change = quote.regularMarketChange ?? (price - prev);
    const changePercent = quote.regularMarketChangePercent ?? (prev > 0 ? (change / prev) * 100 : 0);

    return {
      symbol: sym,
      name: quote.longName || quote.shortName || sym,
      price,
      change,
      changePercent,
      volume: quote.regularMarketVolume ?? 0,
      marketCap: quote.marketCap ?? null,
      high52Week: quote.fiftyTwoWeekHigh ?? null,
      low52Week: quote.fiftyTwoWeekLow ?? null,
      lastUpdated: new Date()
    };
  } catch (err) {
    // Fallback: direct Yahoo Finance chart API
    console.warn(`yahoo-finance2 failed for ${sym}, trying direct API: ${err.message}`);
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://finance.yahoo.com/',
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
}

// yahoo-finance2 is free, no API key, no rate limits for reasonable use
// Works in production on Render/Railway/Fly etc.
export async function fetchAndUpdateStocks() {
  try {
    const symbols = ['NFLX', 'MSFT', 'GOOGL', 'AAPL', 'NVDA', '7203.T', '9984.T', '6758.T'];

    // Dynamically import yahoo-finance2 (ESM compat)
    const yahooFinance = (await import('yahoo-finance2')).default;

    for (const symbol of symbols) {
      try {
        const quote = await yahooFinance.quote(symbol);

        if (quote && quote.regularMarketPrice) {
          await Stock.findOneAndUpdate(
            { symbol },
            {
              symbol,
              name: quote.longName || quote.shortName || symbol,
              price: quote.regularMarketPrice,
              change: quote.regularMarketChange ?? 0,
              changePercent: quote.regularMarketChangePercent ?? 0,
              high52Week: quote.fiftyTwoWeekHigh,
              low52Week: quote.fiftyTwoWeekLow,
              volume: quote.regularMarketVolume,
              marketCap: quote.marketCap,
              lastUpdated: new Date()
            },
            { upsert: true, new: true }
          );

          console.log(`✓ Updated ${symbol} @ $${quote.regularMarketPrice}`);
        }
      } catch (symbolErr) {
        console.error(`Error fetching ${symbol}:`, symbolErr.message);
      }
    }
  } catch (error) {
    console.error('Stock update error:', error);
  }
}
