import Tweet from '../models/Tweet.js';

// X API v2 — Bearer Token stored in TWITTER_BEARER_TOKEN env var
const BEARER = process.env.TWITTER_BEARER_TOKEN;
const BASE   = 'https://api.twitter.com/2';

const CURATED_USERS = [
  { handle: 'KevinLMak',       displayName: 'Kevin Mak' },
  { handle: 'ContrarianCurse', displayName: 'SuspendedCap' },
  { handle: 'dsundheim',       displayName: 'D. Sundheim' },
  { handle: 'jeff_weinstein',  displayName: 'Jeff Weinstein' },
  { handle: 'HannoLustig',     displayName: 'Hanno Lustig' },
  { handle: 'patrick_oshag',   displayName: 'Patrick O\'Shaughnessy' },
];

const xGet = (path) => fetch(`${BASE}${path}`, {
  headers: { Authorization: `Bearer ${BEARER}` }
});

export async function fetchAndUpdateTweets() {
  if (!BEARER) {
    console.log('ℹ TWITTER_BEARER_TOKEN not set — skipping tweet fetch');
    return;
  }

  // 1. Batch-resolve all handles → user IDs
  const usernames = CURATED_USERS.map(u => u.handle).join(',');
  const usersRes = await xGet(`/users/by?usernames=${usernames}&user.fields=name,username`);

  if (!usersRes.ok) {
    console.error('X API /users/by failed:', usersRes.status, await usersRes.text());
    return;
  }

  const { data: users = [] } = await usersRes.json();
  let saved = 0;

  // 2. Fetch recent tweets for each user
  for (const user of users) {
    try {
      const tweetsRes = await xGet(
        `/users/${user.id}/tweets?max_results=10&exclude=retweets,replies` +
        `&tweet.fields=created_at,text,entities`
      );

      if (!tweetsRes.ok) {
        console.error(`X API tweets failed for @${user.username}: ${tweetsRes.status}`);
        continue;
      }

      const { data: tweets = [] } = await tweetsRes.json();
      const meta = CURATED_USERS.find(u => u.handle.toLowerCase() === user.username.toLowerCase());

      for (const tweet of tweets) {
        const url = `https://x.com/${user.username}/status/${tweet.id}`;
        const exists = await Tweet.findOne({ url });
        if (exists) continue;

        await Tweet.create({
          author:        meta?.displayName || user.name,
          authorHandle:  user.username,
          content:       tweet.text,
          url,
          createdAt:     new Date(tweet.created_at),
          tags:          (tweet.entities?.hashtags  || []).map(h => h.tag),
          mentions:      (tweet.entities?.mentions  || []).map(m => m.username),
          relatedSymbols:(tweet.entities?.cashtags  || []).map(c => c.tag.toUpperCase()),
          sentiment:     classifySentiment(tweet.text)
        });
        saved++;
      }

      await sleep(150); // stay well within rate limits
    } catch (err) {
      console.error(`Error fetching @${user.username}:`, err.message);
    }
  }

  console.log(`✓ X API: ${saved} new tweets saved`);
}

// ── helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function classifySentiment(text = '') {
  const pos = ['bull','up','gain','buy','long','rally','surge'].filter(w => text.toLowerCase().includes(w)).length;
  const neg = ['bear','down','fall','sell','short','crash','weak'].filter(w => text.toLowerCase().includes(w)).length;
  return pos > neg ? 'positive' : neg > pos ? 'negative' : 'neutral';
}
