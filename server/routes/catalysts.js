import express from 'express';
import Catalyst from '../models/Catalyst.js';
import Earnings from '../models/Earnings.js';

const router = express.Router();

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
router.get('/month', async (req, res) => {
  try {
    const year  = parseInt(req.query.year  || new Date().getFullYear());
    const month = parseInt(req.query.month || new Date().getMonth()); // 0-indexed
    const from  = new Date(year, month, 1);
    const to    = new Date(year, month + 1, 0, 23, 59, 59);

    const [catalysts, earnings] = await Promise.all([
      Catalyst.find({ date: { $gte: from, $lte: to } }).sort({ date: 1 }),
      Earnings.find({ reportDate: { $gte: from, $lte: to } }).sort({ reportDate: 1 }).catch(() => []),
    ]);

    // Normalise earnings into same event shape
    const earningEvents = earnings.map(e => ({
      _id: e._id,
      ticker:  e.symbol || e.ticker || '',
      title:   `${e.symbol || e.ticker} Earnings`,
      type:    'earnings',
      date:    e.reportDate,
      impact:  'high',
      source:  'earnings',
    }));

    res.json([
      ...catalysts.map(c => ({ ...c.toObject(), source: 'catalyst' })),
      ...earningEvents,
    ]);
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
