import Stock from '../models/Stock.js';

// ── 2026 Economic Calendar ────────────────────────────────────────────────────
// Events are keyed by ISO date of first day. Priority: high/medium/low.
const ECONOMIC_CALENDAR = [
  // ─ FOMC meetings ─
  { date:'2026-04-28', name:'FOMC Meeting',       desc:'Fed rate decision — Apr 28–29', tag:'fed',     priority:'high'   },
  { date:'2026-06-16', name:'FOMC Meeting',       desc:'Fed rate decision — Jun 16–17', tag:'fed',     priority:'high'   },
  { date:'2026-07-28', name:'FOMC Meeting',       desc:'Fed rate decision — Jul 28–29', tag:'fed',     priority:'high'   },
  { date:'2026-09-15', name:'FOMC Meeting',       desc:'Fed rate decision — Sep 15–16', tag:'fed',     priority:'high'   },
  { date:'2026-11-03', name:'FOMC Meeting',       desc:'Fed rate decision — Nov 3–4',   tag:'fed',     priority:'high'   },
  { date:'2026-12-08', name:'FOMC Meeting',       desc:'Fed rate decision — Dec 8–9',   tag:'fed',     priority:'high'   },
  // ─ BOJ meetings ─
  { date:'2026-04-30', name:'BOJ Meeting',        desc:'Bank of Japan policy meeting — Apr 30–May 1', tag:'boj', priority:'high' },
  { date:'2026-06-15', name:'BOJ Meeting',        desc:'Bank of Japan policy meeting — Jun 15–16',    tag:'boj', priority:'medium' },
  { date:'2026-07-29', name:'BOJ Meeting',        desc:'Bank of Japan policy meeting — Jul 29–30',    tag:'boj', priority:'medium' },
  { date:'2026-09-16', name:'BOJ Meeting',        desc:'Bank of Japan policy meeting — Sep 16–17',    tag:'boj', priority:'medium' },
  // ─ US CPI (approx 2nd Tuesday of month) ─
  { date:'2026-05-12', name:'US CPI Release',     desc:'April CPI inflation data',    tag:'macro',    priority:'high'   },
  { date:'2026-06-10', name:'US CPI Release',     desc:'May CPI inflation data',      tag:'macro',    priority:'medium' },
  { date:'2026-07-14', name:'US CPI Release',     desc:'June CPI inflation data',     tag:'macro',    priority:'medium' },
  { date:'2026-08-11', name:'US CPI Release',     desc:'July CPI inflation data',     tag:'macro',    priority:'medium' },
  // ─ US Jobs Report (approx first Friday of month) ─
  { date:'2026-05-01', name:'US Jobs Report',     desc:'April nonfarm payrolls',      tag:'macro',    priority:'high'   },
  { date:'2026-06-05', name:'US Jobs Report',     desc:'May nonfarm payrolls',        tag:'macro',    priority:'medium' },
  { date:'2026-07-10', name:'US Jobs Report',     desc:'June nonfarm payrolls',       tag:'macro',    priority:'medium' },
  // ─ PCE (approx last Friday of month) ─
  { date:'2026-04-30', name:'PCE Inflation',      desc:'March PCE personal spending', tag:'macro',    priority:'medium' },
  { date:'2026-05-29', name:'PCE Inflation',      desc:'April PCE personal spending', tag:'macro',    priority:'medium' },
  // ─ Quarterly GDP ─
  { date:'2026-04-29', name:'Q1 GDP Release',     desc:'First estimate of Q1 2026 GDP growth', tag:'macro', priority:'high' },
  { date:'2026-07-29', name:'Q2 GDP Release',     desc:'First estimate of Q2 2026 GDP growth', tag:'macro', priority:'high' },
  // ─ Warren Buffett Berkshire letter / AGM (annual) ─
  { date:'2026-05-02', name:'Berkshire AGM',      desc:'Berkshire Hathaway annual meeting', tag:'event', priority:'low' },
];

// Tickers we care about for earnings alerts (user's portfolio)
const WATCH_TICKERS = [
  'NVDA','GOOGL','AAPL','MSFT','AMD','MUFG','ONDS','MMS','QXO','TPL','CRCL','VOO','VRT',
  'NFLX','META','AMZN','TSLA',
];

