/**
 * redditService.js — Reddit API sentiment scanner
 *
 * Queries r/wallstreetbets + r/stocks + r/investing + r/{TICKER} for ticker mentions.
 * Uses Reddit's official public JSON API (no auth for read-only, 60 req/min).
 *
 * Academic grounding:
 *  Da, Engelberg & Gao (2011): retail investor attention → short-run price pressure
 *  Bollen, Mao & Zeng (2011): Twitter mood predicts DJIA (Reddit has similar dynamics)
 *  Cookson & Niessner (2020): StockTwits + Reddit disagreement predicts volatility
 */

const REDDIT_UA     = 'Torii Investment Platform/1.0 (by /u/toriiplatform)';
const REDDIT_TIMEOUT = 8000;

// Subreddits to search (in priority order)
const SUBREDDITS = ['wallstreetbets', 'stocks', 'investing'];

// Bullish and bearish keyword patterns
const BULL_WORDS = /\b(bull|long|buy|calls?|moon|rocket|🚀|💎|🙌|squeeze|breakout|strong buy|price target raised|earnings beat|buying the dip|hodl|accumulate)\b/gi;
const BEAR_WORDS = /\b(bear|short|puts?|crash|dump|sell|overvalued|bubble|baghold|rug pull|avoid|downgrade|miss|disappointing|heading lower|death cross)\b/gi;

async function fetchSubredditPosts(subreddit, ticker, limit = 10) {
  try {
    // Search within the subreddit for the ticker
    const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(ticker)}&sort=new&limit=${limit}&restrict_sr=1&t=week`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': REDDIT_UA,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(REDDIT_TIMEOUT),
    });
    if (!r.ok) return [];
    const data = await r.json();
    return data?.data?.children?.map(c => c.data) || [];
  } catch (_) { return []; }
}

async function fetchTickerSubreddit(ticker) {
  // Many stocks have their own subreddit (e.g. r/NVDA, r/TSLA, r/GME)
  try {
    const url = `https://www.reddit.com/r/${ticker}/new.json?limit=10`;
    const r = await fetch(url, {
      headers: { 'User-Agent': REDDIT_UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(REDDIT_TIMEOUT),
    });
    if (!r.ok) return [];
    const data = await r.json();
    return data?.data?.children?.map(c => c.data) || [];
  } catch (_) { return []; }
}

function scorePosts(posts) {
  let bull = 0, bear = 0, totalUpvotes = 0, totalComments = 0;
  const titles = [];

  for (const post of posts) {
    const text  = `${post.title || ''} ${post.selftext || ''}`;
    const score = post.score || 0;
    const comments = post.num_comments || 0;
    totalUpvotes  += score;
    totalComments += comments;
    titles.push(post.title || '');

    const bullMatches = (text.match(BULL_WORDS) || []).length;
    const bearMatches = (text.match(BEAR_WORDS) || []).length;

    // Weight by upvotes (high-upvote posts carry more signal)
    const weight = score > 1000 ? 2 : score > 100 ? 1 : 0.5;
    if (bullMatches > bearMatches)  bull += weight;
    else if (bearMatches > bullMatches) bear += weight;
  }

  return { bull, bear, totalUpvotes, totalComments, postCount: posts.length, titles };
}

/**
 * Fetch Reddit sentiment for a ticker.
 * Returns { bull, bear, totalPosts, totalUpvotes, bullPct, mentionVelocity, topTitle }
 */
export async function fetchRedditSentiment(ticker) {
  // Japan stocks / indices don't have meaningful Reddit coverage
  if (ticker.includes('.T') || ticker.startsWith('^')) return null;

  const sym = ticker.toUpperCase().replace(/[^A-Z0-9]/g, '');

  try {
    // Parallel: search main subs + ticker-specific sub
    const [wsb, stocks, investing, tickerSub] = await Promise.all([
      fetchSubredditPosts('wallstreetbets', sym, 10),
      fetchSubredditPosts('stocks', sym, 8),
      fetchSubredditPosts('investing', sym, 5),
      fetchTickerSubreddit(sym),
    ]);

    const allPosts = [...wsb, ...stocks, ...investing, ...tickerSub];
    if (allPosts.length === 0) return null;

    const { bull, bear, totalUpvotes, totalComments, postCount, titles } = scorePosts(allPosts);
    const total = bull + bear;

    if (total < 1 && postCount < 3) return null; // insufficient signal

    const bullPct = total > 0 ? (bull / total) * 100 : 50;

    // Mention velocity: high upvote posts signal trending attention
    const wsbPosts   = wsb.length;
    const highUpvote = allPosts.filter(p => (p.score || 0) > 500).length;

    return {
      bull: Math.round(bull),
      bear: Math.round(bear),
      postCount,
      totalUpvotes,
      totalComments,
      bullPct: parseFloat(bullPct.toFixed(1)),
      wsbPosts,
      highUpvotePosts: highUpvote,
      topTitle: titles[0] || null,
    };
  } catch (err) {
    console.warn(`Reddit fetch failed for ${ticker}: ${err.message}`);
    return null;
  }
}
