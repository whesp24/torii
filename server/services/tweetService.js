import Tweet from '../models/Tweet.js';
import Parser from 'rss-parser';

const parser = new Parser({ timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ToriiApp/1.0)' } });

// Curated finance accounts with display info
const CURATED_USERS = [
  { handle: 'KevinLMak',       displayName: 'Kevin Mak' },
  { handle: 'ContrarianCurse', displayName: 'SuspendedCap' },
  { handle: 'dsundheim',       displayName: 'D. Sundheim' },
  { handle: 'jeff_weinstein',  displayName: 'Jeff Weinstein' },
  { handle: 'HannoLustig',     displayName: 'Hanno Lustig' },
  { handle: 'patrick_oshag',   displayName: 'Patrick O\'Shaughnessy' },
];

// Working nitter instances — tried in order until one works
const NITTER_INSTANCES = [
  'nitter.privacydev.net',
  'nitter.poast.org',
  'nitter.bird.froth.zone',
  'nitter.cz',
  'nitter.1d4.us',
];

export async function fetchAndUpdateTweets() {
  let saved = 0;

  for (const { handle, displayName } of CURATED_USERS) {
    let fetched = false;

    // Try each nitter instance until one works
    for (const instance of NITTER_INSTANCES) {
      if (fetched) break;
      try {
        const feedUrl = `https://${instance}/${handle}/rss`;
        const feed = await parser.parseURL(feedUrl);

        for (const item of (feed.items || []).slice(0, 10)) {
          if (!item.link) continue;
          const exists = await Tweet.findOne({ url: item.link });
          if (exists) continue;

          const content = item.contentSnippet || item.title || '';
          await Tweet.create({
            author: displayName,
            authorHandle: handle,
            content: content.trim(),
            url: item.link,
            createdAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            tags: extractHashtags(content),
            mentions: extractMentions(content),
            relatedSymbols: extractSymbols(content),
            sentiment: classifySentiment(content)
          });
          saved++;
        }

        console.log(`✓ Fetched tweets for @${handle} via ${instance}`);
        fetched = true;
      } catch (err) {
        // Try next instance silently
      }
    }

    if (!fetched) {
      console.log(`ℹ No nitter instance worked for @${handle} — skipping`);
    }
    await sleep(500);
  }

  console.log(`✓ Tweets update: ${saved} new posts saved`);
}

// ── helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function extractHashtags(t = '') { return (t.match(/#\w+/g) || []).map(h => h.slice(1)); }
function extractMentions(t = '') { return (t.match(/@\w+/g) || []).map(m => m.slice(1)); }
function extractSymbols(t = '') { return (t.match(/\$[A-Z]{1,5}/g) || []).map(s => s.slice(1)); }
function classifySentiment(text = '') {
  const pos = ['bull', 'up', 'gain', 'buy', 'long', 'rally', 'surge', 'strong'].filter(w => text.toLowerCase().includes(w)).length;
  const neg = ['bear', 'down', 'fall', 'sell', 'short', 'crash', 'weak', 'drop'].filter(w => text.toLowerCase().includes(w)).length;
  return pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral';
}
