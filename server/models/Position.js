import mongoose from 'mongoose';

const positionSchema = new mongoose.Schema({
  ticker:    { type: String, required: true, uppercase: true },
  shares:    { type: Number, required: true },
  costBasis: { type: Number, default: 0 },
  addedAt:   { type: Date, default: Date.now },
}, { timestamps: true });

positionSchema.index({ ticker: 1 }, { unique: true });

export default mongoose.model('Position', positionSchema);
