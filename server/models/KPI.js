import mongoose from 'mongoose';

const kpiSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  label: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  change: Number,
  changePercent: Number,
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String,
    enum: ['alpha-vantage', 'mock'],
    default: 'alpha-vantage'
  }
}, { timestamps: true });

// Index for efficient queries
kpiSchema.index({ symbol: 1 });
kpiSchema.index({ lastUpdated: -1 });

export default mongoose.model('KPI', kpiSchema);
