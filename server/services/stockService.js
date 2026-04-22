import Stock from '../models/Stock.js';

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';

export async function fetchAndUpdateStocks() {
  try {
    // Example: Fetch NFLX stock data
    const symbols = ['NFLX', 'MSFT', 'GOOGL', 'AAPL', 'NVDA'];

    for (const symbol of symbols) {
      const url = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data['Global Quote'] && data['Global Quote']['05. price']) {
        const quote = data['Global Quote'];

        await Stock.findOneAndUpdate(
          { symbol },
          {
            symbol,
            price: parseFloat(quote['05. price']),
            change: parseFloat(quote['09. change']),
            changePercent: parseFloat(quote['10. change percent']),
            high52Week: quote['52WeekHigh'],
            low52Week: quote['52WeekLow'],
            lastUpdated: new Date()
          },
          { upsert: true, new: true }
        );

        console.log(`✓ Updated ${symbol}`);
      }
    }
  } catch (error) {
    console.error('Stock update error:', error);
  }
}
