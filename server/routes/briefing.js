import express from 'express';
import Briefing from '../models/Briefing.js';

const router = express.Router();

// Get latest briefing
router.get('/latest', async (req, res) => {
  try {
    const briefing = await Briefing.findOne().sort({ date: -1 });

    if (!briefing) {
      return res.status(404).json({ error: 'No briefing found' });
    }

    res.json(briefing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get briefing by date
router.get('/date/:date', async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const briefing = await Briefing.findOne({
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    if (!briefing) {
      return res.status(404).json({ error: 'No briefing found for this date' });
    }

    res.json(briefing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get briefing history
router.get('/history/:days', async (req, res) => {
  try {
    const days = parseInt(req.params.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const briefings = await Briefing.find({
      date: { $gte: startDate }
    }).sort({ date: -1 });

    res.json(briefings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
