import express from 'express';

const router = express.Router();
let CACHE = { data: null, fetchedAt: 0 };
const TTL = 4 * 60 * 60 * 1000; // 4 hours

async function loadTrades() {
  if (CACHE.data && Date.now() - CACHE.fetchedAt < TTL) return CACHE.data;

  // Quiverquant free API — no key required for basic congressional trading data
  const r = await fetch('https://api.quiverquant.com/beta/live/congresstrading', {
    headers: {
      'User-Agent': 'Torii Investment Platform whesp24@gmail.com',
      'Accept': 'application/json',
    },
  });
  if (!r.ok) throw new Error(`Quiverquant ${r.status}`);
  const raw = await r.json();
  CACHE = { data: raw, fetchedAt: Date.now() };
  return raw;
}

// GET /api/congressional?ticker=&chamber=&days=&party=
router.get('/', async (req, res) => {
  try {
    const { ticker, chamber, days = '90', party } = req.query;
    const raw = await loadTrades();
    const cutoff = new Date(Date.now() - parseInt(days) * 86400000);

    let trades = (Array.isArray(raw) ? raw : []).filter(t => {
      const d = new Date(t.Date || t.TransactionDate || 0);
      return d >= cutoff;
    });

    if (ticker)  trades = trades.filter(t => (t.Ticker || '').toUpperCase() === ticker.toUpperCase());
    if (chamber) trades = trades.filter(t => (t.Chamber || '').toLowerCase().includes(chamber.toLowerCase()));
    if (party)   trades = trades.filter(t => (t.Party || '').toUpperCase() === party.toUpperCase());

    trades.sort((a, b) => new Date(b.Date || 0) - new Date(a.Date || 0));

    const normalised = trades.slice(0, 300).map(t => ({
      name:     t.Representative || t.Name || 'Unknown',
      ticker:   (t.Ticker || '').toUpperCase(),
      chamber:  t.Chamber || 'House',
      party:    t.Party || '',
      type:     t.Transaction || '',
      amount:   t.Range || t.Amount || '',
      date:     t.Date || t.TransactionDate || '',
      state:    t.State || '',
      isBuy:    /purchase|buy/i.test(t.Transaction || ''),
    }));

    res.json({ trades: normalised, count: normalised.length, cached: new Date(CACHE.fetchedAt) });
  } catch (err) {
    res.status(500).json({ error: err.message, trades: [] });
  }
});

export default router;
