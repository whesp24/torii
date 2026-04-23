import mongoose from 'mongoose';

const MeetingSchema = new mongoose.Schema({
  contactId:     { type: String },
  contactName:   { type: String, required: true },
  company:       { type: String },
  date:          { type: Date, required: true },
  type:          { type: String, enum: ['call','coffee','interview','intro','follow-up','other'], default: 'call' },
  agenda:        { type: String, default: '' },
  brief:         { type: String, default: '' },    // AI-generated pre-meeting brief
  postCallNotes: { type: String, default: '' },
  status:        { type: String, enum: ['upcoming','completed','cancelled'], default: 'upcoming' },
}, { timestamps: true });

export default mongoose.model('Meeting', MeetingSchema);
