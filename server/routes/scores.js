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

// POST /api/scores/narrative — generate investment thesis narrative from signal data
// Rules-based engine: no AI key required. Takes signals[], score, ticker → returns narrative text.
router.post('/narrative', (req, res) => {
  const { ticker, score, rating, signals } = req.body;
  if (!ticker || score == null || !Array.isArray(signals)) {
    return res.status(400).json({ error: 'ticker, score, signals[] required' });
  }

  const active  = signals.filter(s => !s.noData && s.delta !== 0);
  const bull    = active.filter(s => s.direction === 'bullish');
  const bear    = active.filter(s => s.direction === 'bearish');

  const get = (label) => active.find(s => s.label && s.label.toLowerCase().includes(label.toLowerCase()));
  const momentum = get('Momentum');
  const analyst  = get('Analyst');
  const short    = get('Short Interest');
  const options  = get('Options Flow');
  const news     = get('News Sentiment');
  const insider  = get('Insider');
  const congress = get('Congressional');
  const catalyst = get('Catalyst');
  const thesis   = get('Investment Thesis');
  const eps      = get('EPS');

  // Build human-readable strings for positives and risks
  function summarize(sig) {
    if (!sig) return null;
    const v = sig.value || '';
    if (sig.label.includes('Momentum'))     return `price momentum is ${v.split('·')[0].trim()}`;
    if (sig.label.includes('Analyst'))      return `analyst target implies ${v.split('upside')[0].trim() + ' upside'}`.replace('  ', ' ');
    if (sig.label.includes('Options'))      return `options flow is bullish (${v.split('·')[0].trim()})`;
    if (sig.label.includes('News'))         return `news sentiment is ${v.split('·')[0].trim().toLowerCase()}`;
    if (sig.label.includes('Insider'))      { const parts = v.split('/'); return `insiders are net ${parseInt(parts[0]) > parseInt(parts[1]) ? 'buyers' : 'sellers'}`; }
    if (sig.label.includes('Congressional')) return `congressional trading favors ${sig.direction === 'bullish' ? 'buying' : 'selling'}`;
    if (sig.label.includes('EPS'))          return `earnings ${v.includes('beat') ? 'beat' : 'missed'} estimates recently (${v.split('avg')[1]?.split('·')[0]?.trim() || ''})`;
    if (sig.label.includes('Short'))        return `short interest is elevated (${v.split('·')[0].trim()})`;
    return sig.label.toLowerCase();
  }

  function summarizeRisk(sig) {
    if (!sig) return null;
    const v = sig.value || '';
    if (sig.label.includes('Short'))    return `high short interest (${v.split('·')[0].trim()}) creates squeeze risk`;
    if (sig.label.includes('Analyst'))  return `analyst consensus is negative`;
    if (sig.label.includes('Momentum')) return `price momentum is declining`;
    if (sig.label.includes('News'))     return `negative news flow`;
    if (sig.label.includes('Options'))  return `put-heavy options flow`;
    if (sig.label.includes('EPS'))      return `recent earnings disappointment`;
    return sig.label.toLowerCase();
  }

  const positives  = bull.map(s => summarize(s)).filter(Boolean);
  const risks      = bear.map(s => summarizeRisk(s)).filter(Boolean);
  const catNote    = catalyst && !catalyst.noData ? catalyst.value + '. ' : '';
  const thesisNote = thesis?.direction === 'bullish' ? 'Investment thesis is valid. ' : '';

  let narrative = '';

  if (score >= 80) {
    const top2 = positives.slice(0, 2).join(' and ');
    const rsk  = risks.length > 0 ? ` Key risk: ${risks[0]}.` : '';
    narrative = `${ticker} shows broad-based conviction across ${bull.length}/${active.length} signals — ${top2 || 'strong across the board'}. ${catNote}${thesisNote}${rsk}`;
  } else if (score >= 65) {
    const top  = positives[0] || 'a constructive technical setup';
    const rest = positives.length > 1 ? `, alongside ${positives.length - 1} other positive signal${positives.length > 2 ? 's' : ''}` : '';
    const rsk  = risks.length > 0 ? ` Watch: ${risks.slice(0, 2).join(' and ')}.` : '';
    narrative = `${ticker} has a favorable risk/reward: ${top}${rest}. ${catNote}${rsk}`;
  } else if (score >= 45) {
    const bullStr = positives.length > 0 ? `Positives: ${positives.slice(0, 2).join(' and ')}` : 'Few clear positives';
    const bearStr = risks.length > 0 ? `Risks: ${risks.slice(0, 2).join(' and ')}` : 'no major red flags';
    narrative = `${ticker} presents a mixed picture. ${bullStr}. ${bearStr}. ${catNote}A clear catalyst is needed for conviction.`;
  } else if (score >= 30) {
    const bearStr = risks.slice(0, 2).join(' and ') || 'weak technical setup';
    const posNote = positives.length > 0 ? ` Potential bright spot: ${positives[0]}.` : '';
    narrative = `Risk-off on ${ticker}: ${bearStr}.${posNote} ${catNote}Would need a material positive catalyst to revisit.`;
  } else {
    const bearStr = risks.slice(0, 3).join(', ') || 'deteriorating fundamentals across the board';
    narrative = `${ticker} faces significant headwinds: ${bearStr}. ${catNote}Avoid until there is a fundamental improvement.`;
  }

  res.json({
    ticker, score, rating,
    narrative:    narrative.replace(/\s{2,}/g, ' ').trim(),
    bullCount:    bull.length,
    bearCount:    bear.length,
    totalActive:  active.length,
  });
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
