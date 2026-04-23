import mongoose from 'mongoose';

const NoteSchema = new mongoose.Schema({
  title:     { type: String, required: true },
  body:      { type: String, default: '' },
  ticker:    { type: String },               // linked stock ticker
  contactId: { type: String },               // linked contact _id
  tags:      [{ type: String }],
  pinned:    { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('Note', NoteSchema);
