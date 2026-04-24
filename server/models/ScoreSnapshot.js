/**
 * ScoreSnapshot — immutable record of each scoring run.
 *
 * Every time scoreAllWatchlist() runs, it writes a ScoreSnapshot for each ticker
 * with the score, all signals, and the price at that moment.
 *
 * Forward returns are filled in by backtestService.js after enough time has passed:
 *   ret7d, ret30d, ret90d, ret180d
 *
 * This lets us answer: "Did stocks scored 80+ outperform stocks scored 30-?"
 * Algorithm version tracks when signal weights/sources changed.
 */

import mongoose from 'mongoose';

const signalSnapshotSchema = new mongoose.Schema({
  label:     String,
  direction: { type: String, enum: ['bullish', 'bearish', 'neutral'] },
  delta:     Number,
  noData:    { type: Boolean, default: false },
}, { _id: false });

const snapshotSchema = new mongoose.Schema({
  symbol:           { type: String, required: true, uppercase: true, index: true },
  score:            { type: Number, min: 0, max: 100, required: true },
  rating:           String,
  strategy:         String,
  priceAtScore:     { type: Number, default: null },  // price when scored
  signals:          [signalSnapshotSchema],
  activeSignals:    Number,
  algorithmVersion: { type: String, default: 'v4' },  // increment when weights change
  scoredAt:         { type: Date, default: Date.now, index: true },

  // Forward returns — populated by backtestService after time passes
  ret7d:   { type: Number, default: null },
  ret30d:  { type: Number, default: null },
  ret90d:  { type: Number, default: null },
  ret180d: { type: Number, default: null },
  // Prices used to compute forward returns
  price7d:   Number,
  price30d:  Number,
  price90d:  Number,
  price180d: Number,
  // Whether forward returns have been filled
  filled7d:   { type: Boolean, default: false },
  filled30d:  { type: Boolean, default: false },
  filled90d:  { type: Boolean, default: false },
  filled180d: { type: Boolean, default: false },
}, { timestamps: true });

snapshotSchema.index({ symbol: 1, scoredAt: -1 });
snapshotSchema.index({ score: -1, scoredAt: -1 });
snapshotSchema.index({ algorithmVersion: 1, scoredAt: -1 });

export default mongoose.model('ScoreSnapshot', snapshotSchema);
