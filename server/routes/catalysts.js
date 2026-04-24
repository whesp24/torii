import express from 'express';
import Catalyst from '../models/Catalyst.js';

const router = express.Router();

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';
const WATCH_TICKERS = [
  'NVDA','GOOGL','AAPL','MSFT','AMD','MUFG','ONDS','MMS','QXO','TPL','CRCL','VOO','VRT',
  'NFLX','META','AMZN','TSLA','UBER','PLTR','SOFI','SHOP','BABA','TSM','ASML',
];

// GET /api/catalysts?from=&to=&ticker=&type=
router.get('/', async (req, res) => {
  try {
    const { from, to, ticker, type } = req.query;
    const query = {};
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from);
      if (to)   query.date.$lte = new Date(to);
    }
    if (ticker) query.ticker = ticker.toUpperCase();
    if (type)   query.type   = type;
    const items = await Catalyst.find(query).sort({ date: 1 }).limit(500);
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/catalysts/month?year=&month= — all events for a calendar month
// Merges: custom catalysts + Finnhub earnings for watchlist tickers
router.get('/month', async (req, res) => {
  try {
    const year  = parseInt(req.query.year  || new Date().getFullYear());
    const month = parseInt(req.query.month || new Date().getMonth()); // 0-indexed
    const from  = new Date(year, month, 1);
    const to    = new Date(year, month + 1, 0, 23, 59, 59);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr   = to.toISOString().slice(0, 10);

    // Fetch custom catalysts from DB
    const catalysts = await Catalyst.find({ date: { $gte: from, $lte: to } }).sort({ date: 1 });

    // Fetch earnings from Finnhub for watchlist tickers (best-effort)
    let earningEvents = [];
    if (FINNHUB_KEY) {
      try {
        const r = await fetch(
          `https://finnhub.io/api/v1/calendar/earnings?from=${fromStr}&to=${toStr}&token=${FINNHUB_KEY}`
        );
        if (r.ok) {
          const data = await r.json();
          const calItems = data.earningsCalendar || [];
          // Filter to watchlist tickers only to avoid noise
          earningEvents = calItems
            .filter(e => WATCH_TICKERS.includes((e.symbol || '').toUpperCase()))
            .map(e => ({
              _id:    `earn-${e.symbol}-${e.date}`,
              ticker: e.symbol,
              title:  `${e.symbol} Earnings`,
              type:   'earnings',
              date:   new Date(e.date),
              impact: 'high',
              source: 'earnings',
              epsEstimate: e.epsEstimate,
              revenueEstimate: e.revenueEstimate,
            }));
        }
      } catch (_) { /* best-effort */ }
    }

    res.json([
      ...catalysts.map(c => ({ ...c.toObject(), source: 'catalyst' })),
      ...earningEvents,
    ].sort((a, b) => new Date(a.date) - new Date(b.date)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/catalysts
router.post('/', async (req, res) => {
  try {
    const item = await Catalyst.create(req.body);
    res.status(201).json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/catalysts/:id
router.put('/:id', async (req, res) => {
  try {
    const item = await Catalyst.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/catalysts/:id
router.delete('/:id', async (req, res) => {
  try {
    await Catalyst.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
