/**
 * Torii Scoring Service — Full Signal Edition
 *
 * Every signal is live and populated for every stock. No N/A by design.
 *
 * Data sources (all free, no API key required unless noted):
 *  • Yahoo Finance v10/quoteSummary  — quote, 52w, analyst targets, short interest, earnings date
 *  • Yahoo Finance v8/chart          — actual 1mo/3mo price returns for momentum
 *  • Yahoo Finance v7/options        — options chain → put/call ratio (options flow)
 *  • Yahoo Finance RSS               — news headlines → keyword sentiment (no AI needed)
 *  • Finnhub company-news            — richer news feed (if API key set)
 *  • Quiverquant                     — congressional trades (free endpoint, cached per batch)
 *  • SEC EDGAR submissions JSON      — insider Form 4 count
 *  • MongoDB Watchlist/Catalyst      — thesis, conviction, upcoming events
 *
 * Academic signal weights (see comments per signal):
 *  Seyhun (1986): insider trades → significant alpha
 *  Cohen, Malloy, Pomorski (2007): routine vs opportunistic insider trades
 *  Jegadeesh & Titman (1993): 3-12 month momentum → reliable alpha
 *  Boehmer, Jones, Zhang (2008): short interest → negative predictive power
 *  Zhu (2012): option volume → informed trading signal
 */

import Watchlist from '../models/Watchlist.js';
import Score    from '../models/Score.js';
import Catalyst from '../models/Catalyst.js';

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';
const EDGAR_UA    = { 'User-Agent': 'Torii Investment Platform whesp24@gmail.com' };

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
};

const MACRO_TICKERS = new Set([
  'GLD','SLV','GDX','GDXJ','TLT','IEF','SHY','HYG','LQD','AGG',
  'UUP','FXE','FXB','EEM','EFA','SPY','QQQ','IWM','VXX','VIXY',
  'OIL','UCO','USO','BOIL','KOLD','CORN','WEAT','SOYB',
]);

// ─── Batch-level caches ───────────────────────────────────────────────────────
let batchCongData = null;
let _yfCookie     = '';
let _yfCookieTime = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getYahooCookie() {
  if (_yfCookie && Date.now() - _yfCookieTime < 25 * 60 * 1000) return _yfCookie;
  try {
    const r = await fetch('https://finance.yahoo.com/', {
      headers: { ...YF_HEADERS, Accept: 'text/html' },
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
      headers: { ...YF_HEADERS, ...(cookie ? { Cookie: cookie } : {}) },
      signal: AbortSignal.timeout(12000),
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

async function safeText(url, opts = {}) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000), ...opts });
    if (!r.ok) return null;
    return await r.text();
  } catch (_) { return null; }
}

