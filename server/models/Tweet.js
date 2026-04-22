import mongoose from 'mongoose';

const tweetSchema = new mongoose.Schema({
  author: String,
  authorHandle: String,
  content: {
    type: String,
    required: true
  },
  url: String,
  createdAt: Date,
  likes: Number,
  retweets: Number,
  replies: Number,
  tags: [String],
  mentions: [String],
  sentiment: {
    type: String,
    enum: ['positive', 'negative', 'neutral'],
    default: 'neutral'
  },
  relatedSymbols: [String]
}, { timestamps: true });

export default mongoose.model('Tweet', tweetSchema);
