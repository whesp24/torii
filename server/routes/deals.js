import express from 'express';
import Deal from '../models/Deal.js';

const router = express.Router();

// GET all deals
router.get('/', async (req, res) => {
  try {
    const { stage } = req.query;
    const query = stage ? { stage } : {};
    const deals = await Deal.find(query).sort({ updatedAt: -1 });
    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create deal
router.post('/', async (req, res) => {
  try {
    const { company, ticker, stage, thesis, targetPrice, catalysts, risks, notes, priority } = req.body;
    if (!company?.trim()) return res.status(400).json({ error: 'company required' });
    const deal = await Deal.create({
      company: company.trim(),
      ticker:  ticker?.toUpperCase() || undefined,
      stage:   stage || 'watching',
      thesis, targetPrice, catalysts, risks, notes,
      priority: priority || 'medium',
    });
    res.status(201).json(deal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update deal (including stage move)
router.put('/:id', async (req, res) => {
  try {
    if (req.body.ticker) req.body.ticker = req.body.ticker.toUpperCase();
    const deal = await Deal.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    res.json(deal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE deal
router.delete('/:id', async (req, res) => {
  try {
    await Deal.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
