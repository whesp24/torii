import * as yahooClient from '../lib/yahooClient.js';
import UniversalScore from '../models/UniversalScore.js';
import Watchlist from '../models/Watchlist.js';
import { TICKER_UNIVERSE } from '../data/ticker-universe.js';
import { getEDGARFundamentals } from './edgarService.js';
import { computeDCF, scoreDCF } from './dcfService.js';

// ── Seed / sync the universe collection on every startup ─────────────────────
// Uses $setOnInsert so existing scored records are never overwritten.
// Runs every deploy to pick up new tickers added to TICKER_UNIVERSE.
export async function seedUniverseIfEmpty() {
  const ops = TICKER_UNIVERSE.map(t => ({
    updateOne: {
      filter: { symbol: t.symbol },
      update: { $setOnInsert: { symbol: t.symbol, exchange: t.exchange, sector: t.sector, score: 50 } },
      upsert: true,
    }
  }));
  const result = await UniversalScore.bulkWrite(ops, { ordered: false });
  const inserted = result.upsertedCount || 0;
  const total    = await UniversalScore.countDocuments();
  if (inserted > 0) {
    console.log(`✓ Universe sync: ${inserted} new tickers added → ${total} total`);
  } else {
    console.log(`✓ Universe already synced (${total} tickers)`);
  }
}

