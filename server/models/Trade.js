import mongoose from 'mongoose';

const tradeSchema = new mongoose.Schema({
  ticker: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, default: '' },
  action: { type: String, enum: ['buy', 'sell', 'short', 'cover'], required: true },
  date: { type: Date, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  thesis: { type: String, default: '' },
  catalysts: [String],
  timeframe: { type: String, enum: ['day', 'swing', 'position', 'long-term'], default: 'position' },
  conviction: { type: Number, min: 1, max: 10, default: 5 },
  // Exit / outcome
  exitDate: { type: Date, default: null },
  exitPrice: { type: Number, default: null },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  thesisOutcome: { type: String, enum: ['confirmed', 'invalidated', 'partial', 'pending'], default: 'pending' },
  postMortem: { type: String, default: '' },
  tags: [String],
}, { timestamps: true });

// Virtual: realized P&L
tradeSchema.virtual('pnl').get(function() {
  if (!this.exitPrice || this.status !== 'closed') return null;
  const mult = (this.action === 'buy' || this.action === 'cover') ? 1 : -1;
  return mult * (this.exitPrice - this.price) * this.quantity;
});

tradeSchema.virtual('pnlPct').get(function() {
  if (!this.exitPrice || !this.price) return null;
  const mult = (this.action === 'buy' || this.action === 'cover') ? 1 : -1;
  return mult * (this.exitPrice - this.price) / this.price * 100;
});

tradeSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Trade', tradeSchema);
