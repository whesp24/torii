import mongoose from 'mongoose';

const signalSchema = new mongoose.Schema({
  label:     { type: String },
  value:     { type: String },
  direction: { type: String, enum: ['bullish', 'bearish', 'neutral'] },
  delta:     { type: Number, default: 0 },
  source:    { type: String },
  noData:    { type: Boolean, default: false },
}, { _id: false });

const scoreSchema = new mongoose.Schema({
  symbol:       { type: String, required: true, uppercase: true, index: true },
  name:         { type: String, default: '' },
  score:        { type: Number, min: 0, max: 100, required: true },
  rating:       { type: String, enum: ['STRONG BUY', 'BUY', 'NEUTRAL', 'SELL', 'STRONG SELL'] },
  strategy:     { type: String, enum: ['long', 'short', 'options', 'macro', 'neutral'], default: 'neutral' },
  signals:      [signalSchema],
  currentPrice: { type: Number, default: null },
  changePercent:{ type: Number, default: null },
  activeSignals:{ type: Number, default: 0 },
  scoredAt:     { type: Date, default: Date.now, index: true },
}, { timestamps: true });

scoreSchema.index({ score: -1 });
scoreSchema.index({ strategy: 1, score: -1 });

export default mongoose.model('Score', scoreSchema);
