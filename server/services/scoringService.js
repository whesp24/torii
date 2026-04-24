/**
 * Torii Scoring Service — Yahoo Finance Primary Edition
 *
 * Data sources (all free, no API key required unless noted):
 *  • Yahoo Finance v10/quoteSummary  — quote, 52w, analyst targets, short interest
 *  • Quiverquant                     — congressional trades (free endpoint, cached)
 *  • SEC EDGAR submissions JSON      — insider Form 4 count (no XML parsing in batch)
 *  • MongoDB Watchlist/Catalyst      — thesis, conviction, upcoming events
 *  • Finnhub (optional)              — additional analyst data when key is available
 *
 * No self-HTTP calls, no PORT dependency. Works on Render without env vars.
 */

import Watchlist from '../models/Watchlist.js';
import Score    from '../models/Score.js';
import Catalyst from '../models/Catalyst.js';

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';
const EDGAR_UA    = { 'User-Agent': 'Torii Investment Platform whesp24@gmail.com' };

// Yahoo Finance User-Agent header
const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
};

// ─── Macro / ETF tickers → strategy='macro' ──────────────────────────────────
const MACRO_TICKERS = new Set([
  'GLD','SLV','GDX','GDXJ','TLT','IEF','SHY','HYG','LQD','AGG',
  'UUP','FXE','FXB','EEM','EFA','SPY','QQQ','IWM','VXX','VIXY',
  'OIL','UCO','USO','BOIL','KOLD','CORN','WEAT','SOYB',
]);

// ─── Batch-level caches ───────────────────────────────────────────────────────
let batchCongData = null;   // raw Quiverquant array for this run
let _yfCookie     = '';
let _yfCookieTime = 0;

// ─── Yahoo Finance cookie ─────────────────────────────────────────────────────
async function getYahooCookie() {
  if (_yfCookie && Date.now() - _yfCookieTime < 25 * 60 * 1000) return _yfCookie;
  try {
    const r = await fetch('https://finance.yahoo.com/', {
      headers: { ...YF_HEADERS, 'Accept': 'text/html' },
      signal: AbortSignal.timeout(8000),
    });
    const raw = r.headers.get('set-cookie') || '';
    _yfCookie = raw.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
    _yfCookieTime = Date.now();
  } catch (_) {}
  return _yfCookie;
}

async function yfFetch(url) {
  try {
    const cookie = await getYahooCookie();
    const r = await fetch(url, {
      headers: { ...YF_HEADERS, ...(cookie ? { 'Cookie': cookie } : {}) },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; }
}

async function safeFetch(url, opts = {}) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000), ...opts });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; }
}

