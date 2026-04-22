import mongoose from 'mongoose';

const briefingSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true
  },
  marketSentiment: {
    type: String,
    enum: ['bullish', 'bearish', 'neutral'],
    default: 'neutral'
  },
  topMovers: [{
    symbol: String,
    change: Number,
    reason: String
  }],
  keyNews: [{
    title: String,
    summary: String,
    impact: String
  }],
  economicEvents: [{
    event: String,
    impact: String,
    forecast: String,
    actual: String
  }],
  summary: String,
  recommendations: [String],
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export default mongoose.model('Briefing', briefingSchema);
