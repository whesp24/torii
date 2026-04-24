import express from 'express';
import SportsBet from '../models/SportsBet.js';

const router = express.Router();

// GET / — list bets with optional filters
router.get('/', async (req, res) => {
  try {
    const { status, sport, limit = 50 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (sport) query.sport = sport;

    const bets = await SportsBet.find(query)
      .sort({ eventDate: -1 })
      .limit(parseInt(limit))
      .lean();
    res.json(bets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /stats — betting performance stats
router.get('/stats', async (req, res) => {
  try {
    const all = await SportsBet.find({ status: { $in: ['won', 'lost', 'push'] } }).lean();
    const pending = await SportsBet.countDocuments({ status: 'pending' });

    const totalBets = all.length;
    const wins = all.filter(b => b.status === 'won').length;
    const losses = all.filter(b => b.status === 'lost').length;
    const pushes = all.filter(b => b.status === 'push').length;
    const winRate = totalBets > 0 ? wins / (wins + losses) : 0;

    const totalStaked = all.reduce((sum, b) => sum + (b.stake || 0), 0);
    const totalResult = all.reduce((sum, b) => sum + (b.result || 0), 0);
    const roi = totalStaked > 0 ? (totalResult / totalStaked) * 100 : 0;

    // Average EV on bets placed
    const evBets = all.filter(b => b.ev != null);
    const avgEV = evBets.length > 0 ? evBets.reduce((s, b) => s + b.ev, 0) / evBets.length : 0;

    // By sport breakdown
    const bySport = {};
    for (const b of all) {
      if (!bySport[b.sport]) bySport[b.sport] = { bets: 0, wins: 0, staked: 0, result: 0 };
      bySport[b.sport].bets++;
      if (b.status === 'won') bySport[b.sport].wins++;
      bySport[b.sport].staked += b.stake || 0;
      bySport[b.sport].result += b.result || 0;
    }

    // By bet type breakdown
    const byType = {};
    for (const b of all) {
      if (!byType[b.betType]) byType[b.betType] = { bets: 0, wins: 0, staked: 0, result: 0 };
      byType[b.betType].bets++;
      if (b.status === 'won') byType[b.betType].wins++;
      byType[b.betType].staked += b.stake || 0;
      byType[b.betType].result += b.result || 0;
    }

    // Streak tracking
    const sorted = all.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
    let currentStreak = 0, streakType = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].status === 'push') continue;
      if (!streakType) {
        streakType = sorted[i].status;
        currentStreak = 1;
      } else if (sorted[i].status === streakType) {
        currentStreak++;
      } else {
        break;
      }
    }

    res.json({
      totalBets, wins, losses, pushes, pending,
      winRate: parseFloat((winRate * 100).toFixed(1)),
      totalStaked: parseFloat(totalStaked.toFixed(2)),
      totalResult: parseFloat(totalResult.toFixed(2)),
      roi: parseFloat(roi.toFixed(2)),
      avgEV: parseFloat(avgEV.toFixed(2)),
      currentStreak: { count: currentStreak, type: streakType },
      bySport, byType,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / — log a new bet
router.post('/', async (req, res) => {
  try {
    const bet = await SportsBet.create(req.body);
    res.json(bet);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /:id/settle — settle a bet (won, lost, push, void)
router.patch('/:id/settle', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['won', 'lost', 'push', 'void'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const bet = await SportsBet.findById(req.params.id);
    if (!bet) return res.status(404).json({ error: 'Bet not found' });

    bet.status = status;
    bet.settledAt = new Date();

    if (status === 'won') {
      bet.result = bet.toWin;
    } else if (status === 'lost') {
      bet.result = -bet.stake;
    } else {
      bet.result = 0; // push or void
    }

    await bet.save();
    res.json(bet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id — update a bet
router.put('/:id', async (req, res) => {
  try {
    const bet = await SportsBet.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!bet) return res.status(404).json({ error: 'Bet not found' });
    res.json(bet);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    await SportsBet.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