// ─── Yahoo Finance quoteSummary — single call returns everything ──────────────
// Returns: { quote, high52, low52, targetMean, numAnalysts, shortPct, recMean, recKey }
async function fetchYahooSummary(symbol) {
  const modules = [
    'summaryDetail',
    'financialData',
    'defaultKeyStatistics',
    'price',
  ].join('%2C');
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=${modules}`;
  const data = await yfFetch(url);
  const res  = data?.quoteSummary?.result?.[0];
  if (!res) return null;

  const price = res.price        || {};
  const sumD  = res.summaryDetail|| {};
  const finD  = res.financialData|| {};
  const defKS = res.defaultKeyStatistics || {};

  const currentPrice = price.regularMarketPrice?.raw ?? sumD.previousClose?.raw ?? null;
  const prevClose    = price.regularMarketPreviousClose?.raw ?? sumD.previousClose?.raw ?? null;
  const changePercent= price.regularMarketChangePercent?.raw
    ? price.regularMarketChangePercent.raw * 100
    : (currentPrice && prevClose && prevClose > 0 ? ((currentPrice - prevClose) / prevClose) * 100 : null);

  return {
    currentPrice,
    changePercent,
    high52:      sumD.fiftyTwoWeekHigh?.raw     ?? defKS.fiftyTwoWeekHigh?.raw     ?? null,
    low52:       sumD.fiftyTwoWeekLow?.raw      ?? defKS.fiftyTwoWeekLow?.raw      ?? null,
    targetMean:  finD.targetMeanPrice?.raw      ?? null,
    targetHigh:  finD.targetHighPrice?.raw      ?? null,
    targetLow:   finD.targetLowPrice?.raw       ?? null,
    numAnalysts: finD.numberOfAnalystOpinions?.raw ?? 0,
    shortPct:    defKS.shortPercentOfFloat?.raw  // e.g. 0.045 = 4.5%
      ? defKS.shortPercentOfFloat.raw * 100
      : null,
    shortRatio:  defKS.shortRatio?.raw          ?? null,  // days to cover
    recMean:     finD.recommendationMean?.raw   ?? null,  // 1=strong buy, 5=strong sell
    recKey:      finD.recommendationKey         ?? null,  // "buy", "hold", etc.
    name:        price.shortName || price.longName || symbol,
    marketCap:   price.marketCap?.raw           ?? null,
    beta:        defKS.beta?.raw                ?? null,
  };
}

// ─── Congressional data — bulk load once per batch ───────────────────────────
async function loadCongData() {
  if (batchCongData) return batchCongData;
  const raw = await safeFetch('https://api.quiverquant.com/beta/live/congresstrading', {
    headers: { 'User-Agent': EDGAR_UA['User-Agent'], 'Accept': 'application/json' },
  });
  batchCongData = Array.isArray(raw) ? raw : [];
  return batchCongData;
}

// ─── SEC EDGAR insider count (submissions JSON only — no XML) ─────────────────
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

async function getInsiderCount(ticker, days = 90) {
  try {
    const cik = await tickerToCIK(ticker);
    if (!cik) return 0;
    const sub  = await safeFetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: EDGAR_UA });
    if (!sub) return 0;
    const recent  = sub.filings?.recent || {};
    const forms   = recent.form        || [];
    const dates   = recent.filingDate  || [];
    const cutoff  = new Date(Date.now() - days * 86400000);
    let count = 0;
    for (let i = 0; i < Math.min(forms.length, 200); i++) {
      if (new Date(dates[i]) < cutoff) break;
      if (forms[i] === '4' || forms[i] === '4/A') count++;
    }
    return count;
  } catch (_) { return 0; }
}

// ─── Rating + strategy ────────────────────────────────────────────────────────
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

// ─── Score a single ticker ────────────────────────────────────────────────────
export async function scoreTicker(symbol, { congData } = {}) {
  const t = symbol.toUpperCase();
  const gathered = [];
  let total = 50;

  // Fire everything in parallel
  const [wl, yfSummary, insiderCount, cats, congAll] = await Promise.all([
    Watchlist.findOne({ symbol: t }).lean().catch(() => null),
    fetchYahooSummary(t),
    getInsiderCount(t),
    Catalyst.find({ ticker: t, date: { $gte: new Date().toISOString().slice(0, 10) } }).lean().catch(() => []),
    congData ? Promise.resolve(congData) : loadCongData(),
  ]);

  // ── 1. Watchlist thesis + conviction ──────────────────────────────────────
  if (wl) {
    const ts = wl.thesisStatus;
    if (ts && ts !== 'unchecked') {
      const delta = ts === 'valid' ? +15 : ts === 'weakening' ? -10 : ts === 'invalidated' ? -25 : 0;
      total += delta;
      gathered.push({ label:'Investment Thesis',
        value: ts.charAt(0).toUpperCase() + ts.slice(1),
        direction: ts==='valid'?'bullish':ts==='invalidated'?'bearish':'neutral',
        delta, source:'Watchlist' });
    }
    if (wl.conviction) {
      const cd = (wl.conviction - 5) * 2;
      total += cd;
      gathered.push({ label:'Conviction Rating', value:`${wl.conviction}/10`,
        direction: wl.conviction>=7?'bullish':wl.conviction<=3?'bearish':'neutral',
        delta:cd, source:'Watchlist' });
    }
  }

  // ── 2. Analyst consensus — Yahoo Finance (works for small caps too) ────────
  if (yfSummary?.targetMean && yfSummary?.currentPrice) {
    const upside = ((yfSummary.targetMean - yfSummary.currentPrice) / yfSummary.currentPrice) * 100;
    const delta  = upside > 30 ? +15 : upside > 15 ? +10 : upside > 5 ? +5 : upside < -15 ? -12 : upside < -5 ? -6 : 0;
    total += delta;
    const nA = yfSummary.numAnalysts > 0 ? ` · ${yfSummary.numAnalysts} analysts` : '';
    const recLabel = yfSummary.recKey ? ` · consensus: ${yfSummary.recKey}` : '';
    gathered.push({ label:'Analyst Consensus',
      value:`$${yfSummary.targetMean.toFixed(2)} target · ${upside>0?'+':''}${upside.toFixed(0)}% upside${nA}${recLabel}`,
      direction: delta>0?'bullish':delta<0?'bearish':'neutral', delta, source:'Yahoo Finance' });
  } else {
    gathered.push({ label:'Analyst Consensus', value:'No analyst coverage',
      direction:'neutral', delta:0, source:'Yahoo Finance', noData:true });
  }

  // ── 3. Price momentum — 52w position (Yahoo Finance) ─────────────────────
  if (yfSummary?.currentPrice && yfSummary?.high52 && yfSummary?.low52) {
    const { currentPrice, high52, low52 } = yfSummary;
    const pctFromHigh = ((currentPrice - high52) / high52) * 100;
    const range       = high52 - low52;
    const posInRange  = range > 0 ? ((currentPrice - low52) / range) * 100 : 50;
    const delta = pctFromHigh > -8 ? +8 : pctFromHigh > -20 ? +4 : pctFromHigh > -35 ? 0 : pctFromHigh > -50 ? -5 : -10;
    total += delta;
    gathered.push({ label:'Price Momentum',
      value:`${pctFromHigh.toFixed(1)}% from 52w high · ${posInRange.toFixed(0)}% of range`,
      direction: delta>=4?'bullish':delta<=-5?'bearish':'neutral', delta, source:'Yahoo Finance' });
  } else {
    gathered.push({ label:'Price Momentum', value:'No price data',
      direction:'neutral', delta:0, source:'Yahoo Finance', noData:true });
  }

  // ── 4. Short interest — Yahoo Finance (works for micro-caps) ──────────────
  if (yfSummary?.shortPct != null) {
    const sp    = yfSummary.shortPct;
    const delta = sp > 20 ? -10 : sp > 10 ? -5 : sp < 3 ? +5 : 0;
    total += delta;
    const daysCover = yfSummary.shortRatio ? ` · ${yfSummary.shortRatio.toFixed(1)}d to cover` : '';
    gathered.push({ label:'Short Interest',
      value:`${sp.toFixed(1)}% of float${daysCover}`,
      direction: sp>20?'bearish':sp>10?'neutral':'bullish', delta, source:'Yahoo Finance' });
  } else {
    gathered.push({ label:'Short Interest', value:'No data',
      direction:'neutral', delta:0, source:'Yahoo Finance', noData:true });
  }

  // ── 5. Congressional trading ───────────────────────────────────────────────
  const cutoff90  = new Date(Date.now() - 90 * 86400000);
  const congTrades = (congAll || []).filter(tx => {
    const d = new Date(tx.Date || tx.TransactionDate || 0);
    return (tx.Ticker || '').toUpperCase() === t && d >= cutoff90;
  });
  if (congTrades.length > 0) {
    const buys  = congTrades.filter(tx => /purchase|buy/i.test(tx.Transaction || '')).length;
    const sells = congTrades.filter(tx => !/purchase|buy/i.test(tx.Transaction || '')).length;
    const delta = buys > sells + 1 ? +8 : buys < sells - 1 ? -8 : 0;
    total += delta;
    gathered.push({ label:'Congressional Trading',
      value:`${buys} buys / ${sells} sells (90d)`,
      direction: buys>sells?'bullish':buys<sells?'bearish':'neutral', delta, source:'STOCK Act' });
  } else {
    gathered.push({ label:'Congressional Trading', value:'No trades in 90d',
      direction:'neutral', delta:0, source:'STOCK Act', noData:true });
  }

  // ── 6. Insider Form 4 activity — EDGAR count ──────────────────────────────
  // Full buy/sell breakdown is available in ConvictionPage (too slow for batch)
  if (insiderCount > 0) {
    const delta = insiderCount >= 8 ? +6 : insiderCount >= 3 ? +3 : +1;
    total += delta;
    gathered.push({ label:'Insider Activity',
      value:`${insiderCount} Form 4s filed (90d) — open Conviction for buy/sell detail`,
      direction:'neutral', delta, source:'SEC EDGAR' });
  } else {
    gathered.push({ label:'Insider Activity', value:'No Form 4s in 90d',
      direction:'neutral', delta:0, source:'SEC EDGAR', noData:true });
  }

  // ── 7. News Sentiment — skip in batch (NLP too slow; use ConvictionPage) ──
  gathered.push({ label:'News Sentiment', value:'Run full Conviction analysis for live sentiment',
    direction:'neutral', delta:0, source:'AI', noData:true });

  // ── 8. Options Flow — skip in batch (scraping too slow; use ConvictionPage) ─
  gathered.push({ label:'Options Flow', value:'Run full Conviction analysis for options data',
    direction:'neutral', delta:0, source:'Yahoo Finance', noData:true });

  // ── 9. Upcoming catalysts (MongoDB) ───────────────────────────────────────
  if (cats.length > 0) {
    const high  = cats.filter(c => c.impact === 'high').length;
    const delta = high >= 2 ? +8 : high === 1 ? +4 : +2;
    total += delta;
    gathered.push({ label:'Upcoming Catalysts',
      value:`${cats.length} events · ${high} high impact`,
      direction:'bullish', delta, source:'Calendar' });
  } else {
    gathered.push({ label:'Upcoming Catalysts', value:'No upcoming events',
      direction:'neutral', delta:0, source:'Calendar', noData:true });
  }

  total = Math.min(100, Math.max(0, Math.round(total)));
  const activeSignals = gathered.filter(s => !s.noData).length;

  return {
    symbol:        t,
    name:          wl?.name || yfSummary?.name || t,
    score:         total,
    rating:        getRating(total),
    strategy:      getStrategy(total, gathered, t),
    signals:       gathered,
    currentPrice:  yfSummary?.currentPrice  ?? null,
    changePercent: yfSummary?.changePercent ?? null,
    activeSignals,
    scoredAt:      new Date(),
  };
}

// ─── Batch score all watchlist tickers ───────────────────────────────────────
export async function scoreAllWatchlist(onProgress) {
  const watchlistItems = await Watchlist.find().sort({ addedAt: -1 });
  if (!watchlistItems.length) return { scored: 0, errors: 0, results: [] };

  const symbols = [...new Set(watchlistItems.map(w => w.symbol))];

  // Pre-load Yahoo cookie + congressional data once
  console.log('Scoring: pre-loading shared data…');
  batchCongData = null;
  const [, congData] = await Promise.all([
    getYahooCookie(),   // warm up the cookie
    loadCongData(),     // congressional trades
  ]);
  console.log(`Congressional trades loaded: ${congData.length}`);

  const results = [];
  let errors = 0;
  // 3 concurrent — Yahoo Finance quoteSummary + EDGAR = ~2-3 calls per ticker
  const BATCH = 3;

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch        = symbols.slice(i, i + BATCH);
    const batchResults = await Promise.allSettled(
      batch.map(sym => scoreTicker(sym, { congData }))
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

    // 800ms between batches — polite to Yahoo Finance
    if (i + BATCH < symbols.length) await new Promise(r => setTimeout(r, 800));
  }

  return { scored: results.length, errors, results };
}
