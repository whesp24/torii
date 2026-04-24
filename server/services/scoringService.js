/**
 * Torii Scoring Service
 * Ports ConvictionPage.analyze() to server-side so we can batch-score
 * every watchlist ticker and cache results in MongoDB.
 */

import Watchlist from '../models/Watchlist.js';
import Score from '../models/Score.js';

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';

// Macro / theme tickers that get 'macro' strategy tag
const MACRO_TICKERS = new Set([
  'GLD','SLV','GDX','GDXJ','TLT','IEF','SHY','HYG','LQD','AGG',
  'UUP','FXE','FXB','EEM','EFA','SPY','QQQ','IWM','VXX','VIXY',
  'DXY','OIL','UCO','USO','BOIL','KOLD','CORN','WEAT','SOYB',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeFetch(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) {
    return null;
  }
}

async function safePost(url, body) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) {
    return null;
  }
}

function getRating(score) {
  if (score >= 80) return 'STRONG BUY';
  if (score >= 65) return 'BUY';
  if (score >= 45) return 'NEUTRAL';
  if (score >= 30) return 'SELL';
  return 'STRONG SELL';
}

function getStrategy(score, signals, symbol) {
  if (MACRO_TICKERS.has(symbol)) return 'macro';

  const optSig = signals.find(s => s.label === 'Options Flow (P/C ratio)');
  const insSig = signals.find(s => s.label === 'Insider Transactions');

  // Strong options signal wins if it has data
  if (optSig && !optSig.noData && Math.abs(optSig.delta) >= 8) {
    return 'options';
  }

  if (score >= 65) return 'long';
  if (score <= 35) return 'short';
  return 'neutral';
}

// ─── Score a single ticker ────────────────────────────────────────────────────

