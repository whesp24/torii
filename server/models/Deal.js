import mongoose from 'mongoose';

const DealSchema = new mongoose.Schema({
  company:        { type: String, required: true },
  ticker:         { type: String },
  stage:          { type: String, enum: ['watching','thesis','conviction','position','passed','exited'], default: 'watching' },
  thesis:         { type: String, default: '' },
  targetPrice:    { type: Number },
  currentPrice:   { type: Number },
  upside:         { type: Number },           // % upside to target
  catalysts:      [{ type: String }],
  risks:          [{ type: String }],
  linkedContacts: [{ type: String }],         // contact _ids
  notes:          { type: String, default: '' },
  priority:       { type: String, enum: ['high','medium','low'], default: 'medium' },
}, { timestamps: true });

export default mongoose.model('Deal', DealSchema);
