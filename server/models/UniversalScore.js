import mongoose from 'mongoose';

const SignalSchema = new mongoose.Schema({
  label:     { type: String },
  direction: { type: String, enum: ['bullish','bearish','neutral'] },
  delta:     { type: Number, default: 0 },
  value:     { type: String },
}, { _id: false });

const UniversalScoreSchema = new mongoose.Schema({
  symbol:       { type: String, required: true, unique: true, index: true, uppercase: true },
  exchange:     { type: String, index: true },      // NASDAQ, NYSE, TSE
  name:         { type: String },
  sector:       { type: String, index: true },
  industry:     { type: String },
  // Score
  score:        { type: Number, default: 50, index: true },
  rating:       { type: String },
  strategy:     { type: String, index: true },
  // Key metrics (pre-extracted for fast filtering without re-fetching)
  currentPrice: { type: Number },
  changePercent:{ type: Number },
  marketCap:    { type: Number, index: true },       // in USD millions
  peRatio:      { type: Number },
  fwdPE:        { type: Number },
  revenueGrowth:{ type: Number },                    // % YoY
  shortPct:     { type: Number },                    // % of float
  rsi:          { type: Number },
  ret3mo:       { type: Number },                    // 3-month return %
  daysToEarnings:{ type: Number },                   // null if no upcoming
  // EDGAR / DCF fields (added in v2)
  fcfMargin:    { type: Number },                    // FCF margin %
  debtToEquity: { type: Number },                    // D/E ratio
  netDebt:      { type: Number },                    // net debt $M
  interestCoverage: { type: Number },                // EBIT / interest expense
  intrinsicValue: { type: Number },                  // DCF per-share value
  dcfUpside:    { type: Number, index: true },       // % upside vs market price
  // signals stored for filter-by-signal
  signals:      [SignalSchema],
  // Meta
  lastScored:   { type: Date, index: true },
  inWatchlist:  { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('UniversalScore', UniversalScoreSchema);
