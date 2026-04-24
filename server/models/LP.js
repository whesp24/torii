import mongoose from 'mongoose';

const txSchema = new mongoose.Schema({
  date:    { type: Date, required: true },
  amount:  { type: Number, required: true },
  type:    { type: String, default: '' },
  notes:   { type: String, default: '' },
});

const lpSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  type:         { type: String, enum: ['pension','endowment','family_office','fof','sovereign_wealth','insurance','corporate','hnwi','other'], default: 'other' },
  fund:         { type: String, default: '' },
  commitment:   { type: Number, default: 0 },  // $k
  called:       { type: Number, default: 0 },
  distributed:  { type: Number, default: 0 },
  nav:          { type: Number, default: 0 },
  vintage:      { type: Number },
  irr:          { type: Number },
  moic:         { type: Number },
  contact:      { type: String, default: '' },
  email:        { type: String, default: '' },
  notes:        { type: String, default: '' },
  status:       { type: String, enum: ['active','harvesting','realized','watchlist'], default: 'active' },
  capitalCalls:  [txSchema],
  distributions: [txSchema],
}, { timestamps: true });

export default mongoose.model('LP', lpSchema);
