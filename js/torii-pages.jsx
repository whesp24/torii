// ─── TORII SUB-PAGES: Portfolio, Japan, News, Voices, Stock ──────────────────

const API_URL = '/api';

// ─── PORTFOLIO PAGE ───────────────────────────────────────────────────────────

const PORTFOLIO_KEY = 'torii_portfolio';

function loadSavedPositions() {
  try {
    const s = localStorage.getItem(PORTFOLIO_KEY);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

function PortfolioPage({ onNav }) {
  const [positions, setPositions] = React.useState(loadSavedPositions);
  const [holdings, setHoldings] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showAdd, setShowAdd] = React.useState(false);
  const [newTicker, setNewTicker] = React.useState('');
  const [newShares, setNewShares] = React.useState('');
  const [newCost, setNewCost] = React.useState('');
  const [addLoading, setAddLoading] = React.useState(false);
  const [addError, setAddError] = React.useState('');

  // Persist positions to localStorage
  React.useEffect(() => {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(positions));
  }, [positions]);

  // Fetch live prices for all positions
  React.useEffect(() => {
    if (positions.length === 0) { setHoldings([]); setLoading(false); return; }
    setLoading(true);
    Promise.all(positions.map((p, i) =>
      fetch(`${API_URL}/stocks/live/${p.ticker}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => d ? {
          id: i + 1,
          ticker: p.ticker,
          name: d.name || p.ticker,
          shares: p.shares,
          costBasis: p.costBasis || d.price,
          price: d.price,
          pct: d.changePercent || 0,
          change: d.change || 0,
          value: d.price * p.shares,
          prevClose: d.price - (d.change || 0)
        } : null)
        .catch(() => null)
    )).then(res => { setHoldings(res.filter(Boolean)); setLoading(false); });
  }, [positions]);

  const addPosition = async () => {
    const ticker = newTicker.trim().toUpperCase();
    const shares = parseFloat(newShares);
    if (!ticker || isNaN(shares) || shares <= 0) { setAddError('Enter a valid ticker and share count'); return; }
    if (positions.find(p => p.ticker === ticker)) { setAddError(`${ticker} is already in your portfolio`); return; }
    setAddLoading(true); setAddError('');
    try {
      const r = await fetch(`${API_URL}/stocks/live/${ticker}`);
      if (!r.ok) { setAddError(`Couldn't find "${ticker}" — check the symbol`); setAddLoading(false); return; }
      setPositions(prev => [...prev, { ticker, shares, costBasis: parseFloat(newCost) || 0 }]);
      setShowAdd(false); setNewTicker(''); setNewShares(''); setNewCost('');
    } catch { setAddError('Network error — try again'); }
    setAddLoading(false);
  };

  const removePosition = ticker => setPositions(prev => prev.filter(p => p.ticker !== ticker));

  const total  = holdings.reduce((s,h) => s + (h.value || 0), 0);
  const dayChg = holdings.reduce((s,h) => s + ((h.change || 0) * (h.shares || 0)), 0);
  const dayPct = total > 0 ? (dayChg / (total - dayChg)) * 100 : 0;
  const [sort, setSort] = React.useState('value');

  const sorted = [...holdings].sort((a,b) => {
    if (sort === 'value')  return b.value - a.value;
    if (sort === 'pct')    return Math.abs(b.pct) - Math.abs(a.pct);
    if (sort === 'ticker') return a.ticker.localeCompare(b.ticker);
    return 0;
  });

  const allocs = total > 0 ? holdings.map(h => ({
    ticker: h.ticker, pct: (h.value/total)*100, value: h.value,
    color: h.pct >= 0 ? 'var(--green)' : 'var(--red-loss)'
  })).sort((a,b) => b.pct - a.pct) : [];

  const modalStyle = { position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center' };
  const inputStyle = { width:'100%',background:'var(--surf2)',border:'1px solid var(--bdr2)',borderRadius:8,padding:'10px 12px',color:'var(--fg)',fontFamily:'var(--font-mono)',fontSize:13,outline:'none' };

  return (
    <div className="page-root">
      {/* Add Position Modal */}
      {showAdd && (
        <div style={modalStyle} onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="card" style={{width:360,padding:24}}>
            <div style={{fontSize:16,fontWeight:700,fontFamily:'var(--font-d)',marginBottom:20}}>Add Position</div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,fontFamily:'var(--font-mono)',color:'var(--fg3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Ticker Symbol</div>
              <input style={inputStyle} placeholder="e.g. AAPL, NVDA, 7203.T"
                value={newTicker} onChange={e => setNewTicker(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && addPosition()} autoFocus />
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,fontFamily:'var(--font-mono)',color:'var(--fg3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Shares</div>
              <input style={inputStyle} type="number" placeholder="e.g. 10" min="0.001" step="any"
                value={newShares} onChange={e => setNewShares(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPosition()} />
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,fontFamily:'var(--font-mono)',color:'var(--fg3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Avg Cost Basis <span style={{opacity:0.5}}>(optional)</span></div>
              <input style={inputStyle} type="number" placeholder="e.g. 850.00" min="0" step="any"
                value={newCost} onChange={e => setNewCost(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPosition()} />
            </div>
            {addError && <div style={{color:'var(--red-loss)',fontSize:12,fontFamily:'var(--font-mono)',marginBottom:12}}>{addError}</div>}
            <div style={{display:'flex',gap:8}}>
              <button onClick={addPosition} disabled={addLoading}
                style={{flex:1,padding:'10px',background:'var(--red)',color:'white',border:'none',borderRadius:8,fontFamily:'var(--font-ui)',fontWeight:600,cursor:'pointer',fontSize:13}}>
                {addLoading ? 'Checking…' : '+ Add Position'}
              </button>
              <button onClick={() => { setShowAdd(false); setAddError(''); }}
                style={{padding:'10px 16px',background:'var(--surf2)',color:'var(--fg2)',border:'1px solid var(--bdr)',borderRadius:8,fontFamily:'var(--font-ui)',cursor:'pointer',fontSize:13}}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Portfolio</h1>
          <p className="page-sub">Holdings · performance · analytics</p>
        </div>
        <button onClick={() => { setShowAdd(true); setAddError(''); }}
          style={{padding:'9px 18px',background:'var(--red)',color:'white',border:'none',borderRadius:8,fontFamily:'var(--font-ui)',fontWeight:600,cursor:'pointer',fontSize:13}}>
          + Add Position
        </button>
      </div>

      {/* Summary row */}
      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:16}}>
        <div className="stat-card accent">
          <span className="stat-label">Total Value</span>
          <span className="stat-value">${total.toLocaleString('en-US',{maximumFractionDigits:0})}</span>
          <span className="stat-change" style={{color:dayChg>=0?'var(--green)':'var(--red-loss)'}}>
            {dayChg>=0?'▲':'▼'} {dayPct.toFixed(2)}% today
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Day P&L</span>
          <span className="stat-value" style={{color:dayChg>=0?'var(--green)':'var(--red-loss)'}}>
            {dayChg>=0?'+':''}{fmtPrice(dayChg,0)}
          </span>
          <span className="stat-change" style={{color:'var(--fg3)'}}>vs. prior close</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Positions</span>
          <span className="stat-value">{holdings.length}</span>
          <span className="stat-change" style={{color:'var(--fg3)'}}>
            {holdings.filter(h=>h.pct>0).length} up · {holdings.filter(h=>h.pct<0).length} down
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Largest Move</span>
          {(() => {
            const top = holdings && holdings.length > 0 ? [...holdings].sort((a,b) => Math.abs(b.pct)-Math.abs(a.pct))[0] : null;
            return top ? <>
              <span className="stat-value">{top.ticker}</span>
              <span className="stat-change" style={{color:top.pct>=0?'var(--green)':'var(--red-loss)'}}>
                {top.pct>=0?'+':''}{(top.pct || 0).toFixed(2)}%
              </span>
            </> : <>
              <span className="stat-value">—</span>
              <span className="stat-change" style={{color:'var(--fg3)'}}>loading</span>
            </>;
          })()}
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:14,alignItems:'start'}}>
        {/* Holdings table */}
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'16px 20px 12px',borderBottom:'1px solid var(--bdr)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div className="section-label" style={{marginBottom:0}}>Holdings</div>
            <div style={{display:'flex',gap:6}}>
              {[['value','Value'],['pct','Move'],['ticker','A–Z']].map(([k,l]) => (
                <button key={k} className={`range-btn${sort===k?' active':''}`} onClick={()=>setSort(k)}>{l}</button>
              ))}
            </div>
          </div>
          <table className="data-table" style={{width:'100%'}}>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Name</th>
                <th style={{textAlign:'right'}}>Shares</th>
                <th style={{textAlign:'right'}}>Price</th>
                <th style={{textAlign:'right'}}>Day</th>
                <th style={{textAlign:'right'}}>Value</th>
                <th style={{textAlign:'right'}}>Alloc</th>
                <th style={{width:36}}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{textAlign:'center',padding:32,color:'var(--fg3)',fontFamily:'var(--font-mono)',fontSize:12}}>Loading prices…</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={8} style={{textAlign:'center',padding:32,color:'var(--fg3)',fontFamily:'var(--font-mono)',fontSize:12}}>
                  No positions yet — click <strong style={{color:'var(--fg)'}}>+ Add Position</strong> to get started
                </td></tr>
              ) : sorted.map(h => {
                const up = h.pct >= 0;
                const color = up ? 'var(--green)' : 'var(--red-loss)';
                return (
                  <tr key={h.ticker}>
                    <td onClick={() => onNav(`stock-${h.ticker}`)} style={{cursor:'pointer'}}>
                      <span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:12,color:'var(--fg)'}}>{h.ticker}</span>
                    </td>
                    <td onClick={() => onNav(`stock-${h.ticker}`)} style={{cursor:'pointer'}}>
                      <span style={{fontSize:11,color:'var(--fg2)'}}>{h.name}</span>
                    </td>
                    <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--fg3)'}}>{h.shares}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:12,color:'var(--fg)'}}>${(h.price||0).toFixed(2)}</td>
                    <td style={{textAlign:'right'}}>
                      <span style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,color}}>
                        {up?'+':''}{(h.pct||0).toFixed(2)}%
                      </span>
                    </td>
                    <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600,color:'var(--fg)'}}>
                      ${(h.value||0).toLocaleString('en-US',{maximumFractionDigits:0})}
                    </td>
                    <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--fg3)'}}>
                      {total > 0 ? ((h.value/total)*100).toFixed(1) : '0.0'}%
                    </td>
                    <td style={{textAlign:'center',padding:'4px 8px'}}>
                      <button onClick={() => removePosition(h.ticker)}
                        style={{background:'none',border:'none',color:'var(--fg3)',cursor:'pointer',fontSize:14,lineHeight:1,padding:'2px 6px',borderRadius:4}}
                        title={`Remove ${h.ticker}`}>×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Allocation sidebar */}
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="card">
            <div className="section-label">Allocation</div>
            {allocs.map(a => (
              <div key={a.ticker} style={{marginBottom:9}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,color:'var(--fg)'}}>{a.ticker}</span>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--fg3)'}}>{a.pct.toFixed(1)}%</span>
                </div>
                <div style={{height:4,background:'var(--bdr)',borderRadius:4}}>
                  <div style={{height:4,width:`${a.pct}%`,background:'var(--red)',borderRadius:4,opacity:0.8}} />
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="section-label">Performance</div>
            {holdings && holdings.length > 0 ? [
              {label:'Best today', h: [...holdings].sort((a,b)=>(b.pct||0)-(a.pct||0))[0], up:true},
              {label:'Worst today', h: [...holdings].sort((a,b)=>(a.pct||0)-(b.pct||0))[0], up:false}
            ].map(({label,h,up})=>h ? (
              <div key={label} style={{marginBottom:12}}>
                <div style={{fontSize:9,fontFamily:'var(--font-mono)',color:'var(--fg3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>{label}</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:13,color:'var(--fg)'}}>{h.ticker}</span>
                  <span style={{fontFamily:'var(--font-mono)',fontWeight:600,fontSize:12,color:up?'var(--green)':'var(--red-loss)'}}>
                    {(h.pct||0)>=0?'+':''}{(h.pct||0).toFixed(2)}%
                  </span>
                </div>
              </div>
            ) : null) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── JAPAN PAGE ───────────────────────────────────────────────────────────────

function JapanPage() {
  const groups = [...new Set(MOCK.japanDetail.map(r => r.group))];

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Japan Market</h1>
          <p className="page-sub">Indices · FX · equities · macro overview</p>
        </div>
        <span className="live-dot" />
      </div>

      {/* Hero KPIs */}
      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:16}}>
        {[
          {label:'Nikkei 225', sym:'^N225',    src:'japan', dec:0, accent:true},
          {label:'USD / JPY',  sym:'USDJPY=X', src:'japan', dec:2, tag:'FX'},
          {label:'EWJ',        sym:'EWJ',       src:'japan', dec:2, tag:'ETF'},
          {label:'TOPIX',      sym:'^TOPX',     src:'japan', dec:0, tag:'INDEX'},
        ].map(({label,sym,src,dec,accent,tag}) => {
          const q = getQ(sym,src);
          return <StatCard key={sym} label={label} tag={tag} price={q?.price} pct={q?.pct} dec={dec} accent={accent} />;
        })}
      </div>

      {/* Nikkei chart */}
      <div className="card" style={{marginBottom:14}}>
        <div className="card-head" style={{marginBottom:10}}>
          <div className="section-label" style={{marginBottom:0}}>Nikkei 225 · 1 Month</div>
          <div style={{display:'flex',gap:6}}>
            {['1W','1M','3M','YTD'].map((r,i) => (
              <button key={r} className={`range-btn${i===1?' active':''}`}>{r}</button>
            ))}
          </div>
        </div>
        <AreaChart data={MOCK.nikkeiChart.prices} labels={MOCK.nikkeiChart.dates} height={140} />
      </div>

      {/* Detail tables by group */}
      {groups.map(group => (
        <div key={group} className="card" style={{marginBottom:14,padding:0,overflow:'hidden'}}>
          <div style={{padding:'12px 20px',borderBottom:'1px solid var(--bdr)'}}>
            <div className="section-label" style={{marginBottom:0}}>{group}</div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th style={{textAlign:'right'}}>Price</th>
                <th style={{textAlign:'right'}}>Change</th>
                <th style={{textAlign:'right'}}>Open</th>
                <th style={{textAlign:'right'}}>High</th>
                <th style={{textAlign:'right'}}>Low</th>
                <th style={{textAlign:'right'}}>Volume</th>
              </tr>
            </thead>
            <tbody>
              {MOCK.japanDetail.filter(r => r.group === group).map(r => {
                const up = r.pct >= 0;
                const color = up ? 'var(--green)' : 'var(--red-loss)';
                return (
                  <tr key={r.symbol}>
                    <td><span style={{fontFamily:'var(--font-mono)',fontWeight:600,fontSize:12}}>{r.label}</span></td>
                    <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600}}>{fmtPrice(r.price,r.group==='FX'?2:r.price<100?2:0)}</td>
                    <td style={{textAlign:'right'}}>
                      <span style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,color}}>{up?'+':''}{r.pct.toFixed(2)}%</span>
                    </td>
                    <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--fg3)'}}>{fmtPrice(r.open,r.group==='FX'?2:0)}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--green)'}}>{fmtPrice(r.high,r.group==='FX'?2:0)}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--red-loss)'}}>{fmtPrice(r.low,r.group==='FX'?2:0)}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--fg3)'}}>{r.vol}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ─── NEWS PAGE ────────────────────────────────────────────────────────────────

