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

// Get stock by symbol
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