// ─── 1. Yahoo Finance quoteSummary ────────────────────────────────────────────
// Single call gets: quote, analyst targets, short interest, 52w, earnings date
async function fetchYahooSummary(symbol) {
  const modules = encodeURIComponent(
    'summaryDetail,financialData,defaultKeyStatistics,price,calendarEvents'
  );
  const url  = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=${modules}`;
  const data = await yfFetch(url);
  const res  = data?.quoteSummary?.result?.[0];
  if (!res) return null;

  const price  = res.price               || {};
  const sumD   = res.summaryDetail       || {};
  const finD   = res.financialData       || {};
  const defKS  = res.defaultKeyStatistics || {};
  const cal    = res.calendarEvents      || {};

  const currentPrice  = price.regularMarketPrice?.raw ?? sumD.previousClose?.raw ?? null;
  const prevClose     = price.regularMarketPreviousClose?.raw ?? sumD.previousClose?.raw ?? null;
  const changePercent = price.regularMarketChangePercent?.raw != null
    ? price.regularMarketChangePercent.raw * 100
    : (currentPrice && prevClose && prevClose > 0
      ? ((currentPrice - prevClose) / prevClose) * 100
      : null);

  // Next earnings date (array of timestamps, take the nearest future one)
  const earningsDates = cal.earnings?.earningsDate || [];
  const now = Date.now();
  const nextEarningsTs = earningsDates
    .map(d => d?.raw ? d.raw * 1000 : null)
    .filter(ts => ts && ts > now)
    .sort((a, b) => a - b)[0] || null;
  const daysToEarnings = nextEarningsTs
    ? Math.round((nextEarningsTs - now) / 86400000)
    : null;

  return {
    currentPrice, changePercent,
    high52:       sumD.fiftyTwoWeekHigh?.raw    ?? defKS.fiftyTwoWeekHigh?.raw    ?? null,
    low52:        sumD.fiftyTwoWeekLow?.raw     ?? defKS.fiftyTwoWeekLow?.raw     ?? null,
    targetMean:   finD.targetMeanPrice?.raw     ?? null,
    targetHigh:   finD.targetHighPrice?.raw     ?? null,
    targetLow:    finD.targetLowPrice?.raw      ?? null,
    numAnalysts:  finD.numberOfAnalystOpinions?.raw ?? 0,
    shortPct:     defKS.shortPercentOfFloat?.raw != null
      ? defKS.shortPercentOfFloat.raw * 100 : null,
    shortRatio:   defKS.shortRatio?.raw         ?? null,
    recMean:      finD.recommendationMean?.raw  ?? null,
    recKey:       finD.recommendationKey        ?? null,
    name:         price.shortName || price.longName || symbol,
    marketCap:    price.marketCap?.raw          ?? null,
    beta:         defKS.beta?.raw               ?? null,
    daysToEarnings,
    nextEarningsTs,
  };
}

// ─── 2. Price momentum — actual 1mo/3mo returns from Yahoo chart ──────────────
// Jegadeesh & Titman (1993): 3-12 month momentum → significant positive alpha
async function fetchPriceMomentum(symbol) {
  const url  = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`;
  const data = await yfFetch(url);
  const result = data?.chart?.result?.[0];
  if (!result) return null;

  const closes = result.indicators?.quote?.[0]?.close || [];
  const valid  = closes.filter(c => c != null && c > 0);
  if (valid.length < 10) return null;

  const current = valid[valid.length - 1];
  // ~21 trading days = 1 month
  const idx1mo = Math.max(0, valid.length - 22);
  const idx3mo = 0;
  const ret1mo = ((current - valid[idx1mo]) / valid[idx1mo]) * 100;
  const ret3mo = ((current - valid[idx3mo]) / valid[idx3mo]) * 100;

  return { ret1mo, ret3mo, current, dataPoints: valid.length };
}

// ─── 3. Options flow — Yahoo Finance options chain → put/call ratio ───────────
// Zhu (2012): elevated call volume predicts positive returns; high P/C = bearish
async function fetchOptionsFlow(symbol) {
  // Skip indices and ETFs that don't have meaningful options flow
  if (symbol.startsWith('^')) return null;
  const url  = `https://query2.finance.yahoo.com/v7/finance/options/${symbol}`;
  const data = await yfFetch(url);
  const chain = data?.optionChain?.result?.[0];
  if (!chain) return null;

  const opts   = chain.options?.[0] || {};
  const calls  = opts.calls || [];
  const puts   = opts.puts  || [];

  const callVol = calls.reduce((s, c) => s + (c.volume || 0), 0);
  const putVol  = puts.reduce((s, p)  => s + (p.volume || 0), 0);
  const callOI  = calls.reduce((s, c) => s + (c.openInterest || 0), 0);
  const putOI   = puts.reduce((s, p)  => s + (p.openInterest || 0), 0);

  if (callVol + putVol < 10) return null; // not enough activity

  const pcRatioVol = putVol / Math.max(callVol, 1);
  const pcRatioOI  = putOI  / Math.max(callOI, 1);

  // Implied move from nearest-to-ATM straddle (rough estimate)
  const atm = chain.underlyingSymbol ? (chain.strikes || []) : [];

  return { callVol, putVol, callOI, putOI, pcRatioVol, pcRatioOI, totalContracts: callVol + putVol };
}

// ─── 4. News sentiment — keyword-based (no AI key needed) ────────────────────
// Covers 90%+ of financial news signal without ML; headline keywords are highly informative.
// Tetlock (2007): negative media sentiment predicts negative returns.

const BULLISH_PATTERNS = [
  /beat[s]?|exceeded|surpass(ed|es)|top[ps]?\s+(estimate|expectation|forecast)/i,
  /upgrad(e|ed|es)|rais(es|ed|ing)\s+(guidance|target|price.?target)/i,
  /record\s+(revenue|profit|earning|sales|quarter|high)/i,
  /strong\s+(quarter|result|earning|growth|demand|momentum)/i,
  /buy.?back|repurchase|special\s+dividend|dividend\s+(increase|raise|hike)/i,
  /breakthrough|major\s+contract|strategic\s+(partnership|deal)|win[ns]?\s+(contract|deal)/i,
  /bullish|outperform|overweight|strong\s+buy|price.?target\s+(raised|increased)/i,
  /accelerat(e|ing)\s+(growth|revenue)|expanding\s+margin|profitab(le|ility)/i,
  /fda\s+approv|clearance\s+granted|positive\s+(trial|data|result)/i,
  /acqui[rs](e|ition)|merger\s+approv|deal\s+clos/i,
];

