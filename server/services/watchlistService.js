import Watchlist from '../models/Watchlist.js';

// Get all watchlist items
export async function getAllWatchlist() {
  try {
    const items = await Watchlist.find().sort({ addedAt: -1 });
    return items;
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    throw error;
  }
}

// Get watchlist items by category
export async function getWatchlistByCategory(category) {
  try {
    const items = await Watchlist.find({ category }).sort({ addedAt: -1 });
    return items;
  } catch (error) {
    console.error('Error fetching watchlist by category:', error);
    throw error;
  }
}

// Get single watchlist item by symbol
export async function getWatchlistItem(symbol) {
  try {
    const item = await Watchlist.findOne({ symbol: symbol.toUpperCase() });
    return item;
  } catch (error) {
    console.error('Error fetching watchlist item:', error);
    throw error;
  }
}

// Add item to watchlist
export async function addToWatchlist(watchlistData) {
  try {
    // Check if already exists
    const existing = await Watchlist.findOne({ symbol: watchlistData.symbol.toUpperCase() });
    if (existing) {
      return existing; // Return existing if already in watchlist
    }

    const item = new Watchlist({
      symbol: watchlistData.symbol.toUpperCase(),
      name: watchlistData.name || '',
      category: watchlistData.category || 'stock',
      notes: watchlistData.notes || '',
      alertPrice: watchlistData.alertPrice || null,
      alertType: watchlistData.alertType || 'none'
    });

    await item.save();
    return item;
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    throw error;
  }
}

// Update watchlist item
export async function updateWatchlistItem(symbol, updates) {
  try {
    const item = await Watchlist.findOneAndUpdate(
      { symbol: symbol.toUpperCase() },
      updates,
      { new: true }
    );
    return item;
  } catch (error) {
    console.error('Error updating watchlist item:', error);
    throw error;
  }
}

// Remove item from watchlist
export async function removeFromWatchlist(symbol) {
  try {
    const item = await Watchlist.findOneAndDelete({ symbol: symbol.toUpperCase() });
    return item;
  } catch (error) {
    console.error('Error removing from watchlist:', error);
    throw error;
  }
}

// Update price data for watchlist item
export async function updateWatchlistPrice(symbol, priceData) {
  try {
    const item = await Watchlist.findOneAndUpdate(
      { symbol: symbol.toUpperCase() },
      {
        lastPrice: priceData.price,
        lastChange: priceData.change,
        lastChangePercent: priceData.changePercent,
        lastPriceUpdate: new Date()
      },
      { new: true }
    );
    return item;
  } catch (error) {
    console.error('Error updating watchlist price:', error);
    throw error;
  }
}

// Get items with active alerts
export async function getWatchlistWithAlerts() {
  try {
    const items = await Watchlist.find({ alertType: { $ne: 'none' } }).sort({ addedAt: -1 });
    return items;
  } catch (error) {
    console.error('Error fetching watchlist alerts:', error);
    throw error;
  }
}

// Initialize with sample watchlist items
export async function initializeWatchlist() {
  try {
    const count = await Watchlist.countDocuments();
    if (count === 0) {
      console.log('Initializing watchlist...');
      const sampleItems = [
        { symbol: 'NVDA', name: 'NVIDIA Corp', category: 'stock', notes: 'AI leader' },
        { symbol: 'TSLA', name: 'Tesla Inc', category: 'stock', notes: 'EV & energy' },
        { symbol: 'MSFT', name: 'Microsoft Corp', category: 'stock', notes: 'Cloud & AI' },
        { symbol: 'SPY', name: 'S&P 500 ETF', category: 'etf' },
        { symbol: 'QQQ', name: 'Nasdaq 100 ETF', category: 'etf' },
      ];

      await Watchlist.insertMany(sampleItems);
      console.log('Watchlist initialized');
    }
  } catch (error) {
    console.error('Error initializing watchlist:', error);
  }
}
