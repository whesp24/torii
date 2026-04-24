/**
 * Torii Scoring Service — Direct API Edition
 *
 * Calls external APIs directly (Finnhub, Quiverquant, FINRA, SEC EDGAR)
 * and MongoDB directly — no self-HTTP calls, so no PORT dependency issues.
 *
 * Batch-level caches (congressional + FINRA) are populated once per run
 * then reused for every ticker, keeping rate-limit surface area minimal.
 */

import Watchlist from '../models/Watchlist.js';
import Score    from '../models/Score.js';
import Catalyst from '../models/Catalyst.js';

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';
const EDGAR_UA    = { 'User-Agent': 'Torii Investment Platform whesp24@gmail.com' };

// ─── Macro / ETF tickers → strategy='macro' ──────────────────────────────────
const MACRO_TICKERS = new Set([
  'GLD','SLV','GDX','GDXJ','TLT','IEF','SHY','HYG','LQD','AGG',
  'UUP','FXE','FXB','EEM','EFA','SPY','QQQ','IWM','VXX','VIXY',
  'DXY','OIL','UCO','USO','BOIL','KOLD','CORN','WEAT','SOYB',
]);

// ─── Batch-level caches ───────────────────────────────────────────────────────
// These are populated ONCE per scoreAllWatchlist() call and shared.
let batchCongData  = null;   // raw Quiverquant array
let batchFinraMap  = null;   // Map<TICKER, shortPct>

async function safeFetch(url, opts = {}) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000), ...opts });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; }
}

// ─── Congressional data — bulk load once ─────────────────────────────────────
async function loadCongData() {
  if (batchCongData) return batchCongData;
  const raw = await safeFetch('https://api.quiverquant.com/beta/live/congresstrading', {
    headers: { 'User-Agent': EDGAR_UA['User-Agent'], 'Accept': 'application/json' },
  });
  batchCongData = Array.isArray(raw) ? raw : [];
  return batchCongData;
}

// ─── FINRA short volume — bulk parse once ─────────────────────────────────────
async function loadFinraMap() {
  if (batchFinraMap) return batchFinraMap;
  batchFinraMap = new Map();
  for (let i = 0; i <= 5; i++) {
    const d = new Date(Date.now() - i * 86400000);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const ds = d.toISOString().slice(0, 10).replace(/-/g, '');
    try {
      const r = await fetch(`https://cdn.finra.org/equity/regsho/daily/CNMSshvol${ds}.txt`, {
        headers: EDGAR_UA, signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) continue;
      const txt   = await r.text();
      const lines = txt.split('\n');
      const hdr   = (lines[0] || '').split('|');
      const siIdx = hdr.indexOf('ShortVolume');
      const tvIdx = hdr.indexOf('TotalVolume');
      for (const line of lines.slice(1)) {
        const p  = line.split('|');
        if (p.length < 3) continue;
        const sym = p[0];
        const sv  = parseInt(p[siIdx] || '0');
        const tv  = parseInt(p[tvIdx] || '0');
        if (sym && tv > 0) batchFinraMap.set(sym, parseFloat((sv / tv * 100).toFixed(1)));
      }
      break; // got a valid file
    } catch (_) {}
  }
  return batchFinraMap;
}

// ─── SEC EDGAR — light insider summary (submissions JSON only, no XML) ───────
// Counts Form 4 filings in last `days` days. Returns { total, recent }
// We avoid parsing XMLs (too slow for batch — 25 HTTP calls per ticker).
const CIK_CACHE = new Map();
async function tickerToCIK(ticker) {
  if (CIK_CACHE.has(ticker)) return CIK_CACHE.get(ticker);
  const map = await safeFetch('https://www.sec.gov/files/company_tickers.json', { headers: EDGAR_UA });
  if (!map) return null;
  for (const key in map) {
    if ((map[key].ticker || '').toUpperCase() === ticker) {
      const cik = String(map[key].cik_str).padStart(10, '0');
      CIK_CACHE.set(ticker, cik);
      return cik;
    }
  }
  return null;
}

async function getInsiderSummary(ticker, days = 90) {
  try {
    const cik = await tickerToCIK(ticker);
    if (!cik) return null;
    const sub = await safeFetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: EDGAR_UA });
    if (!sub) return null;
    const recent = sub.filings?.recent || {};
    const forms  = recent.form        || [];
    const dates  = recent.filingDate  || [];
    const cutoff = new Date(Date.now() - days * 86400000);
    let count = 0;
    for (let i = 0; i < forms.length; i++) {
      if ((forms[i] === '4' || forms[i] === '4/A') && new Date(dates[i]) >= cutoff) count++;
      // Stop scanning once filings are older than cutoff
      if (i > 5 && new Date(dates[i]) < cutoff) break;
    }
    return { count };
  } catch (_) { return null; }
}

