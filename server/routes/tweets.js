import express from 'express';
import Tweet from '../models/Tweet.js';

const router = express.Router();

// Curated handles — only these accounts are shown
const CURATED_HANDLES = ['KevinLMak', 'ContrarianCurse', 'dsundheim', 'jeff_weinstein', 'HannoLustig', 'patrick_oshag'];
const HANDLE_REGEXES  = CURATED_HANDLES.map(h => new RegExp(`^${h}$`, 'i'));

// Get tweets (curated accounts only — filters out any stale/wrong DB data)
router.get('/', async (req, res) => {
  try {
    const tweets = await Tweet.find({ authorHandle: { $in: HANDLE_REGEXES } })
      .sort({ createdAt: -1 }).limit(60);
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
