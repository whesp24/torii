import express from 'express';
import Briefing from '../models/Briefing.js';
import { generateAndSaveBriefing } from '../services/briefingService.js';

const router = express.Router();

// GET latest briefing
router.get('/latest', async (req, res) => {
  try {
    const briefing = await Briefing.findOne().sort({ date: -1 });
    if (!briefing) return res.status(404).json({ error: 'No briefing found' });
    res.json(briefing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST — generate today's briefing (force regenerate if exists)
router.post('/generate', async (req, res) => {
  try {
    const { force = false } = req.body;
    const briefing = await generateAndSaveBriefing({ force });
    res.json(briefing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
