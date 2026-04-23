import express from 'express';
import Stock from '../models/Stock.js';

const router = express.Router();

// Get all stocks
router.get('/', async (req, res) => {
  try {
    const stocks = await Stock.find().sort({ changePercent: -1 });
    res.json(stocks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Live on-demand quote for ANY symbol via yahoo-finance2 (no DB needed)
router.get('/live/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const yahooFinance = (await import('yahoo-finance2')).default;

    // Suppress strict validation — some small-caps have incomplete data
    const quote = await yahooFinance.quote(symbol, {}, { validateResult: false });

    // Accept any available price field
    const price = quote?.regularMarketPrice
      ?? quote?.preMarketPrice
      ?? quote?.postMarketPrice
      ?? null;

    if (!price) {
      return res.status(404).json({ error: `No price data for ${symbol}` });
    }

    res.json({
      symbol,
      name: quote.longName || quote.shortName || quote.displayName || symbol,
      price,
      change: quote.regularMarketChange ?? 0,
      changePercent: quote.regularMarketChangePercent ?? 0,
      volume: quote.regularMarketVolume ?? 0,
      marketCap: quote.marketCap ?? null,
      high52Week: quote.fiftyTwoWeekHigh ?? null,
      low52Week: quote.fiftyTwoWeekLow ?? null,
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error(`Live quote error for ${symbol}:`, error.message);
    res.status(404).json({ error: `Could not fetch ${symbol}: ${error.message}` });
  }
});

// Get stock by symbol (from DB cache)
router.get('/:symbol', async (req, res) => {
  try {
    const stock = await Stock.findOne({ symbol: req.params.symbol.toUpperCase() });

    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    res.json(stock);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get top gainers
router.get('/gainers/top', async (req, res) => {
  try {
    const gainers = await Stock.find().sort({ changePercent: -1 }).limit(10);
    res.json(gainers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get top losers
router.get('/losers/bottom', async (req, res) => {
  try {
    const losers = await Stock.find().sort({ changePercent: 1 }).limit(10);
    res.json(losers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