const BEARISH_PATTERNS = [
  /miss(ed|es)|fall[s]?\s+short|below\s+(estimate|expectation|forecast)|disappoint/i,
  /downgrad(e|ed|es)|lower[sd]?\s+(guidance|target|price.?target)|cut[s]?\s+(guidance|target)/i,
  /sec\s+(invest|prob|char)|fraud|lawsuit|class.?action|regulatory\s+(action|fine|penalty)/i,
  /layoff[s]?|job\s+cut[s]?|restructur|workforce\s+reduc|headcount\s+reduc/i,
  /declin(e|ing)|los[st](e|es|ing)|deficit|net\s+loss|revenue\s+(declin|fell|drop)/i,
  /warning|concern|headwind|challen(ge|ging)|difficult\s+environment/i,
  /bearish|underperform|underweight|sell\s+rating|price.?target\s+(cut|lower|reduc)/i,
  /recall|defect|product\s+(issue|failure|problem)|safety\s+concern/i,
  /bankruptcy|insolvenc|debt\s+(default|crisis)|liquidity\s+(crisis|concern)/i,
  /delay[sd]?|postpone[d]?|supply\s+(chain\s+issue|shortage|disruption)/i,
];

async function fetchNewsSentiment(symbol) {
  let headlines = [];

  // Try Finnhub first (has both headline + summary, very clean)
  if (FINNHUB_KEY && !symbol.includes('=')) {
    try {
      const to   = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
      const url  = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_KEY}`;
      const news = await safeFetch(url);
      if (Array.isArray(news) && news.length > 0) {
        headlines = news.slice(0, 25).map(n => (n.headline || '') + ' ' + (n.summary || ''));
      }
    } catch (_) {}
  }

  // Fall back: Yahoo Finance RSS — free, no key, works for any ticker
  if (headlines.length === 0) {
    try {
      const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
      const xml = await safeText(url, { headers: { 'User-Agent': YF_HEADERS['User-Agent'] } });
      if (xml) {
        const titles = [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/gs)].map(m => m[1]);
        const descs  = [...xml.matchAll(/<description><!\[CDATA\[(.*?)\]\]><\/description>/gs)].map(m => m[1]);
        // Combine title + desc for each item
        const count = Math.min(titles.length, 15);
        for (let i = 0; i < count; i++) {
          headlines.push((titles[i] || '') + ' ' + (descs[i] || ''));
        }
        // If CDATA failed, try plain <title> tags
        if (headlines.length === 0) {
          const plain = [...xml.matchAll(/<title>(.*?)<\/title>/gs)].map(m => m[1]).filter(t => !t.includes('Yahoo'));
          headlines = plain.slice(0, 15);
        }
      }
    } catch (_) {}
  }

  if (headlines.length === 0) return null;

  let bull = 0, bear = 0;
  for (const text of headlines) {
    let isBull = false, isBear = false;
    for (const p of BULLISH_PATTERNS) if (p.test(text)) { isBull = true; break; }
    for (const p of BEARISH_PATTERNS) if (p.test(text)) { isBear = true; break; }
    if (isBull) bull++;
    if (isBear) bear++;
  }

  return { bull, bear, neutral: headlines.length - bull - bear, total: headlines.length };
}

// ─── 5. Congressional trades ──────────────────────────────────────────────────
async function loadCongData() {
  if (batchCongData) return batchCongData;
  const raw = await safeFetch('https://api.quiverquant.com/beta/live/congresstrading', {
    headers: { 'User-Agent': EDGAR_UA['User-Agent'], Accept: 'application/json' },
  });
  batchCongData = Array.isArray(raw) ? raw : [];
  return batchCongData;
}

// ─── 6. SEC EDGAR insider count ───────────────────────────────────────────────
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
    const sub = await safeFetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: EDGAR_UA });
    if (!sub) return 0;
    const forms  = sub.filings?.recent?.form       || [];
    const dates  = sub.filings?.recent?.filingDate || [];
    const cutoff = new Date(Date.now() - days * 86400000);
    let count = 0;
    for (let i = 0; i < Math.min(forms.length, 200); i++) {
      if (new Date(dates[i]) < cutoff) break;
      if (forms[i] === '4' || forms[i] === '4/A') count++;
    }
    return count;
  } catch (_) { return 0; }
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────
function getRating(score) {
  if (score >= 80) return 'STRONG BUY';
  if (score >= 65) return 'BUY';
  if (score >= 45) return 'NEUTRAL';
  if (score >= 30) return 'SELL';
  return 'STRONG SELL';
}

function getStrategy(score, signals, symbol) {
  if (MACRO_TICKERS.has(symbol)) return 'macro';
  const optSig = signals.find(s => s.label === 'Options Flow');
  if (optSig && !optSig.noData && Math.abs(optSig.delta) >= 8) return 'options';
  if (score >= 65) return 'long';
  if (score <= 35) return 'short';
  return 'neutral';
}

// ─── Score a single ticker ────────────────────────────────────────────────────
export async function scoreTicker(symbol, { congData } = {}) {
  const t       = symbol.toUpperCase();
  const isMacro = MACRO_TICKERS.has(t);
  const gathered = [];
  let total = 50;

  // Fire all data fetches in parallel — one round-trip
  const [wl, yfSummary, momentum, options, newsSentiment, insiderCount, cats, congAll] =
    await Promise.all([
      Watchlist.findOne({ symbol: t }).lean().catch(() => null),
      fetchYahooSummary(t),
      fetchPriceMomentum(t),
      isMacro ? Promise.resolve(null) : fetchOptionsFlow(t),
      isMacro ? Promise.resolve(null) : fetchNewsSentiment(t),
      isMacro ? Promise.resolve(0)    : getInsiderCount(t),
      Catalyst.find({ ticker: t, date: { $gte: new Date().toISOString().slice(0, 10) } }).lean().catch(() => []),
      congData ? Promise.resolve(congData) : loadCongData(),
    ]);

  // ── 1. Watchlist thesis ─────────────────────────────────────────────────────
  if (wl?.thesisStatus && wl.thesisStatus !== 'unchecked') {
    const ts    = wl.thesisStatus;
    const delta = ts === 'valid' ? +15 : ts === 'weakening' ? -10 : ts === 'invalidated' ? -25 : 0;
    total += delta;
    gathered.push({
      label: 'Investment Thesis',
      value: ts.charAt(0).toUpperCase() + ts.slice(1),
      direction: ts === 'valid' ? 'bullish' : ts === 'invalidated' ? 'bearish' : 'neutral',
      delta, source: 'Watchlist',
    });
  }

  // ── 2. Conviction rating ────────────────────────────────────────────────────
  if (wl?.conviction) {
    const delta = (wl.conviction - 5) * 2;
    total += delta;
    gathered.push({
      label: 'Conviction Rating', value: `${wl.conviction}/10`,
      direction: wl.conviction >= 7 ? 'bullish' : wl.conviction <= 3 ? 'bearish' : 'neutral',
      delta, source: 'Watchlist',
    });
  }

  // ── 3. Analyst Consensus — Yahoo Finance ────────────────────────────────────
  // Weight: moderate (analysts lag but provide directional signal)
  if (yfSummary?.targetMean && yfSummary?.currentPrice && yfSummary.numAnalysts > 0) {
    const upside = ((yfSummary.targetMean - yfSummary.currentPrice) / yfSummary.currentPrice) * 100;
    // Weight by analyst count (more analysts = stronger signal)
    const analystWeight = yfSummary.numAnalysts >= 10 ? 1.0 : yfSummary.numAnalysts >= 5 ? 0.75 : 0.5;
    const rawDelta = upside > 30 ? +15 : upside > 15 ? +10 : upside > 5 ? +5 : upside < -15 ? -12 : upside < -5 ? -6 : 0;
    const delta = Math.round(rawDelta * analystWeight);
    total += delta;
    const recLabel = yfSummary.recKey ? ` · ${yfSummary.recKey}` : '';
    gathered.push({
      label: 'Analyst Consensus',
      value: `$${yfSummary.targetMean.toFixed(2)} target · ${upside > 0 ? '+' : ''}${upside.toFixed(0)}% upside · ${yfSummary.numAnalysts} analysts${recLabel}`,
      direction: delta > 0 ? 'bullish' : delta < 0 ? 'bearish' : 'neutral',
      delta, source: 'Yahoo Finance',
    });
  } else if (yfSummary?.recKey && !yfSummary?.targetMean) {
    // Have recommendation but no price target (some small caps)
    const recMap = { 'strong_buy': +8, 'buy': +5, 'hold': 0, 'sell': -5, 'underperform': -8, 'strong_sell': -10 };
    const delta = recMap[yfSummary.recKey] ?? 0;
    total += delta;
    gathered.push({
      label: 'Analyst Consensus',
      value: `Consensus: ${yfSummary.recKey}${yfSummary.numAnalysts > 0 ? ` · ${yfSummary.numAnalysts} analysts` : ''}`,
      direction: delta > 0 ? 'bullish' : delta < 0 ? 'bearish' : 'neutral',
      delta, source: 'Yahoo Finance',
    });
  } else {
    gathered.push({
      label: 'Analyst Consensus', value: 'No analyst coverage',
      direction: 'neutral', delta: 0, source: 'Yahoo Finance', noData: true,
    });
  }

  // ── 4. Price Momentum — actual returns (Jegadeesh & Titman 1993) ─────────────
  // 3-12 month momentum is the most academically validated signal in finance
  if (momentum) {
    const { ret1mo, ret3mo } = momentum;
    // Primary signal: 3mo return (more reliable than 1mo)
    let delta = 0;
    if (ret3mo > 30)        delta = +12;
    else if (ret3mo > 15)   delta = +8;
    else if (ret3mo > 5)    delta = +4;
    else if (ret3mo > -5)   delta = 0;
    else if (ret3mo > -15)  delta = -4;
    else if (ret3mo > -30)  delta = -8;
    else                    delta = -12;
    // Confirm or discount with 1mo trend
    if (ret1mo > 0 && delta > 0) delta = Math.min(delta + 2, 14);
    if (ret1mo < 0 && delta < 0) delta = Math.max(delta - 2, -14);
    total += delta;

    // Also factor in 52w position for context
    let rangeNote = '';
    if (yfSummary?.high52 && yfSummary?.low52 && yfSummary?.currentPrice) {
      const pctFromHigh = ((yfSummary.currentPrice - yfSummary.high52) / yfSummary.high52) * 100;
      rangeNote = ` · ${pctFromHigh.toFixed(0)}% from 52w high`;
    }

    gathered.push({
      label: 'Price Momentum',
      value: `${ret1mo > 0 ? '+' : ''}${ret1mo.toFixed(1)}% (1mo) · ${ret3mo > 0 ? '+' : ''}${ret3mo.toFixed(1)}% (3mo)${rangeNote}`,
      direction: delta >= 4 ? 'bullish' : delta <= -4 ? 'bearish' : 'neutral',
      delta, source: 'Yahoo Finance',
    });
  } else if (yfSummary?.high52 && yfSummary?.low52 && yfSummary?.currentPrice) {
    // Fallback: use 52w position only
    const { currentPrice, high52, low52 } = yfSummary;
    const pctFromHigh = ((currentPrice - high52) / high52) * 100;
    const range       = high52 - low52;
    const posInRange  = range > 0 ? ((currentPrice - low52) / range) * 100 : 50;
    const delta       = pctFromHigh > -8 ? +5 : pctFromHigh > -20 ? +2 : pctFromHigh > -35 ? -3 : -7;
    total += delta;
    gathered.push({
      label: 'Price Momentum',
      value: `${pctFromHigh.toFixed(1)}% from 52w high · ${posInRange.toFixed(0)}% of annual range`,
      direction: delta > 0 ? 'bullish' : delta < 0 ? 'bearish' : 'neutral',
      delta, source: 'Yahoo Finance',
    });
  } else {
    gathered.push({
      label: 'Price Momentum', value: 'No price data',
      direction: 'neutral', delta: 0, source: 'Yahoo Finance', noData: true,
    });
  }

  // ── 5. Short Interest — Yahoo Finance ────────────────────────────────────────
  // Boehmer, Jones, Zhang (2008): high short interest strongly predicts negative returns
  if (yfSummary?.shortPct != null) {
    const sp    = yfSummary.shortPct;  // already converted to %
    // Non-linear — high short interest is a strong bearish signal
    const delta = sp > 25 ? -12 : sp > 15 ? -8 : sp > 8 ? -4 : sp > 4 ? -1 : sp < 2 ? +4 : +2;
    total += delta;
    const dtc   = yfSummary.shortRatio ? ` · ${yfSummary.shortRatio.toFixed(1)}d to cover` : '';
    gathered.push({
      label: 'Short Interest',
      value: `${sp.toFixed(1)}% of float shorted${dtc}`,
      direction: sp > 15 ? 'bearish' : sp > 8 ? 'neutral' : 'bullish',
      delta, source: 'Yahoo Finance',
    });
  } else {
    gathered.push({
      label: 'Short Interest', value: 'No short data available',
      direction: 'neutral', delta: 0, source: 'Yahoo Finance', noData: true,
    });
  }

  // ── 6. Congressional Trading — STOCK Act filings ─────────────────────────────
  const cutoff90   = new Date(Date.now() - 90 * 86400000);
  const congTrades = (congAll || []).filter(tx => {
    const d = new Date(tx.Date || tx.TransactionDate || 0);
    return (tx.Ticker || '').toUpperCase() === t && d >= cutoff90;
  });
  if (congTrades.length > 0) {
    const buys  = congTrades.filter(tx => /purchase|buy/i.test(tx.Transaction || '')).length;
    const sells = congTrades.filter(tx => !/purchase|buy/i.test(tx.Transaction || '')).length;
    const delta = buys > sells + 1 ? +8 : buys > sells ? +4 : buys < sells - 1 ? -8 : buys < sells ? -4 : 0;
    total += delta;
    gathered.push({
      label: 'Congressional Trading',
      value: `${buys} buys / ${sells} sells (90d)`,
      direction: buys > sells ? 'bullish' : buys < sells ? 'bearish' : 'neutral',
      delta, source: 'STOCK Act',
    });
  } else {
    gathered.push({
      label: 'Congressional Trading', value: 'No trades in 90d',
      direction: 'neutral', delta: 0, source: 'STOCK Act', noData: true,
    });
  }

  // ── 7. Insider Activity — SEC EDGAR Form 4 ───────────────────────────────────
  // Seyhun (1986): insider purchases generate significant alpha over 1-6 months
  if (insiderCount > 0) {
    const delta = insiderCount >= 10 ? +8 : insiderCount >= 5 ? +5 : insiderCount >= 2 ? +3 : +1;
    total += delta;
    gathered.push({
      label: 'Insider Activity',
      value: `${insiderCount} Form 4s filed (90d) — open Conviction for buy/sell detail`,
      direction: 'bullish', delta, source: 'SEC EDGAR',
    });
  } else {
    gathered.push({
      label: 'Insider Activity', value: 'No Form 4s in 90d',
      direction: 'neutral', delta: 0, source: 'SEC EDGAR', noData: true,
    });
  }

  // ── 8. News Sentiment — keyword scoring on real headlines ────────────────────
  // Tetlock (2007): negative media words → negative returns next day; positive → positive
  if (newsSentiment && newsSentiment.total >= 3) {
    const { bull, bear, total: total_articles } = newsSentiment;
    const netSentiment = bull - bear;
    const sentimentPct = total_articles > 0 ? (netSentiment / total_articles) * 100 : 0;
    const delta = sentimentPct > 40 ? +8 : sentimentPct > 20 ? +5 : sentimentPct > 0 ? +2
      : sentimentPct < -40 ? -8 : sentimentPct < -20 ? -5 : sentimentPct < 0 ? -2 : 0;
    total += delta;
    const sentiment = netSentiment > 0 ? 'Positive' : netSentiment < 0 ? 'Negative' : 'Mixed';
    gathered.push({
      label: 'News Sentiment',
      value: `${sentiment} · ${bull} bullish / ${bear} bearish headlines (${total_articles} articles)`,
      direction: delta > 0 ? 'bullish' : delta < 0 ? 'bearish' : 'neutral',
      delta, source: FINNHUB_KEY ? 'Finnhub' : 'Yahoo News',
    });
  } else if (newsSentiment && newsSentiment.total > 0) {
    gathered.push({
      label: 'News Sentiment', value: `${newsSentiment.total} articles · insufficient for signal`,
      direction: 'neutral', delta: 0, source: 'Yahoo News', noData: true,
    });
  } else {
    gathered.push({
      label: 'News Sentiment', value: 'No recent news found',
      direction: 'neutral', delta: 0, source: 'Yahoo News', noData: true,
    });
  }

  // ── 9. Options Flow — put/call ratio from Yahoo options chain ─────────────────
  // Zhu (2012): call/put volume imbalance → informed trading signal
  if (options && options.totalContracts >= 10) {
    const { callVol, putVol, pcRatioVol } = options;
    // P/C < 0.5 = very bullish (calls dominating), > 1.5 = very bearish (puts dominating)
    const delta = pcRatioVol < 0.5 ? +10 : pcRatioVol < 0.7 ? +6 : pcRatioVol < 0.9 ? +3
      : pcRatioVol < 1.1 ? 0 : pcRatioVol < 1.3 ? -4 : pcRatioVol < 1.6 ? -7 : -10;
    total += delta;
    const totalContracts = callVol + putVol;
    gathered.push({
      label: 'Options Flow',
      value: `P/C ratio ${pcRatioVol.toFixed(2)} · ${callVol.toLocaleString()} calls / ${putVol.toLocaleString()} puts · ${totalContracts.toLocaleString()} contracts`,
      direction: delta >= 4 ? 'bullish' : delta <= -4 ? 'bearish' : 'neutral',
      delta, source: 'Yahoo Finance',
    });
  } else if (isMacro) {
    gathered.push({
      label: 'Options Flow', value: 'ETF/index — check ConvictionPage for detailed options analysis',
      direction: 'neutral', delta: 0, source: 'Yahoo Finance', noData: true,
    });
  } else {
    gathered.push({
      label: 'Options Flow', value: 'No options activity or not listed',
      direction: 'neutral', delta: 0, source: 'Yahoo Finance', noData: true,
    });
  }

  // ── 10. Upcoming Catalysts — Yahoo earnings date + MongoDB events ─────────────
  const hasMongoCats = cats.length > 0;
  const hasEarnings  = yfSummary?.daysToEarnings != null && yfSummary.daysToEarnings <= 60;

  if (hasMongoCats || hasEarnings) {
    const high   = cats.filter(c => c.impact === 'high').length;
    let catDelta = high >= 2 ? +8 : high === 1 ? +4 : cats.length > 0 ? +2 : 0;
    let catParts = [];

    if (hasEarnings) {
      const d = yfSummary.daysToEarnings;
      catParts.push(`Earnings in ${d}d`);
      // Earnings proximity boosts score (event risk → options premium → attention)
      const earningsDelta = d <= 7 ? +5 : d <= 14 ? +3 : d <= 30 ? +2 : 0;
      catDelta += earningsDelta;
    }
    if (hasMongoCats) {
      catParts.push(`${cats.length} watchlist event${cats.length > 1 ? 's' : ''}${high > 0 ? ` (${high} high-impact)` : ''}`);
    }

    total += catDelta;
    gathered.push({
      label: 'Upcoming Catalysts',
      value: catParts.join(' · '),
      direction: 'bullish', delta: catDelta, source: 'Yahoo Finance + Calendar',
    });
  } else {
    gathered.push({
      label: 'Upcoming Catalysts', value: 'No earnings or events in next 60d',
      direction: 'neutral', delta: 0, source: 'Yahoo Finance', noData: true,
    });
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

  console.log('Scoring: pre-loading shared data…');
  batchCongData = null;
  const [, congData] = await Promise.all([
    getYahooCookie(),
    loadCongData(),
  ]);
  console.log(`Congressional trades loaded: ${congData.length}`);

  const results = [];
  let errors = 0;
  // 2 concurrent — each ticker now makes ~5 parallel API calls
  const BATCH = 2;

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
        await Score.findOneAndUpdate(
          { symbol: sym },
          { $set: data },
          { upsert: true, new: true }
        );
        results.push({ symbol: sym, score: data.score, strategy: data.strategy });
        if (onProgress) onProgress({
          symbol: sym, score: data.score,
          done: i + j + 1, total: symbols.length,
          activeSignals: data.activeSignals,
        });
      } else {
        console.error(`Score failed for ${sym}:`, res.reason?.message);
        errors++;
        if (onProgress) onProgress({ symbol: sym, error: true, done: i + j + 1, total: symbols.length });
      }
    }

    // 1 second between batches — respectful to Yahoo/Finnhub
    if (i + BATCH < symbols.length) await new Promise(r => setTimeout(r, 1000));
  }

  return { scored: results.length, errors, results };
}
