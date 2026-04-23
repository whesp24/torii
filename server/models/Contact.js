import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  name:             { type: String, required: true },
  role:             { type: String, default: '' },
  company:          { type: String, default: '' },
  school:           { type: String, default: '' },
  location:         { type: String, default: '' },
  linkedIn:         { type: String, default: '' },
  notes:            { type: String, default: '' },
  lastContactedAt:  { type: Date, default: null }, // CRM: last time you reached out
  linkedDeals:      [{ type: String }],            // deal _ids
  email:            String,
  phone:            String,
  tags:             [String],
}, { timestamps: true });

export default mongoose.model('Contact', contactSchema);
