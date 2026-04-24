import express from 'express';
import { getSports, getOdds } from '../services/oddsService.js';

const router = express.Router();

// GET /sports — list available sports
router.get('/sports', async (req, res) => {
  try {
    const sports = await getSports();
    res.json(sports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /odds/:sport — get odds for a sport with EV enrichment
router.get('/odds/:sport', async (req, res) => {
  try {
    const { sport } = req.params;
    const { markets = 'h2h' } = req.query;
    const odds = await getOdds(sport, markets);
    res.json(odds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
