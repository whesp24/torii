import Briefing from '../models/Briefing.js';
import Stock from '../models/Stock.js';
import News from '../models/News.js';
import Tweet from '../models/Tweet.js';

export async function generateAndSaveBriefing() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if briefing already exists for today
    const existingBriefing = await Briefing.findOne({
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    if (existingBriefing) {
      console.log('Briefing already generated for today');
      return;
    }

    // Fetch latest data
    const topStocks = await Stock.find().sort({ changePercent: -1 }).limit(5);
    const topNews = await News.find().sort({ publishedAt: -1 }).limit(5);
    const sentimentTweets = await Tweet.find().sort({ createdAt: -1 }).limit(10);

    // Calculate market sentiment
    const avgChange = topStocks.reduce((sum, stock) => sum + stock.changePercent, 0) / topStocks.length;
    const marketSentiment = avgChange > 1 ? 'bullish' : avgChange < -1 ? 'bearish' : 'neutral';

    // Analyze sentiment from news
    const posNews = topNews.filter(n => n.sentiment === 'positive').length;
    const negNews = topNews.filter(n => n.sentiment === 'negative').length;

    // Generate summary
    const summary = `
Market opened with ${marketSentiment} sentiment.
Top movers: ${topStocks.slice(0, 3).map(s => `${s.symbol} (${s.changePercent.toFixed(2)}%)`).join(', ')}
Notable news: ${topNews.slice(0, 2).map(n => n.title).join('; ')}
Sentiment: ${posNews} positive vs ${negNews} negative articles
    `.trim();

    // Create briefing
    const briefing = await Briefing.create({
      date: today,
      marketSentiment,
      topMovers: topStocks.map(stock => ({
        symbol: stock.symbol,
        change: stock.change,
        reason: `Trading at $${stock.price.toFixed(2)}`
      })),
      keyNews: topNews.map(news => ({
        title: news.title,
        summary: news.description,
        impact: news.sentiment
      })),
      summary,
      recommendations: generateRecommendations(marketSentiment, topStocks)
    });

    console.log('✓ Daily briefing generated');
    return briefing;
  } catch (error) {
    console.error('Briefing generation error:', error);
  }
}

function generateRecommendations(sentiment, stocks) {
  const recommendations = [];

  if (sentiment === 'bullish') {
    recommendations.push('Consider increasing positions in top performers');
    recommendations.push('Monitor support levels for potential entries');
  } else if (sentiment === 'bearish') {
    recommendations.push('Reduce exposure in volatile stocks');
    recommendations.push('Look for oversold opportunities');
  } else {
    recommendations.push('Maintain balanced portfolio');
    recommendations.push('Watch for trend confirmation signals');
  }

  return recommendations;
}
