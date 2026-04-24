/**
 * Backtest Service
 *
 * Fills in forward returns on ScoreSnapshot documents.
 * Called periodically (or on demand) to look up current/historical prices
 * and compute how well the score predicted subsequent performance.
 *
 * Academic framing:
 * - Jegadeesh & Titman (1993): buy top-decile momentum, short bottom-decile → 12.01% annual alpha
 * - Asness, Moskowitz, Pedersen (2013): value + momentum combo > either alone
 * - We score on many factors; backtest validates which factor combination had best forward prediction
 */

import ScoreSnapshot from '../models/ScoreSnapshot.js';

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://finance.yahoo.com/',
};

async function fetchCurrentPrice(symbol) {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    const r = await fetch(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const data = await r.json();
    const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
    const valid = closes.filter(c => c != null && c > 0);
    return valid.length > 0 ? valid[valid.length - 1] : null;
  } catch (_) { return null; }
}

/**
 * Fill forward returns for snapshots where enough time has passed.
 * 7d snapshots older than 7 days, 30d snapshots older than 30 days, etc.
 */
export async function fillForwardReturns() {
  const now = Date.now();

  // Find snapshots needing forward return fills
  const toFill = await ScoreSnapshot.find({
    $or: [
      { filled7d:   false, scoredAt: { $lte: new Date(now - 7   * 86400000) } },
      { filled30d:  false, scoredAt: { $lte: new Date(now - 30  * 86400000) } },
      { filled90d:  false, scoredAt: { $lte: new Date(now - 90  * 86400000) } },
      { filled180d: false, scoredAt: { $lte: new Date(now - 180 * 86400000) } },
    ],
    priceAtScore: { $ne: null, $gt: 0 },
  }).limit(100);

  if (toFill.length === 0) return { updated: 0 };

  // Group by symbol to batch price fetches
  const symbols = [...new Set(toFill.map(s => s.symbol))];
  const prices = {};
  for (const sym of symbols) {
    prices[sym] = await fetchCurrentPrice(sym);
    await new Promise(r => setTimeout(r, 200)); // rate limit
  }

  let updated = 0;
  for (const snap of toFill) {
    const currentPrice = prices[snap.symbol];
    if (!currentPrice || !snap.priceAtScore) continue;

    const updates = {};
    const daysSinceScore = (now - snap.scoredAt.getTime()) / 86400000;

    if (!snap.filled7d && daysSinceScore >= 7) {
      const ret = ((currentPrice - snap.priceAtScore) / snap.priceAtScore) * 100;
      updates.ret7d = parseFloat(ret.toFixed(2));
      updates.price7d = currentPrice;
      updates.filled7d = true;
    }
    if (!snap.filled30d && daysSinceScore >= 30) {
      const ret = ((currentPrice - snap.priceAtScore) / snap.priceAtScore) * 100;
      updates.ret30d = parseFloat(ret.toFixed(2));
      updates.price30d = currentPrice;
      updates.filled30d = true;
    }
    if (!snap.filled90d && daysSinceScore >= 90) {
      const ret = ((currentPrice - snap.priceAtScore) / snap.priceAtScore) * 100;
      updates.ret90d = parseFloat(ret.toFixed(2));
      updates.price90d = currentPrice;
      updates.filled90d = true;
    }
    if (!snap.filled180d && daysSinceScore >= 180) {
      const ret = ((currentPrice - snap.priceAtScore) / snap.priceAtScore) * 100;
      updates.ret180d = parseFloat(ret.toFixed(2));
      updates.price180d = currentPrice;
      updates.filled180d = true;
    }

    if (Object.keys(updates).length > 0) {
      await ScoreSnapshot.findByIdAndUpdate(snap._id, { $set: updates });
      updated++;
    }
  }

  return { updated, checked: toFill.length };
}

/**
 * Compute backtest summary: for each score bucket, what were the average forward returns?
 * Only uses snapshots with filled returns.
 */
