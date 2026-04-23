import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  alertType: {
    type: String,
    enum: ['above', 'below', 'change_percent'],
    required: true
  },
  targetPrice: {
    type: Number,
    default: null
  },
  changePercent: {
    type: Number,
    default: null
  },
  enabled: {
    type: Boolean,
    default: true
  },
  triggered: {
    type: Boolean,
    default: false
  },
  triggeredAt: {
    type: Date,
    default: null
  },
  lastCheckedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index for efficient queries
alertSchema.index({ symbol: 1 });
alertSchema.index({ enabled: 1 });
alertSchema.index({ triggered: 1 });

export default mongoose.model('Alert', alertSchema);
