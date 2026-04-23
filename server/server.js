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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend running', timestamp: new Date() });
});

// Serve SPA - all routes not matching /api/* go to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Initialize data on startup
initializeKPIs().catch(err => console.error('Error initializing KPIs:', err));
initializeTasks().catch(err => console.error('Error initializing tasks:', err));
initializeWatchlist().catch(err => console.error('Error initializing watchlist:', err));

// Fetch tweets and news immediately on startup so data is fresh without waiting for cron
setTimeout(() => {
  fetchAndUpdateTweets().catch(err => console.error('Startup tweet fetch error:', err));
  fetchAndUpdateNews().catch(err => console.error('Startup news fetch error:', err));
}, 5000); // 5s delay to let MongoDB finish connecting

// Scheduled Jobs
cron.schedule('*/30 * * * *', () => {
  console.log('Running KPI update...');
  updateAllKPIs();
});

cron.schedule('*/5 * * * *', () => {
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