export async function scoreTicker(symbol) {
  const t = symbol.toUpperCase();
  const gathered = [];

  // Fire all fetches in parallel (same as ConvictionPage)
  const [wl, sent, shi, cong, opts, ins, cats, pt, fund] = await Promise.all([
    safeFetch(`${BASE_URL}/watchlist/${t}`),
    safePost(`${BASE_URL}/sentiment/analyze/${t}`, {}),
    safeFetch(`${BASE_URL}/short/${t}`),
    safeFetch(`${BASE_URL}/congressional?ticker=${t}&days=90`),
    safeFetch(`${BASE_URL}/options/${t}`),
    safeFetch(`${BASE_URL}/insider/form4/${t}`),
    safeFetch(`${BASE_URL}/catalysts?ticker=${t}&from=${new Date().toISOString().slice(0, 10)}`),
    safeFetch(`${BASE_URL}/stocks/price-target/${t}`),
    safeFetch(`${BASE_URL}/stocks/fundamentals/${t}`),
  ]);

  const quote  = fund?.quote  || null;
  const metric = fund?.metric || null;

  let total = 50;

  // 1. Thesis status
  if (wl && !wl.error) {
    const ts = wl.thesisStatus;
    const delta = ts === 'valid' ? +15 : ts === 'weakening' ? -10 : ts === 'invalidated' ? -25 : 0;
    total += delta;
    if (ts) {
      gathered.push({
        label: 'Investment Thesis',
        value: ts.charAt(0).toUpperCase() + ts.slice(1),
        direction: ts === 'valid' ? 'bullish' : ts === 'invalidated' ? 'bearish' : 'neutral',
        delta,
        source: 'watchlist',
      });
    }
    if (wl.conviction) {
      const cd = (wl.conviction - 5) * 2;
      total += cd;
      gathered.push({
        label: 'Conviction Rating',
        value: `${wl.conviction}/10`,
        direction: wl.conviction >= 7 ? 'bullish' : wl.conviction <= 3 ? 'bearish' : 'neutral',
        delta: cd,
        source: 'watchlist',
      });
    }
  }

  // 2. Analyst price target
  if (pt && pt.targetMean && quote?.c) {
    const upside = ((pt.targetMean - quote.c) / quote.c) * 100;
    const delta = upside > 30 ? +15 : upside > 15 ? +10 : upside > 5 ? +5 : upside < -15 ? -12 : upside < -5 ? -6 : 0;
    total += delta;
    const rec = pt.recommendation;
    const recLabel = rec ? ` · ${rec.strongBuy}SB/${rec.buy}B/${rec.hold}H/${rec.sell}S` : '';
    gathered.push({
      label: 'Analyst Consensus',
      value: `$${pt.targetMean.toFixed(0)} target · ${upside > 0 ? '+' : ''}${upside.toFixed(0)}% upside${recLabel}`,
      direction: delta > 0 ? 'bullish' : delta < 0 ? 'bearish' : 'neutral',
      delta,
      source: 'Finnhub',
    });
  } else {
    gathered.push({ label: 'Analyst Consensus', value: 'No data', direction: 'neutral', delta: 0, source: 'Finnhub', noData: true });
  }

  // 3. Price momentum (52w position)
  if (quote?.c && metric?.['52WeekHigh'] && metric?.['52WeekLow']) {
    const high52 = metric['52WeekHigh'];
    const low52  = metric['52WeekLow'];
    const pctFromHigh = ((quote.c - high52) / high52) * 100;
    const range = high52 - low52;
    const posInRange = range > 0 ? ((quote.c - low52) / range) * 100 : 50;
    const delta = pctFromHigh > -8 ? +8 : pctFromHigh > -20 ? +4 : pctFromHigh > -35 ? 0 : pctFromHigh > -50 ? -5 : -10;
    total += delta;
    gathered.push({
      label: 'Price Momentum',
      value: `${pctFromHigh.toFixed(1)}% from 52w high · ${posInRange.toFixed(0)}% of range`,
      direction: delta >= 4 ? 'bullish' : delta <= -5 ? 'bearish' : 'neutral',
      delta,
      source: 'Finnhub',
    });
  } else {
    gathered.push({ label: 'Price Momentum', value: 'No quote data', direction: 'neutral', delta: 0, source: 'Finnhub', noData: true });
  }

  // 4. News sentiment
  if (sent && !sent.error && sent.score != null) {
    const delta = sent.score > 60 ? +10 : sent.score < 40 ? -10 : 0;
    total += delta;
    gathered.push({
      label: 'News Sentiment',
      value: `${sent.score.toFixed(0)}% positive`,
      direction: sent.score > 60 ? 'bullish' : sent.score < 40 ? 'bearish' : 'neutral',
      delta,
      source: 'AI',
    });
  } else {
    gathered.push({ label: 'News Sentiment', value: 'No news data', direction: 'neutral', delta: 0, source: 'AI', noData: true });
  }

  // 5. Short interest
  if (shi && !shi.error) {
    const sp = shi.shortInterestPct ?? shi.finra?.shortPct;
    if (sp != null) {
      const delta = sp > 20 ? -10 : sp > 10 ? -5 : sp < 3 ? +5 : 0;
      total += delta;
      gathered.push({
        label: 'Short Interest',
        value: `${sp.toFixed(1)}% of float`,
        direction: sp > 20 ? 'bearish' : sp > 10 ? 'neutral' : 'bullish',
        delta,
        source: 'FINRA/Finnhub',
      });
    } else {
      gathered.push({ label: 'Short Interest', value: 'No data', direction: 'neutral', delta: 0, source: 'FINRA/Finnhub', noData: true });
    }
  } else {
    gathered.push({ label: 'Short Interest', value: 'No data', direction: 'neutral', delta: 0, source: 'FINRA/Finnhub', noData: true });
  }

  // 6. Congressional trading
  if (cong && Array.isArray(cong.trades) && cong.trades.length > 0) {
    const buys  = cong.trades.filter(tx => tx.isBuy).length;
    const sells = cong.trades.filter(tx => !tx.isBuy).length;
    const delta = buys > sells + 1 ? +8 : buys < sells - 1 ? -8 : 0;
    total += delta;
    gathered.push({
      label: 'Congressional Trading',
      value: `${buys} buys / ${sells} sells (90d)`,
      direction: buys > sells ? 'bullish' : buys < sells ? 'bearish' : 'neutral',
      delta,
      source: 'STOCK Act',
    });
  } else {
    gathered.push({ label: 'Congressional Trading', value: 'No trades in 90d', direction: 'neutral', delta: 0, source: 'STOCK Act', noData: true });
  }

  // 7. Options flow
  if (opts && !opts.error && opts.putCallRatio != null) {
    const pcr = opts.putCallRatio;
    const delta = pcr < 0.7 ? +8 : pcr > 1.2 ? -8 : 0;
    total += delta;
    gathered.push({
      label: 'Options Flow (P/C ratio)',
      value: `${pcr.toFixed(2)} — ${opts.sentiment}`,
      direction: opts.sentiment === 'bullish' ? 'bullish' : opts.sentiment === 'bearish' ? 'bearish' : 'neutral',
      delta,
      source: 'Yahoo Finance',
    });
  } else {
    gathered.push({ label: 'Options Flow (P/C ratio)', value: 'No options data', direction: 'neutral', delta: 0, source: 'Yahoo Finance', noData: true });
  }

  // 8. Insider Form 4 — buy vs sell breakdown
  if (ins && !ins.error && ins.filings?.length > 0) {
    const buys  = ins.filings.filter(f => f.isBuy).length;
    const sells = ins.filings.filter(f => f.isSell).length;
    const net   = buys - sells;
    const delta = net >= 3 ? +12 : net > 0 ? +6 : net <= -3 ? -12 : net < 0 ? -6 : +2;
    total += delta;
    gathered.push({
      label: 'Insider Transactions',
      value: `${buys} buys / ${sells} sells · ${ins.filings.length} Form 4s (90d)`,
      direction: delta > 0 ? 'bullish' : delta < 0 ? 'bearish' : 'neutral',
      delta,
      source: 'SEC EDGAR',
    });
  } else {
    gathered.push({ label: 'Insider Transactions', value: 'No Form 4s in 90d', direction: 'neutral', delta: 0, source: 'SEC EDGAR', noData: true });
  }

  // 9. Upcoming catalysts
  if (Array.isArray(cats) && cats.length > 0) {
    const high = cats.filter(c => c.impact === 'high').length;
    const delta = high >= 2 ? +8 : high === 1 ? +4 : +2;
    total += delta;
    gathered.push({
      label: 'Upcoming Catalysts',
      value: `${cats.length} events · ${high} high impact`,
      direction: 'bullish',
      delta,
      source: 'Calendar',
    });
  } else {
    gathered.push({ label: 'Upcoming Catalysts', value: 'No upcoming events', direction: 'neutral', delta: 0, source: 'Calendar', noData: true });
  }

  total = Math.min(100, Math.max(0, Math.round(total)));

  const activeSignals = gathered.filter(s => !s.noData).length;
  const strategy = getStrategy(total, gathered, t);
  const rating   = getRating(total);

  const currentPrice  = quote?.c ?? null;
  const changePercent = quote?.dp ?? null;

  // Get name from watchlist or profile
  const name = wl?.name || fund?.profile?.name || t;

  return {
    symbol: t,
    name,
    score: total,
    rating,
    strategy,
    signals: gathered,
    currentPrice,
    changePercent,
    activeSignals,
    scoredAt: new Date(),
  };
}

