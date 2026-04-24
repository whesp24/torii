import express from 'express';

const router = express.Router();

function norm(o) {
  return {
    strike:       o.strike || 0,
    expiry:       o.expiration ? new Date(o.expiration * 1000).toISOString().slice(0, 10) : '',
    last:         o.lastPrice || 0,
    bid:          o.bid || 0,
    ask:          o.ask || 0,
    volume:       o.volume || 0,
    oi:           o.openInterest || 0,
    iv:           o.impliedVolatility ? parseFloat((o.impliedVolatility * 100).toFixed(1)) : null,
    itm:          o.inTheMoney || false,
    change:       o.change || 0,
    pctChg:       o.percentChange || 0,
  };
}

// GET /api/options/:ticker
router.get('/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const url = `https://query1.finance.yahoo.com/v7/finance/options/${ticker}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    });
    if (!r.ok) throw new Error(`Yahoo options ${r.status}`);
    const data = await r.json();
    const result  = data.optionChain?.result?.[0];
    if (!result)  return res.json({ ticker, calls: [], puts: [], unusual: [], summary: null });

    const quote   = result.quote || {};
    const options = result.options?.[0] || {};
    const allCalls = (options.calls || []).map(o => norm(o));
    const allPuts  = (options.puts  || []).map(o => norm(o));

    const totalCallVol = allCalls.reduce((s, o) => s + o.volume, 0);
    const totalPutVol  = allPuts.reduce((s, o) => s + o.volume, 0);
    const pcRatio      = totalCallVol > 0 ? parseFloat((totalPutVol / totalCallVol).toFixed(3)) : null;

    // Unusual: volume > 500 AND volume/OI > 2 (or no OI — fresh opening)
    const unusual = [
      ...allCalls.filter(o => o.volume >= 500 && (o.oi === 0 || o.volume > o.oi * 2)).map(o => ({ ...o, side: 'CALL' })),
      ...allPuts.filter(o => o.volume  >= 500 && (o.oi === 0 || o.volume > o.oi * 2)).map(o => ({ ...o, side: 'PUT' })),
    ].sort((a, b) => b.volume - a.volume).slice(0, 20);

    res.json({
      ticker,
      price:          quote.regularMarketPrice ?? null,
      expiry:         options.expirationDate ? new Date(options.expirationDate * 1000).toISOString().slice(0, 10) : null,
      putCallRatio:   pcRatio,
      totalCallVol,
      totalPutVol,
      sentiment:      pcRatio === null ? 'neutral' : pcRatio < 0.7 ? 'bullish' : pcRatio > 1.2 ? 'bearish' : 'neutral',
      calls:          allCalls.filter(o => o.volume > 0).sort((a, b) => b.volume - a.volume).slice(0, 15),
      puts:           allPuts.filter(o => o.volume > 0).sort((a, b) => b.volume - a.volume).slice(0, 15),
      unusual,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