function NewsPage() {
  const [cat, setCat]   = React.useState('all');
  const [imp, setImp]   = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [articles, setArticles] = React.useState(MOCK.news);
  const [loading, setLoading] = React.useState(true);

  const cats = ['all','japan','macro','market'];
  const imps = ['all','high','medium','low'];

  React.useEffect(() => {
    fetch(`${API_URL}/news`)
      .then(r => r.json())
      .then(news => {
        if (news && news.length > 0) {
          // Transform API news data - ensure all required fields exist
          const transformed = news.map(article => ({
            id: article._id || Math.random(),
            source: article.source || 'Unknown',
            title: article.title || 'Untitled',
            summary: article.description || article.content || 'No summary available',
            url: article.url || '#',
            publishedAt: article.publishedAt || new Date().toISOString(),
            category: article.category || 'general',
            importance: article.sentiment === 'positive' ? 'high' : article.sentiment === 'negative' ? 'medium' : 'low'
          }));
          setArticles(transformed);
        } else {
          setArticles(MOCK.news);
        }
      })
      .catch(e => {console.error('News API Error:', e); setArticles(MOCK.news);})
      .finally(() => setLoading(false));
  }, []);

  let displayArticles = articles || [];
  if (cat !== 'all') displayArticles = displayArticles.filter(a => a.category === cat);
  if (imp !== 'all') displayArticles = displayArticles.filter(a => a.importance === imp);
  if (query.trim()) {
    const ql = query.toLowerCase();
    displayArticles = displayArticles.filter(a => a.title.toLowerCase().includes(ql) || a.summary.toLowerCase().includes(ql));
  }

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">News</h1>
          <p className="page-sub">Ranked by priority · refreshed every 15m</p>
        </div>
      </div>

      {/* Search + filters */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <div style={{position:'relative',flex:'0 0 240px'}}>
          <svg style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',opacity:0.4}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className="search-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search headlines…" style={{paddingLeft:30}} />
        </div>
        <div className="filter-strip">
          {cats.map(c=><button key={c} className={`filter-chip${cat===c?' active':''}`} onClick={()=>setCat(c)}>{c==='all'?'All':c.charAt(0).toUpperCase()+c.slice(1)}</button>)}
        </div>
        <div className="filter-strip">
          {imps.map(i=><button key={i} className={`filter-chip${imp===i?' active':''}`} onClick={()=>setImp(i)}>{i==='all'?'All priority':i.charAt(0).toUpperCase()+i.slice(1)}</button>)}
        </div>
      </div>

      {/* Articles */}
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {displayArticles.length === 0 && (
          <div style={{padding:'40px',textAlign:'center',color:'var(--fg3)',fontFamily:'var(--font-mono)',fontSize:12}}>No articles match</div>
        )}
        {displayArticles.map(a => (
          <a key={a.id} href={a.url} target="_blank" rel="noopener"
            className={`news-card${a.importance==='high'?' high':''}`}>
            <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:5}}>
                  <ImpBadge importance={a.importance} />
                  <SourceBadge source={a.source} category={a.category} />
                  <span style={{fontSize:9,color:'var(--fg3)',fontFamily:'var(--font-mono)'}}>{timeAgo(a.publishedAt)}</span>
                </div>
                <div style={{fontSize:14,fontWeight:a.importance==='high'?600:400,lineHeight:1.45,color:'var(--fg)',marginBottom:4}}>{a.title}</div>
                <div style={{fontSize:12,color:'var(--fg3)',lineHeight:1.5,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{a.summary}</div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── VOICES PAGE ──────────────────────────────────────────────────────────────

const VOICE_ACCOUNTS = [
  { handle:'KevinLMak',       name:'Kevin Mak',       topics:['Japan','Macro','FX'],     initials:'KM', color:'#3B82F6' },
  { handle:'ContrarianCurse', name:'SuspendedCap',    topics:['Equities','Sentiment'],   initials:'SC', color:'#8B5CF6' },
  { handle:'dsundheim',       name:'D. Sundheim',     topics:['Long/Short','Equity'],    initials:'DS', color:'#10B981' },
  { handle:'jeff_weinstein',  name:'Jeff Weinstein',  topics:['Tech','Venture'],         initials:'JW', color:'#F59E0B' },
  { handle:'HannoLustig',     name:'Hanno Lustig',    topics:['Macro','Research'],       initials:'HL', color:'#EF4444' },
  { handle:'patrick_oshag',   name:'Patrick O\'Shag', topics:['Value','Capital'],        initials:'PO', color:'#EC4899' },
];

function VoicesPage() {
  const [selected, setSelected] = React.useState('all');
  const [tweets, setTweets] = React.useState(MOCK.tweets);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`${API_URL}/tweets`)
      .then(r => r.json())
      .then(tweetData => {
        if (tweetData && tweetData.length > 0) {
          // Transform API tweet data
          const transformed = tweetData.map(tweet => ({
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

  const displayedTweets = selected === 'all'
    ? (tweets || MOCK.tweets)
    : (tweets || MOCK.tweets).filter(t => t.handle === selected);

  return (
    <div className="page-root">
      <div className="page-header">
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--fg)"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          <h1 className="page-title">Voices</h1>
        </div>
        <p className="page-sub">Curated finance & Japan accounts · native feed</p>
      </div>

      {/* Account grid */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16}}>
        <div
          onClick={() => setSelected('all')}
          className={`voice-card${selected==='all'?' active':''}`}>
          <div className="voice-avatar" style={{background:'var(--surf2)',color:'var(--fg2)',fontSize:11,fontFamily:'var(--font-mono)'}}>ALL</div>
          <div className="voice-info">
            <span className="voice-name">All Voices</span>
            <span className="voice-handle">{VOICE_ACCOUNTS.length} accounts</span>
          </div>
        </div>
        {VOICE_ACCOUNTS.map(a => (
          <div key={a.handle}
            onClick={() => setSelected(a.handle)}
            className={`voice-card${selected===a.handle?' active':''}`}>
            <div className="voice-avatar" style={{background:a.color}}>{a.initials}</div>
            <div className="voice-info">
              <span className="voice-name">{a.name}</span>
              <span className="voice-handle">@{a.handle}</span>
              <div style={{display:'flex',gap:4,marginTop:3,flexWrap:'wrap'}}>
                {a.topics.map(t => <span key={t} className="topic-tag">{t}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tweet feed */}
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {displayedTweets.map(t => <TweetCard key={t.id} tweet={t} />)}
        {displayedTweets.length === 0 && (
          <div style={{padding:'40px',textAlign:'center',color:'var(--fg3)',fontFamily:'var(--font-mono)',fontSize:12}}>No tweets found</div>
        )}
      </div>
    </div>
  );
}

// ─── STOCK DETAIL PAGE ────────────────────────────────────────────────────────

function StockPage({ ticker, onBack }) {
  const [quote, setQuote] = React.useState(null);
  const [loadingQ, setLoadingQ] = React.useState(true);
  const [timeframe, setTimeframe] = React.useState('5D');

  // Get user's position data from localStorage for shares/cost info
  const positions = loadSavedPositions();
  const pos = positions.find(p => p.ticker === ticker);

  React.useEffect(() => {
    setLoadingQ(true);
    fetch(`${API_URL}/stocks/live/${ticker}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setQuote(d); setLoadingQ(false); })
      .catch(() => setLoadingQ(false));
  }, [ticker]);

  const spark = MOCK.sparklines[ticker] || [];

  // Build a display object from either live data or fallback
  const h = quote ? {
    ticker,
    name: quote.name || ticker,
    price: quote.price || 0,
    pct: quote.changePercent || 0,
    change: quote.change || 0,
    shares: pos?.shares || 0,
    costBasis: pos?.costBasis || quote.price || 0,
    value: (quote.price || 0) * (pos?.shares || 0),
    prevClose: (quote.price || 0) - (quote.change || 0)
  } : null;

  if (loadingQ) return (
    <div className="page-root">
      <button onClick={onBack} style={{display:'flex',alignItems:'center',gap:6,marginBottom:16,background:'none',border:'none',color:'var(--fg3)',cursor:'pointer',fontSize:12,fontFamily:'var(--font-mono)',padding:0}}>← Back to Portfolio</button>
      <div style={{color:'var(--fg3)',fontFamily:'var(--font-mono)',fontSize:13,paddingTop:40}}>Loading {ticker}…</div>
    </div>
  );

  if (!h) return (
    <div className="page-root">
      <button onClick={onBack} style={{display:'flex',alignItems:'center',gap:6,marginBottom:16,background:'none',border:'none',color:'var(--fg3)',cursor:'pointer',fontSize:12,fontFamily:'var(--font-mono)',padding:0}}>← Back to Portfolio</button>
      <div style={{color:'var(--fg3)',fontFamily:'var(--font-mono)',fontSize:13,paddingTop:40}}>Could not load data for {ticker}</div>
    </div>
  );

  const up = h.pct >= 0;
  const color = up ? 'var(--green)' : 'var(--red-loss)';
  const posValue = h.shares > 0 ? h.value : null;
  const dayPnL = h.shares > 0 ? h.change * h.shares : null;

  const newsItems = MOCK.news.slice(0,3);

  const timeframes = ['1D', '5D', '1M', '3M', '1Y', 'All'];
  const chartData = spark.slice(-{
    '1D': 1,
    '5D': 5,
    '1M': 22,
    '3M': 66,
    '1Y': 252,
    'All': spark.length
  }[timeframe]);

  return (
    <div className="page-root">
      {/* Back */}
      <button onClick={onBack} style={{
        display:'flex',alignItems:'center',gap:6,marginBottom:16,
        background:'none',border:'none',color:'var(--fg3)',cursor:'pointer',
        fontSize:12,fontFamily:'var(--font-mono)',padding:0,
      }}>
        ← Back to Portfolio
      </button>

      {/* Header */}
      <div className="page-header" style={{marginBottom:20}}>
        <div>
          <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:4}}>
            <h1 style={{fontSize:28,fontWeight:800,fontFamily:'var(--font-mono)',letterSpacing:'-0.04em',color:'var(--fg)'}}>{ticker}</h1>
            <span style={{fontSize:14,color:'var(--fg3)',fontFamily:'var(--font-ui)'}}>{h.name}</span>
          </div>
          <div style={{display:'flex',alignItems:'baseline',gap:12}}>
            <span style={{fontSize:36,fontWeight:900,fontFamily:'var(--font-mono)',letterSpacing:'-0.04em'}}>${h.price.toFixed(2)}</span>
            <span style={{fontSize:16,fontWeight:600,fontFamily:'var(--font-mono)',color}}>
              {up?'+':''}{h.pct.toFixed(2)}% {timeframe === '1D' ? 'today' : 'period'}
            </span>
          </div>
        </div>
        <a href={`https://finance.yahoo.com/quote/${ticker}`} target="_blank" rel="noopener" className="btn-ghost" style={{padding:'8px 16px',fontSize:12}}>
          Yahoo Finance ↗
        </a>
      </div>

      {/* Timeframe selector and chart */}
      <div className="card" style={{marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div className="section-label" style={{margin:0}}>Price History</div>
          <div style={{display:'flex',gap:6}}>
            {timeframes.map(tf => (
              <button key={tf}
                onClick={() => setTimeframe(tf)}
                style={{padding:'6px 12px',fontSize:11,fontWeight:timeframe===tf?700:400,background:timeframe===tf?'var(--red)':'var(--surf2)',color:timeframe===tf?'white':'var(--fg)',border:'none',borderRadius:6,cursor:'pointer'}}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
        <AreaChart data={chartData} height={140} showDates={false} />
      </div>

      {/* Position stats */}
      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:14}}>
        {[
          {label:'Position Value', val: posValue != null ? `$${posValue.toLocaleString('en-US',{maximumFractionDigits:0})}` : '—', sub: h.shares > 0 ? `${h.shares} shares` : 'Not in portfolio'},
          {label:'Day P&L', val: dayPnL != null ? `${dayPnL>=0?'+':''}$${Math.abs(dayPnL).toFixed(2)}` : `${up?'+':''}${h.pct.toFixed(2)}%`, sub:`${h.pct.toFixed(2)}% today`, color},
          {label:'Prev Close', val:`$${h.prevClose.toFixed(2)}`, sub:'prior close'},
          {label:'Cost Basis', val: h.costBasis > 0 ? `$${h.costBasis.toFixed(2)}` : '—', sub:'avg cost per share'},
        ].map(({label,val,sub,color:c})=>(
          <div key={label} className="stat-card">
            <span className="stat-label">{label}</span>
            <span className="stat-value" style={c?{color:c}:{}}>{val}</span>
            <span style={{fontSize:10,fontFamily:'var(--font-mono)',color:'var(--fg3)'}}>{sub}</span>
          </div>
        ))}
      </div>

      {/* Related news */}
      <div className="card">
        <div className="section-label">Related News</div>
        {newsItems.map((a,i) => (
          <a key={a.id} href={a.url} target="_blank" rel="noopener"
            style={{display:'block',padding:'10px 0',borderBottom:i<newsItems.length-1?'1px solid var(--bdr)':'none',textDecoration:'none'}}>
            <div style={{fontSize:13,color:'var(--fg)',lineHeight:1.45,marginBottom:4,fontWeight:a.importance==='high'?600:400}}>{a.title}</div>
            <div style={{display:'flex',gap:7,alignItems:'center'}}>
              <SourceBadge source={a.source} category={a.category} />
              <span style={{fontSize:9,color:'var(--fg3)',fontFamily:'var(--font-mono)'}}>{timeAgo(a.publishedAt)}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── WATCHLIST PAGE ───────────────────────────────────────────────────────────

function WatchlistPage({ onNav }) {
  const [watchlist, setWatchlist] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('all');
  const [addForm, setAddForm] = React.useState({ symbol: '', name: '' });
  const [showAdd, setShowAdd] = React.useState(false);

  React.useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        const response = await fetch(`${API_URL}/watchlist`);
        const data = await response.json();
        if (Array.isArray(data)) {
          setWatchlist(data);
        } else {
          setWatchlist([]);
        }
      } catch (e) {
        console.error('Watchlist fetch error:', e);
        setWatchlist([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWatchlist();
  }, []);

  function handleAddToWatchlist(e) {
    e.preventDefault();
    if (!addForm.symbol.trim()) return;

    fetch(`${API_URL}/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: addForm.symbol.toUpperCase(),
        name: addForm.name || addForm.symbol,
        category: 'stock'
      })
    })
      .then(r => r.json())
      .then(item => {
        setWatchlist(p => [...p, item]);
        setAddForm({ symbol: '', name: '' });
        setShowAdd(false);
      })
      .catch(e => console.error('Error adding to watchlist:', e));
  }

  function handleRemoveFromWatchlist(symbol) {
    fetch(`${API_URL}/watchlist/${symbol}`, { method: 'DELETE' })
      .then(() => {
        setWatchlist(p => p.filter(w => w.symbol !== symbol));
      })
      .catch(e => console.error('Error removing from watchlist:', e));
  }

  const filtered = filter === 'all' ? watchlist : watchlist.filter(w => w.category === filter);
  const categories = [...new Set(watchlist.map(w => w.category))];

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Watchlist</h1>
          <p className="page-sub">Track securities · alerts · notes</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(!showAdd)} style={{padding:'8px 16px',fontSize:13}}>
          {showAdd ? '✕' : '+ Add'} Security
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="card" style={{marginBottom:16}}>
          <form onSubmit={handleAddToWatchlist} style={{display:'flex',gap:12,alignItems:'flex-end'}}>
            <div style={{flex:1}}>
              <label style={{fontSize:12,color:'var(--fg3)',display:'block',marginBottom:6}}>Symbol</label>
              <input
                type="text"
                placeholder="e.g., NVDA"
                value={addForm.symbol}
                onChange={e => setAddForm(p => ({...p, symbol: e.target.value}))}
                style={{width:'100%',padding:'8px 12px',border:'1px solid var(--bdr)',borderRadius:8,fontSize:13,background:'var(--surf1)',color:'var(--fg)'}}
              />
            </div>
            <div style={{flex:1}}>
              <label style={{fontSize:12,color:'var(--fg3)',display:'block',marginBottom:6}}>Name (optional)</label>
              <input
                type="text"
                placeholder="Company name"
                value={addForm.name}
                onChange={e => setAddForm(p => ({...p, name: e.target.value}))}
                style={{width:'100%',padding:'8px 12px',border:'1px solid var(--bdr)',borderRadius:8,fontSize:13,background:'var(--surf1)',color:'var(--fg)'}}
              />
            </div>
            <button type="submit" className="btn-primary" style={{padding:'8px 16px',fontSize:13}}>
              Add
            </button>
          </form>
        </div>
      )}

      {/* Filter buttons */}
      {categories.length > 0 && (
        <div style={{display:'flex',gap:8,marginBottom:16,overflowX:'auto'}}>
          <button
            onClick={() => setFilter('all')}
            style={{padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:filter==='all'?600:400,background:filter==='all'?'var(--red)':'var(--surf2)',color:filter==='all'?'white':'var(--fg)',border:'none',cursor:'pointer'}}
          >
            All ({watchlist.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              style={{padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:filter===cat?600:400,background:filter===cat?'var(--red)':'var(--surf2)',color:filter===cat?'white':'var(--fg)',border:'none',cursor:'pointer',textTransform:'capitalize'}}
            >
              {cat} ({watchlist.filter(w=>w.category===cat).length})
            </button>
          ))}
        </div>
      )}

      {/* Watchlist Table */}
      {loading ? (
        <div style={{padding:40,textAlign:'center',color:'var(--fg3)'}}>Loading watchlist...</div>
      ) : filtered.length === 0 ? (
        <div style={{padding:40,textAlign:'center',color:'var(--fg3)'}}>
          No securities in watchlist. Add one to get started.
        </div>
      ) : (
        <div className="card">
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid var(--bdr)'}}>
                  <th style={{padding:'12px 8px',textAlign:'left',fontSize:12,fontWeight:700,color:'var(--fg3)',textTransform:'uppercase'}}>Symbol</th>
                  <th style={{padding:'12px 8px',textAlign:'left',fontSize:12,fontWeight:700,color:'var(--fg3)',textTransform:'uppercase'}}>Name</th>
                  <th style={{padding:'12px 8px',textAlign:'right',fontSize:12,fontWeight:700,color:'var(--fg3)',textTransform:'uppercase'}}>Price</th>
                  <th style={{padding:'12px 8px',textAlign:'right',fontSize:12,fontWeight:700,color:'var(--fg3)',textTransform:'uppercase'}}>Change</th>
                  <th style={{padding:'12px 8px',textAlign:'left',fontSize:12,fontWeight:700,color:'var(--fg3)',textTransform:'uppercase'}}>Added</th>
                  <th style={{padding:'12px 8px',textAlign:'center',fontSize:12,fontWeight:700,color:'var(--fg3)',textTransform:'uppercase'}}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => {
                  const up = (item.lastChangePercent || 0) >= 0;
                  const addedDate = new Date(item.addedAt).toLocaleDateString('en-US', {month:'short',day:'numeric'});
                  return (
                    <tr key={item._id} style={{borderBottom:i<filtered.length-1?'1px solid var(--bdr)':'none'}}>
                      <td style={{padding:'12px 8px',fontSize:13,fontWeight:700,color:'var(--red)'}}>{item.symbol}</td>
                      <td style={{padding:'12px 8px',fontSize:13,color:'var(--fg)'}}>{item.name || '—'}</td>
                      <td style={{padding:'12px 8px',fontSize:13,textAlign:'right',fontFamily:'var(--font-mono)',color:'var(--fg)'}}>
                        ${(item.lastPrice || 0).toFixed(2)}
                      </td>
                      <td style={{padding:'12px 8px',fontSize:13,textAlign:'right',fontFamily:'var(--font-mono)',color:up?'var(--green)':'var(--red-loss)'}}>
                        {up?'+':''}{(item.lastChangePercent || 0).toFixed(2)}%
                      </td>
                      <td style={{padding:'12px 8px',fontSize:12,color:'var(--fg3)'}}>{addedDate}</td>
                      <td style={{padding:'12px 8px',textAlign:'center'}}>
                        <button
                          onClick={() => handleRemoveFromWatchlist(item.symbol)}
                          style={{padding:'4px 10px',fontSize:11,background:'var(--red)',color:'white',border:'none',borderRadius:4,cursor:'pointer'}}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ALERTS PANEL ─────────────────────────────────────────────────────────────

function AlertsPanel({ onClose }) {
  const [alerts, setAlerts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [newAlert, setNewAlert] = React.useState({ symbol: '', alertType: 'above', targetPrice: '' });

  React.useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch(`${API_URL}/alerts`);
        const data = await response.json();
        if (Array.isArray(data)) {
          setAlerts(data);
        }
      } catch (e) {
        console.error('Alerts fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  function handleCreateAlert(e) {
    e.preventDefault();
    if (!newAlert.symbol || !newAlert.targetPrice) return;

    fetch(`${API_URL}/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: newAlert.symbol.toUpperCase(),
        alertType: newAlert.alertType,
        targetPrice: parseFloat(newAlert.targetPrice)
      })
    })
      .then(r => r.json())
      .then(alert => {
        setAlerts(p => [...p, alert]);
        setNewAlert({ symbol: '', alertType: 'above', targetPrice: '' });
      })
      .catch(e => console.error('Error creating alert:', e));
  }

  function handleToggleAlert(id) {
    fetch(`${API_URL}/alerts/${id}/toggle`, { method: 'PATCH' })
      .then(r => r.json())
      .then(updated => {
        setAlerts(p => p.map(a => a._id === id ? updated : a));
      })
      .catch(e => console.error('Error toggling alert:', e));
  }

  function handleDeleteAlert(id) {
    fetch(`${API_URL}/alerts/${id}`, { method: 'DELETE' })
      .then(() => {
        setAlerts(p => p.filter(a => a._id !== id));
      })
      .catch(e => console.error('Error deleting alert:', e));
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--bdr)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Price Alerts</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--fg3)' }}>×</button>
        </div>

        {/* Create Alert Form */}
        <form onSubmit={handleCreateAlert} style={{ display: 'flex', gap: 10, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--bdr)' }}>
          <input
            type="text"
            placeholder="Symbol (e.g., NVDA)"
            value={newAlert.symbol}
            onChange={e => setNewAlert(p => ({ ...p, symbol: e.target.value }))}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--bdr)', borderRadius: 6, fontSize: 13, background: 'var(--surf1)', color: 'var(--fg)' }}
          />
          <select
            value={newAlert.alertType}
            onChange={e => setNewAlert(p => ({ ...p, alertType: e.target.value }))}
            style={{ padding: '8px 12px', border: '1px solid var(--bdr)', borderRadius: 6, fontSize: 13, background: 'var(--surf1)', color: 'var(--fg)' }}
          >
            <option value="above">Price ≥</option>
            <option value="below">Price ≤</option>
          </select>
          <input
            type="number"
            placeholder="Price"
            value={newAlert.targetPrice}
            onChange={e => setNewAlert(p => ({ ...p, targetPrice: e.target.value }))}
            step="0.01"
            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--bdr)', borderRadius: 6, fontSize: 13, background: 'var(--surf1)', color: 'var(--fg)' }}
          />
          <button type="submit" style={{ padding: '8px 16px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            Add
          </button>
        </form>

        {/* Alerts List */}
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--fg3)', padding: 20 }}>Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--fg3)', padding: 20 }}>No alerts set. Create one above.</div>
          ) : (
            alerts.map(alert => (
              <div key={alert._id} style={{ padding: 12, borderBottom: '1px solid var(--bdr)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: 'var(--red)', fontSize: 14 }}>{alert.symbol}</span>
                    <span style={{ fontSize: 12, color: 'var(--fg3)', background: 'var(--surf2)', padding: '2px 8px', borderRadius: 4 }}>
                      {alert.alertType === 'above' ? '≥' : '≤'} ${alert.targetPrice.toFixed(2)}
                    </span>
                    {alert.triggered && <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>✓ TRIGGERED</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg3)' }}>
                    {alert.enabled ? '🟢 Active' : '⚫ Disabled'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleToggleAlert(alert._id)}
                    style={{ padding: '4px 10px', fontSize: 11, background: alert.enabled ? 'var(--red)' : 'var(--surf2)', color: alert.enabled ? 'white' : 'var(--fg)', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    {alert.enabled ? 'Off' : 'On'}
                  </button>
                  <button
                    onClick={() => handleDeleteAlert(alert._id)}
                    style={{ padding: '4px 10px', fontSize: 11, background: 'var(--surf2)', color: 'var(--fg3)', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Del
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PortfolioPage, JapanPage, NewsPage, VoicesPage, StockPage, WatchlistPage, AlertsPanel });
