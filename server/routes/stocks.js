import express from 'express';
import Stock from '../models/Stock.js';
import { fetchLiveQuote, fetchFinnhubChart, fetchYahooChart } from '../services/stockService.js';

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
  const symbol = req.params.symbol.toUpperCase();
  try {
    const YF_HEADERS = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://finance.yahoo.com/',
    };
    const modules = encodeURIComponent('summaryDetail,financialData,defaultKeyStatistics,price,calendarEvents,recommendationTrend,upgradeDowngradeHistory,institutionOwnership');
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=${modules}`;
    const r = await fetch(url, { headers: YF_HEADERS });
    if (!r.ok) return res.status(404).json({ error: `Yahoo Finance ${r.status}` });
    const data = await r.json();
    const result = data?.quoteSummary?.result?.[0];
    if (!result) return res.status(404).json({ error: 'No data' });

    const price = result.price                || {};
    const sumD  = result.summaryDetail        || {};
    const finD  = result.financialData        || {};
    const defKS = result.defaultKeyStatistics || {};
    const cal   = result.calendarEvents       || {};

    const currentPrice  = price.regularMarketPrice?.raw ?? sumD.previousClose?.raw ?? null;
    const prevClose     = price.regularMarketPreviousClose?.raw ?? sumD.previousClose?.raw ?? null;
    const changePercent = currentPrice && prevClose && prevClose > 0
      ? ((currentPrice - prevClose) / prevClose) * 100 : null;

    // Next earnings date
    const earningsDates = cal.earnings?.earningsDate || [];
    const now = Date.now();
    const nextEarningsTs = earningsDates
      .map(d => d?.raw ? d.raw * 1000 : null)
      .filter(ts => ts && ts > now)
      .sort((a, b) => a - b)[0] || null;
    const daysToEarnings = nextEarningsTs
      ? Math.round((nextEarningsTs - now) / 86400000)
      : null;

    // Analyst trend breakdown + recent upgrades/downgrades
    const recTrend = result.recommendationTrend?.trend || [];
    const latestTrend = recTrend[0] || {};
    const upgrades = result.upgradeDowngradeHistory?.history || [];
    const upgrades30d = upgrades.filter(u => u.epochGradeDate && (now - u.epochGradeDate * 1000) < 30 * 86400000);
    const instOwnership = result.institutionOwnership?.ownershipList || [];

    res.json({
      symbol,
      name:          price.shortName || price.longName || symbol,
      currentPrice,
      changePercent,
      high52:        sumD.fiftyTwoWeekHigh?.raw    ?? defKS.fiftyTwoWeekHigh?.raw    ?? null,
      low52:         sumD.fiftyTwoWeekLow?.raw     ?? defKS.fiftyTwoWeekLow?.raw     ?? null,
      targetMean:    finD.targetMeanPrice?.raw     ?? null,
      targetHigh:    finD.targetHighPrice?.raw     ?? null,
      targetLow:     finD.targetLowPrice?.raw      ?? null,
      numAnalysts:   finD.numberOfAnalystOpinions?.raw ?? 0,
      shortPct:      defKS.shortPercentOfFloat?.raw != null
        ? defKS.shortPercentOfFloat.raw * 100 : null,
      shortRatio:    defKS.shortRatio?.raw         ?? null,
      recMean:       finD.recommendationMean?.raw  ?? null,
      recKey:        finD.recommendationKey        ?? null,
      marketCap:     price.marketCap?.raw          ?? null,
      beta:          defKS.beta?.raw               ?? null,
      // Valuation
      peRatio:       sumD.trailingPE?.raw          ?? defKS.trailingPE?.raw    ?? null,
      fwdPE:         sumD.forwardPE?.raw           ?? null,
      revenueGrowth: finD.revenueGrowth?.raw      != null ? finD.revenueGrowth.raw * 100 : null,
      grossMargins:  finD.grossMargins?.raw        != null ? finD.grossMargins.raw * 100  : null,
      operatingMargins: finD.operatingMargins?.raw != null ? finD.operatingMargins.raw * 100 : null,
      returnOnEquity: finD.returnOnEquity?.raw     != null ? finD.returnOnEquity.raw * 100  : null,
      daysToEarnings,
      nextEarningsTs,
      // Analyst trend breakdown (strongBuy/buy/hold/sell counts)
      analystBuy:    (latestTrend.strongBuy || 0) + (latestTrend.buy || 0),
      analystHold:   latestTrend.hold || 0,
      analystSell:   (latestTrend.sell || 0) + (latestTrend.strongSell || 0),
      // Recent upgrades/downgrades (last 30 days)
      recentUpgrades:   upgrades30d.filter(u => /upgrade|buy|outperform|overweight/i.test(u.newGrade || '')).length,
      recentDowngrades: upgrades30d.filter(u => /downgrade|sell|underperform|underweight/i.test(u.newGrade || '')).length,
      recentActions: upgrades30d.slice(0, 5).map(u => ({ firm: u.firm, action: u.action, from: u.fromGrade, to: u.toGrade })),
      // Institutional ownership
      instPctHeld:   defKS.heldPercentInstitutions?.raw != null ? defKS.heldPercentInstitutions.raw * 100 : null,
      insiderPctHeld: defKS.heldPercentInsiders?.raw    != null ? defKS.heldPercentInsiders.raw * 100    : null,
      instOwners:    instOwnership.slice(0, 5).map(o => ({
        name: o.organization,
        pct:  o.pctHeld?.raw != null ? parseFloat((o.pctHeld.raw * 100).toFixed(2)) : null,
      })),
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
    const YF_HEADERS = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Referer': 'https://finance.yahoo.com/',
    };
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`;
    const r = await fetch(url, { headers: YF_HEADERS });
    if (!r.ok) return res.status(404).json({ error: `Yahoo chart ${r.status}` });
    const data = await r.json();
    const result = data?.chart?.result?.[0];
    if (!result) return res.status(404).json({ error: 'No chart data' });

    const closes = result.indicators?.quote?.[0]?.close || [];
    const valid  = closes.filter(c => c != null && c > 0);
    if (valid.length < 10) return res.status(404).json({ error: 'Insufficient price history' });

    const current = valid[valid.length - 1];
    const idx1mo  = Math.max(0, valid.length - 22);
    const ret1mo  = ((current - valid[idx1mo]) / valid[idx1mo]) * 100;
    const ret3mo  = ((current - valid[0]) / valid[0]) * 100;

    res.json({ symbol, ret1mo, ret3mo, current, dataPoints: valid.length });
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
  const symbol = req.params.symbol.toUpperCase();
  try {
    const YF_HEADERS_LOCAL = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Referer': 'https://finance.yahoo.com/',
    };
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;
    const r = await fetch(url, { headers: YF_HEADERS_LOCAL, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return res.status(r.status).json({ error: `Yahoo chart ${r.status}` });
    const data = await r.json();
    const result = data?.chart?.result?.[0];
    if (!result) return res.status(404).json({ error: 'No chart data' });

    const closes = result.indicators?.quote?.[0]?.close || [];
    const valid  = closes.filter(c => c != null && c > 0);
    if (valid.length < 20) return res.status(404).json({ error: 'Insufficient price history' });

    const current = valid[valid.length - 1];
    const len = valid.length;

    // RSI-14
    const rsi14Window = valid.slice(-15);
    const changes = rsi14Window.map((v, i) => i === 0 ? 0 : v - rsi14Window[i-1]).slice(1);
    const gains  = changes.map(d => d > 0 ? d : 0);
    const losses = changes.map(d => d < 0 ? -d : 0);
    const avgGain = gains.reduce((a,b)=>a+b,0) / 14;
    const avgLoss = losses.reduce((a,b)=>a+b,0) / 14;
    const rsi = avgLoss === 0 ? 100 : parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(1));

    // Moving averages
    const ma20Arr  = valid.slice(-20);
    const ma50Arr  = valid.slice(-50);
    const ma200Arr = len >= 200 ? valid.slice(-200) : null;
    const ma20  = parseFloat((ma20Arr.reduce((a,b)=>a+b,0)  / ma20Arr.length).toFixed(2));
    const ma50  = parseFloat((ma50Arr.reduce((a,b)=>a+b,0)  / ma50Arr.length).toFixed(2));
    const ma200 = ma200Arr ? parseFloat((ma200Arr.reduce((a,b)=>a+b,0) / ma200Arr.length).toFixed(2)) : null;

    // Multi-period returns
    const idx1mo  = Math.max(0, len - 22);
    const idx3mo  = Math.max(0, len - 66);
    const idx6mo  = Math.max(0, len - 132);
    const ret1mo  = parseFloat(((current - valid[idx1mo])  / valid[idx1mo]  * 100).toFixed(2));
    const ret3mo  = parseFloat(((current - valid[idx3mo])  / valid[idx3mo]  * 100).toFixed(2));
    const ret6mo  = len >= 66  ? parseFloat(((current - valid[idx6mo])  / valid[idx6mo]  * 100).toFixed(2)) : null;
    const ret12mo = parseFloat(((current - valid[0]) / valid[0] * 100).toFixed(2));

    // Bollinger Bands (20-day)
    const bbMean = ma20;
    const variance = ma20Arr.reduce((s, v) => s + (v - bbMean) ** 2, 0) / ma20Arr.length;
    const stdDev = Math.sqrt(variance);
    const bbUpper = parseFloat((bbMean + 2 * stdDev).toFixed(2));
    const bbLower = parseFloat((bbMean - 2 * stdDev).toFixed(2));
    const bbPosition = parseFloat(((current - bbLower) / (bbUpper - bbLower) * 100).toFixed(1));

    res.json({
      symbol, current, dataPoints: valid.length,
      rsi,
      ma20, ma50, ma200,
      aboveMa20: current > ma20,
      aboveMa50: current > ma50,
      aboveMa200: ma200 != null && current > ma200,
      ret1mo, ret3mo, ret6mo, ret12mo,
      bollingerUpper: bbUpper,
      bollingerLower: bbLower,
      bollingerPosition: bbPosition,
      bollingerInterpret: bbPosition > 80 ? 'overbought' : bbPosition < 20 ? 'oversold' : 'neutral',
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

// Alpha Vantage EARNINGS — EPS surprise history (beat/miss, avg surprise %)
// Free tier: counts toward 25/day limit.
router.get('/earnings-surprise/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const AV_KEY = process.env.ALPHA_VANTAGE_KEY;
  if (!AV_KEY) return res.status(503).json({ error: 'No Alpha Vantage key configured' });
  try {
    const url = `https://www.alphavantage.co/query?function=EARNINGS&symbol=${symbol}&apikey=${AV_KEY}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return res.status(r.status).json({ error: `Alpha Vantage ${r.status}` });
    const data = await r.json();
    if (data['Information']) return res.status(429).json({ error: 'Alpha Vantage rate limit reached (25/day free tier)' });
    if (data['Note']) return res.status(429).json({ error: 'Alpha Vantage rate limit (5/min)' });

    const quarterly = data.quarterlyEarnings || [];
    if (quarterly.length === 0) return res.status(404).json({ error: 'No earnings data' });

    const recent = quarterly.slice(0, 8).map(q => ({
      date:        q.reportedDate,
      fiscalEnd:   q.fiscalDateEnding,
      reported:    parseFloat(q.reportedEPS),
      estimated:   parseFloat(q.estimatedEPS),
      surprise:    parseFloat(q.surprise),
      surprisePct: parseFloat(q.surprisePercentage),
      beat:        parseFloat(q.surprise) > 0,
    })).filter(q => !isNaN(q.reported) && !isNaN(q.estimated));

    if (recent.length === 0) return res.status(404).json({ error: 'No EPS history with estimates' });

    const last4   = recent.slice(0, 4);
    const beats   = last4.filter(q => q.beat).length;
    const avgSurp = last4.reduce((s, q) => s + (q.surprisePct || 0), 0) / last4.length;

    res.json({
      symbol,
      recent: last4,
      beats,
      misses: last4.length - beats,
      total:  last4.length,
      avgSurprisePct: parseFloat(avgSurp.toFixed(2)),
      mostRecentBeat:       last4[0]?.beat,
      mostRecentSurprisePct: last4[0]?.surprisePct,
      mostRecentDate:       last4[0]?.date,
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
