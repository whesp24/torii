import News from '../models/News.js';

const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
const BASE_URL = 'https://newsapi.org/v2';

export async function fetchAndUpdateNews() {
  try {
    const categories = ['business', 'technology'];

    for (const category of categories) {
      const url = `${BASE_URL}/top-headlines?category=${category}&country=us&apiKey=${NEWSAPI_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.articles) {
        for (const article of data.articles.slice(0, 10)) {
          const existingNews = await News.findOne({ url: article.url });

          if (!existingNews) {
            await News.create({
              source: article.source.name,
              author: article.author,
              title: article.title,
              description: article.description,
              url: article.url,
              imageUrl: article.urlToImage,
              publishedAt: new Date(article.publishedAt),
              content: article.content,
              category: category === 'business' ? 'stocks' : 'tech',
              sentiment: classifySentiment(article.title + ' ' + article.description)
            });

            console.log(`✓ Saved: ${article.title}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('News update error:', error);
  }
}

function classifySentiment(text) {
  const positive = ['up', 'gain', 'surge', 'rally', 'bull', 'jump', 'rise', 'strong', 'excellent'];
  const negative = ['down', 'fall', 'crash', 'drop', 'bear', 'decline', 'loss', 'weak', 'poor'];

  const lowerText = text.toLowerCase();
  const posCount = positive.filter(word => lowerText.includes(word)).length;
  const negCount = negative.filter(word => lowerText.includes(word)).length;

  if (posCount > negCount) return 'positive';
  if (negCount > posCount) return 'negative';
  return 'neutral';
}
