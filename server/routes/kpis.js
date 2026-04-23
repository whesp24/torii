import express from 'express';
import KPI from '../models/KPI.js';
import { updateAllKPIs } from '../services/kpiService.js';

const router = express.Router();

const STALE_MS = 60 * 60 * 1000; // 1 hour — trigger background refresh if data this old

// Get all KPIs — triggers background refresh if data is stale
router.get('/', async (req, res) => {
  try {
    const kpis = await KPI.find().sort({ symbol: 1 });
    res.json(kpis);

    // Background refresh if any KPI is stale (don't block the response)
    if (kpis.length === 0 || kpis.some(k => !k.lastUpdated || Date.now() - new Date(k.lastUpdated) > STALE_MS)) {
      updateAllKPIs({ force: false }).catch(err => console.warn('Background KPI refresh error:', err.message));
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single KPI by symbol
router.get('/:symbol', async (req, res) => {
  try {
    const kpi = await KPI.findOne({ symbol: req.params.symbol.toUpperCase() });
    if (!kpi) return res.status(404).json({ error: 'KPI not found' });
    res.json(kpi);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Force-refresh all KPIs
router.post('/update', async (req, res) => {
  try {
    const { force = true } = req.body;
    // Run async, return immediately
    updateAllKPIs({ force }).catch(err => console.warn('KPI update error:', err.message));
    res.json({ message: 'KPI refresh triggered' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
