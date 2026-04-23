import express from 'express';
import Note from '../models/Note.js';

const router = express.Router();

// GET notes (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { ticker, tag, search } = req.query;
    const query = {};
    if (ticker) query.ticker = ticker.toUpperCase();
    if (tag)    query.tags   = tag;
    if (search) query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { body:  { $regex: search, $options: 'i' } },
      { tags:  { $regex: search, $options: 'i' } },
    ];
    const notes = await Note.find(query).sort({ pinned: -1, updatedAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create note
router.post('/', async (req, res) => {
  try {
    const { title, body, ticker, contactId, tags } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title required' });
    const note = await Note.create({
      title: title.trim(),
      body:  body || '',
      ticker: ticker?.toUpperCase() || undefined,
      contactId,
      tags: tags || [],
    });
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update note
router.put('/:id', async (req, res) => {
  try {
    if (req.body.ticker) req.body.ticker = req.body.ticker.toUpperCase();
    const note = await Note.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE note
router.delete('/:id', async (req, res) => {
  try {
    await Note.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
