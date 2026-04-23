import Tweet from '../models/Tweet.js';

// StockTwits public API — free, no auth required for reading public streams
// Replaces nitter.net which shut down in Feb 2024
const STOCKTWITS_BASE = 'https://api.stocktwits.com/api/2';

// Symbols to pull social chatter for
const WATCH_SYMBOLS = ['AAPL', 'NVDA', 'MSFT', 'NFLX', 'GOOGL', 'SPY', 'QQQ'];

export async function fetchAndUpdateTweets() {
  try {
    for (const symbol of WATCH_SYMBOLS) {
      try {
        const url = `${STOCKTWITS_BASE}/streams/symbol/${symbol}.json?limit=20`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'ToriiApp/1.0'
          }
        });

        if (!response.ok) {
          console.error(`StockTwits error for ${symbol}: ${response.status}`);
          continue;
        }

        const data = await response.json();

        if (!data.messages || !Array.isArray(data.messages)) continue;

        for (const msg of data.messages) {
          // Deduplicate by StockTwits message ID
          const existingTweet = await Tweet.findOne({ url: `https://stocktwits.com/message/${msg.id}` });
          if (existingTweet) continue;

          const symbols = msg.symbols?.map(s => s.symbol) || [symbol];
          const sentiment = msg.entities?.sentiment?.basic?.toLowerCase() ||
                            classifySentiment(msg.body);

          await Tweet.create({
            author: msg.user?.name || msg.user?.username || 'Unknown',
            authorHandle: msg.user?.username || 'unknown',
            content: msg.body,
            url: `https://stocktwits.com/message/${msg.id}`,
            createdAt: new Date(msg.created_at),
            tags: extractHashtags(msg.body),
            mentions: extractMentions(msg.body),
            relatedSymbols: symbols,
            sentiment: normalizeSentiment(sentiment)
          });

          console.log(`✓ Saved StockTwits post for $${symbol}`);
        }

        // Respect rate limits — StockTwits allows ~200 req/hour unauthenticated
        await sleep(300);
      } catch (symErr) {
        console.error(`Error fetching StockTwits for ${symbol}:`, symErr.message);
      }
    }
  } catch (error) {
    console.error('Tweet (StockTwits) update error:', error);
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractHashtags(text = '') {
  return (text.match(/#\w+/g) || []).map(t => t.slice(1));
}

function extractMentions(text = '') {
  return (text.match(/@\w+/g) || []).map(m => m.slice(1));
}

function normalizeSentiment(raw = '') {
  const lower = raw.toLowerCase();
  if (lower === 'bullish' || lower === 'positive') return 'positive';
  if (lower === 'bearish' || lower === 'negative') return 'negative';
  return 'neutral';
}

function classifySentiment(text = '') {
  const positive = ['bull', 'up', 'gain', 'surge', 'bullish', 'strong', 'excellent', 'buy', 'long'];
  const negative = ['bear', 'down', 'fall', 'crash', 'bearish', 'weak', 'poor', 'sell', 'short'];
  const lower = text.toLowerCase();
  const pos = positive.filter(w => lower.includes(w)).length;
  const neg = negative.filter(w => lower.includes(w)).length;
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}
