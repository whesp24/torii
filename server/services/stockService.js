import Stock from '../models/Stock.js';

// Shared helper — used by both the cron job and the /live/:symbol route
export async function fetchLiveQuote(symbol) {
  const { default: yf } = await import('yahoo-finance2');
  const quote = await yf.quote(symbol.toUpperCase(), {}, { validateResult: false });
  const price = quote?.regularMarketPrice ?? quote?.preMarketPrice ?? null;
  if (!price) throw new Error(`No price data for ${symbol}`);
  return {
    symbol: symbol.toUpperCase(),
    name: quote.longName || quote.shortName || symbol,
    price,
    change: quote.regularMarketChange ?? 0,
    changePercent: quote.regularMarketChangePercent ?? 0,
    volume: quote.regularMarketVolume ?? 0,
    marketCap: quote.marketCap ?? null,
    high52Week: quote.fiftyTwoWeekHigh ?? null,
    low52Week: quote.fiftyTwoWeekLow ?? null,
    lastUpdated: new Date()
  };
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
