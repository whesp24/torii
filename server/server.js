import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchAndUpdateStocks } from './services/stockService.js';
import { fetchAndUpdateNews } from './services/newsService.js';
import { fetchAndUpdateTweets } from './services/tweetService.js';
import { generateAndSaveBriefing } from './services/briefingService.js';
import { updateAllKPIs, initializeKPIs } from './services/kpiService.js';
import { initializeTasks } from './services/taskService.js';
import { initializeWatchlist } from './services/watchlistService.js';
import { checkAllAlerts } from './services/alertService.js';
import { sendDailyDigest } from './services/emailService.js';
import stockRoutes from './routes/stocks.js';
import newsRoutes from './routes/news.js';
import tweetRoutes from './routes/tweets.js';
import briefingRoutes from './routes/briefing.js';
import kpiRoutes from './routes/kpis.js';
import taskRoutes from './routes/tasks.js';
import watchlistRoutes from './routes/watchlist.js';
import alertRoutes from './routes/alerts.js';
import earningsRoutes from './routes/earnings.js';
import analyticsRoutes from './routes/analytics.js';
import pushRoutes from './routes/push.js';
import positionRoutes from './routes/positions.js';
import contactRoutes from './routes/contacts.js';
import assistantRoutes from './routes/assistant.js';
import notesRoutes from './routes/notes.js';
import dealsRoutes from './routes/deals.js';
import meetingsRoutes from './routes/meetings.js';
import memosRoutes from './routes/memos.js';
import tradeRoutes from './routes/trades.js';
import sentimentRoutes from './routes/sentiment.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✓ MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// Routes
app.use('/api/stocks', stockRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/tweets', tweetRoutes);
app.use('/api/briefing', briefingRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/earnings', earningsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/memos', memosRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/sentiment', sentimentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend running', timestamp: new Date() });
});

// Serve SPA - all routes not matching /api/* go to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Initialize data on startup — staggered to avoid Yahoo 429s on cold start
initializeTasks().catch(err => console.error('Error initializing tasks:', err));
initializeWatchlist().catch(err => console.error('Error initializing watchlist:', err));

// KPIs: cache-aware, only hits Yahoo for stale data
setTimeout(() => {
  initializeKPIs().catch(err => console.error('Error initializing KPIs:', err));
}, 3000);

// Stocks: cache-aware, staggered 20s after KPIs to avoid simultaneous Yahoo bursts
setTimeout(() => {
  fetchAndUpdateStocks().catch(err => console.error('Startup stock fetch error:', err));
}, 20000);

// News + tweets: 30s after startup
setTimeout(() => {
  fetchAndUpdateTweets().catch(err => console.error('Startup tweet fetch error:', err));
  fetchAndUpdateNews().catch(err => console.error('Startup news fetch error:', err));
}, 30000);

// Scheduled Jobs
cron.schedule('*/30 * * * *', () => {
  console.log('Running KPI update...');
  updateAllKPIs();
});

// Stocks every 15min (was 5min — too aggressive for Yahoo free tier)
cron.schedule('*/15 * * * *', () => {
  console.log('Running stock update...');
  fetchAndUpdateStocks();
});

cron.schedule('*/2 * * * *', () => {
  console.log('Checking price alerts...');
  checkAllAlerts().catch(err => console.error('Error checking alerts:', err));
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

// Daily digest email at 7am ET (12:00 UTC)
cron.schedule('0 12 * * 1-5', () => {
  console.log('Sending daily digest email...');
  sendDailyDigest().catch(err => console.error('Email error:', err));
});

app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});
