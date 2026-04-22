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

app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});
