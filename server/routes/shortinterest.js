import express from 'express';

const router = express.Router();
const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';

// GET /api/short/:ticker
router.get('/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    let metrics = {};

    if (FINNHUB_KEY) {
      try {
        const r = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${FINNHUB_KEY}`);
        if (r.ok) metrics = (await r.json()).metric || {};
      } catch (_) {}
    }

    // FINRA daily short volume (free, no key)
    let finra = null;
    try {
      // Try today and up to 5 prior business days to find a valid file
      for (let i = 0; i <= 5; i++) {
        const d = new Date(Date.now() - i * 86400000);
        if (d.getDay() === 0 || d.getDay() === 6) continue;   // skip weekends
        const ds = d.toISOString().slice(0, 10).replace(/-/g, '');
        const r2 = await fetch(`https://cdn.finra.org/equity/regsho/daily/CNMSshvol${ds}.txt`, {
          headers: { 'User-Agent': 'Torii Investment Platform whesp24@gmail.com' },
        });
        if (!r2.ok) continue;
        const txt = await r2.text();
        const lines = txt.split('\n');
        const header = (lines[0] || '').split('|');
        const line = lines.find(l => l.startsWith(ticker + '|'));
        if (line) {
          const p = line.split('|');
          const shortVol = parseInt(p[header.indexOf('ShortVolume')] || '0');
          const totalVol = parseInt(p[header.indexOf('TotalVolume')] || '0');
          finra = {
            date:       d.toISOString().slice(0, 10),
            shortVol,
            totalVol,
            shortPct:   totalVol > 0 ? parseFloat((shortVol / totalVol * 100).toFixed(1)) : null,
          };
          break;
        }
      }
    } catch (_) {}

    res.json({
      ticker,
      shortInterestPct:   metrics.shortInterestPercentage ?? null,
      shortInterestRatio: metrics.shortInterestRatio ?? null,  // days to cover
      shortInterest:      metrics.shortInterest ?? null,
      shareFloat:         metrics.shareFloat ?? null,
      beta:               metrics.beta ?? null,
      high52w:            metrics['52WeekHigh'] ?? null,
      low52w:             metrics['52WeekLow']  ?? null,
      peRatio:            metrics.peInclExtraTTM ?? null,
      evEbitda:           metrics.evEbitdaTTM ?? null,
      finra,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
