import express from 'express';
import Tweet from '../models/Tweet.js';

const router = express.Router();

// Get all tweets
router.get('/', async (req, res) => {
  try {
    const tweets = await Tweet.find().sort({ createdAt: -1 }).limit(50);
    res.json(tweets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tweets by tag
router.get('/tag/:tag', async (req, res) => {
  try {
    const tweets = await Tweet.find({ tags: req.params.tag })
      .sort({ createdAt: -1 })
      .limit(30);
    res.json(tweets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tweets about specific symbol
router.get('/symbol/:symbol', async (req, res) => {
  try {
    const tweets = await Tweet.find({ relatedSymbols: req.params.symbol.toUpperCase() })
      .sort({ createdAt: -1 });
    res.json(tweets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tweets by sentiment
router.get('/sentiment/:sentiment', async (req, res) => {
  try {
    const tweets = await Tweet.find({ sentiment: req.params.sentiment })
      .sort({ createdAt: -1 })
      .limit(30);
    res.json(tweets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
