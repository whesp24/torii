// ─── OVERVIEW PAGE ────────────────────────────────────────────────────────────

const API_URL = 'https://torii-backend.onrender.com/api';

// Keep Render free tier alive — ping every 14 min to prevent 15-min sleep
(function keepAlive() {
  setInterval(() => fetch(`${API_URL}/health`).catch(() => {}), 14 * 60 * 1000);
})();

const OVERVIEW_KPIS = [
  { label:'Nikkei 225', sym:'^N225',    src:'japan', dec:0, accent:true },
  { label:'USD / JPY',  sym:'USDJPY=X', src:'japan', dec:2, tag:'FX'    },
  { label:'EWJ ETF',    sym:'EWJ',       src:'japan', dec:2, tag:'ETF'   },
  { label:'S&P 500',    sym:'^GSPC',     src:'macro', dec:0, tag:'US'    },
  { label:'VIX',        sym:'^VIX',      src:'macro', dec:2, tag:'VOL',  invert:true },
  { label:'Gold',       sym:'GC=F',      src:'macro', dec:0, tag:'COMMO' },
];

function getQ(sym, src) {
  const pool = src === 'japan' ? MOCK.japan : MOCK.macro;
  return pool.find(q => q.symbol === sym) || null;
}

// ─── Briefing card ───────────────────────────────────────────────────────────

function BriefingCard() {
  const [loading, setLoading] = React.useState(true);
  const [briefing, setBriefing] = React.useState(MOCK.briefing);
  const [refreshed, setRefreshed] = React.useState(false);

  React.useEffect(() => {
    fetch(`${API_URL}/briefing`)
      .then(r => r.json())
      .then(data => {
        if (data) {
          // Handle both array and single object responses
          const briefingContent = Array.isArray(data) ? data[0]?.content : (data.content || data.summary);
          setBriefing(briefingContent || MOCK.briefing);
        } else {
          setBriefing(MOCK.briefing);
        }
      })
      .catch(e => {console.error('Briefing API Error:', e); setBriefing(MOCK.briefing);})
      .finally(() => setLoading(false));
  }, []);

  function handleRefresh() {
    setLoading(true);
    fetch(`${API_URL}/briefing`)
      .then(r => r.json())
      .then(data => {
        if (data && (data.content || data.summary)) {
          setBriefing(data.content || data.summary || MOCK.briefing);
        }
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshed(true); });
  }
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="section-label">AI Daily Briefing</div>
          <div className="card-sub">{refreshed ? 'just now' : 'today'} · {refreshed ? 'refreshed' : 'live'}</div>
        </div>
        <button className="btn-ghost" onClick={handleRefresh} disabled={loading}
          style={{padding:'5px 12px',fontSize:11}}>
          {loading ? <span className="spin">↻</span> : '↻ Refresh'}
        </button>
      </div>
      {loading
        ? <div style={{display:'flex',flexDirection:'column',gap:7}}>
            {[92,100,78,85,60].map((w,i) => <Skel key={i} w={`${w}%`} h={13} />)}
          </div>
        : <div className="briefing-content"
            dangerouslySetInnerHTML={{__html: simpleMarkdown(briefing)}} />
      }
    </div>
  );
}

// ─── Voices feed panel ───────────────────────────────────────────────────────

const VOICE_FILTERS = ['All','Kevin Mak','SuspendedCap','D. Sundheim','Jeff Weinstein','Hanno Lustig','P. O\'Shag'];

function VoicesFeedPanel() {
  const [filter, setFilter] = React.useState('All');
  const [tweets, setTweets] = React.useState(MOCK.tweets);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`${API_URL}/tweets`)
      .then(r => r.json())
      .then(data => {
        if (data && data.length > 0) {
          // Transform API tweet data
          const transformed = data.map(tweet => ({
            id: tweet._id || Math.random(),
            author: tweet.author || 'Unknown',
            handle: tweet.authorHandle || 'unknown',
            name: tweet.author || 'Unknown',
            content: tweet.content || '',
            url: tweet.url || '#',
            createdAt: tweet.createdAt || new Date().toISOString(),
            likes: tweet.likes || 0,
            retweets: tweet.retweets || 0,
            replies: tweet.replies || 0,
            sentiment: tweet.sentiment || 'neutral'
          }));
          setTweets(transformed);
        } else {
          setTweets(MOCK.tweets);
        }
      })
      .catch(e => {console.error('Tweets API Error:', e); setTweets(MOCK.tweets);})
      .finally(() => setLoading(false));
  }, []);

  const displayedTweets = filter === 'All'
    ? (tweets || MOCK.tweets)
    : (tweets || MOCK.tweets).filter(t => t.name === filter || t.name.includes(filter.split(' ').pop()));

  return (
    <div className="card voices-panel">
      <div className="card-head" style={{marginBottom:10}}>
        <div className="section-label" style={{marginBottom:0}}>Finance Voices</div>
        <a href="#" className="card-link" onClick={e=>{e.preventDefault();}}>Full feed →</a>
      </div>
      {/* Filter chips */}
      <div className="filter-strip" style={{marginBottom:12}}>
        {VOICE_FILTERS.map(f => (
          <button key={f} className={`filter-chip ${filter===f?'active':''}`} onClick={() => setFilter(f)}>
            {f === 'All' ? 'All' : '@'+f.split(' ').pop()}
          </button>
        ))}
      </div>
      {/* Tweets scroll */}
      <div className="voices-scroll">
        {displayedTweets.map(t => <TweetCard key={t.id} tweet={t} compact />)}
      </div>
    </div>
  );
}

