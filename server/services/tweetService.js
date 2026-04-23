import Tweet from '../models/Tweet.js';

// StockTwits user streams for the curated finance accounts.
// These accounts exist on StockTwits with the same handles as Twitter.
const CURATED_USERS = [
  { stHandle: 'KevinLMak',       displayName: 'Kevin Mak' },
  { stHandle: 'ContrarianCurse', displayName: 'SuspendedCap' },
  { stHandle: 'dsundheim',       displayName: 'D. Sundheim' },
  { stHandle: 'jeff_weinstein',  displayName: 'Jeff Weinstein' },
  { stHandle: 'HannoLustig',     displayName: 'Hanno Lustig' },
  { stHandle: 'patrick_oshag',   displayName: 'Patrick O\'Shaughnessy' },
];

// Fallback: symbol-based streams if user streams are empty/unavailable
const FALLBACK_SYMBOLS = ['AAPL', 'NVDA', 'MSFT', 'SPY', 'QQQ', 'NFLX', 'GOOGL'];

const STOCKTWITS_BASE = 'https://api.stocktwits.com/api/2';

export async function fetchAndUpdateTweets() {
  let saved = 0;

  // 1. Try to fetch from each curated user's stream
  for (const { stHandle, displayName } of CURATED_USERS) {
    try {
      const url = `${STOCKTWITS_BASE}/streams/user/${stHandle}.json?limit=10`;
      const res = await fetch(url, { headers: { 'User-Agent': 'ToriiApp/1.0' } });
      if (!res.ok) continue; // user not on StockTwits — skip silently

      const data = await res.json();
      if (!data.messages || !Array.isArray(data.messages)) continue;

      for (const msg of data.messages) {
        const exists = await Tweet.findOne({ url: `https://stocktwits.com/message/${msg.id}` });
        if (exists) continue;

        await Tweet.create({
          author: displayName,
          authorHandle: stHandle,
          content: msg.body || '',
          url: `https://stocktwits.com/message/${msg.id}`,
          createdAt: new Date(msg.created_at),
          tags: extractHashtags(msg.body || ''),
          mentions: extractMentions(msg.body || ''),
          relatedSymbols: msg.symbols?.map(s => s.symbol) || [],
          sentiment: normalizeSentiment(msg.entities?.sentiment?.basic)
        });
        saved++;
      }
      await sleep(300);
    } catch (err) {
      console.error(`StockTwits user error (${stHandle}):`, err.message);
    }
  }

  // 2. Supplement with symbol-based streams to fill gaps
  for (const symbol of FALLBACK_SYMBOLS) {
    try {
      const url = `${STOCKTWITS_BASE}/streams/symbol/${symbol}.json?limit=5`;
      const res = await fetch(url, { headers: { 'User-Agent': 'ToriiApp/1.0' } });
      if (!res.ok) continue;

      const data = await res.json();
      if (!data.messages) continue;

      for (const msg of data.messages) {
        const exists = await Tweet.findOne({ url: `https://stocktwits.com/message/${msg.id}` });
        if (exists) continue;

        // Only save posts with actual financial content (filter out low-quality)
        if (!msg.body || msg.body.length < 20) continue;

        await Tweet.create({
          author: msg.user?.name || msg.user?.username || 'StockTwits',
          authorHandle: msg.user?.username || 'stocktwits',
          content: msg.body,
          url: `https://stocktwits.com/message/${msg.id}`,
          createdAt: new Date(msg.created_at),
          tags: extractHashtags(msg.body),
          mentions: extractMentions(msg.body),
          relatedSymbols: msg.symbols?.map(s => s.symbol) || [symbol],
          sentiment: normalizeSentiment(msg.entities?.sentiment?.basic)
        });
        saved++;
      }
      await sleep(200);
    } catch (err) {
      console.error(`StockTwits symbol error (${symbol}):`, err.message);
    }
  }

  console.log(`✓ Tweets update: ${saved} new posts saved`);
}

// ── helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function extractHashtags(t = '') { return (t.match(/#\w+/g) || []).map(h => h.slice(1)); }
function extractMentions(t = '') { return (t.match(/@\w+/g) || []).map(m => m.slice(1)); }
function normalizeSentiment(raw = '') {
  const l = (raw || '').toLowerCase();
  if (l === 'bullish') return 'positive';
  if (l === 'bearish') return 'negative';
  return 'neutral';
}
