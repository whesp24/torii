import mongoose from 'mongoose';

const newsSchema = new mongoose.Schema({
  source: String,
  author: String,
  title: {
    type: String,
    required: true
  },
  description: String,
  url: {
    type: String,
    required: true,
    unique: true
  },
  imageUrl: String,
  publishedAt: Date,
  content: String,
  category: {
    type: String,
    enum: ['stocks', 'economics', 'tech', 'international', 'general', 'japan'],
    default: 'general'
  },
  sentiment: {
    type: String,
    enum: ['positive', 'negative', 'neutral'],
    default: 'neutral'
  },
  relatedStocks: [String]
}, { timestamps: true });

export default mongoose.model('News', newsSchema);