export async function computeBacktestSummary(algorithmVersion = null) {
  const query = {};
  if (algorithmVersion) query.algorithmVersion = algorithmVersion;

  const snapshots = await ScoreSnapshot.find(query).lean();

  const BUCKETS = [
    { label: 'Strong Buy (80-100)', min: 80, max: 100 },
    { label: 'Buy (65-79)',         min: 65, max: 79  },
    { label: 'Neutral (45-64)',     min: 45, max: 64  },
    { label: 'Sell (30-44)',        min: 30, max: 44  },
    { label: 'Strong Sell (0-29)', min: 0,  max: 29  },
  ];

  const bucketStats = BUCKETS.map(bucket => {
    const snaps = snapshots.filter(s => s.score >= bucket.min && s.score <= bucket.max);
    const withRet30  = snaps.filter(s => s.ret30d  != null);
    const withRet90  = snaps.filter(s => s.ret90d  != null);
    const withRet180 = snaps.filter(s => s.ret180d != null);

    const avg = (arr, field) => arr.length > 0
      ? parseFloat((arr.reduce((s, x) => s + (x[field] || 0), 0) / arr.length).toFixed(2))
      : null;
    const winRate = (arr, field) => arr.length > 0
      ? parseFloat((arr.filter(x => (x[field] || 0) > 0).length / arr.length * 100).toFixed(1))
      : null;

    return {
      label: bucket.label,
      min: bucket.min,
      max: bucket.max,
      count: snaps.length,
      avgRet30d:   avg(withRet30,  'ret30d'),
      avgRet90d:   avg(withRet90,  'ret90d'),
      avgRet180d:  avg(withRet180, 'ret180d'),
      winRate30d:  winRate(withRet30,  'ret30d'),
      winRate90d:  winRate(withRet90,  'ret90d'),
      winRate180d: winRate(withRet180, 'ret180d'),
      n30:  withRet30.length,
      n90:  withRet90.length,
      n180: withRet180.length,
    };
  });

  // Signal-level accuracy: which signals, when bullish, led to positive 30d returns?
  const signalLabels = [...new Set(
    snapshots.flatMap(s => (s.signals || []).map(sig => sig.label))
  )];

  const signalAccuracy = signalLabels.map(label => {
    const bullSnaps = snapshots.filter(s =>
      s.ret30d != null &&
      (s.signals || []).some(sig => sig.label === label && sig.direction === 'bullish' && !sig.noData)
    );
    const bearSnaps = snapshots.filter(s =>
      s.ret30d != null &&
      (s.signals || []).some(sig => sig.label === label && sig.direction === 'bearish' && !sig.noData)
    );

    const bullWin = bullSnaps.filter(s => (s.ret30d || 0) > 0).length;
    const bearWin = bearSnaps.filter(s => (s.ret30d || 0) < 0).length;

    return {
      label,
      bullSamples: bullSnaps.length,
      bearSamples: bearSnaps.length,
      bullWinRate: bullSnaps.length > 0 ? parseFloat((bullWin / bullSnaps.length * 100).toFixed(1)) : null,
      bearWinRate: bearSnaps.length > 0 ? parseFloat((bearWin / bearSnaps.length * 100).toFixed(1)) : null,
      avgBullRet30d: bullSnaps.length > 0 ? parseFloat((bullSnaps.reduce((s, x) => s + (x.ret30d || 0), 0) / bullSnaps.length).toFixed(2)) : null,
    };
  }).filter(s => s.bullSamples + s.bearSamples >= 3);

  return {
    totalSnapshots:  snapshots.length,
    totalWithRet30:  snapshots.filter(s => s.ret30d  != null).length,
    totalWithRet90:  snapshots.filter(s => s.ret90d  != null).length,
    totalWithRet180: snapshots.filter(s => s.ret180d != null).length,
    bucketStats,
    signalAccuracy: signalAccuracy.sort((a, b) => (b.bullSamples + b.bearSamples) - (a.bullSamples + a.bearSamples)),
    generatedAt: new Date(),
  };
}
