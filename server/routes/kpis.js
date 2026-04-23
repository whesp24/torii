import express from 'express';
import KPI from '../models/KPI.js';

const router = express.Router();

// Get all KPIs
router.get('/', async (req, res) => {
  try {
    const kpis = await KPI.find().sort({ symbol: 1 });
    res.json(kpis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single KPI by symbol
router.get('/:symbol', async (req, res) => {
  try {
    const kpi = await KPI.findOne({ symbol: req.params.symbol.toUpperCase() });

    if (!kpi) {
      return res.status(404).json({ error: 'KPI not found' });
    }

    res.json(kpi);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual KPI update
router.post('/update', async (req, res) => {
  try {
    // This will be called by the cron job, but can also be triggered manually
    res.json({ message: 'KPI update triggered' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
