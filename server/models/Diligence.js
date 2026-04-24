import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  id:       String,
  label:    { type: String, required: true },
  checked:  { type: Boolean, default: false },
  notes:    { type: String, default: '' },
  priority: { type: String, enum: ['critical','high','medium','low'], default: 'medium' },
  flagged:  { type: Boolean, default: false },
});

const sectionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  items: [itemSchema],
});

const diligenceSchema = new mongoose.Schema({
  dealName:    { type: String, required: true },
  dealId:      { type: String, default: '' },
  ticker:      { type: String, uppercase: true, default: '' },
  sections:    [sectionSchema],
  status:      { type: String, enum: ['active','paused','approved','passed','completed'], default: 'active' },
  lead:        { type: String, default: '' },
  targetClose: { type: Date },
  notes:       { type: String, default: '' },
  aiSummary:   { type: String, default: '' },
  score:       { type: Number, min: 0, max: 100, default: 0 },
}, { timestamps: true });

export default mongoose.model('Diligence', diligenceSchema);
