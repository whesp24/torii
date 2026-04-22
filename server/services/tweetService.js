import Tweet from '../models/Tweet.js';
import Parser from 'rss-parser';

const parser = new Parser();

export async function fetchAndUpdateTweets() {
  try {
    // Using Nitter RSS feeds as alternative to Twitter API
    const feeds = [
      'https://nitter.net/elonmusk/rss',
      'https://nitter.net/CNBCnow/rss',
      'https://nitter.net/wsj/rss'
    ];

    for (const feedUrl of feeds) {
      try {
        const feed = await parser.parseURL(feedUrl);

        for (const item of feed.items.slice(0, 5)) {
          const existingTweet = await Tweet.findOne({ url: item.link });

          if (!existingTweet) {
            const hashtags = extractHashtags(item.content || item.title);
            const symbols = extractSymbols(item.content || item.title);

            await Tweet.create({
              author: feed.title?.split(' /')[0],
              authorHandle: extractHandle(feedUrl),
              content: item.title || item.content,
              url: item.link,
              createdAt: new Date(item.pubDate),
              tags: hashtags,
              mentions: extractMentions(item.content || item.title),
              relatedSymbols: symbols,
              sentiment: classifySentiment(item.content || item.title)
            });

            console.log(`✓ Saved tweet from ${feed.title}`);
          }
        }
      } catch (feedError) {
        console.error(`Error parsing feed ${feedUrl}:`, feedError.message);
      }
    }
  } catch (error) {
    console.error('Tweet update error:', error);
  }
}

function extractHashtags(text) {
  const hashtags = text.match(/#\w+/g) || [];
  return hashtags.map(tag => tag.substring(1));
}

function extractMentions(text) {
  const mentions = text.match(/@\w+/g) || [];
  return mentions.map(mention => mention.substring(1));
}

function extractSymbols(text) {
  const symbols = text.match(/\$[A-Z]{1,5}/g) || [];
  return symbols.map(symbol => symbol.substring(1));
}

function extractHandle(feedUrl) {
  const match = feedUrl.match(/nitter\.net\/([^\/]+)/);
  return match ? match[1] : 'unknown';
}

function classifySentiment(text) {
  const positive = ['bull', 'up', 'gain', 'surge', 'bullish', 'strong', 'excellent'];
  const negative = ['bear', 'down', 'fall', 'crash', 'bearish', 'weak', 'poor'];

  const lowerText = text.toLowerCase();
  const posCount = positive.filter(word => lowerText.includes(word)).length;
  const negCount = negative.filter(word => lowerText.includes(word)).length;

  if (posCount > negCount) return 'positive';
  if (negCount > posCount) return 'negative';
  return 'neutral';
}
