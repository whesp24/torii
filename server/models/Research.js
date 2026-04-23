import mongoose from 'mongoose';

const researchSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  content:     { type: String, default: '' },
  type:        { type: String, enum: ['thesis','memo','note','article','model','other'], default: 'note' },
  tags:        [String],
  tickers:     [String],   // linked tickers e.g. ['NVDA','TSM']
  dealIds:     [String],   // linked deal _ids
  conviction:  { type: Number, min: 1, max: 10, default: 5 },
  source:      { type: String, default: '' }, // URL or citation
  pinned:      { type: Boolean, default: false },
}, { timestamps: true });

researchSchema.index({ title: 'text', content: 'text', tags: 'text' });
researchSchema.index({ tickers: 1 });
researchSchema.index({ type: 1 });

export default mongoose.model('Research', researchSchema);
