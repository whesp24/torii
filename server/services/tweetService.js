import Tweet from '../models/Tweet.js';
import Parser from 'rss-parser';

// Nitter RSS — no auth required, free, works without an X API key
// Multiple instances to try in order (they go down occasionally)
const NITTER_INSTANCES = [
  'nitter.poast.org',
  'nitter.privacydev.net',
  'nitter.1d4.us',
  'nitter.net',
];

const RSS_PARSER = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; ToriiBot/1.0)',
    'Accept': 'application/rss+xml, application/xml, text/xml',
  }
});

const CURATED_USERS = [
  { handle: 'KevinLMak',       displayName: 'Kevin Mak' },
  { handle: 'ContrarianCurse', displayName: 'SuspendedCap' },
  { handle: 'dsundheim',       displayName: 'D. Sundheim' },
  { handle: 'jeff_weinstein',  displayName: 'Jeff Weinstein' },
  { handle: 'HannoLustig',     displayName: 'Hanno Lustig' },
  { handle: 'patrick_oshag',   displayName: "Patrick O'Shaughnessy" },
];

// Build display name lookup
const HANDLE_MAP = {};
for (const u of CURATED_USERS) {
  HANDLE_MAP[u.handle.toLowerCase()] = u.displayName;
}

// Try each Nitter instance until one works
async function fetchNitterRSS(handle) {
  for (const instance of NITTER_INSTANCES) {
    const url = `https://${instance}/${handle}/rss`;
    try {
      const feed = await RSS_PARSER.parseURL(url);
      console.log(`✓ Nitter RSS for @${handle} via ${instance}: ${feed.items.length} items`);
      return feed.items.slice(0, 8);
    } catch (err) {
      console.warn(`Nitter ${instance} failed for @${handle}: ${err.message}`);
    }
  }
  return [];
}

// Convert Nitter item link to x.com link, extract tweet ID
function toXUrl(handle, nitterLink) {
  // nitterLink looks like: https://nitter.poast.org/KevinLMak/status/123456
  const match = nitterLink?.match(/\/status\/(\d+)/);
  if (match) return `https://x.com/${handle}/status/${match[1]}`;
  return `https://x.com/${handle}`;
}

export async function fetchAndUpdateTweets() {
  let saved = 0;

  for (const user of CURATED_USERS) {
    try {
      const items = await fetchNitterRSS(user.handle);

      for (const item of items) {
        // Skip retweets and replies (title starts with "RT @" or "@username")
        const title = item.title || '';
        if (title.startsWith('RT @') || title.startsWith('R to @')) continue;

        const tweetUrl = toXUrl(user.handle, item.link);
        const exists = await Tweet.findOne({ url: tweetUrl });
        if (exists) continue;

        // Clean up the content — Nitter sometimes includes HTML
        const content = (item.contentSnippet || item.content || item.title || '')
          .replace(/<[^>]*>/g, '')  // strip HTML
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
          .trim()
          .slice(0, 560);

        if (!content) continue;

        const hashtags = [...content.matchAll(/#(\w+)/g)].map(m => m[1]);
        const mentions = [...content.matchAll(/@(\w+)/g)].map(m => m[1]);
        const cashtags = [...content.matchAll(/\$([A-Z]{1,5})\b/g)].map(m => m[1]);

        await Tweet.create({
          author:        user.displayName,
          authorHandle:  user.handle,
          content,
          url:           tweetUrl,
          createdAt:     item.pubDate ? new Date(item.pubDate) : new Date(),
          tags:          hashtags,
          mentions:      mentions,
          relatedSymbols: cashtags,
          sentiment:     classifySentiment(content)
        });
        saved++;
      }

      await sleep(500); // be polite to Nitter
    } catch (err) {
      console.error(`Error fetching @${user.handle}:`, err.message);
    }
  }

  console.log(`✓ Nitter RSS: ${saved} new tweets saved`);
}

// ── helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function classifySentiment(text = '') {
  const pos = ['bull','up','gain','buy','long','rally','surge'].filter(w => text.toLowerCase().includes(w)).length;
  const neg = ['bear','down','fall','sell','short','crash','weak'].filter(w => text.toLowerCase().includes(w)).length;
  return pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral';
}