// ─── Rating + strategy helpers ────────────────────────────────────────────────
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
  if (optSig && !optSig.noData && Math.abs(optSig.delta) >= 8) return 'options';
  if (score >= 65) return 'long';
  if (score <= 35) return 'short';
  return 'neutral';
}

// ─── Score a single ticker (direct API calls) ─────────────────────────────────
export async function scoreTicker(symbol, { congData, finraMap } = {}) {
  const t = symbol.toUpperCase();
  const gathered = [];
  let total = 50;

  // ── 1. Watchlist thesis + conviction (MongoDB) ─────────────────────────────
  const wl = await Watchlist.findOne({ symbol: t }).lean().catch(() => null);
  if (wl) {
    const ts = wl.thesisStatus;
    const delta = ts === 'valid' ? +15 : ts === 'weakening' ? -10 : ts === 'invalidated' ? -25 : 0;
    total += delta;
    if (ts && ts !== 'unchecked') {
      gathered.push({ label:'Investment Thesis', value: ts.charAt(0).toUpperCase()+ts.slice(1),
        direction: ts==='valid'?'bullish':ts==='invalidated'?'bearish':'neutral', delta, source:'watchlist' });
    }
    if (wl.conviction) {
      const cd = (wl.conviction - 5) * 2;
      total += cd;
      gathered.push({ label:'Conviction Rating', value:`${wl.conviction}/10`,
        direction: wl.conviction>=7?'bullish':wl.conviction<=3?'bearish':'neutral', delta:cd, source:'watchlist' });
    }
  }

  // ── 2 + 3. Finnhub: price target + fundamentals (parallel) ─────────────────
  const [ptRaw, fundRaw] = FINNHUB_KEY ? await Promise.all([
    safeFetch(`https://finnhub.io/api/v1/stock/price-target?symbol=${t}&token=${FINNHUB_KEY}`),
    Promise.all([
      safeFetch(`https://finnhub.io/api/v1/stock/metric?symbol=${t}&metric=all&token=${FINNHUB_KEY}`),
      safeFetch(`https://finnhub.io/api/v1/quote?symbol=${t}&token=${FINNHUB_KEY}`),
      safeFetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${t}&token=${FINNHUB_KEY}`),
    ]),
  ]) : [null, [null, null, null]];

  const metric = fundRaw?.[0]?.metric || null;
  const quote  = fundRaw?.[1] || null;
  const recArr = fundRaw?.[2];
  const rec    = Array.isArray(recArr) && recArr.length > 0 ? recArr[0] : null;

  // Analyst consensus
  if (ptRaw?.targetMean && quote?.c) {
    const upside = ((ptRaw.targetMean - quote.c) / quote.c) * 100;
    const delta  = upside > 30 ? +15 : upside > 15 ? +10 : upside > 5 ? +5 : upside < -15 ? -12 : upside < -5 ? -6 : 0;
    total += delta;
    const recLabel = rec ? ` · ${rec.strongBuy}SB/${rec.buy}B/${rec.hold}H/${rec.sell}S` : '';
    gathered.push({ label:'Analyst Consensus',
      value:`$${ptRaw.targetMean.toFixed(0)} target · ${upside>0?'+':''}${upside.toFixed(0)}% upside${recLabel}`,
      direction: delta>0?'bullish':delta<0?'bearish':'neutral', delta, source:'Finnhub' });
  } else {
    gathered.push({ label:'Analyst Consensus', value:'No data', direction:'neutral', delta:0, source:'Finnhub', noData:true });
  }

  // Price momentum
  if (quote?.c && metric?.['52WeekHigh'] && metric?.['52WeekLow']) {
    const high52 = metric['52WeekHigh'], low52 = metric['52WeekLow'];
    const pctFromHigh = ((quote.c - high52) / high52) * 100;
    const range = high52 - low52;
    const posInRange = range > 0 ? ((quote.c - low52) / range) * 100 : 50;
    const delta = pctFromHigh > -8 ? +8 : pctFromHigh > -20 ? +4 : pctFromHigh > -35 ? 0 : pctFromHigh > -50 ? -5 : -10;
    total += delta;
    gathered.push({ label:'Price Momentum',
      value:`${pctFromHigh.toFixed(1)}% from 52w high · ${posInRange.toFixed(0)}% of range`,
      direction: delta>=4?'bullish':delta<=-5?'bearish':'neutral', delta, source:'Finnhub' });
  } else {
    gathered.push({ label:'Price Momentum', value:'No quote data', direction:'neutral', delta:0, source:'Finnhub', noData:true });
  }

  // ── 4. Short interest — Finnhub metric + FINRA bulk file ──────────────────
  const finnhubSI = metric?.shortInterestPercentage ?? null;
  const finraSI   = finraMap ? finraMap.get(t) : null;
  const sp = finnhubSI ?? finraSI;
  if (sp != null) {
    const delta = sp > 20 ? -10 : sp > 10 ? -5 : sp < 3 ? +5 : 0;
    total += delta;
    gathered.push({ label:'Short Interest', value:`${sp.toFixed(1)}% of float`,
      direction: sp>20?'bearish':sp>10?'neutral':'bullish', delta, source:'FINRA/Finnhub' });
  } else {
    gathered.push({ label:'Short Interest', value:'No data', direction:'neutral', delta:0, source:'FINRA/Finnhub', noData:true });
  }

  // ── 5. Congressional trading — from batch cache ────────────────────────────
  const congAll  = congData || [];
  const cutoff90 = new Date(Date.now() - 90 * 86400000);
  const congTrades = congAll.filter(tx => {
    const d = new Date(tx.Date || tx.TransactionDate || 0);
    return (tx.Ticker || '').toUpperCase() === t && d >= cutoff90;
  });
  if (congTrades.length > 0) {
    const buys  = congTrades.filter(tx => /purchase|buy/i.test(tx.Transaction || '')).length;
    const sells = congTrades.filter(tx => !/purchase|buy/i.test(tx.Transaction || '')).length;
    const delta = buys > sells + 1 ? +8 : buys < sells - 1 ? -8 : 0;
    total += delta;
    gathered.push({ label:'Congressional Trading', value:`${buys} buys / ${sells} sells (90d)`,
      direction: buys>sells?'bullish':buys<sells?'bearish':'neutral', delta, source:'STOCK Act' });
  } else {
    gathered.push({ label:'Congressional Trading', value:'No trades in 90d', direction:'neutral', delta:0, source:'STOCK Act', noData:true });
  }

  // ── 6. Insider — light EDGAR count (no XML parsing in batch) ─────────────
  // Note: full XML parsing with isBuy/isSell is too slow for batch.
  // We show filing count signal; use ConvictionPage for full buy/sell breakdown.
  const ins = await getInsiderSummary(t);
  if (ins && ins.count > 0) {
    // Treat recent filing activity as a mild bullish signal (activity = engagement)
    // ConvictionPage does the full buy/sell analysis from XML
    const delta = ins.count >= 5 ? +4 : ins.count >= 2 ? +2 : +1;
    total += delta;
    gathered.push({ label:'Insider Activity', value:`${ins.count} Form 4s in 90d (open in Conviction for buy/sell detail)`,
      direction:'neutral', delta, source:'SEC EDGAR' });
  } else {
    gathered.push({ label:'Insider Activity', value:'No Form 4s in 90d', direction:'neutral', delta:0, source:'SEC EDGAR', noData:true });
  }

  // ── 7. News Sentiment — skip in batch (requires NLP; use ConvictionPage) ──
  gathered.push({ label:'News Sentiment', value:'Open Conviction page for live sentiment', direction:'neutral', delta:0, source:'AI', noData:true });

  // ── 8. Options Flow — skip in batch (Yahoo scraping; use ConvictionPage) ──
  gathered.push({ label:'Options Flow', value:'Open Conviction page for options data', direction:'neutral', delta:0, source:'Yahoo Finance', noData:true });

  // ── 9. Upcoming Catalysts (MongoDB) ───────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const cats  = await Catalyst.find({ ticker: t, date: { $gte: today } }).lean().catch(() => []);
  if (cats.length > 0) {
    const high  = cats.filter(c => c.impact === 'high').length;
    const delta = high >= 2 ? +8 : high === 1 ? +4 : +2;
    total += delta;
    gathered.push({ label:'Upcoming Catalysts', value:`${cats.length} events · ${high} high impact`,
      direction:'bullish', delta, source:'Calendar' });
  } else {
    gathered.push({ label:'Upcoming Catalysts', value:'No upcoming events', direction:'neutral', delta:0, source:'Calendar', noData:true });
  }

  total = Math.min(100, Math.max(0, Math.round(total)));

  const activeSignals  = gathered.filter(s => !s.noData).length;
  const strategy       = getStrategy(total, gathered, t);
  const rating         = getRating(total);
  const currentPrice   = quote?.c   ?? null;
  const changePercent  = quote?.dp  ?? null;
  const name           = wl?.name   || t;

  return { symbol: t, name, score: total, rating, strategy, signals: gathered,
    currentPrice, changePercent, activeSignals, scoredAt: new Date() };
}

// ─── Batch score all watchlist tickers ───────────────────────────────────────
export async function scoreAllWatchlist(onProgress) {
  const watchlistItems = await Watchlist.find().sort({ addedAt: -1 });
  if (!watchlistItems.length) return { scored: 0, errors: 0, results: [] };

  const symbols = [...new Set(watchlistItems.map(w => w.symbol))];

  // Pre-load bulk data once — reused for every ticker
  console.log('Loading congressional + FINRA data…');
  batchCongData = null; batchFinraMap = null; // reset caches for fresh run
  const [congData, finraMap] = await Promise.all([loadCongData(), loadFinraMap()]);
  console.log(`Congressional trades: ${congData.length}, FINRA tickers: ${finraMap.size}`);

  const results = [];
  let errors    = 0;
  const BATCH   = 4; // 4 concurrent — each only 3 Finnhub calls

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch       = symbols.slice(i, i + BATCH);
    const batchResults = await Promise.allSettled(
      batch.map(sym => scoreTicker(sym, { congData, finraMap }))
    );

    for (let j = 0; j < batch.length; j++) {
      const sym = batch[j];
      const res = batchResults[j];
      if (res.status === 'fulfilled') {
        const data = res.value;
        await Score.findOneAndUpdate({ symbol: sym }, { $set: data }, { upsert: true, new: true });
        results.push({ symbol: sym, score: data.score, strategy: data.strategy });
        if (onProgress) onProgress({ symbol: sym, score: data.score, done: i + j + 1, total: symbols.length });
      } else {
        console.error(`Score failed for ${sym}:`, res.reason?.message);
        errors++;
        if (onProgress) onProgress({ symbol: sym, error: true, done: i + j + 1, total: symbols.length });
      }
    }

    // 1s pause between batches — Finnhub free tier is 60 calls/min
    if (i + BATCH < symbols.length) await new Promise(r => setTimeout(r, 1000));
  }

  return { scored: results.length, errors, results };
}
