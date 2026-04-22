#!/bin/bash

# Navigate to the server folder
cd ~/Downloads/toriiclaude1/server

# Create directory structure
mkdir -p models services routes

# Create package.json
cat > package.json << 'EOF'
{
  "name": "torii-backend",
  "version": "1.0.0",
  "type": "module",
  "description": "Backend for Torii - Japan Market Hub",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.0.0",
    "dotenv": "^16.0.3",
    "cors": "^2.8.5",
    "node-cron": "^3.0.2"
  }
}
EOF

# Create .env template
cat > .env.example << 'EOF'
MONGODB_URI=mongodb+srv://whesp24_db_user:TrkJulZqSC536J5a@cluster0.w3tc4dc.mongodb.net/?appName=Cluster0
ALPHA_VANTAGE_KEY=IO0Y9CY7K6K36D6Z
NEWSAPI_KEY=183666ca6fd9408bacda18350ec07599
NODE_ENV=development
PORT=5000
EOF

# Create server.js
cat > server.js << 'EOF'
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { fetchAndUpdateStocks } from './services/stockService.js';
import { fetchAndUpdateNews } from './services/newsService.js';
import { fetchAndUpdateTweets } from './services/tweetService.js';
import { generateAndSaveBriefing } from './services/briefingService.js';
import stockRoutes from './routes/stocks.js';
import newsRoutes from './routes/news.js';
import tweetRoutes from './routes/tweets.js';
import briefingRoutes from './routes/briefing.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✓ MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// Routes
app.use('/api/stocks', stockRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/tweets', tweetRoutes);
app.use('/api/briefing', briefingRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend running', timestamp: new Date() });
});

// Scheduled Jobs
cron.schedule('*/5 * * * *', () => {
  console.log('Running stock update...');
  fetchAndUpdateStocks();
});

cron.schedule('*/15 * * * *', () => {
  console.log('Running news update...');
  fetchAndUpdateNews();
});

cron.schedule('*/10 * * * *', () => {
  console.log('Running tweet update...');
  fetchAndUpdateTweets();
});

cron.schedule('0 9 * * *', () => {
  console.log('Generating daily briefing...');
  generateAndSaveBriefing();
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server running at http://localhost:${PORT}`);
});
EOF

# Create models/Stock.js
cat > models/Stock.js << 'EOF'
import mongoose from 'mongoose';

const stockSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  change: { type: Number },
  changePercent: { type: Number },
  high: { type: Number },
  low: { type: Number },
  volume: { type: Number },
  priceHistory: [{
    price: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Stock', stockSchema);
EOF

# Create models/News.js
cat > models/News.js << 'EOF'
import mongoose from 'mongoose';

const newsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  content: String,
  url: { type: String, unique: true },
  image: String,
  source: String,
  author: String,
  publishedAt: Date,
  category: { type: String, enum: ['market', 'crypto', 'tech', 'general'] },
  sentiment: { type: String, enum: ['positive', 'negative', 'neutral'], default: 'neutral' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('News', newsSchema);
EOF

# Create models/Tweet.js
cat > models/Tweet.js << 'EOF'
import mongoose from 'mongoose';

const tweetSchema = new mongoose.Schema({
  tweetId: { type: String, unique: true },
  content: String,
  author: String,
  authorHandle: String,
  url: String,
  postedAt: Date,
  source: String,
  sentiment: { type: String, enum: ['positive', 'negative', 'neutral'], default: 'neutral' },
  tags: [String],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Tweet', tweetSchema);
EOF

# Create models/Briefing.js
cat > models/Briefing.js << 'EOF'
import mongoose from 'mongoose';

const briefingSchema = new mongoose.Schema({
  title: String,
  summary: String,
  keyPoints: [String],
  marketSentiment: { type: String, enum: ['bullish', 'bearish', 'neutral'] },
  topMovers: [{
    symbol: String,
    change: Number,
    changePercent: Number
  }],
  newsHighlights: [String],
  recommendations: [String],
  date: { type: Date, default: Date.now }
});

export default mongoose.model('Briefing', briefingSchema);
EOF

# Create models/Contact.js
cat > models/Contact.js << 'EOF'
import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  name: String,
  email: String,
  linkedinUrl: String,
  title: String,
  company: String,
  notes: String,
  tags: [String],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Contact', contactSchema);
EOF

# Create services/stockService.js
cat > services/stockService.js << 'EOF'
import Stock from '../models/Stock.js';

const API_KEY = process.env.ALPHA_VANTAGE_KEY;

export async function fetchAndUpdateStocks() {
  try {
    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA'];

    for (const symbol of symbols) {
      try {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data['Global Quote']) {
          const quote = data['Global Quote'];
          const price = parseFloat(quote['05. price']);
          const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));

          await Stock.findOneAndUpdate(
            { symbol },
            {
              price,
              change: parseFloat(quote['09. change']),
              changePercent,
              high: parseFloat(quote['03. high']),
              low: parseFloat(quote['04. low']),
              volume: parseInt(quote['06. volume']),
              updatedAt: new Date()
            },
            { upsert: true }
          );
        }
      } catch (error) {
        console.error(`Error fetching ${symbol}:`, error.message);
      }
    }
    console.log('✓ Stock update complete');
  } catch (error) {
    console.error('Stock service error:', error);
  }
}
EOF

# Create services/newsService.js
cat > services/newsService.js << 'EOF'
import News from '../models/News.js';

const NEWS_API = 'https://newsapi.org/v2/everything';
const API_KEY = process.env.NEWSAPI_KEY;

export async function fetchAndUpdateNews() {
  try {
    const queries = ['Japan stocks market', 'cryptocurrency', 'stock market', 'tech stocks'];

    for (const query of queries) {
      try {
        const params = new URLSearchParams({
          q: query,
          sortBy: 'publishedAt',
          language: 'en',
          pageSize: '20',
          apiKey: API_KEY
        });
        const response = await fetch(`${NEWS_API}?${params}`);
        const data = await response.json();
        const articles = data.articles || [];

        for (const article of articles) {
          const exists = await News.findOne({ url: article.url });
          if (exists) continue;

          let category = 'general';
          if (query.includes('Japan') || query.includes('stock market')) category = 'market';
          if (query.includes('crypto')) category = 'crypto';

          await News.create({
            title: article.title,
            description: article.description,
            url: article.url,
            image: article.urlToImage,
            source: article.source.name,
            author: article.author,
            publishedAt: new Date(article.publishedAt),
            content: article.content,
            category
          });
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error fetching news for "${query}":`, error.message);
      }
    }

    const count = await News.countDocuments();
    if (count > 500) {
      const toDelete = count - 500;
      const oldestArticles = await News.find({}).sort({ publishedAt: 1 }).limit(toDelete);
      for (const article of oldestArticles) {
        await News.deleteOne({ _id: article._id });
      }
    }

    console.log('✓ News fetch complete');
  } catch (error) {
    console.error('News service error:', error);
  }
}
EOF

# Create services/tweetService.js
cat > services/tweetService.js << 'EOF'
import Tweet from '../models/Tweet.js';

const NITTER_HOST = 'nitter.poast.org';
const ACCOUNTS_TO_TRACK = ['elonmusk', 'Reuters', 'MarketWatch', 'cnbc', 'WSJ', 'ReutersBiz', 'business', 'TradingView'];

export async function fetchAndUpdateTweets() {
  try {
    for (const account of ACCOUNTS_TO_TRACK) {
      try {
        const url = `https://${NITTER_HOST}/${account}/rss`;
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const text = await response.text();
        const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];

        for (const item of items.slice(0, 5)) {
          try {
            const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
            const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
            const linkMatch = item.match(/<link>(.*?)<\/link>/);
            const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);

            if (!titleMatch || !descMatch) continue;

            const content = descMatch[1]
              .replace(/<img[^>]*>/g, '')
              .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, '$2 [$1]')
              .replace(/<[^>]*>/g, '');

            const tweetUrl = linkMatch ? linkMatch[1] : '';
            const tweetId = tweetUrl.split('/').pop() || '';

            const exists = await Tweet.findOne({ tweetId });
            if (exists) continue;

            await Tweet.create({
              tweetId,
              author: account,
              authorHandle: account,
              content,
              url: tweetUrl,
              postedAt: pubDateMatch ? new Date(pubDateMatch[1]) : new Date(),
              source: 'nitter',
              tags: extractTags(content)
            });
          } catch (error) {
            console.error(`Error parsing tweet from @${account}:`, error.message);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error fetching tweets from @${account}:`, error.message);
      }
    }

    const count = await Tweet.countDocuments();
    if (count > 500) {
      const toDelete = count - 500;
      const oldestTweets = await Tweet.find({}).sort({ postedAt: 1 }).limit(toDelete);
      for (const tweet of oldestTweets) {
        await Tweet.deleteOne({ _id: tweet._id });
      }
    }

    console.log('✓ Tweet fetch complete');
  } catch (error) {
    console.error('Tweet service error:', error);
  }
}

function extractTags(content) {
  const tags = [];
  if (content.toLowerCase().includes('market') || content.toLowerCase().includes('stock')) tags.push('market');
  if (content.toLowerCase().includes('crypto') || content.toLowerCase().includes('bitcoin')) tags.push('crypto');
  if (content.toLowerCase().includes('japan') || content.toLowerCase().includes('nikkei')) tags.push('japan');
  if (content.toLowerCase().includes('tech')) tags.push('tech');
  return tags;
}
EOF

# Create services/briefingService.js
cat > services/briefingService.js << 'EOF'
import Briefing from '../models/Briefing.js';
import Stock from '../models/Stock.js';
import News from '../models/News.js';
import Tweet from '../models/Tweet.js';

export async function generateAndSaveBriefing() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingBriefing = await Briefing.findOne({
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    if (existingBriefing) {
      console.log('Briefing already exists for today');
      return existingBriefing;
    }

    const topMovers = await Stock.find({}).sort({ changePercent: -1 }).limit(5).select('symbol changePercent change price');
    const recentNews = await News.find({}).sort({ publishedAt: -1 }).limit(5).select('title description url');
    const sentimentTweets = await Tweet.find({}).sort({ postedAt: -1 }).limit(10).select('content author postedAt');

    const avgChange = topMovers.reduce((sum, s) => sum + s.changePercent, 0) / topMovers.length;
    const sentiment = avgChange > 1 ? 'bullish' : avgChange < -1 ? 'bearish' : 'neutral';

    const topGainer = topMovers[0];
    const topLoser = topMovers[topMovers.length - 1];

    const briefingData = {
      title: 'Daily Market Briefing',
      summary: `Market ${sentiment === 'bullish' ? 'showing strength' : sentiment === 'bearish' ? 'under pressure' : 'mixed'}. Top gainer: ${topGainer?.symbol || 'N/A'} (${topGainer?.changePercent?.toFixed(2) || 0}%). Most covered topic: ${recentNews[0]?.title?.substring(0, 50) || 'Market activity'}. Staying diversified is key.`,
      keyPoints: [
        `Market sentiment is ${sentiment}`,
        `Top performer: ${topGainer?.symbol || 'N/A'} +${topGainer?.changePercent?.toFixed(2) || 0}%`,
        `Latest headlines show interest in ${recentNews[0]?.title?.substring(0, 40) || 'market news'}`,
        `${recentNews.length} major news items tracked today`
      ],
      marketSentiment: sentiment,
      topMovers: topMovers.map(s => ({
        symbol: s.symbol,
        change: s.change,
        changePercent: s.changePercent
      })),
      newsHighlights: recentNews.map(n => n.title),
      recommendations: [
        'Monitor key economic indicators',
        'Stay updated on company earnings',
        'Review portfolio positions regularly'
      ]
    };

    const briefing = await Briefing.create(briefingData);
    console.log('✓ Briefing generated and saved');
    return briefing;
  } catch (error) {
    console.error('Briefing service error:', error);
    return null;
  }
}
EOF

# Create routes/stocks.js
cat > routes/stocks.js << 'EOF'
import express from 'express';
import Stock from '../models/Stock.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const stocks = await Stock.find().sort({ changePercent: -1 });
    res.json(stocks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:symbol', async (req, res) => {
  try {
    const stock = await Stock.findOne({ symbol: req.params.symbol.toUpperCase() });
    if (!stock) return res.status(404).json({ error: 'Stock not found' });
    res.json(stock);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
EOF

# Create routes/news.js
cat > routes/news.js << 'EOF'
import express from 'express';
import News from '../models/News.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const news = await News.find().sort({ publishedAt: -1 }).limit(50);
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/category/:category', async (req, res) => {
  try {
    const news = await News.find({ category: req.params.category }).sort({ publishedAt: -1 }).limit(50);
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
EOF

# Create routes/tweets.js
cat > routes/tweets.js << 'EOF'
import express from 'express';
import Tweet from '../models/Tweet.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const tweets = await Tweet.find().sort({ postedAt: -1 }).limit(50);
    res.json(tweets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/tag/:tag', async (req, res) => {
  try {
    const tweets = await Tweet.find({ tags: req.params.tag }).sort({ postedAt: -1 }).limit(50);
    res.json(tweets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
EOF

# Create routes/briefing.js
cat > routes/briefing.js << 'EOF'
import express from 'express';
import Briefing from '../models/Briefing.js';

const router = express.Router();

router.get('/latest', async (req, res) => {
  try {
    const briefing = await Briefing.findOne().sort({ date: -1 });
    res.json(briefing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const days = req.query.days || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const briefings = await Briefing.find({ date: { $gte: startDate } }).sort({ date: -1 });
    res.json(briefings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
EOF

echo "✓ Backend server files created successfully!"
echo ""
echo "Next steps:"
echo "1. Copy the .env.example file to .env"
echo "2. Run: cd ~/Downloads/toriiclaude1 && git add . && git commit -m 'Add backend server' && git push origin main"
echo "3. Go to Render and trigger a new deployment"
