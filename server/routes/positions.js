import express from 'express';
import Position from '../models/Position.js';

const router = express.Router();

// GET all positions
router.get('/', async (req, res) => {
  try {
    const positions = await Position.find().sort({ addedAt: 1 });
    res.json(positions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST — add or update a position (upsert by ticker)
router.post('/', async (req, res) => {
  try {
    const { ticker, shares, costBasis } = req.body;
    if (!ticker || shares == null) return res.status(400).json({ error: 'ticker and shares required' });
    const position = await Position.findOneAndUpdate(
      { ticker: ticker.toUpperCase() },
      { ticker: ticker.toUpperCase(), shares, costBasis: costBasis || 0 },
      { upsert: true, new: true }
    );
    res.status(201).json(position);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT — update shares / cost basis for an existing position
router.put('/:ticker', async (req, res) => {
  try {
    const { shares, costBasis } = req.body;
    const position = await Position.findOneAndUpdate(
      { ticker: req.params.ticker.toUpperCase() },
      { shares, costBasis },
      { new: true }
    );
    if (!position) return res.status(404).json({ error: 'Position not found' });
    res.json(position);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE — remove a position
router.delete('/:ticker', async (req, res) => {
  try {
    const position = await Position.findOneAndDelete({ ticker: req.params.ticker.toUpperCase() });
    if (!position) return res.status(404).json({ error: 'Position not found' });
    res.json({ message: 'Deleted', position });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
