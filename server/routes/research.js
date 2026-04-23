import express from 'express';
import Research from '../models/Research.js';

const router = express.Router();

// GET /api/research — list with optional filters
router.get('/', async (req, res) => {
  try {
    const { type, ticker, tag, q } = req.query;
    const query = {};
    if (type)   query.type   = type;
    if (ticker) query.tickers = ticker.toUpperCase();
    if (tag)    query.tags   = tag;
    if (q)      query.$text  = { $search: q };

    const items = await Research.find(query)
      .sort({ pinned: -1, updatedAt: -1 })
      .limit(100);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/research — create
router.post('/', async (req, res) => {
  try {
    const { title, content, type, tags, tickers, dealIds, conviction, source, pinned } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title required' });
    const item = await Research.create({
      title: title.trim(), content: content || '',
      type: type || 'note',
      tags: (tags || []).map(t => t.toLowerCase().trim()),
      tickers: (tickers || []).map(t => t.toUpperCase().trim()),
      dealIds: dealIds || [],
      conviction: conviction || 5,
      source: source || '',
      pinned: pinned || false,
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/research/:id — update
router.put('/:id', async (req, res) => {
  try {
    if (req.body.tags)    req.body.tags    = req.body.tags.map(t => t.toLowerCase().trim());
    if (req.body.tickers) req.body.tickers = req.body.tickers.map(t => t.toUpperCase().trim());
    const item = await Research.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/research/:id
router.delete('/:id', async (req, res) => {
  try {
    const item = await Research.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
