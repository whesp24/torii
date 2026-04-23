import mongoose from 'mongoose';

const watchlistSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  name: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['stock', 'etf', 'crypto', 'forex', 'commodity', 'index'],
    default: 'stock'
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  },
  alertPrice: {
    type: Number,
    default: null
  },
  alertType: {
    type: String,
    enum: ['above', 'below', 'none'],
    default: 'none'
  },
  // Latest price data cache
  lastPrice: {
    type: Number,
    default: null
  },
  lastChange: {
    type: Number,
    default: null
  },
  lastChangePercent: {
    type: Number,
    default: null
  },
  lastPriceUpdate: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Index for efficient queries
watchlistSchema.index({ addedAt: -1 });
watchlistSchema.index({ category: 1 });

export default mongoose.model('Watchlist', watchlistSchema);
