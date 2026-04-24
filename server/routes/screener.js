import express from 'express';
import UniversalScore from '../models/UniversalScore.js';
import SavedScreen from '../models/SavedScreen.js';
import Watchlist from '../models/Watchlist.js';
import { runUniverseScoring, isUniverseRunning } from '../services/universeService.js';

const router = express.Router();

// ── GET /api/screener/status ──────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  const total  = await UniversalScore.countDocuments();
  const scored = await UniversalScore.countDocuments({ lastScored: { $exists: true } });
  const lastRun = await UniversalScore.findOne({}, { lastScored: 1 }).sort({ lastScored: -1 }).lean();
  res.json({ total, scored, running: isUniverseRunning(), lastRunAt: lastRun?.lastScored });
});

// ── POST /api/screener/search ─────────────────────────────────────────────────
// Fast query against pre-scored UniversalScore collection
router.post('/search', async (req, res) => {
  const {
    sector, exchange, strategy,
    minScore = 0, maxScore = 100,
    minMarketCap, maxMarketCap,
    minPE, maxPE,
    hasEarnings,
    minRet3mo, maxShortPct,
    signalLabel, signalDir,
    sortBy = 'score', sortDir = 'desc',
    limit = 100, offset = 0,
  } = req.body;

  const query = { lastScored: { $exists: true } };

  if (sector && sector !== 'All') query.sector = sector;
  if (exchange && exchange !== 'All') query.exchange = exchange;
  if (strategy && strategy !== 'all') query.strategy = strategy;
  if (minScore > 0 || maxScore < 100) query.score = { $gte: minScore, $lte: maxScore };
  if (minMarketCap) query.marketCap = { ...query.marketCap, $gte: minMarketCap };
  if (maxMarketCap) query.marketCap = { ...query.marketCap, $lte: maxMarketCap };
  if (minPE != null) query.peRatio = { ...query.peRatio, $gte: minPE, $gt: 0 };
  if (maxPE != null) query.peRatio = { ...query.peRatio, $lte: maxPE };
  if (hasEarnings) query.daysToEarnings = { $gte: 0, $lte: 60 };
  if (minRet3mo != null) query.ret3mo = { $gte: minRet3mo };
  if (maxShortPct != null) query.shortPct = { $lte: maxShortPct };

  // Signal direction filter (post-filter after query for now)
  const sortField = { score:'score', marketCap:'marketCap', ret3mo:'ret3mo', peRatio:'peRatio' }[sortBy] || 'score';
  const sortOrder = sortDir === 'asc' ? 1 : -1;

  let results = await UniversalScore.find(query, {
    symbol:1, exchange:1, name:1, sector:1, industry:1, marketCap:1,
    score:1, rating:1, strategy:1, currentPrice:1, changePercent:1,
    peRatio:1, fwdPE:1, shortPct:1, rsi:1, ret3mo:1, daysToEarnings:1,
    revenueGrowth:1, signals:1, inWatchlist:1, lastScored:1,
  })
  .sort({ [sortField]: sortOrder })
  .lean();

  // Post-filter by signal direction (MongoDB can't easily index into array elements by label)
  if (signalLabel && signalDir && signalDir !== 'all') {
    results = results.filter(r => {
      const sig = (r.signals || []).find(s => s.label === signalLabel);
      return sig && sig.direction === signalDir;
    });
  }

  const total = results.length;
  const paginated = results.slice(offset, offset + limit);

  res.json({ results: paginated, total, hasMore: total > offset + limit });
});

// ── GET /api/screener/metadata ────────────────────────────────────────────────
// Returns distinct sectors, exchanges, signal labels for filter dropdowns
router.get('/metadata', async (req, res) => {
  const [sectors, exchanges] = await Promise.all([
    UniversalScore.distinct('sector', { sector: { $ne: null } }),
    UniversalScore.distinct('exchange', { exchange: { $ne: null } }),
  ]);
  const sampleSignals = await UniversalScore.findOne({ signals: { $exists: true, $ne: [] } }, { signals: 1 }).lean();
  const signalLabels = (sampleSignals?.signals || []).map(s => s.label);
  res.json({ sectors: sectors.sort(), exchanges: exchanges.sort(), signalLabels });
});

// ── GET /api/screener/screens ─────────────────────────────────────────────────
router.get('/screens', async (req, res) => {
  const screens = await SavedScreen.find().sort({ updatedAt: -1 }).lean();
  res.json(screens);
});

// ── POST /api/screener/screens ────────────────────────────────────────────────
router.post('/screens', async (req, res) => {
  const { name, description, filters, sortBy, sortDir } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const screen = await SavedScreen.create({ name, description, filters, sortBy, sortDir });
  res.json(screen);
});

// ── PATCH /api/screener/screens/:id ──────────────────────────────────────────
router.patch('/screens/:id', async (req, res) => {
  const { name, description, filters, sortBy, sortDir, lastRunAt, lastResultCount } = req.body;
  const screen = await SavedScreen.findByIdAndUpdate(
    req.params.id,
    { name, description, filters, sortBy, sortDir, lastRunAt, lastResultCount },
    { new: true }
  );
  res.json(screen);
});

// ── DELETE /api/screener/screens/:id ─────────────────────────────────────────
router.delete('/screens/:id', async (req, res) => {
  await SavedScreen.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ── POST /api/screener/watchlist ──────────────────────────────────────────────
// Add a ticker from the screener to the watchlist
router.post('/watchlist', async (req, res) => {
  const { symbol } = req.body;
  if (!symbol) return res.status(400).json({ error: 'Symbol required' });
  const sym = symbol.toUpperCase();
  const existing = await Watchlist.findOne({ symbol: sym });
  if (existing) return res.json({ ok: true, existing: true });
  const rec = await UniversalScore.findOne({ symbol: sym }, { name: 1, sector: 1 }).lean();
  await Watchlist.create({ symbol: sym, name: rec?.name || sym, sector: rec?.sector || '' });
  await UniversalScore.updateOne({ symbol: sym }, { $set: { inWatchlist: true } });
  res.json({ ok: true });
});

// ── POST /api/screener/run ────────────────────────────────────────────────────
// SSE stream for nightly batch scoring (triggered manually from UI)
router.post('/run', async (req, res) => {
  if (isUniverseRunning()) {
    return res.status(409).json({ error: 'Scoring already in progress' });
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  send({ type: 'start' });

  // Manual runs: fastMode=true (skip chart + EDGAR), cap at 200 tickers
  // Watchlist tickers are always scored first regardless of limit
  const fastMode = req.body?.fastMode !== false; // default true for UI runs
  const limit    = req.body?.limit    ?? 200;

  runUniverseScoring({
    fastMode,
    limit,
    onProgress: ({ done, total, symbol, score }) => {
      send({ type: 'progress', done, total, symbol, score });
    }
  }).then(({ scored, total }) => {
    send({ type: 'complete', scored, total, lastRunAt: new Date() });
    res.end();
  }).catch(err => {
    send({ type: 'error', message: err.message });
    res.end();
  });
});

export default router;
