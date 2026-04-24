import mongoose from 'mongoose';

const sportsBetSchema = new mongoose.Schema({
  // Core bet info
  sport: { type: String, required: true },          // NFL, NBA, MLB, NHL, Soccer, etc.
  league: String,                                     // specific league
  event: { type: String, required: true },           // "Lakers vs Celtics"
  eventDate: { type: Date, required: true },
  betType: {
    type: String,
    required: true,
    enum: ['moneyline', 'spread', 'total', 'prop', 'parlay', 'futures', 'live'],
  },
  selection: { type: String, required: true },       // "Lakers -3.5", "Over 215.5", etc.

  // Odds & sizing
  odds: { type: Number, required: true },            // American odds: +150, -110, etc.
  impliedProb: Number,                                // calculated from odds
  estimatedProb: Number,                              // your estimated true probability
  ev: Number,                                         // expected value (estimatedProb * payout - stake)
  kellyPct: Number,                                   // Kelly criterion % of bankroll

  // Money
  stake: { type: Number, required: true },           // dollars wagered
  toWin: Number,                                      // potential profit
  payout: Number,                                     // stake + toWin

  // Result
  status: {
    type: String,
    enum: ['pending', 'won', 'lost', 'push', 'void'],
    default: 'pending',
  },
  result: Number,                                     // actual P&L (+toWin, -stake, or 0)
  settledAt: Date,

  // Tracking
  sportsbook: String,                                 // DraftKings, FanDuel, etc.
  thesis: String,                                     // reasoning for the bet
  tags: [String],                                     // e.g. ['value', 'sharp-move', 'fade-public']
  confidence: { type: Number, min: 1, max: 10 },

  // Link to broader capital allocation
  capitalPool: {
    type: String,
    enum: ['sports', 'equities', 'crypto', 'options'],
    default: 'sports',
  },
}, { timestamps: true });

// Virtuals for convenience
sportsBetSchema.virtual('isSettled').get(function() {
  return ['won', 'lost', 'push', 'void'].includes(this.status);
});

// Convert American odds to implied probability
sportsBetSchema.pre('save', function(next) {
  if (this.odds) {
    if (this.odds > 0) {
      this.impliedProb = 100 / (this.odds + 100);
      this.toWin = this.stake * (this.odds / 100);
    } else {
      this.impliedProb = Math.abs(this.odds) / (Math.abs(this.odds) + 100);
      this.toWin = this.stake * (100 / Math.abs(this.odds));
    }
    this.payout = this.stake + this.toWin;

    // Calculate EV if estimatedProb is set
    if (this.estimatedProb) {
      this.ev = (this.estimatedProb * this.toWin) - ((1 - this.estimatedProb) * this.stake);
      // Kelly: (bp - q) / b where b = decimal odds - 1, p = estimated prob, q = 1 - p
      const b = this.payout / this.stake - 1;
      const p = this.estimatedProb;
      const q = 1 - p;
      this.kellyPct = Math.max(0, (b * p - q) / b);
    }
  }
  next();
});

sportsBetSchema.index({ status: 1 });
sportsBetSchema.index({ eventDate: -1 });
sportsBetSchema.index({ sport: 1, status: 1 });

export default mongoose.model('SportsBet', sportsBetSchema);
