import express from 'express';
import yahooFinance from 'yahoo-finance2';

const router = express.Router();

function norm(o) {
  return {
    strike:  o.strike        || 0,
    expiry:  o.expiration ? new Date(o.expiration * 1000).toISOString().slice(0, 10) : (o.contractSymbol?.match(/\d{6}/)?.[0] || ''),
    last:    o.lastPrice     || 0,
    bid:     o.bid           || 0,
    ask:     o.ask           || 0,
    volume:  o.volume        || 0,
    oi:      o.openInterest  || 0,
    iv:      o.impliedVolatility ? parseFloat((o.impliedVolatility * 100).toFixed(1)) : null,
    itm:     o.inTheMoney    || false,
    change:  o.change        || 0,
    pctChg:  o.percentChange || 0,
  };
}

// GET /api/options/:ticker
// Uses yahoo-finance2 package to avoid 429s from datacenter IPs
router.get('/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();

    // yahoo-finance2 .options() handles cookie/session internally
    const result = await yahooFinance.options(ticker, {}, { validateResult: false });

    if (!result || !result.options || result.options.length === 0) {
      return res.json({ ticker, calls: [], puts: [], unusual: [], summary: null, putCallRatio: null });
    }

    const optionSet = result.options[0] || {};
    const allCalls  = (optionSet.calls || []).map(o => norm(o));
    const allPuts   = (optionSet.puts  || []).map(o => norm(o));

    const totalCallVol = allCalls.reduce((s, o) => s + o.volume, 0);
    const totalPutVol  = allPuts.reduce((s, o)  => s + o.volume, 0);
    const pcRatio = totalCallVol > 0 ? parseFloat((totalPutVol / totalCallVol).toFixed(3)) : null;

    // Unusual activity: high volume relative to open interest (fresh positioning)
    const unusual = [
      ...allCalls.filter(o => o.volume >= 200 && (o.oi === 0 || o.volume > o.oi * 1.5)).map(o => ({ ...o, side: 'CALL' })),
      ...allPuts.filter(o  => o.volume >= 200 && (o.oi === 0 || o.volume > o.oi * 1.5)).map(o => ({ ...o, side: 'PUT' })),
    ].sort((a, b) => b.volume - a.volume).slice(0, 20);

    // Expiry date from the options set
    const expiryTs = optionSet.expirationDate;
    const expiry = expiryTs ? new Date(expiryTs * 1000).toISOString().slice(0, 10) : null;

    // Quote info from result
    const quote = result.quote || {};

    res.json({
      ticker,
      price:        quote.regularMarketPrice ?? null,
      expiry,
      putCallRatio: pcRatio,
      totalCallVol,
      totalPutVol,
      totalContracts: totalCallVol + totalPutVol,
      sentiment: pcRatio === null ? 'neutral' : pcRatio < 0.7 ? 'bullish' : pcRatio > 1.3 ? 'bearish' : 'neutral',
      calls:    allCalls.filter(o => o.volume > 0).sort((a, b) => b.volume - a.volume).slice(0, 15),
      puts:     allPuts.filter(o  => o.volume > 0).sort((a, b) => b.volume - a.volume).slice(0, 15),
      unusual,
      expirationDates: (result.expirationDates || []).slice(0, 8).map(ts =>
        new Date(ts * 1000).toISOString().slice(0, 10)
      ),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
