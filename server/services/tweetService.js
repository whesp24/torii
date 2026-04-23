import Tweet from '../models/Tweet.js';

// X API v2 — Bearer Token stored in TWITTER_BEARER_TOKEN env var
// Free tier uses search/recent (NOT user timelines — that requires Basic $100/mo)
const BEARER = process.env.TWITTER_BEARER_TOKEN;
const BASE   = 'https://api.twitter.com/2';

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

const xGet = (path) => fetch(`${BASE}${path}`, {
  headers: { Authorization: `Bearer ${BEARER}` }
});

export async function fetchAndUpdateTweets() {
  if (!BEARER) {
    console.log('ℹ TWITTER_BEARER_TOKEN not set — skipping tweet fetch');
    return;
  }

  // Single search query for all curated accounts (free tier compatible)
  // Free tier: search/recent — up to 10 req/month (rate limited to 1 per 15 min)
  const fromClauses = CURATED_USERS.map(u => `from:${u.handle}`).join(' OR ');
  const query = encodeURIComponent(`(${fromClauses}) -is:retweet -is:reply`);
  const fields = 'tweet.fields=created_at,text,entities,author_id&expansions=author_id&user.fields=name,username&max_results=10';

  const url = `${BASE}/tweets/search/recent?query=${query}&${fields}`;

  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${BEARER}` }
    });
  } catch (err) {
    console.error('X API search/recent network error:', err.message);
    return;
  }

  if (!res.ok) {
    const body = await res.text();
    console.error(`X API search/recent failed (${res.status}):`, body);
    return;
  }

  const json = await res.json();
  const tweets = json.data || [];
  const includes = json.includes || {};
  const usersById = {};
  for (const u of (includes.users || [])) {
    usersById[u.id] = u;
  }

  let saved = 0;
  for (const tweet of tweets) {
    try {
      const author = usersById[tweet.author_id];
      if (!author) continue;

      const handle = author.username;
      const handleLower = handle.toLowerCase();

      // Only store tweets from our curated list
      if (!HANDLE_MAP[handleLower]) continue;

      const tweetUrl = `https://x.com/${handle}/status/${tweet.id}`;
      const exists = await Tweet.findOne({ url: tweetUrl });
      if (exists) continue;

      await Tweet.create({
        author:        HANDLE_MAP[handleLower] || author.name,
        authorHandle:  handle,
        content:       tweet.text,
        url:           tweetUrl,
        createdAt:     new Date(tweet.created_at),
        tags:          (tweet.entities?.hashtags  || []).map(h => h.tag),
        mentions:      (tweet.entities?.mentions  || []).map(m => m.username),
        relatedSymbols:(tweet.entities?.cashtags  || []).map(c => c.tag.toUpperCase()),
        sentiment:     classifySentiment(tweet.text)
      });
      saved++;
    } catch (err) {
      console.error('Error saving tweet:', err.message);
    }
  }

  console.log(`✓ X API search: ${saved} new tweets saved (${tweets.length} fetched)`);
}

// ── helpers ──────────────────────────────────────────────────────────────────
function classifySentiment(text = '') {
  const pos = ['bull','up','gain','buy','long','rally','surge'].filter(w => text.toLowerCase().includes(w)).length;
  const neg = ['bear','down','fall','sell','short','crash','weak'].filter(w => text.toLowerCase().includes(w)).length;
  return pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral';
}
