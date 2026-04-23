import express from 'express';
import Stock from '../models/Stock.js';
import { fetchLiveQuote, fetchFinnhubChart, fetchYahooChart } from '../services/stockService.js';

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

// Historical chart data — Finnhub for US stocks, Yahoo+cookie for indices/forex
router.get('/chart/:symbol', async (req, res) => {
  const sym = req.params.symbol.toUpperCase();
  const range = req.query.range || '1mo';
  const isIndex = sym.startsWith('^') || sym.includes('=') || sym.endsWith('.T');

  try {
    let points = [];
    if (!isIndex && process.env.FINNHUB_API_KEY) {
      try {
        points = await fetchFinnhubChart(sym, range);
      } catch (e) {
        console.warn(`Finnhub chart failed for ${sym}, trying Yahoo: ${e.message}`);
      }
    }
    if (points.length === 0) {
      points = await fetchYahooChart(sym, range);
    }
    res.json(points);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Live on-demand quote for ANY symbol (uses proven stockService import pattern)
router.get('/live/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const data = await fetchLiveQuote(symbol);
    res.json(data);
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