// ─── Portfolio snapshot ───────────────────────────────────────────────────────

function PortfolioSnap({ onNav }) {
  const [holdings, setHoldings] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  const loadPortfolio = React.useCallback(() => {
    let positions = [];
    try {
      const saved = localStorage.getItem('torii_portfolio');
      positions = saved ? JSON.parse(saved) : [];
    } catch { positions = []; }

    if (positions.length === 0) { setHoldings([]); setLoading(false); return; }

    Promise.all(positions.slice(0, 6).map((p, i) =>
      fetch(`${API_URL}/stocks/live/${p.ticker}`)
        .then(r => r.ok ? r.json() : null).catch(() => null)
        .then(d => ({
          id: i + 1,
          ticker: p.ticker,
          name: d?.name || p.ticker,
          shares: p.shares,
          price: d?.price || 0,
          pct: d?.changePercent || 0,
          change: d?.change || 0,
          value: (d?.price || 0) * p.shares,
        }))
    )).then(res => { setHoldings(res); setLoading(false); });
  }, []);

  React.useEffect(() => {
    loadPortfolio();
    // Refresh every 5 minutes
    const interval = setInterval(loadPortfolio, 5 * 60 * 1000);
    // Also refresh when user navigates back to this tab / page
    const onFocus = () => loadPortfolio();
    const onStorage = (e) => { if (e.key === 'torii_portfolio') loadPortfolio(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [loadPortfolio]);
  const total  = holdings && holdings.length > 0 ? holdings.reduce((s,h) => s + (h.value || 0), 0) : 0;
  const dayChg = holdings.reduce((s,h) => s + (h.change * h.shares), 0);
  const dayPct = total > 0 ? (dayChg / (total - dayChg)) * 100 : 0;
  const up = dayChg >= 0;

  // Top movers
  const movers = [...holdings].sort((a,b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0,5);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="section-label">Portfolio</div>
          <div style={{display:'flex',alignItems:'baseline',gap:10}}>
            <span style={{fontSize:26,fontWeight:800,fontFamily:'var(--font-mono)',letterSpacing:'-0.03em'}}>
              ${total.toLocaleString('en-US',{maximumFractionDigits:0})}
            </span>
            <span style={{fontSize:13,fontWeight:600,fontFamily:'var(--font-mono)',color:up?'var(--green)':'var(--red-loss)'}}>
              {up?'+':''}{fmtPrice(Math.abs(dayChg),0)} ({up?'+':''}{dayPct.toFixed(2)}%)
            </span>
          </div>
        </div>
        <button className="btn-ghost" onClick={() => onNav('portfolio')} style={{padding:'5px 12px',fontSize:11}}>
          View All →
        </button>
      </div>
      {/* Movers row */}
      <div style={{display:'flex',gap:7,marginTop:4,overflowX:'auto',scrollbarWidth:'none'}}>
        {movers.map(h => {
          const up = h.pct >= 0;
          return (
            <div key={h.ticker} style={{
              background:'var(--surf2)', border:'1px solid var(--bdr)',
              borderRadius:10, padding:'8px 12px', minWidth:88, flexShrink:0,
            }}>
              <div style={{fontSize:11,fontWeight:700,fontFamily:'var(--font-mono)',color:'var(--fg)',marginBottom:2}}>
                {h.ticker}
              </div>
              <div style={{fontSize:13,fontWeight:600,fontFamily:'var(--font-mono)'}}>
                ${h.price.toFixed(2)}
              </div>
              <div style={{fontSize:10,fontFamily:'var(--font-mono)',color:up?'var(--green)':'var(--red-loss)',marginTop:1}}>
                {up?'+':''}{h.pct.toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Top Headlines ────────────────────────────────────────────────────────────

function HeadlinesCard({ onNav }) {
  const articles = MOCK.news.filter(a => a.importance !== 'low').slice(0,5);
  return (
    <div className="card">
      <div className="card-head">
        <div className="section-label" style={{marginBottom:0}}>Top Headlines</div>
        <button className="card-link" onClick={() => onNav('news')}>All news →</button>
      </div>
      <div style={{display:'flex',flexDirection:'column'}}>
        {articles.map((a,i) => (
          <a key={a.id} href={a.url} target="_blank" rel="noopener"
            style={{
              display:'block', padding:'11px 0',
              borderBottom: i < articles.length-1 ? '1px solid var(--bdr)' : 'none',
              textDecoration:'none',
            }}>
            <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
              {a.importance === 'high' && (
                <div style={{width:6,height:6,borderRadius:'50%',background:'#EF4444',flexShrink:0,marginTop:5}} />
              )}
              <div style={{flex:1,minWidth:0}}>
                <div style={{
                  fontSize:13,lineHeight:1.45,fontWeight:a.importance==='high'?600:400,
                  color:'var(--fg)', overflow:'hidden', display:'-webkit-box',
                  WebkitLineClamp:2, WebkitBoxOrient:'vertical',
                  marginBottom:4,
                }}>{a.title}</div>
                <div style={{display:'flex',gap:7,alignItems:'center'}}>
                  <SourceBadge source={a.source} category={a.category} />
                  <span style={{fontSize:9,color:'var(--fg3)',fontFamily:'var(--font-mono)'}}>{timeAgo(a.publishedAt)}</span>
                </div>
              </div>
              {a.importance === 'high' && <ImpBadge importance={a.importance} />}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Desktop Overview ─────────────────────────────────────────────────────────

function OverviewPage({ onNav }) {
  const chartData  = MOCK.nikkeiChart.prices;
  const chartDates = MOCK.nikkeiChart.dates;
  const isUp = chartData[chartData.length-1] >= chartData[0];
  const chartColor = isUp ? '#22C55E' : '#FF6B6B';

  return (
    <div className="page-root">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-sub">Japan markets · portfolio · daily briefing</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span style={{fontSize:10,fontFamily:'var(--font-mono)',color:'var(--fg3)'}}>
            Live · refreshes every 60s
          </span>
          <span className="live-dot" />
        </div>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid">
        {OVERVIEW_KPIS.map(({ label, sym, src, dec, accent, tag, invert }) => {
          const q = getQ(sym, src);
          return (
            <StatCard key={sym}
              label={label} tag={tag}
              price={q?.price} pct={q?.pct}
              dec={dec} invert={invert} accent={accent}
            />
          );
        })}
      </div>

      {/* Main 2-col grid */}
      <div className="overview-grid">
        {/* Left column */}
        <div style={{display:'flex',flexDirection:'column',gap:14,minWidth:0}}>

          {/* Nikkei Chart */}
          <div className="card">
            <div className="card-head" style={{marginBottom:12}}>
              <div>
                <div className="section-label" style={{marginBottom:2}}>Nikkei 225 · 1 Month</div>
                <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                  <span style={{fontSize:22,fontWeight:800,fontFamily:'var(--font-mono)',letterSpacing:'-0.03em'}}>
                    {chartData[chartData.length-1].toLocaleString()}
                  </span>
                  <span style={{fontSize:12,fontFamily:'var(--font-mono)',color:chartColor,fontWeight:600}}>
                    {isUp?'▲':'▼'} {Math.abs(((chartData[chartData.length-1]/chartData[0])-1)*100).toFixed(2)}% 30d
                  </span>
                </div>
              </div>
              <div style={{display:'flex',gap:6}}>
                {['1W','1M','3M'].map((r,i) => (
                  <button key={r} className={`range-btn${i===1?' active':''}`}>{r}</button>
                ))}
              </div>
            </div>
            <AreaChart data={chartData} labels={chartDates} height={130} />
          </div>

          {/* Portfolio snapshot */}
          <PortfolioSnap onNav={onNav} />

          {/* AI Briefing */}
          <BriefingCard />

          {/* Headlines */}
          <HeadlinesCard onNav={onNav} />
        </div>

        {/* Right column — Voices feed (sticky) */}
        <div className="overview-right">
          <VoicesFeedPanel />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OverviewPage });