// ── Score a single ticker and upsert into UniversalScore ─────────────────────
// fastMode=true skips chart + EDGAR to cut per-ticker time from ~3s to ~500ms
async function scoreUniverseTicker(symbol, { fastMode = false } = {}) {
  const sym = symbol.toUpperCase();
  try {
    const isJapan = sym.endsWith('.T');
    const isMacro = sym.startsWith('^');

    // Fast mode: only fetch quoteSummary with minimal modules
    // Full mode: fetch quoteSummary + chart + EDGAR in parallel
    const modules = fastMode
      ? ['price', 'summaryDetail', 'financialData', 'defaultKeyStatistics', 'recommendationTrend', 'earnings']
      : ['price', 'summaryDetail', 'financialData', 'defaultKeyStatistics',
         'recommendationTrend', 'calendarEvents', 'earnings', 'assetProfile'];

    let qs, chart, edgarFundamentals;

    if (fastMode) {
      qs = await yahooClient.quoteSummary(sym, { modules }, { validateResult: false });
      chart = null;
      edgarFundamentals = null;
    } else {
      [qs, chart, edgarFundamentals] = await Promise.all([
        yahooClient.quoteSummary(sym, { modules }, { validateResult: false }),
        yahooClient.chart(sym, {
          period1: new Date(Date.now() - 370 * 86400000).toISOString().slice(0,10),
          period2: new Date().toISOString().slice(0,10),
          interval: '1d',
        }).catch(() => null),
        (!isJapan && !isMacro) ? getEDGARFundamentals(sym).catch(() => null) : Promise.resolve(null),
      ]);
    }

    if (!qs) return null;

    const price   = qs.price || {};
    const sumD    = qs.summaryDetail || {};
    const finD    = qs.financialData || {};
    const defKS   = qs.defaultKeyStatistics || {};
    const cal     = qs.calendarEvents || {};
    const earn    = qs.earnings || {};
    const recTrend= qs.recommendationTrend?.trend || [];
    const assetP  = qs.assetProfile || {};

    const currentPrice = price.regularMarketPrice ?? sumD.previousClose ?? null;
    if (!currentPrice || currentPrice <= 0) return null;

    const marketCap = price.marketCap ? price.marketCap / 1e6 : null; // convert to millions

    const sector   = assetP.sector   || price.sector   || null;
    const industry = assetP.industry || price.industry || null;

    const peRatio = sumD.trailingPE ?? defKS.trailingPE ?? null;
    const fwdPE   = sumD.forwardPE  ?? null;
    const shortPct = (sumD.shortPercentOfFloat ?? defKS.shortPercentOfFloat ?? null);
    const revenueGrowth = finD.revenueGrowth != null ? finD.revenueGrowth * 100 : null;

    const earningsDates = cal.earnings?.earningsDate || [];
    const now = Date.now();
    const futureDates = earningsDates.map(d => d instanceof Date ? d.getTime() : null).filter(t => t && t > now);
    const daysToEarnings = futureDates.length ? Math.round((Math.min(...futureDates) - now) / 86400000) : null;

    // Price momentum from chart (only available in full mode)
    let ret3mo = null, rsi = null;
    if (chart?.quotes?.length >= 20) {
      const closes = chart.quotes.map(q => q.close).filter(c => c != null && c > 0);
      if (closes.length >= 20) {
        const current = closes[closes.length - 1];
        const idx3mo = Math.max(0, closes.length - 63);
        ret3mo = ((current - closes[idx3mo]) / closes[idx3mo]) * 100;
        let gains = 0, losses = 0;
        for (let i = closes.length - 14; i < closes.length; i++) {
          const diff = closes[i] - closes[i-1];
          if (diff > 0) gains += diff; else losses -= diff;
        }
        const avgGain = gains / 14, avgLoss = losses / 14;
        rsi = avgLoss === 0 ? 100 : Math.round(100 - (100 / (1 + avgGain / avgLoss)));
      }
    }

    // ── Compute 10 core signals ────────────────────────────────────────────────
    const signals = [];
    let score = 50;

    // 1. Analyst Consensus
    if (finD.targetMeanPrice && currentPrice && finD.numberOfAnalystOpinions > 0) {
      const upside = ((finD.targetMeanPrice - currentPrice) / currentPrice) * 100;
      const delta = upside > 30 ? +12 : upside > 15 ? +8 : upside > 5 ? +4 : upside < -15 ? -10 : upside < -5 ? -5 : 0;
      score += delta;
      signals.push({ label:'Analyst Consensus', direction: delta>0?'bullish':delta<0?'bearish':'neutral', delta,
        value:`$${finD.targetMeanPrice.toFixed(0)} target · ${upside.toFixed(0)}% upside · ${finD.numberOfAnalystOpinions} analysts` });
    } else {
      signals.push({ label:'Analyst Consensus', direction:'neutral', delta:0, value:'No analyst coverage' });
    }

    // 2. Price Momentum
    if (ret3mo != null) {
      const delta = ret3mo > 30 ? +12 : ret3mo > 15 ? +8 : ret3mo > 5 ? +4 : ret3mo > -5 ? 0 : ret3mo > -15 ? -4 : ret3mo > -30 ? -8 : -12;
      score += delta;
      signals.push({ label:'Price Momentum', direction: delta>=4?'bullish':delta<=-4?'bearish':'neutral', delta, value:`${ret3mo.toFixed(1)}% (3mo)` });
    } else {
      signals.push({ label:'Price Momentum', direction:'neutral', delta:0, value: fastMode ? 'Fast mode (chart skipped)' : 'No price data' });
    }

    // 3. RSI / Technical
    if (rsi != null) {
      const delta = rsi < 30 ? +6 : rsi > 70 ? -4 : rsi >= 50 ? +3 : 0;
      score += delta;
      signals.push({ label:'Technical Setup', direction: delta>0?'bullish':delta<0?'bearish':'neutral', delta, value:`RSI ${rsi}` });
    } else {
      signals.push({ label:'Technical Setup', direction:'neutral', delta:0, value: fastMode ? 'Fast mode (chart skipped)' : 'No data' });
    }

    // 4. Short Interest
    if (shortPct != null) {
      const sp = shortPct * 100;
      const delta = sp > 25 ? -12 : sp > 15 ? -8 : sp > 8 ? -4 : sp < 2 ? +4 : 0;
      score += delta;
      signals.push({ label:'Short Interest', direction: sp>15?'bearish':sp<4?'bullish':'neutral', delta, value:`${sp.toFixed(1)}% of float` });
    } else {
      signals.push({ label:'Short Interest', direction:'neutral', delta:0, value:'No data' });
    }

    // 5. Valuation
    if (peRatio != null && peRatio > 0) {
      const delta = peRatio < 10 ? +5 : peRatio < 20 ? +2 : peRatio < 40 ? 0 : peRatio > 80 ? -4 : -2;
      score += delta;
      signals.push({ label:'Valuation', direction: delta>0?'bullish':delta<0?'bearish':'neutral', delta, value:`P/E ${peRatio.toFixed(1)}` });
    } else if (peRatio != null && peRatio <= 0) {
      score -= 4;
      signals.push({ label:'Valuation', direction:'bearish', delta:-4, value:'Loss-making (negative P/E)' });
    } else if (fwdPE != null && fwdPE > 0) {
      const delta = fwdPE < 15 ? +3 : fwdPE < 25 ? +1 : fwdPE > 50 ? -2 : 0;
      score += delta;
      signals.push({ label:'Valuation', direction: delta>0?'bullish':delta<0?'bearish':'neutral', delta, value:`Fwd P/E ${fwdPE.toFixed(1)}` });
    } else {
      signals.push({ label:'Valuation', direction:'neutral', delta:0, value:'No valuation data' });
    }

    // 6. Revenue Growth / Fundamentals
    if (finD.grossMargins != null || revenueGrowth != null) {
      const gm = finD.grossMargins != null ? finD.grossMargins * 100 : null;
      let delta = 0;
      if (revenueGrowth != null) delta += revenueGrowth > 25 ? +4 : revenueGrowth > 10 ? +2 : revenueGrowth < -10 ? -3 : 0;
      if (gm != null) delta += gm > 60 ? +3 : gm > 40 ? +2 : gm < 0 ? -3 : 0;
      score += delta;
      const parts = [];
      if (revenueGrowth != null) parts.push(`Rev ${revenueGrowth > 0 ? '+' : ''}${revenueGrowth.toFixed(0)}% YoY`);
      if (gm != null) parts.push(`GM ${gm.toFixed(0)}%`);
      signals.push({ label:'Fundamental Quality', direction: delta>=3?'bullish':delta<=-3?'bearish':'neutral', delta, value: parts.join(' · ') || 'Fundamentals available' });
    } else {
      signals.push({ label:'Fundamental Quality', direction:'neutral', delta:0, value:'No data' });
    }

    // 7. EPS Surprise
    const epsHist = (earn.earningsHistory?.history || []).slice(-4).filter(q => q.surprisePercent != null);
    if (epsHist.length >= 2) {
      const beats = epsHist.filter(q => q.surprisePercent > 0).length;
      const beatPct = beats / epsHist.length;
      const delta = beatPct >= 0.75 ? +8 : beatPct >= 0.5 ? +4 : beatPct < 0.25 ? -6 : 0;
      score += delta;
      signals.push({ label:'EPS Surprise', direction: delta>0?'bullish':delta<0?'bearish':'neutral', delta, value:`${beats}/${epsHist.length} beats` });
    } else {
      signals.push({ label:'EPS Surprise', direction:'neutral', delta:0, value:'No earnings history' });
    }

    // 8. Upcoming Catalysts
    if (daysToEarnings != null && daysToEarnings >= 0 && daysToEarnings <= 60) {
      const delta = daysToEarnings <= 7 ? +5 : daysToEarnings <= 14 ? +3 : daysToEarnings <= 30 ? +2 : +1;
      score += delta;
      signals.push({ label:'Upcoming Catalysts', direction:'bullish', delta, value:`Earnings in ${daysToEarnings}d` });
    } else {
      signals.push({ label:'Upcoming Catalysts', direction:'neutral', delta:0, value:'No near-term earnings' });
    }

    // 9. Analyst Rating
    const recMean = finD.recommendationMean ?? null;
    if (recMean != null) {
      const delta = recMean <= 1.5 ? +6 : recMean <= 2.0 ? +4 : recMean <= 2.5 ? +2 : recMean >= 4 ? -6 : recMean >= 3.5 ? -3 : 0;
      score += delta;
      const label = recMean <= 1.5 ? 'Strong Buy' : recMean <= 2.0 ? 'Buy' : recMean <= 2.5 ? 'Moderate Buy' : recMean >= 4 ? 'Sell' : 'Hold';
      signals.push({ label:'Analyst Rating', direction: delta>0?'bullish':delta<0?'bearish':'neutral', delta, value:`${label} (mean ${recMean.toFixed(1)})` });
    } else {
      signals.push({ label:'Analyst Rating', direction:'neutral', delta:0, value:'No rating' });
    }

    // 10. Market Cap tier signal
    if (marketCap != null) {
      const delta = marketCap > 100000 ? +2 : marketCap > 10000 ? +1 : marketCap > 2000 ? 0 : -2;
      score += delta;
      const tier = marketCap > 200000 ? 'Mega-cap' : marketCap > 10000 ? 'Large-cap' : marketCap > 2000 ? 'Mid-cap' : marketCap > 300 ? 'Small-cap' : 'Micro-cap';
      signals.push({ label:'Market Cap Tier', direction: delta>0?'bullish':delta<0?'bearish':'neutral', delta, value:`${tier} ($${marketCap > 1000 ? (marketCap/1000).toFixed(1)+'B' : marketCap.toFixed(0)+'M'})` });
    } else {
      signals.push({ label:'Market Cap Tier', direction:'neutral', delta:0, value:'Unknown' });
    }

    // ── EDGAR-powered signals (11-13) — only in full mode ─────────────────────

    // 11. FCF Trend (from EDGAR XBRL)
    if (edgarFundamentals?.fcfTrend) {
      const { fcfTrend, fcfMargin, fcfCAGR, latestFCF } = edgarFundamentals;
      let delta = 0;
      if (fcfTrend === 'growing') {
        delta = (fcfCAGR != null && fcfCAGR > 20) ? +8 : +4;
      } else if (fcfTrend === 'declining') {
        delta = -6;
      } else if (fcfTrend === 'mixed') {
        delta = 0;
      }
      if (latestFCF <= 0) delta = Math.min(delta - 4, -4);
      score += delta;
      const parts = [];
      if (fcfMargin != null) parts.push(`FCF margin ${fcfMargin.toFixed(1)}%`);
      if (fcfCAGR != null)   parts.push(`CAGR ${fcfCAGR > 0 ? '+' : ''}${fcfCAGR.toFixed(0)}%`);
      parts.push(fcfTrend);
      signals.push({ label:'FCF Trend', direction: delta>=4?'bullish':delta<=-4?'bearish':'neutral', delta, value: parts.join(' · ') });
    } else {
      signals.push({ label:'FCF Trend', direction:'neutral', delta:0, value: fastMode ? 'Fast mode (EDGAR skipped)' : 'No EDGAR data' });
    }

    // 12. Debt Health (from EDGAR XBRL)
    if (edgarFundamentals?.debtToEquity != null || edgarFundamentals?.netDebt != null) {
      const { debtToEquity, interestCoverage, netDebt } = edgarFundamentals;
      let delta = 0;
      if (debtToEquity != null) {
        delta += debtToEquity < 0.3 ? +4 : debtToEquity < 1.0 ? +2 : debtToEquity < 2.0 ? 0 : debtToEquity < 4.0 ? -3 : -6;
      }
      if (interestCoverage != null) {
        delta += interestCoverage > 10 ? +2 : interestCoverage > 3 ? 0 : interestCoverage < 1.5 ? -4 : -2;
      }
      delta = Math.max(-8, Math.min(6, delta));
      score += delta;
      const parts = [];
      if (debtToEquity != null) parts.push(`D/E ${debtToEquity.toFixed(2)}`);
      if (interestCoverage != null) parts.push(`Int. coverage ${interestCoverage.toFixed(1)}×`);
      if (netDebt != null) {
        const netDebtB = (netDebt / 1e9).toFixed(1);
        parts.push(netDebt < 0 ? `Net cash $${Math.abs(netDebtB)}B` : `Net debt $${netDebtB}B`);
      }
      signals.push({ label:'Debt Health', direction: delta>=3?'bullish':delta<=-3?'bearish':'neutral', delta, value: parts.join(' · ') || 'Balance sheet data' });
    } else {
      signals.push({ label:'Debt Health', direction:'neutral', delta:0, value: fastMode ? 'Fast mode (EDGAR skipped)' : 'No EDGAR data' });
    }

    // 13. DCF Intrinsic Value
    const yfSummaryProxy = {
      currentPrice,
      beta: defKS.beta ?? sumD.beta ?? null,
      earningsGrowth: finD.earningsGrowth != null ? finD.earningsGrowth * 100 : null,
      revenueGrowth:  finD.revenueGrowth  != null ? finD.revenueGrowth  * 100 : null,
      marketCap: price.marketCap ?? null,
    };
    const dcfResult = edgarFundamentals ? computeDCF(yfSummaryProxy, edgarFundamentals) : null;
    const dcfSignal = scoreDCF(dcfResult);
    if (dcfSignal) {
      score += dcfSignal.delta;
      signals.push({ label:'DCF Intrinsic Value', direction: dcfSignal.direction, delta: dcfSignal.delta, value: dcfSignal.value });
    } else {
      signals.push({ label:'DCF Intrinsic Value', direction:'neutral', delta:0, value: fastMode ? 'Fast mode (EDGAR skipped)' : 'Insufficient FCF data' });
    }

    score = Math.min(100, Math.max(0, Math.round(score)));
    const rating = score >= 75 ? 'STRONG BUY' : score >= 60 ? 'BUY' : score >= 45 ? 'NEUTRAL' : score >= 30 ? 'REDUCE' : 'SELL';
    const strategy = score >= 65 ? 'long' : score <= 35 ? 'short' : 'neutral';

    const inWatchlist = !!(await Watchlist.findOne({ symbol: sym }).lean().catch(() => null));

    // Fetch existing record to preserve exchange (set during seeding, not returned by Yahoo)
    const existing = await UniversalScore.findOne({ symbol: sym }, { exchange: 1 }).lean().catch(() => null);

    await UniversalScore.findOneAndUpdate(
      { symbol: sym },
      {
        $set: {
        symbol: sym,
        name: price.shortName || price.longName || sym,
        ...(existing?.exchange ? { exchange: existing.exchange } : {}),
        ...(sector   ? { sector }   : {}),
        ...(industry ? { industry } : {}),
        currentPrice, marketCap,
        changePercent: price.regularMarketChangePercent != null ? price.regularMarketChangePercent * 100 : null,
        peRatio: peRatio ?? null,
        fwdPE: fwdPE ?? null,
        shortPct: shortPct != null ? shortPct * 100 : null,
        revenueGrowth: revenueGrowth ?? null,
        rsi: rsi ?? null,
        ret3mo: ret3mo ?? null,
        daysToEarnings: daysToEarnings ?? null,
        fcfMargin:    edgarFundamentals?.fcfMargin    ?? null,
        debtToEquity: edgarFundamentals?.debtToEquity ?? null,
        netDebt:      edgarFundamentals?.netDebt      != null ? edgarFundamentals.netDebt / 1e6 : null,
        interestCoverage: edgarFundamentals?.interestCoverage ?? null,
        intrinsicValue: dcfResult?.intrinsicValue ?? null,
        dcfUpside:    dcfResult?.upside ?? null,
        score, rating, strategy, signals,
        inWatchlist,
        lastScored: new Date(),
        },  // close $set
      },    // close update document
      { upsert: true, new: true }
    );

    return { symbol: sym, score };
  } catch (err) {
    console.warn(`Universe score failed for ${sym}: ${err.message}`);
    return null;
  }
}

