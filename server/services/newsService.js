import News from '../models/News.js';
import Parser from 'rss-parser';

// NewsAPI free tier blocks all server-side production requests (returns 426).
// Replaced with free financial RSS feeds — no API key, works everywhere.

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'ToriiApp/1.0 (RSS Reader)' }
});

const RSS_FEEDS = [
  // Business / Markets
  { url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',           category: 'stocks',  source: 'Wall Street Journal' },
  { url: 'https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml',         category: 'stocks',  source: 'Wall Street Journal' },
  { url: 'https://www.cnbc.com/id/10001147/device/rss/rss.html',    category: 'stocks',  source: 'CNBC' },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',   category: 'tech',    source: 'CNBC Technology' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/',   category: 'stocks',  source: 'MarketWatch' },
  { url: 'https://feeds.marketwatch.com/marketwatch/marketpulse/',  category: 'stocks',  source: 'MarketWatch' },
  // International / Japan
  { url: 'https://asia.nikkei.com/rss/feed/nar',                    category: 'japan',   source: 'Nikkei Asia' },
  // Tech
  { url: 'https://www.theverge.com/rss/index.xml',                  category: 'tech',    source: 'The Verge' },
  { url: 'https://techcrunch.com/feed/',                            category: 'tech',    source: 'TechCrunch' },
];

const MAX_ITEMS_PER_FEED = 8;

export async function fetchAndUpdateNews() {
  let savedCount = 0;

  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);

      for (const item of (parsed.items || []).slice(0, MAX_ITEMS_PER_FEED)) {
        if (!item.link || !item.title) continue;

        const exists = await News.findOne({ url: item.link });
        if (exists) continue;

        const title = item.title?.trim() || '';
        const description = item.contentSnippet || item.summary || item.content || '';

        await News.create({
          source: feed.source,
          author: item.author || item.creator || feed.source,
          title,
          description,
          url: item.link,
          imageUrl: extractImage(item),
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          content: item.content || description,
          category: feed.category,
          sentiment: classifySentiment(title + ' ' + description)
        });

        savedCount++;
        console.log(`✓ News saved [${feed.category}]: ${title.slice(0, 60)}…`);
      }
    } catch (feedErr) {
      console.error(`Error parsing feed ${feed.url}:`, feedErr.message);
    }
  }

  console.log(`News update complete — ${savedCount} new articles saved.`);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function extractImage(item) {
  // Some RSS feeds put images in enclosure or media
  if (item.enclosure?.url) return item.enclosure.url;
  if (item['media:content']?.$ ?.url) return item['media:content'].$.url;
  // Try to pull first <img> from content HTML
  const match = (item.content || item['content:encoded'] || '').match(/<img[^>]+src="([^"]+)"/i);
  return match ? match[1] : null;
}

function classifySentiment(text = '') {
  const positive = ['up', 'gain', 'surge', 'rally', 'bull', 'jump', 'rise', 'strong', 'excellent', 'beat', 'record'];
  const negative = ['down', 'fall', 'crash', 'drop', 'bear', 'decline', 'loss', 'weak', 'poor', 'miss', 'slump'];
  const lower = text.toLowerCase();
  const pos = positive.filter(w => lower.includes(w)).length;
  const neg = negative.filter(w => lower.includes(w)).length;
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}
