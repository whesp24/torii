import express from 'express';
import Stock from '../models/Stock.js';
import { fetchLiveQuote, fetchFinnhubChart, fetchYahooChart } from '../services/stockService.js';

const router = express.Router();
const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';

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

// Finnhub fundamentals proxy — metric + profile2 + quote
// Must be before /:symbol wildcard
router.get('/fundamentals/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  if (!FINNHUB_KEY) return res.status(503).json({ error: 'No Finnhub key' });
  try {
    const [metricRes, profileRes, quoteRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`),
      fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`),
    ]);
    const metric  = await metricRes.json();
    const profile = await profileRes.json();
    const quote   = await quoteRes.json();
    res.json({ metric: metric.metric || {}, profile, quote });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Analyst price target + recommendation consensus
// Must be before /:symbol wildcard
router.get('/price-target/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  if (!FINNHUB_KEY) return res.status(503).json({ error: 'No Finnhub key' });
  try {
    const [ptRes, recRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/price-target?symbol=${symbol}&token=${FINNHUB_KEY}`),
      fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${FINNHUB_KEY}`),
    ]);
    const pt  = await ptRes.json();
    const rec = await recRes.json();
    // rec is an array sorted newest first
    const latestRec = Array.isArray(rec) && rec.length > 0 ? rec[0] : null;
    res.json({ ...pt, recommendation: latestRec });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

// Get stock by symbol (from DB cache) — wildcard, must be last
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

export default router;