// ── Wrap a promise with a hard timeout ───────────────────────────────────────
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

// ── Nightly batch scoring — parallel batches, priority ordering ───────────────
// Options:
//   limit    – cap number of tickers processed (default: all)
//   fastMode – skip chart + EDGAR for 4-6× speed increase (default: false)
//   onProgress – callback({ done, total, symbol, score })
let _universeRunning = false;

export async function runUniverseScoring({ limit, fastMode = false, onProgress } = {}) {
  if (_universeRunning) return { error: 'Already running' };
  _universeRunning = true;

  try {
    // Fetch all tickers with lastScored so we can prioritize stale ones
    const all = await UniversalScore.find(
      {},
      { symbol: 1, inWatchlist: 1, lastScored: 1 }
    ).lean();

    // Priority: watchlist first, then null lastScored (never scored), then oldest lastScored
    const sorted = all.slice().sort((a, b) => {
      if (a.inWatchlist && !b.inWatchlist) return -1;
      if (!a.inWatchlist && b.inWatchlist) return +1;
      const ta = a.lastScored ? new Date(a.lastScored).getTime() : 0;
      const tb = b.lastScored ? new Date(b.lastScored).getTime() : 0;
      return ta - tb; // oldest first
    });

    const tickers = limit ? sorted.slice(0, limit) : sorted;
    const total = tickers.length;
    let done = 0, scored = 0;

    const BATCH_SIZE        = 2;     // keep concurrent Yahoo requests low to avoid 429
    const TICKER_TIMEOUT_MS = 30000; // must exceed Yahoo crumb retry delay (~22s max)
    const BATCH_DELAY_MS    = 800;   // between batches — gives Yahoo breathing room

    console.log(`Universe scoring: ${total} tickers, batchSize=${BATCH_SIZE}, fastMode=${fastMode}`);

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = tickers.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(({ symbol }) =>
          withTimeout(
            scoreUniverseTicker(symbol, { fastMode }),
            TICKER_TIMEOUT_MS,
            symbol
          )
        )
      );

      for (let j = 0; j < results.length; j++) {
        const { symbol } = batch[j];
        const r = results[j];
        done++;
        if (r.status === 'fulfilled' && r.value) {
          scored++;
          if (onProgress) onProgress({ done, total, symbol, score: r.value.score });
        } else {
          const reason = r.status === 'rejected' ? r.reason?.message : 'null result';
          console.warn(`Skipped ${symbol}: ${reason}`);
          if (onProgress) onProgress({ done, total, symbol, score: null });
        }
      }

      // Pause between batches (skip delay on the last batch)
      if (i + BATCH_SIZE < total) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    console.log(`Universe scoring complete: ${scored}/${total} scored`);
    return { scored, total };
  } finally {
    _universeRunning = false;
  }
}

export const isUniverseRunning = () => _universeRunning;