// ── Main generator ─────────────────────────────────────────────────────────────
export async function generateSmartTasks() {
  const now   = new Date();
  const today = now.toISOString().split('T')[0];
  const tasks = [];

  // 1. Upcoming economic calendar events (within 14 days)
  for (const evt of ECONOMIC_CALENDAR) {
    const evtDate  = new Date(evt.date + 'T00:00:00Z');
    const daysAway = Math.ceil((evtDate - now) / 86_400_000);
    if (daysAway < 0 || daysAway > 14) continue;

    const when = daysAway === 0 ? 'today'
               : daysAway === 1 ? 'tomorrow'
               : `in ${daysAway}d`;

    tasks.push({
      id:       `cal-${evt.date}-${evt.tag}`,
      text:     `${evt.name} ${when} — ${evt.desc}`,
      tag:      evt.tag,
      priority: evt.priority,
      auto:     true,
      done:     false,
      dueDate:  evt.date,
    });
  }

  // 2. Finnhub earnings calendar — portfolio stocks in the next 10 days
  try {
    const KEY = process.env.FINNHUB_API_KEY;
    if (KEY) {
      const toDate = new Date(now.getTime() + 10 * 86_400_000).toISOString().split('T')[0];
      const r = await fetch(
        `https://finnhub.io/api/v1/calendar/earnings?from=${today}&to=${toDate}&token=${KEY}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (r.ok) {
        const data = await r.json();
        const hits = (data.earningsCalendar || [])
          .filter(e => WATCH_TICKERS.includes(e.symbol));

        const seen = new Set();
        for (const e of hits) {
          if (seen.has(e.symbol)) continue;
          seen.add(e.symbol);
          const d       = new Date(e.date + 'T00:00:00Z');
          const daysAway= Math.ceil((d - now) / 86_400_000);
          if (daysAway < 0 || daysAway > 10) continue;
          const when    = daysAway === 0 ? 'today'
                        : daysAway === 1 ? 'tomorrow'
                        : `in ${daysAway}d`;
          const when2   = e.hour === 'bmo' ? '(before open)' : e.hour === 'amc' ? '(after close)' : '';
          tasks.push({
            id:       `earn-${e.symbol}-${e.date}`,
            text:     `${e.symbol} earnings ${when} ${when2} — review position before report`,
            tag:      'earnings',
            priority: 'high',
            auto:     true,
            done:     false,
            dueDate:  e.date,
          });
        }
      }
    }
  } catch (_) {}

  // 3. Portfolio stocks with significant moves (from DB)
  try {
    const movers = await Stock.find({
      changePercent: { $not: { $gt: -0.01, $lt: 0.01 } }
    }).sort({ changePercent: -1 });

    const big = movers.filter(s => Math.abs(s.changePercent) >= 3);
    for (const s of big.slice(0, 3)) {
      const dir = s.changePercent > 0 ? 'up' : 'down';
      const act = s.changePercent > 0 ? 'consider taking profit' : 'review stop loss';
      tasks.push({
        id:       `mover-${s.symbol}`,
        text:     `${s.symbol} ${dir} ${Math.abs(s.changePercent).toFixed(1)}% — ${act}`,
        tag:      'alert',
        priority: s.changePercent < -5 ? 'high' : 'medium',
        auto:     true,
        done:     false,
      });
    }
  } catch (_) {}

  // 4. Day-of-week recurring intelligence
  const dow = now.getDay(); // 0=Sun, 1=Mon, …, 5=Fri, 6=Sat
  const hour = now.getUTCHours(); // rough hour check

  if (dow === 1) tasks.push({
    id: 'weekly-monday',
    text: 'Monday: review watchlist, set alerts for the week',
    tag: 'routine', priority: 'low', auto: true, done: false,
  });
  if (dow === 3) tasks.push({
    id: 'weekly-wednesday',
    text: 'Mid-week: check portfolio vs. S&P 500 performance',
    tag: 'routine', priority: 'low', auto: true, done: false,
  });
  if (dow === 5) tasks.push({
    id: 'weekly-friday',
    text: 'Friday: review week P&L and weekend positioning',
    tag: 'routine', priority: 'low', auto: true, done: false,
  });

  // Sort: high priority first, then by dueDate
  tasks.sort((a, b) => {
    const pri = { high: 0, medium: 1, low: 2 };
    if (pri[a.priority] !== pri[b.priority]) return pri[a.priority] - pri[b.priority];
    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
    return 0;
  });

  return tasks;
}
