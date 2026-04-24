import express from 'express';
import Briefing from '../models/Briefing.js';
import KPI from '../models/KPI.js';
import News from '../models/News.js';
import { generateAndSaveBriefing } from '../services/briefingService.js';

const router = express.Router();

// GET / — return latest briefing (frontend calls /api/briefing directly)
// Maps model fields (keyNews, topMovers) to frontend fields (headlines, kpis)
// and enriches with live KPI + news data for the Command Center signal panel
router.get('/', async (req, res) => {
  try {
    const briefing = await Briefing.findOne().sort({ date: -1 }).lean();
    if (!briefing) return res.json({ content: null, summary: null, headlines: [], kpis: [], marketSentiment: 'neutral' });

    // Enrich with live KPIs for the Command Center market chips
    const kpiSymbols = ['^GSPC', '^IXIC', '^VIX', '^TNX'];
    const kpiDocs = await KPI.find({ symbol: { $in: kpiSymbols } }).lean().catch(() => []);
    const kpiLabels = { '^GSPC': 'S&P 500', '^IXIC': 'Nasdaq', '^VIX': 'VIX', '^TNX': '10Y Yield' };
    const kpis = kpiDocs.map(k => ({
      symbol: k.symbol,
      label: kpiLabels[k.symbol] || k.symbol,
      price: k.price,
      value: k.price,
      change: k.changePercent,
    }));

    // Map keyNews → headlines (Command Center expects title, source, time)
    const headlines = (briefing.keyNews || []).map(n => ({
      title: n.title,
      headline: n.title,
      summary: n.summary || '',
      source: n.impact || 'News',
      publisher: n.impact || 'News',
      time: briefing.generatedAt,
      publishedAt: briefing.generatedAt,
    }));

    // If keyNews is empty, pull recent news from the News collection
    if (headlines.length === 0) {
      const recentNews = await News.find().sort({ publishedAt: -1 }).limit(5).lean().catch(() => []);
      for (const n of recentNews) {
        headlines.push({
          title: n.title,
          headline: n.title,
          summary: n.description || '',
          source: n.source || n.publisher || 'News',
          publisher: n.source || n.publisher || 'News',
          time: n.publishedAt,
          publishedAt: n.publishedAt,
        });
      }
    }

    res.json({
      ...briefing,
      headlines,
      kpis,
      content: briefing.summary,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET latest briefing
router.get('/latest', async (req, res) => {
  try {
    const briefing = await Briefing.findOne().sort({ date: -1 });
    if (!briefing) return res.status(404).json({ error: 'No briefing found' });
    res.json(briefing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST — generate today's briefing (force regenerate if exists)
router.post('/generate', async (req, res) => {
  try {
    const { force = false } = req.body;
    const briefing = await generateAndSaveBriefing({ force });
    res.json(briefing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
