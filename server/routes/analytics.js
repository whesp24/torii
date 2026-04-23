import express from 'express';
import Stock from '../models/Stock.js';

const router = express.Router();

// Pearson correlation between two arrays
function pearson(a, b) {
  if (a.length !== b.length || a.length < 2) return 0;
  const n = a.length;
  const meanA = a.reduce((s,x) => s+x, 0) / n;
  const meanB = b.reduce((s,x) => s+x, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA, db = b[i] - meanB;
    num  += da * db;
    denA += da * da;
    denB += db * db;
  }
  const denom = Math.sqrt(denA * denB);
  return denom === 0 ? 0 : num / denom;
}

// GET /api/analytics/correlation?tickers=NVDA,AAPL,MSFT
// Returns a matrix of Pearson correlations using daily % changes from Yahoo
router.get('/correlation', async (req, res) => {
  try {
    const rawTickers = (req.query.tickers || 'NVDA,AAPL,MSFT,AMZN,GOOGL,TSLA,AMD,META').split(',').map(t => t.trim().toUpperCase()).slice(0, 10);

    // Fetch ~60 days of daily candles for each ticker from Yahoo Finance
    const endTs = Math.floor(Date.now() / 1000);
    const startTs = endTs - 60 * 24 * 3600;

    const priceMap = {};
    await Promise.allSettled(rawTickers.map(async ticker => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&period1=${startTs}&period2=${endTs}`;
        const r = await fetch(url, {
          headers: { 'User-Agent':'Mozilla/5.0','Accept':'application/json','Cookie':'session=1' },
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) return;
        const data = await r.json();
        const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
        if (!closes || closes.length < 5) return;
        // Compute daily % returns
        const returns = [];
        for (let i = 1; i < closes.length; i++) {
          if (closes[i] != null && closes[i-1] != null && closes[i-1] !== 0) {
            returns.push((closes[i] - closes[i-1]) / closes[i-1]);
          }
        }
        if (returns.length >= 5) priceMap[ticker] = returns;
      } catch (_) {}
    }));

    const tickers = Object.keys(priceMap);
    // Build matrix
    const matrix = {};
    for (const a of tickers) {
      matrix[a] = {};
      for (const b of tickers) {
        const minLen = Math.min(priceMap[a].length, priceMap[b].length);
        matrix[a][b] = Math.round(pearson(
          priceMap[a].slice(-minLen),
          priceMap[b].slice(-minLen)
        ) * 100) / 100;
      }
    }

    res.json({ tickers, matrix, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Correlation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/unusual-volume — stocks with volume > 1.5x avg (from DB)
router.get('/unusual-volume', async (req, res) => {
  try {
    const stocks = await Stock.find({
      volume: { $gt: 0 },
      avgVolume: { $gt: 0 }
    }).lean();

    const unusual = stocks
      .map(s => ({
        symbol: s.symbol,
        price: s.price,
        changePercent: s.changePercent,
        volume: s.volume,
        avgVolume: s.avgVolume,
        ratio: s.avgVolume > 0 ? (s.volume / s.avgVolume) : 0,
      }))
      .filter(s => s.ratio >= 1.3)
      .sort((a, b) => b.ratio - a.ratio);

    res.json({ unusual, updatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
