import mongoose from 'mongoose';

const SavedScreenSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String },
  filters: {
    sector:        { type: String },
    exchange:      { type: String },
    minMarketCap:  { type: Number },     // millions
    maxMarketCap:  { type: Number },
    minScore:      { type: Number },
    maxScore:      { type: Number },
    minPE:         { type: Number },
    maxPE:         { type: Number },
    strategy:      { type: String },
    hasEarnings:   { type: Boolean },    // earnings in next 60d
    minRet3mo:     { type: Number },
    maxShortPct:   { type: Number },
    signalLabel:   { type: String },     // filter by specific signal
    signalDir:     { type: String },     // bullish|bearish|neutral
  },
  sortBy:      { type: String, default: 'score' },   // score|ret3mo|marketCap
  sortDir:     { type: String, default: 'desc' },
  lastRunAt:   { type: Date },
  lastResultCount: { type: Number },
}, { timestamps: true });

export default mongoose.model('SavedScreen', SavedScreenSchema);
