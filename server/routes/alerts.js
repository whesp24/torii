import express from 'express';
import {
  getAllAlerts,
  getActiveAlerts,
  getAlertsBySymbol,
  createAlert,
  updateAlert,
  deleteAlert,
  toggleAlert,
  checkAllAlerts
} from '../services/alertService.js';

const router = express.Router();

// Get all alerts
router.get('/', async (req, res) => {
  try {
    const alerts = await getAllAlerts();
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active alerts only
router.get('/active', async (req, res) => {
  try {
    const alerts = await getActiveAlerts();
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get alerts by symbol
router.get('/symbol/:symbol', async (req, res) => {
  try {
    const alerts = await getAlertsBySymbol(req.params.symbol);
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create alert
router.post('/', async (req, res) => {
  try {
    const { symbol, alertType, targetPrice, changePercent } = req.body;

    if (!symbol || !alertType) {
      return res.status(400).json({ error: 'Symbol and alertType are required' });
    }

    if (alertType === 'above' || alertType === 'below') {
      if (!targetPrice) {
        return res.status(400).json({ error: 'targetPrice required for price alerts' });
      }
    }

    const alert = await createAlert({
      symbol,
      alertType,
      targetPrice: targetPrice || null,
      changePercent: changePercent || null
    });

    res.status(201).json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update alert
router.put('/:id', async (req, res) => {
  try {
    const alert = await updateAlert(req.params.id, req.body);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle alert enabled/disabled
router.patch('/:id/toggle', async (req, res) => {
  try {
    const alert = await toggleAlert(req.params.id);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check all alerts against current prices
router.post('/check', async (req, res) => {
  try {
    const triggered = await checkAllAlerts();
    res.json({ message: 'Alerts checked', triggered: triggered.length, alerts: triggered });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete alert
router.delete('/:id', async (req, res) => {
  try {
    const alert = await deleteAlert(req.params.id);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ message: 'Alert deleted', alert });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
