import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  role:      { type: String, enum: ['user', 'assistant'], required: true },
  content:   { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const ConversationSchema = new mongoose.Schema({
  title:    { type: String, default: 'New Conversation' },
  messages: [MessageSchema],
}, { timestamps: true });

export default mongoose.model('Conversation', ConversationSchema);
