import express from 'express';
import Trade from '../models/Trade.js';

const router = express.Router();

// GET all trades with optional filters
router.get('/', async (req, res) => {
  try {
    const { status, ticker } = req.query;
    const query = {};
    if (status) query.status = status;
    if (ticker) query.ticker = ticker.toUpperCase();

    const trades = await Trade.find(query).sort({ date: -1 });
    res.json(trades);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET stats endpoint
router.get('/stats', async (req, res) => {
  try {
    const trades = await Trade.find();

    if (trades.length === 0) {
      return res.json({
        totalTrades: 0,
        winRate: null,
        avgPnl: null,
        totalPnl: null,
        thesisAccuracy: null,
        byTimeframe: {},
        avgConviction: null,
        biggestWin: null,
        biggestLoss: null,
      });
    }

    // Closed trades
    const closedTrades = trades.filter(t => t.status === 'closed' && t.exitPrice);
    const closedWithPnl = closedTrades.map(t => ({
      ...t.toObject(),
      pnl: (t.action === 'buy' || t.action === 'cover' ? 1 : -1) * (t.exitPrice - t.price) * t.quantity,
      pnlPct: (t.action === 'buy' || t.action === 'cover' ? 1 : -1) * (t.exitPrice - t.price) / t.price * 100,
    }));

    // Win rate: closed trades with pnl > 0 / total closed trades
    const winCount = closedWithPnl.filter(t => t.pnl > 0).length;
    const winRate = closedTrades.length > 0 ? (winCount / closedTrades.length) * 100 : null;

    // Average PnL and total PnL
    const totalPnl = closedWithPnl.reduce((sum, t) => sum + t.pnl, 0);
    const avgPnl = closedTrades.length > 0 ? totalPnl / closedTrades.length : null;

    // Thesis accuracy: trades where thesisOutcome === 'confirmed' / total with outcome != 'pending'
    const tradesWithOutcome = trades.filter(t => t.thesisOutcome !== 'pending');
    const confirmedThesis = trades.filter(t => t.thesisOutcome === 'confirmed').length;
    const thesisAccuracy = tradesWithOutcome.length > 0 ? (confirmedThesis / tradesWithOutcome.length) * 100 : null;

    // By timeframe
    const byTimeframe = {};
    ['day', 'swing', 'position', 'long-term'].forEach(tf => {
      const tfTrades = trades.filter(t => t.timeframe === tf);
      const tfClosed = tfTrades.filter(t => t.status === 'closed' && t.exitPrice);
      if (tfTrades.length > 0) {
        const tfPnl = tfClosed
          .map(t => (t.action === 'buy' || t.action === 'cover' ? 1 : -1) * (t.exitPrice - t.price) * t.quantity)
          .reduce((sum, p) => sum + p, 0);
        byTimeframe[tf] = {
          count: tfTrades.length,
          pnl: tfClosed.length > 0 ? tfPnl : 0,
          avgPnl: tfClosed.length > 0 ? tfPnl / tfClosed.length : 0,
        };
      }
    });

    // Average conviction
    const avgConviction = trades.length > 0 ? trades.reduce((sum, t) => sum + (t.conviction || 5), 0) / trades.length : null;

    // Biggest win and loss
    let biggestWin = null;
    let biggestLoss = null;
    if (closedWithPnl.length > 0) {
      biggestWin = Math.max(...closedWithPnl.map(t => t.pnl));
      biggestLoss = Math.min(...closedWithPnl.map(t => t.pnl));
    }

    res.json({
      totalTrades: trades.length,
      winRate: winRate !== null ? parseFloat(winRate.toFixed(2)) : null,
      avgPnl: avgPnl !== null ? parseFloat(avgPnl.toFixed(2)) : null,
      totalPnl: parseFloat(totalPnl.toFixed(2)),
      thesisAccuracy: thesisAccuracy !== null ? parseFloat(thesisAccuracy.toFixed(2)) : null,
      byTimeframe,
      avgConviction: avgConviction !== null ? parseFloat(avgConviction.toFixed(2)) : null,
      biggestWin: biggestWin !== null ? parseFloat(biggestWin.toFixed(2)) : null,
      biggestLoss: biggestLoss !== null ? parseFloat(biggestLoss.toFixed(2)) : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create trade
router.post('/', async (req, res) => {
  try {
    const { ticker, name, action, date, price, quantity, thesis, catalysts, timeframe, conviction, tags } = req.body;

    if (!ticker?.trim()) return res.status(400).json({ error: 'ticker required' });
    if (!action) return res.status(400).json({ error: 'action required' });
    if (!date) return res.status(400).json({ error: 'date required' });
    if (typeof price !== 'number' || price <= 0) return res.status(400).json({ error: 'price must be positive number' });
    if (typeof quantity !== 'number' || quantity <= 0) return res.status(400).json({ error: 'quantity must be positive number' });

    const trade = await Trade.create({
      ticker: ticker.trim().toUpperCase(),
      name: name || '',
      action,
      date,
      price,
      quantity,
      thesis: thesis || '',
      catalysts: catalysts || [],
      timeframe: timeframe || 'position',
      conviction: conviction || 5,
      tags: tags || [],
    });

    res.status(201).json(trade);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update trade
router.put('/:id', async (req, res) => {
  try {
    const { ticker } = req.body;
    if (ticker) req.body.ticker = ticker.toUpperCase();

    const trade = await Trade.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!trade) return res.status(404).json({ error: 'Trade not found' });

    res.json(trade);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE trade
router.delete('/:id', async (req, res) => {
  try {
    const trade = await Trade.findByIdAndDelete(req.params.id);
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    res.json({ message: 'Trade deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
