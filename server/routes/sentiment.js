import express from 'express';
import News from '../models/News.js';
import Tweet from '../models/Tweet.js';

const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

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

        // Fetch recent news (last 3 days)
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        const news = await News.find({
          relatedStocks: upperTicker,
          publishedAt: { $gte: threeDaysAgo },
        })
          .sort({ publishedAt: -1 })
          .limit(5);

        // If no news, return neutral
        if (news.length === 0) {
          return {
            ticker: upperTicker,
            score: 0,
            label: 'neutral',
            confidence: 0,
            drivers: [],
            headline: 'No recent coverage',
          };
        }

        // Extract headlines
        const headlines = news.map(n => n.title);
        const mainHeadline = headlines[0];

        // Call Groq to analyze sentiment
        const sentimentData = await callGroqSentiment(upperTicker, headlines);

        return {
          ticker: upperTicker,
          ...sentimentData,
          headline: mainHeadline,
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

        const news = await News.find({
          relatedStocks: upperTicker,
          publishedAt: { $gte: threeDaysAgo },
        })
          .sort({ publishedAt: -1 })
          .limit(5);

        if (news.length === 0) {
          return {
            ticker: upperTicker,
            score: 0,
            label: 'neutral',
            confidence: 0,
            drivers: [],
            headline: 'No recent coverage',
          };
        }

        const headlines = news.map(n => n.title);
        const mainHeadline = headlines[0];
        const sentimentData = await callGroqSentiment(upperTicker, headlines);

        return {
          ticker: upperTicker,
          ...sentimentData,
          headline: mainHeadline,
        };
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
