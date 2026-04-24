import express from 'express';
import Stock from '../models/Stock.js';
import { fetchLiveQuote, fetchFinnhubChart, fetchYahooChart } from '../services/stockService.js';
import yahooFinance from 'yahoo-finance2';

const router = express.Router();
const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';

// Get all stocks
router.get('/', async (req, res) => {
  try {
    const stocks = await Stock.find().sort({ changePercent: -1 });
    res.json(stocks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Historical chart data — Finnhub for US stocks, Yahoo+cookie for indices/forex
router.get('/chart/:symbol', async (req, res) => {
  const sym = req.params.symbol.toUpperCase();
  const range = req.query.range || '1mo';
  const isIndex = sym.startsWith('^') || sym.includes('=') || sym.endsWith('.T');

  try {
    let points = [];
    if (!isIndex && process.env.FINNHUB_API_KEY) {
      try {
        points = await fetchFinnhubChart(sym, range);
      } catch (e) {
        console.warn(`Finnhub chart failed for ${sym}, trying Yahoo: ${e.message}`);
      }
    }
    if (points.length === 0) {
      points = await fetchYahooChart(sym, range);
    }
    res.json(points);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Live on-demand quote for ANY symbol (uses proven stockService import pattern)
router.get('/live/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const data = await fetchLiveQuote(symbol);
    res.json(data);
  } catch (error) {
    console.error(`Live quote error for ${symbol}:`, error.message);
    res.status(404).json({ error: `Could not fetch ${symbol}: ${error.message}` });
  }
});

// Finnhub fundamentals proxy — metric + profile2 + quote
// Must be before /:symbol wildcard
router.get('/fundamentals/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  if (!FINNHUB_KEY) return res.status(503).json({ error: 'No Finnhub key' });
  try {
    const [metricRes, profileRes, quoteRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`),
      fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`),
    ]);
    const metric  = await metricRes.json();
    const profile = await profileRes.json();
    const quote   = await quoteRes.json();
    res.json({ metric: metric.metric || {}, profile, quote });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Yahoo Finance quoteSummary — analyst targets + short interest + 52w + earnings date
// Works for small caps and micro-caps that Finnhub doesn't cover
// Must be before /:symbol wildcard
router.get('/yahoo-summary/:symbol', async (req, res) => {
  const sym = req.params.symbol.toUpperCase();
  try {
    const modules = [
      'price', 'summaryDetail', 'financialData', 'defaultKeyStatistics',
      'recommendationTrend', 'upgradeDowngradeHistory', 'institutionOwnership',
      'calendarEvents', 'earnings', 'insiderTransactions',
    ];
    const r = await yahooFinance.quoteSummary(sym, { modules }, { validateResult: false });
    if (!r) return res.status(404).json({ error: 'No data found' });

    const price     = r.price               || {};
    const sumD      = r.summaryDetail       || {};
    const finD      = r.financialData       || {};
    const defKS     = r.defaultKeyStatistics || {};
    const cal       = r.calendarEvents      || {};
    const earn      = r.earnings            || {};
    const recTrend  = r.recommendationTrend?.trend || [];
    const upgHist   = r.upgradeDowngradeHistory?.history || [];
    const instOwn   = r.institutionOwnership?.ownershipList || [];
    const insiderTx = r.insiderTransactions?.transactions || [];

    const now = Date.now();
    const latestTrend = recTrend[0] || {};
    const upgrades30d = upgHist.filter(u => u.epochGradeDate && (now - u.epochGradeDate * 1000) < 30 * 86400000);

    const earningsDates = cal.earnings?.earningsDate || [];
    const futureTs = earningsDates.map(d => d instanceof Date ? d.getTime() : null).filter(ts => ts && ts > now);
    const nextEarningsTs = futureTs.sort((a, b) => a - b)[0] || null;
    const daysToEarnings = nextEarningsTs ? Math.round((nextEarningsTs - now) / 86400000) : null;

    const shortPctRaw = sumD.shortPercentOfFloat ?? defKS.shortPercentOfFloat ?? null;

    const epsHistory = (earn.earningsHistory?.history || []).slice(-4).map(q => ({
      epsActual: q.epsActual ?? null,
      epsEstimate: q.epsEstimate ?? null,
      surprise: q.surprisePercent ?? null,
      date: q.quarter instanceof Date ? q.quarter.toISOString().slice(0, 7) : null,
    })).filter(q => q.epsActual != null);

    res.json({
      symbol: sym,
      name: price.shortName || price.longName || sym,
      currentPrice: price.regularMarketPrice ?? null,
      changePercent: price.regularMarketChangePercent != null ? price.regularMarketChangePercent * 100 : null,
      marketCap: price.marketCap ?? null,
      high52: sumD.fiftyTwoWeekHigh ?? null,
      low52:  sumD.fiftyTwoWeekLow  ?? null,
      beta:   defKS.beta ?? null,
      // Analyst
      targetMean:  finD.targetMeanPrice  ?? null,
      targetHigh:  finD.targetHighPrice  ?? null,
      targetLow:   finD.targetLowPrice   ?? null,
      numAnalysts: finD.numberOfAnalystOpinions ?? 0,
      recMean: finD.recommendationMean ?? null,
      recKey:  finD.recommendationKey  ?? null,
      analystBuy:  (latestTrend.strongBuy || 0) + (latestTrend.buy  || 0),
      analystHold:  latestTrend.hold || 0,
      analystSell: (latestTrend.sell  || 0) + (latestTrend.strongSell || 0),
      recentUpgrades:   upgrades30d.filter(u => /upgrade|buy|outperform|overweight/i.test(u.toGrade   || u.newGrade || '')).length,
      recentDowngrades: upgrades30d.filter(u => /downgrade|sell|underperform|underweight/i.test(u.toGrade || u.newGrade || '')).length,
      recentActions: upgrades30d.slice(0, 5).map(u => ({ firm: u.firm, action: u.action, to: u.toGrade || u.newGrade })),
      // Short interest
      shortPct:   shortPctRaw != null ? shortPctRaw * 100 : null,
      shortRatio: sumD.shortRatio ?? defKS.shortRatio ?? null,
      // Fundamentals
      peRatio:          sumD.trailingPE ?? defKS.trailingPE ?? null,
      fwdPE:            sumD.forwardPE  ?? null,
      revenueGrowth:    finD.revenueGrowth   != null ? finD.revenueGrowth   * 100 : null,
      grossMargins:     finD.grossMargins     != null ? finD.grossMargins     * 100 : null,
      operatingMargins: finD.operatingMargins != null ? finD.operatingMargins * 100 : null,
      returnOnEquity:   finD.returnOnEquity   != null ? finD.returnOnEquity   * 100 : null,
      // Institutional / insider
      instPctHeld:    defKS.heldPercentInstitutions != null ? defKS.heldPercentInstitutions * 100 : null,
      insiderPctHeld: defKS.heldPercentInsiders     != null ? defKS.heldPercentInsiders     * 100 : null,
      instOwners: instOwn.slice(0, 5).map(o => ({ name: o.organization, pct: o.pctHeld != null ? o.pctHeld * 100 : null })),
      insiderBuys:  insiderTx.filter(tx => /purchase|buy/i.test(tx.transactionDescription || '')).length,
      insiderSells: insiderTx.filter(tx => /sale|sell/i.test(tx.transactionDescription    || '')).length,
      recentInsiderTx: insiderTx.slice(0, 5).map(tx => ({
        name: tx.filerName, role: tx.filerRelation,
        type: tx.transactionDescription,
        shares: tx.shares, value: tx.value,
        date: tx.startDate instanceof Date ? tx.startDate.toISOString().slice(0, 10) : null,
      })),
      // Earnings
      daysToEarnings, nextEarningsTs,
      epsHistory,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Price momentum — actual 1mo/3mo returns from Yahoo chart (Jegadeesh & Titman 1993)
// Must be before /:symbol wildcard
router.get('/momentum/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    let closes = null;

    // Primary: yahoo-finance2 (handles auth — no 429 from datacenter IPs)
    try {
      const oneYearAgo = new Date(Date.now() - 370 * 86400000).toISOString().slice(0, 10);
      const chart = await yahooFinance.chart(symbol, {
        period1: oneYearAgo, period2: new Date(), interval: '1d',
      }, { validateResult: false });
      const raw = (chart?.quotes || []).map(q => q.close).filter(c => c != null && c > 0);
      if (raw.length >= 10) closes = raw;
    } catch (_) {}

    // Fallback: raw Yahoo chart API
    if (!closes) {
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.yahoo.com/' } });
      if (r.ok) {
        const data = await r.json();
        const raw = (data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter(c => c != null && c > 0);
        if (raw.length >= 10) closes = raw;
      }
    }

    if (!closes) return res.status(404).json({ error: 'No price data available' });

    const current = closes[closes.length - 1];
    const len     = closes.length;
    const idx1mo  = Math.max(0, len - 22);
    const idx3mo  = Math.max(0, len - 66);
    const idx6mo  = Math.max(0, len - 132);
    const ret1mo  = ((current - closes[idx1mo]) / closes[idx1mo]) * 100;
    const ret3mo  = ((current - closes[idx3mo]) / closes[idx3mo]) * 100;
    const ret6mo  = len >= 66  ? ((current - closes[idx6mo]) / closes[idx6mo]) * 100 : null;
    const ret12mo = len >= 200 ? ((current - closes[0])       / closes[0])      * 100 : null;

    res.json({
      symbol,
      ret1mo:  parseFloat(ret1mo.toFixed(2)),
      ret3mo:  parseFloat(ret3mo.toFixed(2)),
      ret6mo:  ret6mo  != null ? parseFloat(ret6mo.toFixed(2))  : null,
      ret12mo: ret12mo != null ? parseFloat(ret12mo.toFixed(2)) : null,
      current,
      dataPoints: len,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// News keyword sentiment — free, no AI key needed, uses Yahoo RSS + Finnhub
// Must be before /:symbol wildcard
router.get('/news-sentiment/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';

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
    /layoff[s]?|job\s+cut[s]?|restructur|workforce\s+reduc/i,
    /declin(e|ing)|los[st](e|es|ing)|deficit|net\s+loss|revenue\s+(declin|fell|drop)/i,
    /warning|concern|headwind|challen(ge|ging)|difficult\s+environment/i,
    /bearish|underperform|underweight|sell\s+rating|price.?target\s+(cut|lower|reduc)/i,
    /recall|defect|product\s+(issue|failure|problem)|safety\s+concern/i,
    /bankruptcy|insolvenc|debt\s+(default|crisis)|liquidity\s+(crisis|concern)/i,
    /delay[sd]?|postpone[d]?|supply\s+(chain\s+issue|shortage|disruption)/i,
  ];

  function scoreTexts(texts) {
    let bull = 0, bear = 0;
    for (const t of texts) {
      let isBull = false, isBear = false;
      for (const p of BULLISH_PATTERNS) if (p.test(t)) { isBull = true; break; }
      for (const p of BEARISH_PATTERNS) if (p.test(t)) { isBear = true; break; }
      if (isBull) bull++;
      if (isBear) bear++;
    }
    return { bull, bear, neutral: texts.length - bull - bear, total: texts.length };
  }

  try {
    let headlines = [];
    let source = 'Yahoo News';

    // Try Finnhub first (structured, rich data)
    if (FINNHUB_KEY && !symbol.includes('=')) {
      try {
        const to   = new Date().toISOString().slice(0, 10);
        const from = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
        const newsRes = await fetch(
          `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB_KEY}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (newsRes.ok) {
          const news = await newsRes.json();
          if (Array.isArray(news) && news.length > 0) {
            headlines = news.slice(0, 25).map(n => (n.headline || '') + ' ' + (n.summary || ''));
            source = 'Finnhub';
          }
        }
      } catch (_) {}
    }

    // Fall back to Yahoo Finance RSS (always free)
    if (headlines.length === 0) {
      try {
        const rssUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
        const rssRes = await fetch(rssUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(8000),
        });
        if (rssRes.ok) {
          const xml = await rssRes.text();
          const titles = [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/gs)].map(m => m[1]);
          const descs  = [...xml.matchAll(/<description><!\[CDATA\[(.*?)\]\]><\/description>/gs)].map(m => m[1]);
          const count  = Math.min(titles.length, 15);
          for (let i = 0; i < count; i++) {
            headlines.push((titles[i] || '') + ' ' + (descs[i] || ''));
          }
          if (headlines.length === 0) {
            const plain = [...xml.matchAll(/<title>(.*?)<\/title>/gs)].map(m => m[1])
              .filter(t => !t.includes('Yahoo') && t.length > 10);
            headlines = plain.slice(0, 15);
          }
        }
      } catch (_) {}
    }

    if (headlines.length === 0) {
      return res.status(404).json({ error: 'No news found' });
    }

    const scored = scoreTexts(headlines);
    const netSentiment = scored.bull - scored.bear;
    const sentimentPct = scored.total > 0 ? (netSentiment / scored.total) * 100 : 0;

    res.json({
      symbol, source,
      ...scored,
      netSentiment, sentimentPct,
      label: netSentiment > 0 ? 'Positive' : netSentiment < 0 ? 'Negative' : 'Mixed',
      headlines: headlines.slice(0, 5), // return first 5 for display
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// StockTwits social sentiment — real-time bullish/bearish tagged messages
// Da, Engelberg & Gao (2011): investor attention → short-run price pressure.
router.get('/social/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const url = `https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return res.status(r.status).json({ error: `StockTwits ${r.status}` });
    const data = await r.json();
    if (!data?.messages) return res.status(404).json({ error: 'No StockTwits data' });

    const messages = data.messages || [];
    const bull = messages.filter(m => m.entities?.sentiment?.basic === 'Bullish').length;
    const bear = messages.filter(m => m.entities?.sentiment?.basic === 'Bearish').length;
    const tagged = bull + bear;

    res.json({
      symbol,
      bull, bear,
      total: messages.length,
      tagged,
      bullPct: tagged > 0 ? parseFloat((bull / tagged * 100).toFixed(1)) : null,
      watcherCount: data.symbol?.watchlist_count || null,
      recentMessages: messages.slice(0, 5).map(m => ({
        body: m.body?.slice(0, 120),
        sentiment: m.entities?.sentiment?.basic || null,
        createdAt: m.created_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Technical analysis — RSI, moving averages, momentum (from Yahoo 1y chart)
router.get('/technicals/:symbol', async (req, res) => {
  const sym = req.params.symbol.toUpperCase();
  try {
    let closes = null;

    // Primary: yahoo-finance2 (handles auth)
    try {
      const oneYearAgo = new Date(Date.now() - 370 * 86400000).toISOString().slice(0, 10);
      const chart = await yahooFinance.chart(sym, {
        period1: oneYearAgo, period2: new Date(), interval: '1d',
      }, { validateResult: false });
      const raw = (chart?.quotes || []).map(q => q.close).filter(c => c != null && c > 0);
      if (raw.length >= 20) closes = raw;
    } catch (_) {}

    if (!closes) return res.status(404).json({ error: 'No price data' });

    const current = closes[closes.length - 1];
    const len = closes.length;

    // RSI-14
    function computeRSI(prices, period = 14) {
      if (prices.length < period + 1) return null;
      const recent = prices.slice(-(period + 1));
      const changes = recent.map((v, i) => i === 0 ? 0 : v - recent[i-1]).slice(1);
      const gains  = changes.map(d => d > 0 ? d : 0);
      const losses = changes.map(d => d < 0 ? -d : 0);
      const avgGain = gains.reduce((a,b)  => a+b, 0) / period;
      const avgLoss = losses.reduce((a,b) => a+b, 0) / period;
      if (avgLoss === 0) return 100;
      return parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(1));
    }
    function ma(arr, n) {
      const s = arr.slice(-n);
      return s.length ? parseFloat((s.reduce((a,b)=>a+b,0)/s.length).toFixed(2)) : null;
    }

    const rsi   = computeRSI(closes);
    const ma20  = ma(closes, 20);
    const ma50  = ma(closes, 50);
    const ma200 = len >= 200 ? ma(closes, 200) : null;

    // Returns
    const ret1mo  = len >= 22  ? ((current - closes[len-22])  / closes[len-22])  * 100 : null;
    const ret3mo  = len >= 66  ? ((current - closes[len-66])  / closes[len-66])  * 100 : null;
    const ret6mo  = len >= 132 ? ((current - closes[len-132]) / closes[len-132]) * 100 : null;
    const ret12mo = len >= 250 ? ((current - closes[0])       / closes[0])       * 100 : null;

    // Bollinger Bands (20-day, 2 std dev)
    const bb20 = closes.slice(-20);
    const bbMean = bb20.reduce((a,b)=>a+b,0)/20;
    const bbStd  = Math.sqrt(bb20.reduce((s,v)=>s+(v-bbMean)**2,0)/20);
    const bbUpper = bbMean + 2 * bbStd;
    const bbLower = bbMean - 2 * bbStd;
    const bbPosition = bbStd > 0 ? ((current - bbLower) / (bbUpper - bbLower)) * 100 : 50;
    const bollingerInterpret = bbPosition > 80 ? 'overbought' : bbPosition < 20 ? 'oversold' : 'neutral';

    res.json({
      symbol: sym, dataPoints: len, current,
      rsi,
      ma20, ma50, ma200,
      aboveMa20:  ma20  != null && current > ma20,
      aboveMa50:  ma50  != null && current > ma50,
      aboveMa200: ma200 != null && current > ma200,
      ret1mo:  ret1mo  != null ? parseFloat(ret1mo.toFixed(2))  : null,
      ret3mo:  ret3mo  != null ? parseFloat(ret3mo.toFixed(2))  : null,
      ret6mo:  ret6mo  != null ? parseFloat(ret6mo.toFixed(2))  : null,
      ret12mo: ret12mo != null ? parseFloat(ret12mo.toFixed(2)) : null,
      bbUpper: parseFloat(bbUpper.toFixed(2)),
      bbLower: parseFloat(bbLower.toFixed(2)),
      bbPosition: parseFloat(bbPosition.toFixed(1)),
      bollingerInterpret,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alpha Vantage NEWS_SENTIMENT — real AI-analyzed sentiment with per-article scores
// Free tier: 25 req/day. Use on-demand (ConvictionPage), not batch scoring.
router.get('/av-news/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const AV_KEY = process.env.ALPHA_VANTAGE_KEY;
  if (!AV_KEY) return res.status(503).json({ error: 'No Alpha Vantage key configured' });
  try {
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&limit=50&apikey=${AV_KEY}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return res.status(r.status).json({ error: `Alpha Vantage ${r.status}` });
    const data = await r.json();
    if (data['Information']) return res.status(429).json({ error: 'Alpha Vantage rate limit reached (25/day free tier)' });
    if (data['Note']) return res.status(429).json({ error: 'Alpha Vantage rate limit (5/min)' });

    const feed = data.feed || [];
    if (feed.length === 0) return res.status(404).json({ error: 'No news found' });

    // Filter to articles relevant to this specific ticker (relevance_score ≥ 0.3)
    const relevant = feed.filter(a =>
      (a.ticker_sentiment || []).some(ts => ts.ticker === symbol && parseFloat(ts.relevance_score) >= 0.3)
    );
    const articles = relevant.length >= 5 ? relevant : feed.slice(0, 30);

    // Compute relevance-weighted average sentiment score for this ticker
    let totalWeight = 0, weightedScore = 0;
    const scored = articles.slice(0, 30).map(a => {
      const ts = (a.ticker_sentiment || []).find(t => t.ticker === symbol);
      const score     = ts ? parseFloat(ts.ticker_sentiment_score) : parseFloat(a.overall_sentiment_score || 0);
      const relevance = ts ? parseFloat(ts.relevance_score) : 0.3;
      weightedScore += score * relevance;
      totalWeight   += relevance;
      return {
        title:     a.title,
        source:    a.source,
        time:      a.time_published,
        score:     parseFloat(score.toFixed(3)),
        label:     ts?.ticker_sentiment_label || a.overall_sentiment_label,
        relevance: parseFloat(relevance.toFixed(3)),
        url:       a.url,
      };
    });

    const avgScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const bull    = scored.filter(a => a.score > 0.15).length;
    const bear    = scored.filter(a => a.score < -0.15).length;
    const neutral = scored.length - bull - bear;
    const label   = avgScore > 0.25 ? 'Bullish' : avgScore > 0.1 ? 'Somewhat Bullish'
      : avgScore > -0.1 ? 'Neutral' : avgScore > -0.25 ? 'Somewhat Bearish' : 'Bearish';

    res.json({
      symbol, source: 'Alpha Vantage AI',
      avgScore: parseFloat(avgScore.toFixed(3)),
      label, bull, bear, neutral,
      total: scored.length,
      headlines: scored.slice(0, 5).map(a => ({ title: a.title, source: a.source, score: a.score, label: a.label })),
      articles:  scored.slice(0, 10),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// EPS surprise history — Yahoo Finance (primary) + Alpha Vantage (fallback)
// No rate limit on Yahoo; AV fallback for legacy compatibility
router.get('/earnings-surprise/:symbol', async (req, res) => {
  const sym = req.params.symbol.toUpperCase();
  try {
    // Primary: Yahoo Finance earnings module via yahoo-finance2 (no rate limit)
    const r = await yahooFinance.quoteSummary(sym, { modules: ['earnings', 'earningsTrend'] }, { validateResult: false });
    const hist = r?.earnings?.earningsHistory?.history || [];
    if (hist.length > 0) {
      const quarters = hist.slice(-4).map(q => ({
        date: q.quarter instanceof Date ? q.quarter.toISOString().slice(0, 7) : null,
        epsEstimate: q.epsEstimate ?? null,
        epsActual:   q.epsActual   ?? null,
        surprise:    q.surprisePercent ?? null,   // decimal
        beat:        (q.surprisePercent ?? 0) > 0,
      }));
      const beats = quarters.filter(q => q.beat).length;
      const avgSurprisePct = quarters.length > 0
        ? quarters.reduce((s, q) => s + (q.surprise ?? 0), 0) / quarters.length * 100
        : 0;
      const latest = quarters[quarters.length - 1];
      return res.json({
        symbol: sym,
        source: 'Yahoo Finance',
        quarters,
        beats,
        total: quarters.length,
        avgSurprisePct: parseFloat(avgSurprisePct.toFixed(2)),
        mostRecentBeat: latest?.beat ?? null,
        mostRecentSurprisePct: latest?.surprise != null ? parseFloat((latest.surprise * 100).toFixed(2)) : null,
      });
    }

    // Fallback: Alpha Vantage EARNINGS (25 calls/day)
    const AV_KEY = process.env.ALPHA_VANTAGE_KEY || 'IO0Y9CY7K6K36D6Z';
    const url = `https://www.alphavantage.co/query?function=EARNINGS&symbol=${sym}&apikey=${AV_KEY}`;
    const data = await fetch(url).then(r => r.json()).catch(() => null);
    if (data?.Information || data?.Note) {
      return res.status(429).json({ error: 'Alpha Vantage rate limit — try again tomorrow' });
    }
    const avHist = (data?.quarterlyEarnings || []).slice(0, 4);
    if (avHist.length === 0) return res.status(404).json({ error: 'No earnings data available' });

    const quarters = avHist.map(q => ({
      date:          q.fiscalDateEnding,
      epsEstimate:   parseFloat(q.estimatedEPS) || null,
      epsActual:     parseFloat(q.reportedEPS)  || null,
      surprise:      parseFloat(q.surprisePercentage) / 100 || null,
      beat:          parseFloat(q.surprisePercentage) > 0,
    }));
    const beats = quarters.filter(q => q.beat).length;
    const avgSurprisePct = quarters.reduce((s, q) => s + (q.surprise ?? 0), 0) / quarters.length * 100;
    const latest = quarters[0];
    res.json({
      symbol: sym, source: 'Alpha Vantage',
      quarters: quarters.reverse(),
      beats, total: quarters.length,
      avgSurprisePct: parseFloat(avgSurprisePct.toFixed(2)),
      mostRecentBeat: latest?.beat ?? null,
      mostRecentSurprisePct: latest?.surprise != null ? parseFloat((latest.surprise * 100).toFixed(2)) : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Analyst price target + recommendation consensus
// Must be before /:symbol wildcard
router.get('/price-target/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  if (!FINNHUB_KEY) return res.status(503).json({ error: 'No Finnhub key' });
  try {
    const [ptRes, recRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/stock/price-target?symbol=${symbol}&token=${FINNHUB_KEY}`),
      fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${FINNHUB_KEY}`),
    ]);
    const pt  = await ptRes.json();
    const rec = await recRes.json();
    // rec is an array sorted newest first
    const latestRec = Array.isArray(rec) && rec.length > 0 ? rec[0] : null;
    res.json({ ...pt, recommendation: latestRec });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get top gainers
router.get('/gainers/top', async (req, res) => {
  try {
    const gainers = await Stock.find().sort({ changePercent: -1 }).limit(10);
    res.json(gainers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get top losers
router.get('/losers/bottom', async (req, res) => {
  try {
    const losers = await Stock.find().sort({ changePercent: 1 }).limit(10);
    res.json(losers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get stock by symbol (from DB cache) — wildcard, must be last
router.get('/:symbol', async (req, res) => {
  try {
    const stock = await Stock.findOne({ symbol: req.params.symbol.toUpperCase() });
    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    res.json(stock);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
