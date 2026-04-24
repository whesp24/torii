import mongoose from 'mongoose';

const catalystSchema = new mongoose.Schema({
  ticker:   { type: String, required: true, uppercase: true, trim: true },
  title:    { type: String, required: true },
  type:     { type: String, enum: ['earnings','fda','lockup','analyst_day','spin_off','index_rebal','conference','product_launch','dividend','split','macro','other'], default: 'other' },
  date:     { type: Date, required: true },
  endDate:  { type: Date },
  notes:    { type: String, default: '' },
  impact:   { type: String, enum: ['high','medium','low'], default: 'medium' },
  resolved: { type: Boolean, default: false },
  outcome:  { type: String, default: '' },
}, { timestamps: true });

catalystSchema.index({ date: 1, ticker: 1 });
export default mongoose.model('Catalyst', catalystSchema);
