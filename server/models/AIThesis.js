import mongoose from 'mongoose';

const AIThesisSchema = new mongoose.Schema({
  ticker:       { type: String, required: true, index: true },
  headline:     String,
  thesis:       String,
  whyNow:       String,
  conviction:   { type: Number, min: 1, max: 10 },
  entry:        Number,
  target:       Number,
  stop:         Number,
  timeframe:    String,
  catalysts:    [String],
  riskFactors:  [String],
  dataPoints:   [String],
  sector:       String,
  marketCap:    String,
  status:       { type: String, default: 'pending', enum: ['pending','approved','dismissed'] },
  generatedAt:  { type: Date, default: Date.now, index: true },
  reviewedAt:   Date,
}, { timestamps: true });

export default mongoose.model('AIThesis', AIThesisSchema);
