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
import stockRoutes from './routes/stocks.js';
import newsRoutes from './routes/news.js';
import tweetRoutes from './routes/tweets.js';
import briefingRoutes from './routes/briefing.js';
import kpiRoutes from './routes/kpis.js';
import taskRoutes from './routes/tasks.js';
import watchlistRoutes from './routes/watchlist.js';
import alertRoutes from './routes/alerts.js';

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend running', timestamp: new Date() });
});

// Serve SPA - all routes not matching /api/* go to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Initialize KPIs, Tasks, and Watchlist on startup
initializeKPIs().catch(err => console.error('Error initializing KPIs:', err));
initializeTasks().catch(err => console.error('Error initializing tasks:', err));
initializeWatchlist().catch(err => console.error('Error initializing watchlist:', err));

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

app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});