// ─── Batch score all watchlist tickers ───────────────────────────────────────
// Runs with concurrency=3 to avoid hammering external APIs
export async function scoreAllWatchlist(onProgress) {
  const watchlistItems = await Watchlist.find().sort({ addedAt: -1 });
  if (!watchlistItems.length) return { scored: 0, errors: 0, results: [] };

  const symbols = [...new Set(watchlistItems.map(w => w.symbol))];
  const results = [];
  let errors = 0;

  // Process in batches of 3 (concurrency limit)
  const BATCH = 3;
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const batchResults = await Promise.allSettled(batch.map(sym => scoreTicker(sym)));

    for (let j = 0; j < batch.length; j++) {
      const sym = batch[j];
      const res = batchResults[j];

      if (res.status === 'fulfilled') {
        const data = res.value;
        // Upsert into MongoDB
        await Score.findOneAndUpdate(
          { symbol: sym },
          { $set: data },
          { upsert: true, new: true }
        );
        results.push({ symbol: sym, score: data.score, strategy: data.strategy });
        if (onProgress) onProgress({ symbol: sym, score: data.score, done: i + j + 1, total: symbols.length });
      } else {
        console.error(`Score failed for ${sym}:`, res.reason?.message);
        errors++;
        if (onProgress) onProgress({ symbol: sym, error: true, done: i + j + 1, total: symbols.length });
      }
    }

    // Brief pause between batches to be polite to external APIs
    if (i + BATCH < symbols.length) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  return { scored: results.length, errors, results };
}
