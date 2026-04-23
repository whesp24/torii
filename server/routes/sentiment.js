import express from 'express';
import News from '../models/News.js';

const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const FINNHUB_KEY  = process.env.FINNHUB_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

// ── Fetch recent headlines from Finnhub company-news API ──────────────────────
async function fetchFinnhubNews(ticker) {
  if (!FINNHUB_KEY) return [];
  const to   = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}&token=${FINNHUB_KEY}`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!r.ok) return [];
    const articles = await r.json();
    return Array.isArray(articles)
      ? articles.slice(0, 8).map(a => a.headline).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

// ── Scan DB news for any mention of ticker in title or description ────────────
async function fetchDbNews(ticker) {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const regex = new RegExp(ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const news = await News.find({
    publishedAt: { $gte: threeDaysAgo },
    $or: [{ title: regex }, { description: regex }],
  }).sort({ publishedAt: -1 }).limit(6);
  return news.map(n => n.title);
}

// Helper function to call Groq API
async function callGroqSentiment(ticker, headlines) {
  if (!GROQ_API_KEY) {
    console.warn('GROQ_API_KEY not set, returning neutral sentiment');
    return { score: 0, label: 'neutral', confidence: 0 };
  }

  const headlineText = headlines.map(h => `- ${h}`).join('\n');
  const prompt = `Analyze the sentiment of the following financial news headlines for ${ticker}.
Score sentiment from -1 (very bearish) to 1 (very bullish).
Return a JSON response with: { score: number, label: 'bullish'|'bearish'|'neutral', confidence: number 0-1, drivers: string[] }

Headlines:
${headlineText}

Respond ONLY with valid JSON, no markdown code blocks.`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.error('Groq API error:', response.status, response.statusText);
      return { score: 0, label: 'neutral', confidence: 0 };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    // Parse JSON response
    const parsed = JSON.parse(content);
    return {
      score: typeof parsed.score === 'number' ? Math.max(-1, Math.min(1, parsed.score)) : 0,
      label: ['bullish', 'bearish', 'neutral'].includes(parsed.label) ? parsed.label : 'neutral',
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
      drivers: Array.isArray(parsed.drivers) ? parsed.drivers : [],
    };
  } catch (err) {
    console.error(`Error calling Groq for ${ticker}:`, err.message);
    return { score: 0, label: 'neutral', confidence: 0 };
  }
}

// POST /api/sentiment/analyze — analyze sentiment for tickers
router.post('/analyze', async (req, res) => {
  try {
    const { tickers } = req.body;

    if (!Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({ error: 'tickers array required' });
    }

    // Process tickers in parallel
    const results = await Promise.allSettled(
      tickers.map(async (ticker) => {
        const upperTicker = ticker.toUpperCase();

        // 1. Try Finnhub company news (best source — per-ticker)
        let headlines = await fetchFinnhubNews(upperTicker);

        // 2. Fallback: scan DB news titles for ticker mentions
        if (headlines.length === 0) {
          headlines = await fetchDbNews(upperTicker);
        }

        // If still no news, ask Groq for a market-context assessment
        if (headlines.length === 0) {
          const sentimentData = await callGroqSentiment(upperTicker, [
            `General market context for ${upperTicker} — no specific headlines found. Provide a brief neutral assessment.`
          ]);
          return {
            ticker: upperTicker,
            ...sentimentData,
            confidence: Math.max(0, sentimentData.confidence - 0.3), // lower confidence when no news
            headline: 'No recent headlines — based on general context',
          };
        }

        // Call Groq to analyze sentiment from headlines
        const sentimentData = await callGroqSentiment(upperTicker, headlines);
        return {
          ticker: upperTicker,
          ...sentimentData,
          headline: headlines[0],
        };
      })
    );

    // Map settled results
    const output = results.map((result, idx) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // If promise rejected, return neutral for that ticker
        return {
          ticker: tickers[idx].toUpperCase(),
          score: 0,
          label: 'neutral',
          confidence: 0,
          drivers: [],
          headline: 'Error analyzing sentiment',
        };
      }
    });

    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sentiment/latest — analyze sentiment for all tickers with open trades or watchlist
router.get('/latest', async (req, res) => {
  try {
    // For now, this will just return an empty array if no tickers are provided
    // In a full implementation, this would fetch tickers from trades and watchlist
    const { tickers } = req.query;

    if (!tickers) {
      return res.json([]);
    }

    const tickerList = Array.isArray(tickers) ? tickers : [tickers];
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const results = await Promise.allSettled(
      tickerList.map(async (ticker) => {
        const upperTicker = ticker.toUpperCase();
        let headlines = await fetchFinnhubNews(upperTicker);
        if (headlines.length === 0) headlines = await fetchDbNews(upperTicker);
        if (headlines.length === 0) {
          return { ticker: upperTicker, score: 0, label: 'neutral', confidence: 0, drivers: [], headline: 'No recent coverage' };
        }
        const sentimentData = await callGroqSentiment(upperTicker, headlines);
        return { ticker: upperTicker, ...sentimentData, headline: headlines[0] };
      })
    );

    const output = results.map((result, idx) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          ticker: tickerList[idx].toUpperCase(),
          score: 0,
          label: 'neutral',
          confidence: 0,
          drivers: [],
          headline: 'Error analyzing sentiment',
        };
      }
    });

    res.json(output);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
