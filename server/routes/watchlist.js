import express from 'express';
import {
  getAllWatchlist,
  getWatchlistByCategory,
  getWatchlistItem,
  addToWatchlist,
  updateWatchlistItem,
  removeFromWatchlist,
  updateWatchlistPrice,
  getWatchlistWithAlerts
} from '../services/watchlistService.js';

const router = express.Router();

// Get all watchlist items
router.get('/', async (req, res) => {
  try {
    const items = await getAllWatchlist();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get watchlist by category
router.get('/category/:category', async (req, res) => {
  try {
    const items = await getWatchlistByCategory(req.params.category);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get items with active alerts
router.get('/alerts/active', async (req, res) => {
  try {
    const items = await getWatchlistWithAlerts();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single watchlist item
router.get('/:symbol', async (req, res) => {
  try {
    const item = await getWatchlistItem(req.params.symbol);

    if (!item) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add to watchlist
router.post('/', async (req, res) => {
  try {
    const { symbol, name, category, notes, alertPrice, alertType } = req.body;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const item = await addToWatchlist({
      symbol,
      name: name || '',
      category: category || 'stock',
      notes: notes || '',
      alertPrice: alertPrice || null,
      alertType: alertType || 'none'
    });

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update watchlist item
router.put('/:symbol', async (req, res) => {
  try {
    const item = await updateWatchlistItem(req.params.symbol, req.body);

    if (!item) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update price data
router.patch('/:symbol/price', async (req, res) => {
  try {
    const { price, change, changePercent } = req.body;

    const item = await updateWatchlistPrice(req.params.symbol, {
      price,
      change,
      changePercent
    });

    if (!item) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove from watchlist
router.delete('/:symbol', async (req, res) => {
  try {
    const item = await removeFromWatchlist(req.params.symbol);

    if (!item) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    res.json({ message: 'Removed from watchlist', item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
