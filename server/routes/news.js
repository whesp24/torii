import express from 'express';
import News from '../models/News.js';

const router = express.Router();

// Get all news
router.get('/', async (req, res) => {
  try {
    const news = await News.find().sort({ publishedAt: -1 }).limit(50);
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get news by category
router.get('/category/:category', async (req, res) => {
  try {
    const news = await News.find({ category: req.params.category })
      .sort({ publishedAt: -1 })
      .limit(30);
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get news by sentiment
router.get('/sentiment/:sentiment', async (req, res) => {
  try {
    const news = await News.find({ sentiment: req.params.sentiment })
      .sort({ publishedAt: -1 })
      .limit(30);
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search news by keyword (ticker/company name) — used by stock detail page
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const news = await News.find({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    }).sort({ publishedAt: -1 }).limit(6);
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get news related to specific stock
router.get('/stock/:symbol', async (req, res) => {
  try {
    const news = await News.find({ relatedStocks: req.params.symbol.toUpperCase() })
      .sort({ publishedAt: -1 });
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
