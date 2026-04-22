import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: String,
  phone: String,
  company: String,
  title: String,
  industry: String,
  location: String,
  tags: [String],
  notes: String,
  lastContacted: Date,
  relationships: [{
    personId: mongoose.Schema.Types.ObjectId,
    type: String
  }],
  socialLinks: {
    linkedin: String,
    twitter: String,
    website: String
  }
}, { timestamps: true });

export default mongoose.model('Contact', contactSchema);
