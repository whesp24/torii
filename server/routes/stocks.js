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
    const modules = encodeURIComponent('summaryDetail,financialData,defaultKeyStatistics,price,calendarEvents');
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
      daysToEarnings,
      nextEarningsTs,
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
