import yahooFinance from 'yahoo-finance2';
import UniversalScore from '../models/UniversalScore.js';
import Watchlist from '../models/Watchlist.js';
import { TICKER_UNIVERSE } from '../data/ticker-universe.js';

// ── Seed the universe collection on first run ─────────────────────────────────
export async function seedUniverseIfEmpty() {
  const count = await UniversalScore.countDocuments();
  if (count > 0) return console.log(`✓ Universe already seeded (${count} tickers)`);

  console.log(`Seeding ${TICKER_UNIVERSE.length} tickers into universe…`);
  const ops = TICKER_UNIVERSE.map(t => ({
    updateOne: {
      filter: { symbol: t.symbol },
      update: { $setOnInsert: { symbol: t.symbol, exchange: t.exchange, sector: t.sector, score: 50 } },
      upsert: true,
    }
  }));
  await UniversalScore.bulkWrite(ops);
  console.log(`✓ Universe seeded`);
}

// ── Score a single ticker and upsert into UniversalScore ─────────────────────
async function scoreUniverseTicker(symbol) {
  const sym = symbol.toUpperCase();
  try {
    // Parallel: quoteSummary (10 modules) + chart (for momentum/RSI)
    const modules = [
      'price','summaryDetail','financialData','defaultKeyStatistics',
      'recommendationTrend','calendarEvents','earnings',
    ];
    const [qs, chart] = await Promise.all([
      yahooFinance.quoteSummary(sym, { modules }, { validateResult: false }),
      yahooFinance.chart(sym, {
        period1: new Date(Date.now() - 370 * 86400000).toISOString().slice(0,10),
        period2: new Date().toISOString().slice(0,10),
        interval: '1d',
      }, { validateResult: false }).catch(() => null),
    ]);

    if (!qs) return null;

    const price   = qs.price || {};
    const sumD    = qs.summaryDetail || {};
    const finD    = qs.financialData || {};
    const defKS   = qs.defaultKeyStatistics || {};
    const cal     = qs.calendarEvents || {};
    const earn    = qs.earnings || {};
    const recTrend= qs.recommendationTrend?.trend || [];

    const currentPrice = price.regularMarketPrice ?? sumD.previousClose ?? null;
    if (!currentPrice || currentPrice <= 0) return null;

    const marketCap = price.marketCap ? price.marketCap / 1e6 : null; // convert to millions

    // Sector / industry from Yahoo (overrides seed data)
    const sector   = price.sector   || null;
    const industry = price.industry || null;

    const peRatio = sumD.trailingPE ?? defKS.trailingPE ?? null;
    const fwdPE   = sumD.forwardPE  ?? null;
    const shortPct = (sumD.shortPercentOfFloat ?? defKS.shortPercentOfFloat ?? null);
    const revenueGrowth = finD.revenueGrowth != null ? finD.revenueGrowth * 100 : null;

    const earningsDates = cal.earnings?.earningsDate || [];
    const now = Date.now();
    const futureDates = earningsDates.map(d => d instanceof Date ? d.getTime() : null).filter(t => t && t > now);
    const daysToEarnings = futureDates.length ? Math.round((Math.min(...futureDates) - now) / 86400000) : null;

    // Price momentum from chart
    let ret3mo = null, rsi = null;
    if (chart?.quotes?.length >= 20) {
      const closes = chart.quotes.map(q => q.close).filter(c => c != null && c > 0);
      if (closes.length >= 20) {
        const current = closes[closes.length - 1];
        // 3mo return (~63 trading days)
        const idx3mo = Math.max(0, closes.length - 63);
        ret3mo = ((current - closes[idx3mo]) / closes[idx3mo]) * 100;
        // RSI-14
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
      signals.push({ label:'Price Momentum', direction:'neutral', delta:0, value:'No price data' });
    }

    // 3. RSI / Technical
    if (rsi != null) {
      const delta = rsi < 30 ? +6 : rsi > 70 ? -4 : rsi >= 50 ? +3 : 0;
      score += delta;
      signals.push({ label:'Technical Setup', direction: delta>0?'bullish':delta<0?'bearish':'neutral', delta, value:`RSI ${rsi}` });
    } else {
      signals.push({ label:'Technical Setup', direction:'neutral', delta:0, value:'No data' });
    }

    // 4. Short Interest
    if (shortPct != null) {
      const sp = shortPct * 100; // convert to percentage
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

    // 10. Market Cap tier signal (proxy for risk/opportunity)
    if (marketCap != null) {
      const delta = marketCap > 100000 ? +2 : marketCap > 10000 ? +1 : marketCap > 2000 ? 0 : -2;
      score += delta;
      const tier = marketCap > 200000 ? 'Mega-cap' : marketCap > 10000 ? 'Large-cap' : marketCap > 2000 ? 'Mid-cap' : marketCap > 300 ? 'Small-cap' : 'Micro-cap';
      signals.push({ label:'Market Cap Tier', direction: delta>0?'bullish':delta<0?'bearish':'neutral', delta, value:`${tier} ($${marketCap > 1000 ? (marketCap/1000).toFixed(1)+'B' : marketCap.toFixed(0)+'M'})` });
    } else {
      signals.push({ label:'Market Cap Tier', direction:'neutral', delta:0, value:'Unknown' });
    }

    score = Math.min(100, Math.max(0, Math.round(score)));
    const rating = score >= 75 ? 'STRONG BUY' : score >= 60 ? 'BUY' : score >= 45 ? 'NEUTRAL' : score >= 30 ? 'REDUCE' : 'SELL';
    const strategy = score >= 65 ? 'long' : score <= 35 ? 'short' : 'neutral';

    // Check watchlist membership
    const inWatchlist = !!(await Watchlist.findOne({ symbol: sym }).lean().catch(() => null));

    await UniversalScore.findOneAndUpdate(
      { symbol: sym },
      {
        symbol: sym,
        name: price.shortName || price.longName || sym,
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
        score, rating, strategy, signals,
        inWatchlist,
        lastScored: new Date(),
      },
      { upsert: true, new: true }
    );

    return { symbol: sym, score };
  } catch (err) {
    console.warn(`Universe score failed for ${sym}: ${err.message}`);
    return null;
  }
}

// ── Nightly batch scoring for the full universe ───────────────────────────────
let _universeRunning = false;

export async function runUniverseScoring({ onProgress } = {}) {
  if (_universeRunning) return { error: 'Already running' };
  _universeRunning = true;

  const tickers = await UniversalScore.find({}, { symbol: 1 }).lean();
  const total = tickers.length;
  let done = 0, scored = 0;

  console.log(`Starting universe scoring: ${total} tickers`);

  for (const { symbol } of tickers) {
    const result = await scoreUniverseTicker(symbol);
    done++;
    if (result) scored++;
    if (onProgress) onProgress({ done, total, symbol, score: result?.score });
    // Stagger requests to avoid Yahoo rate limits
    const isJapan = symbol.endsWith('.T');
    await new Promise(r => setTimeout(r, isJapan ? 1200 : 600));
  }

  _universeRunning = false;
  console.log(`Universe scoring complete: ${scored}/${total} scored`);
  return { scored, total };
}

export const isUniverseRunning = () => _universeRunning;
