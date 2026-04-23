import express from 'express';

const router = express.Router();

// Cache for 1 hour
let _cache = null;
let _cacheTime = 0;

const WATCH_TICKERS = [
  'NVDA','GOOGL','AAPL','MSFT','AMD','MUFG','ONDS','MMS','QXO','TPL','CRCL','VOO','VRT',
  'NFLX','META','AMZN','TSLA','UBER','PLTR','SOFI','SHOP','BABA','TSM','ASML',
];

// GET /api/earnings/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/calendar', async (req, res) => {
  try {
    const age = Date.now() - _cacheTime;
    if (_cache && age < 60 * 60 * 1000) return res.json(_cache);

    const KEY = process.env.FINNHUB_API_KEY;
    if (!KEY) return res.json({ earningsCalendar: [] });

    const now = new Date();
    const from = req.query.from || now.toISOString().split('T')[0];
    const toDate = req.query.to || new Date(now.getTime() + 30 * 86_400_000).toISOString().split('T')[0];

    const r = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${toDate}&token=${KEY}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return res.json({ earningsCalendar: [] });

    const data = await r.json();
    // Filter to watchlist tickers only
    const filtered = (data.earningsCalendar || []).filter(e =>
      WATCH_TICKERS.includes(e.symbol)
    );

    const result = { earningsCalendar: filtered, updatedAt: new Date().toISOString() };
    _cache = result;
    _cacheTime = Date.now();
    res.json(result);
  } catch (err) {
    console.error('Earnings calendar error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/earnings/watchlist — return tickers we watch
router.get('/watchlist', (req, res) => {
  res.json({ tickers: WATCH_TICKERS });
});

export default router;
