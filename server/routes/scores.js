import express from 'express';
import Score from '../models/Score.js';
import { scoreAllWatchlist, scoreTicker } from '../services/scoringService.js';

const router = express.Router();

// Track running state so we don't double-run
let running = false;
let lastRunAt = null;

// GET /api/scores — return all cached scores with optional filters
// ?strategy=long|short|options|macro|neutral
// ?minScore=70
// ?sort=score (default) | scoredAt | symbol
router.get('/', async (req, res) => {
  try {
    const { strategy, minScore, sort = 'score' } = req.query;

    const query = {};
    if (strategy && strategy !== 'all') query.strategy = strategy;
    if (minScore) query.score = { $gte: parseInt(minScore) };

    const sortField = sort === 'scoredAt' ? { scoredAt: -1 } : sort === 'symbol' ? { symbol: 1 } : { score: -1 };

    const scores = await Score.find(query).sort(sortField).lean();
    res.json({
      scores,
      total: scores.length,
      lastRunAt,
      running,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scores/status — quick status check
router.get('/status', (req, res) => {
  res.json({ running, lastRunAt });
});

// GET /api/scores/:symbol — get cached score for one ticker
router.get('/:symbol', async (req, res) => {
  try {
    const sym = req.params.symbol.toUpperCase();
    const score = await Score.findOne({ symbol: sym }).lean();
    if (!score) return res.status(404).json({ error: 'Not scored yet' });
    res.json(score);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scores/run — trigger a full batch scoring run (SSE stream for progress)
router.post('/run', async (req, res) => {
  if (running) {
    return res.status(409).json({ error: 'Scoring already in progress', running: true });
  }

  // Use Server-Sent Events to stream progress
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  running = true;
  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent({ type: 'start', message: 'Scoring all watchlist tickers…' });

    const result = await scoreAllWatchlist((progress) => {
      sendEvent({ type: 'progress', ...progress });
    });

    lastRunAt = new Date();
    sendEvent({ type: 'complete', ...result, lastRunAt });
  } catch (err) {
    sendEvent({ type: 'error', message: err.message });
  } finally {
    running = false;
    res.end();
  }
});

// POST /api/scores/single — score a single ticker on demand and cache it
router.post('/single', async (req, res) => {
  const { symbol } = req.body;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  try {
    const data = await scoreTicker(symbol.toUpperCase());
    const saved = await Score.findOneAndUpdate(
      { symbol: data.symbol },
      { $set: data },
      { upsert: true, new: true }
    );
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
