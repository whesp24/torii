// ─── TORII SUB-PAGES: Portfolio, Japan, News, Voices, Stock ──────────────────

const API_URL = 'https://torii-backend.onrender.com/api';

// ─── PORTFOLIO PAGE ───────────────────────────────────────────────────────────

function PortfolioPage({ onNav }) {
  const [positions, setPositions] = React.useState([]);
  const [holdings, setHoldings]   = React.useState([]);
  const [loading, setLoading]     = React.useState(true);
  const [showAdd, setShowAdd]     = React.useState(false);
  const [newTicker, setNewTicker] = React.useState('');
  const [newShares, setNewShares] = React.useState('');
  const [newCost, setNewCost]     = React.useState('');
  const [addLoading, setAddLoading] = React.useState(false);
  const [addError, setAddError]   = React.useState('');

  // Load positions from backend (syncs across devices)
  function fetchPositions() {
    return fetch(`${API_URL}/positions`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        // data is array of {ticker, shares, costBasis, _id, ...}
        setPositions(data);
        // Also keep localStorage in sync as fallback cache
        try { localStorage.setItem('torii_portfolio', JSON.stringify(data.map(p => ({ ticker: p.ticker, shares: p.shares, costBasis: p.costBasis })))); } catch {}
        return data;
      })
      .catch(() => {
        // Fallback to localStorage if backend unreachable
        try { const s = localStorage.getItem('torii_portfolio'); return s ? JSON.parse(s) : []; } catch { return []; }
      });
  }

  React.useEffect(() => {
    fetchPositions().then(data => setPositions(data));
  }, []);

  // Fetch live prices for all positions
  React.useEffect(() => {
    if (positions.length === 0) { setHoldings([]); setLoading(false); return; }
    setLoading(true);
    Promise.all(positions.map((p, i) =>
      fetch(`${API_URL}/stocks/live/${p.ticker}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
        .then(d => ({
          id: p._id || i + 1,
          ticker: p.ticker,
          name: d?.name || p.ticker,
          shares: p.shares,
          costBasis: p.costBasis || 0,
          price: d?.price || 0,
          pct: d?.changePercent || 0,
          change: d?.change || 0,
          value: (d?.price || 0) * p.shares,
          prevClose: (d?.price || 0) - (d?.change || 0),
          priceUnavailable: !d?.price
        }))
    )).then(res => { setHoldings(res); setLoading(false); });
  }, [positions]);

  const addPosition = () => {
    const ticker = newTicker.trim().toUpperCase();
    const shares = parseFloat(newShares);
    if (!ticker) { setAddError('Enter a ticker symbol'); return; }
    if (isNaN(shares) || shares <= 0) { setAddError('Enter a valid number of shares'); return; }
    if (positions.find(p => p.ticker === ticker)) { setAddError(`${ticker} is already in your portfolio`); return; }
    setAddLoading(true);
    fetch(`${API_URL}/positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, shares, costBasis: parseFloat(newCost) || 0 }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(saved => {
        if (saved) setPositions(prev => [...prev, saved]);
        setAddLoading(false);
        setShowAdd(false); setNewTicker(''); setNewShares(''); setNewCost(''); setAddError('');
      })
      .catch(() => { setAddError('Failed to save — check connection'); setAddLoading(false); });
  };

  const removePosition = ticker => {
    fetch(`${API_URL}/positions/${ticker}`, { method: 'DELETE' }).catch(() => {});
    setPositions(prev => prev.filter(p => p.ticker !== ticker));
    setHoldings(prev => prev.filter(h => h.ticker !== ticker));
  };

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

const JAPAN_STOCKS = [
  { symbol:'7203.T', label:'Toyota',       group:'Equities' },
  { symbol:'9984.T', label:'SoftBank',     group:'Equities' },
  { symbol:'6758.T', label:'Sony',         group:'Equities' },
  { symbol:'6861.T', label:'Keyence',      group:'Equities' },
  { symbol:'8306.T', label:'Mitsubishi UFJ',group:'Equities'},
  { symbol:'6501.T', label:'Hitachi',      group:'Equities' },
  { symbol:'8035.T', label:'Tokyo Electron',group:'Equities'},
  { symbol:'9432.T', label:'NTT',          group:'Equities' },
];
const JAPAN_KPIS = [
  { symbol:'^N225',    label:'Nikkei 225', dec:0, accent:true },
  { symbol:'USDJPY=X', label:'USD/JPY',    dec:2, tag:'FX'    },
  { symbol:'EWJ',      label:'EWJ ETF',    dec:2, tag:'ETF'   },
  { symbol:'^TOPX',    label:'TOPIX',      dec:0, tag:'INDEX' },
];

function JapanPage() {
  const [kpis,    setKpis]    = React.useState({});
  const [stocks,  setStocks]  = React.useState([]);
  const [chart,   setChart]   = React.useState([]);
  const [range,   setRange]   = React.useState('1mo');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Load KPIs
    fetch(`${API_URL}/kpis`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const map = {};
          data.forEach(k => { map[k.symbol] = k; });
          setKpis(map);
        }
      }).catch(() => {});

    // Load Japan equities live prices
    Promise.all(JAPAN_STOCKS.map(s =>
      fetch(`${API_URL}/stocks/live/${s.symbol}`)
        .then(r => r.ok ? r.json() : null).catch(() => null)
        .then(d => ({ ...s, price: d?.price || 0, pct: d?.changePercent || 0, name: d?.name || s.label }))
    )).then(res => { setStocks(res); setLoading(false); });
  }, []);

  React.useEffect(() => {
    fetch(`${API_URL}/stocks/chart/%5EN225?range=${range}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length) setChart(data.filter(d => d.price != null)); })
      .catch(() => {});
  }, [range]);

  const chartPrices = chart.map(d => d.price);
  const chartLabels = chart.map(d => d.time);
  const rangeMap = { '1mo':'1M', '3mo':'3M', '1y':'1Y', '5d':'5D', '1d':'1D' };

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
        {JAPAN_KPIS.map(({symbol,label,dec,accent,tag}) => {
          const k = kpis[symbol];
          const mock = [...(MOCK.japan||[]),...(MOCK.macro||[])].find(q => q.symbol === symbol);
          const price = k?.price ?? mock?.price;
          const pct   = k?.changePercent ?? mock?.pct;
          return <StatCard key={symbol} label={label} tag={tag} price={price} pct={pct} dec={dec} accent={accent} />;
        })}
      </div>

      {/* Nikkei chart */}
      <div className="card" style={{marginBottom:14}}>
        <div className="card-head" style={{marginBottom:10}}>
          <div className="section-label" style={{marginBottom:0}}>Nikkei 225</div>
          <div style={{display:'flex',gap:6}}>
            {['1d','5d','1mo','3mo','1y'].map(r => (
              <button key={r} className={`range-btn${range===r?' active':''}`} onClick={() => setRange(r)}>
                {rangeMap[r]||r}
              </button>
            ))}
          </div>
        </div>
        {chartPrices.length > 0
          ? <AreaChart data={chartPrices} labels={chartLabels} height={180} showAxes={true} />
          : <AreaChart data={MOCK.nikkeiChart.prices} labels={MOCK.nikkeiChart.dates} height={180} showAxes={true} />
        }
      </div>

      {/* Live Japan equities table */}
      <div className="card" style={{marginBottom:14,padding:0,overflow:'hidden'}}>
        <div style={{padding:'12px 20px',borderBottom:'1px solid var(--bdr)'}}>
          <div className="section-label" style={{marginBottom:0}}>Japan Equities</div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Symbol</th><th>Name</th>
              <th style={{textAlign:'right'}}>Price (¥)</th>
              <th style={{textAlign:'right'}}>Day %</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{padding:20,textAlign:'center',color:'var(--fg3)',fontSize:11}}>Loading…</td></tr>
            ) : stocks.map(s => {
              const up = s.pct >= 0;
              return (
                <tr key={s.symbol}>
                  <td><span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:12}}>{s.symbol}</span></td>
                  <td style={{fontSize:12,color:'var(--fg2)'}}>{s.name || s.label}</td>
                  <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600}}>
                    {s.price > 0 ? `¥${s.price.toLocaleString('en-US',{maximumFractionDigits:0})}` : '—'}
                  </td>
                  <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600,color:up?'var(--green)':'var(--red-loss)'}}>
                    {up?'+':''}{s.pct.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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

// Topic keyword map for each curated account
const VOICE_TOPICS = {
  'KevinLMak':       ['japan', 'nikkei', 'fx', 'yen', 'macro', 'boj', 'jpy'],
  'ContrarianCurse': ['equities', 'sentiment', 'market', 'stock', 'short', 'bearish', 'bullish'],
  'dsundheim':       ['equity', 'long', 'short', 'fund', 'hedge', 'position'],
  'jeff_weinstein':  ['tech', 'venture', 'ai', 'startup', 'software', 'nvda', 'nvidia'],
  'HannoLustig':     ['macro', 'fed', 'rates', 'inflation', 'bond', 'treasury', 'monetary'],
  'patrick_oshag':   ['value', 'capital', 'invest', 'earnings', 'growth', 'compounding'],
};

function VoicesPage() {
  const [selected, setSelected] = React.useState('all');
  const [tweets, setTweets]     = React.useState([]);
  const [loading, setLoading]   = React.useState(true);

  React.useEffect(() => {
    fetch(`${API_URL}/tweets`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTweets(data.map(t => ({
            id: t._id,
            handle: t.authorHandle || 'unknown',
            name: t.author || 'Unknown',
            content: t.content || '',
            url: t.url || '#',
            createdAt: t.createdAt,
            sentiment: t.sentiment || 'neutral'
          })));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Show curated tweets if available, otherwise fall back to topic news
  const [topicNews, setTopicNews] = React.useState([]);
  React.useEffect(() => {
    fetch(`${API_URL}/news`).then(r => r.json()).then(d => setTopicNews(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const curatedHandles = VOICE_ACCOUNTS.map(a => a.handle.toLowerCase());
  const curatedTweets = tweets.filter(t => curatedHandles.includes((t.handle || '').toLowerCase()));

  // Topic keyword map for news fallback
  const topicMap = {
    'KevinLMak':       ['japan','nikkei','yen','boj','fx','macro'],
    'ContrarianCurse': ['equity','sentiment','market','short','bearish','bullish'],
    'dsundheim':       ['equity','long','short','hedge','fund','position'],
    'jeff_weinstein':  ['tech','ai','nvidia','software','venture','startup'],
    'HannoLustig':     ['fed','rates','inflation','bond','treasury','macro'],
    'patrick_oshag':   ['value','capital','invest','earnings','compounding'],
  };

  const getNewsForAccount = (handle) => {
    const keywords = topicMap[handle] || [];
    return topicNews.filter(n => {
      const text = ((n.title || '') + ' ' + (n.description || '')).toLowerCase();
      return keywords.some(k => text.includes(k));
    }).slice(0, 8);
  };

  const hasTweets = curatedTweets.length > 0;
  const displayedTweets = selected === 'all' ? curatedTweets : curatedTweets.filter(t => t.handle.toLowerCase() === selected.toLowerCase());
  const displayedNews = selected === 'all' ? topicNews.slice(0, 15) : getNewsForAccount(selected);

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
        <div onClick={() => setSelected('all')} className={`voice-card${selected==='all'?' active':''}`}>
          <div className="voice-avatar" style={{background:'var(--surf2)',color:'var(--fg2)',fontSize:11,fontFamily:'var(--font-mono)'}}>ALL</div>
          <div className="voice-info">
            <span className="voice-name">All Voices</span>
            <span className="voice-handle">{VOICE_ACCOUNTS.length} accounts</span>
          </div>
        </div>
        {VOICE_ACCOUNTS.map(a => (
          <div key={a.handle} onClick={() => setSelected(a.handle)}
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

      {/* Feed */}
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {loading && <div style={{padding:40,textAlign:'center',color:'var(--fg3)',fontFamily:'var(--font-mono)',fontSize:12}}>Loading…</div>}

        {/* Real tweets when available */}
        {!loading && hasTweets && displayedTweets.map(t => {
          const acct = VOICE_ACCOUNTS.find(a => a.handle.toLowerCase() === t.handle.toLowerCase());
          return (
            <a key={t.id} href={t.url} target="_blank" rel="noopener noreferrer"
              style={{display:'block',textDecoration:'none',background:'var(--surf)',border:'1px solid var(--bdr)',borderRadius:12,padding:'14px 16px'}}>
              <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                <div className="voice-avatar" style={{background:acct?.color||'var(--surf2)',width:38,height:38,fontSize:12,flexShrink:0}}>
                  {acct?.initials||t.handle.charAt(0).toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                    <span style={{fontSize:13,fontWeight:700,color:'var(--fg)'}}>{t.name}</span>
                    <span style={{fontSize:11,color:'var(--fg3)'}}>@{t.handle}</span>
                    <span style={{fontSize:10,color:'var(--fg3)',fontFamily:'var(--font-mono)',marginLeft:'auto'}}>{timeAgo(t.createdAt)}</span>
                  </div>
                  <div style={{fontSize:13,color:'var(--fg)',lineHeight:1.55}}>{t.content}</div>
                </div>
              </div>
            </a>
          );
        })}

        {/* Topic news fallback when no tweets */}
        {!loading && !hasTweets && displayedNews.map((n, i) => {
          const acct = selected !== 'all' ? VOICE_ACCOUNTS.find(a => a.handle === selected) : null;
          return (
            <a key={n._id || i} href={n.url} target="_blank" rel="noopener noreferrer"
              style={{display:'block',textDecoration:'none',background:'var(--surf)',border:'1px solid var(--bdr)',borderRadius:12,padding:'14px 16px'}}>
              <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                <div className="voice-avatar" style={{background:acct?.color||'var(--surf2)',width:38,height:38,fontSize:10,flexShrink:0}}>
                  {acct?.initials || (n.source||'N').charAt(0).toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                    <span style={{fontSize:12,fontWeight:600,color:'var(--fg)'}}>{acct ? acct.name : n.source}</span>
                    <span style={{fontSize:10,color:'var(--fg3)',fontFamily:'var(--font-mono)'}}>{timeAgo(n.publishedAt)}</span>
                    {!acct && n.source && <span style={{fontSize:10,color:'var(--fg3)',marginLeft:'auto'}}>{n.source}</span>}
                  </div>
                  <div style={{fontSize:13,color:'var(--fg)',lineHeight:1.5,fontWeight:500}}>{n.title}</div>
                  {n.description && <div style={{fontSize:11,color:'var(--fg2)',marginTop:3,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{n.description}</div>}
                </div>
              </div>
            </a>
          );
        })}

        {/* View on X link for selected account */}
        {!loading && selected !== 'all' && (() => {
          const acct = VOICE_ACCOUNTS.find(a => a.handle === selected);
          return acct ? (
            <a href={`https://x.com/${acct.handle}`} target="_blank" rel="noopener noreferrer"
              style={{display:'block',textAlign:'center',padding:'12px',background:'var(--surf)',border:'1px solid var(--bdr)',borderRadius:10,textDecoration:'none',color:'var(--fg3)',fontSize:12,fontFamily:'var(--font-mono)'}}>
              View @{acct.handle}'s full feed on X ↗
            </a>
          ) : null;
        })()}

        {!loading && !hasTweets && displayedNews.length === 0 && (
          <div style={{padding:'32px',textAlign:'center',color:'var(--fg3)',fontFamily:'var(--font-mono)',fontSize:12}}>No content found yet</div>
        )}
      </div>
    </div>
  );
}

// ─── STOCK DETAIL PAGE ────────────────────────────────────────────────────────

const TIMEFRAME_RANGE = { '1D':'1d', '5D':'5d', '1M':'1mo', '3M':'3mo', '1Y':'1y', 'All':'max' };

function StockPage({ ticker, onBack }) {
  // ── ALL hooks must come before any early returns ──────────────────────────
  const [quote, setQuote]         = React.useState(null);
  const [loadingQ, setLoadingQ]   = React.useState(true);
  const [timeframe, setTimeframe] = React.useState('5D');
  const [chartPrices, setChartPrices] = React.useState([]);
  const [chartLabels, setChartLabels] = React.useState([]);
  const [chartLoading, setChartLoading] = React.useState(false);
  const [relatedNews, setRelatedNews]   = React.useState([]);

  // Position from localStorage (memoized so it doesn't re-run on every render)
  const pos = React.useMemo(() => {
    const saved = loadSavedPositions();
    return saved.find(p => p.ticker === ticker) || null;
  }, [ticker]);

  // Derived display object from quote state
  const h = React.useMemo(() => {
    if (!quote) return null;
    return {
      ticker,
      name: quote.name || ticker,
      price: quote.price || 0,
      pct: quote.changePercent || 0,
      change: quote.change || 0,
      shares: pos?.shares || 0,
      costBasis: pos?.costBasis || quote.price || 0,
      value: (quote.price || 0) * (pos?.shares || 0),
      prevClose: (quote.price || 0) - (quote.change || 0)
    };
  }, [quote, pos, ticker]);

  // Period % computed from chart data (first → last price)
  const periodPct = React.useMemo(() => {
    if (chartPrices.length < 2) return h?.pct || 0;
    const first = chartPrices[0], last = chartPrices[chartPrices.length - 1];
    return first > 0 ? ((last - first) / first) * 100 : (h?.pct || 0);
  }, [chartPrices, h?.pct]);

  // Fetch live quote
  React.useEffect(() => {
    setLoadingQ(true);
    fetch(`${API_URL}/stocks/live/${ticker}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setQuote(d); setLoadingQ(false); })
      .catch(() => setLoadingQ(false));
  }, [ticker]);

  // Fetch chart data on timeframe change
  React.useEffect(() => {
    setChartLoading(true);
    fetch(`${API_URL}/stocks/chart/${ticker}?range=${TIMEFRAME_RANGE[timeframe]}`)
      .then(r => r.ok ? r.json() : [])
      .then(pts => {
        const valid = Array.isArray(pts) ? pts.filter(p => p.price != null) : [];
        setChartPrices(valid.map(p => p.price));
        setChartLabels(valid.map(p => p.time));
        setChartLoading(false);
      })
      .catch(() => setChartLoading(false));
  }, [ticker, timeframe]);

  // Fetch related news (ticker search, then latest news fallback)
  React.useEffect(() => {
    const trySearch = q => fetch(`${API_URL}/news/search?q=${encodeURIComponent(q)}`).then(r => r.ok ? r.json() : []);
    trySearch(ticker)
      .then(async d => {
        if (d?.length > 0) return d;
        const latest = await fetch(`${API_URL}/news`).then(r => r.ok ? r.json() : []).catch(() => []);
        return Array.isArray(latest) ? latest.slice(0, 4) : [];
      })
      .then(d => setRelatedNews(d))
      .catch(() => {});
  }, [ticker]);

  // ── Early returns (all hooks above this line) ─────────────────────────────
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

  const timeframes = ['1D', '5D', '1M', '3M', '1Y', 'All'];
  const displayChart = chartPrices.length > 0 ? chartPrices : (MOCK.sparklines[ticker] || []);
  const displayLabels = chartPrices.length > 0 ? chartLabels : [];
  const periodUp = periodPct >= 0;
  const periodColor = periodUp ? 'var(--green)' : 'var(--red-loss)';

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
            <span style={{fontSize:16,fontWeight:600,fontFamily:'var(--font-mono)',color:periodColor}}>
              {periodUp?'+':''}{periodPct.toFixed(2)}% {timeframe === '1D' ? 'today' : timeframe}
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
        {chartLoading
          ? <div style={{height:140,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--fg3)',fontSize:12,fontFamily:'var(--font-mono)'}}>Loading chart…</div>
          : <AreaChart data={displayChart} labels={displayLabels} height={180} showDates={true} showAxes={true} />
        }
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
        <div className="section-label">Related News — {ticker}</div>
        {relatedNews.length > 0 ? relatedNews.map((a,i) => (
          <a key={a._id || i} href={a.url} target="_blank" rel="noopener noreferrer"
            style={{display:'block',padding:'10px 0',borderBottom:i<relatedNews.length-1?'1px solid var(--bdr)':'none',textDecoration:'none',cursor:'pointer'}}>
            <div style={{fontSize:13,color:'var(--fg)',lineHeight:1.45,marginBottom:4}}>{a.title}</div>
            <div style={{display:'flex',gap:7,alignItems:'center'}}>
              <SourceBadge source={a.source} category={a.category} />
              <span style={{fontSize:9,color:'var(--fg3)',fontFamily:'var(--font-mono)'}}>{timeAgo(a.publishedAt)}</span>
            </div>
          </a>
        )) : (
          <div style={{padding:'16px 0',color:'var(--fg3)',fontFamily:'var(--font-mono)',fontSize:12}}>
            No news found for {ticker} — check back after the next news update
          </div>
        )}
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
                style={{width:'100%',padding:'8px 12px',border:'1px solid var(--bdr)',borderRadius:8,fontSize:13,background:'var(--surf)',color:'var(--fg)'}}
              />
            </div>
            <div style={{flex:1}}>
              <label style={{fontSize:12,color:'var(--fg3)',display:'block',marginBottom:6}}>Name (optional)</label>
              <input
                type="text"
                placeholder="Company name"
                value={addForm.name}
                onChange={e => setAddForm(p => ({...p, name: e.target.value}))}
                style={{width:'100%',padding:'8px 12px',border:'1px solid var(--bdr)',borderRadius:8,fontSize:13,background:'var(--surf)',color:'var(--fg)'}}
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
            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--bdr)', borderRadius: 6, fontSize: 13, background: 'var(--surf)', color: 'var(--fg)' }}
          />
          <select
            value={newAlert.alertType}
            onChange={e => setNewAlert(p => ({ ...p, alertType: e.target.value }))}
            style={{ padding: '8px 12px', border: '1px solid var(--bdr)', borderRadius: 6, fontSize: 13, background: 'var(--surf)', color: 'var(--fg)' }}
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
            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--bdr)', borderRadius: 6, fontSize: 13, background: 'var(--surf)', color: 'var(--fg)' }}
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

// ─── EARNINGS CALENDAR PAGE ───────────────────────────────────────────────────

const ECOCAL_2026 = [
  { date:'2026-04-28', name:'FOMC Meeting',      desc:'Fed rate decision — Apr 28–29',             tag:'fed',   priority:'high'   },
  { date:'2026-04-29', name:'Q1 GDP Release',    desc:'First estimate of Q1 2026 GDP growth',      tag:'macro', priority:'high'   },
  { date:'2026-04-30', name:'BOJ Meeting',       desc:'Bank of Japan policy — Apr 30–May 1',       tag:'boj',   priority:'high'   },
  { date:'2026-04-30', name:'PCE Inflation',     desc:'March PCE personal spending data',           tag:'macro', priority:'medium' },
  { date:'2026-05-01', name:'US Jobs Report',    desc:'April nonfarm payrolls',                    tag:'macro', priority:'high'   },
  { date:'2026-05-02', name:'Berkshire AGM',     desc:'Berkshire Hathaway annual meeting',         tag:'event', priority:'low'    },
  { date:'2026-05-12', name:'US CPI Release',    desc:'April CPI inflation data',                  tag:'macro', priority:'high'   },
  { date:'2026-05-29', name:'PCE Inflation',     desc:'April PCE personal spending',               tag:'macro', priority:'medium' },
  { date:'2026-06-05', name:'US Jobs Report',    desc:'May nonfarm payrolls',                      tag:'macro', priority:'medium' },
  { date:'2026-06-10', name:'US CPI Release',    desc:'May CPI inflation data',                    tag:'macro', priority:'medium' },
  { date:'2026-06-15', name:'BOJ Meeting',       desc:'Bank of Japan policy — Jun 15–16',          tag:'boj',   priority:'medium' },
  { date:'2026-06-16', name:'FOMC Meeting',      desc:'Fed rate decision — Jun 16–17',             tag:'fed',   priority:'high'   },
  { date:'2026-07-10', name:'US Jobs Report',    desc:'June nonfarm payrolls',                     tag:'macro', priority:'medium' },
  { date:'2026-07-14', name:'US CPI Release',    desc:'June CPI inflation data',                   tag:'macro', priority:'medium' },
  { date:'2026-07-28', name:'FOMC Meeting',      desc:'Fed rate decision — Jul 28–29',             tag:'fed',   priority:'high'   },
  { date:'2026-07-29', name:'Q2 GDP Release',    desc:'First estimate of Q2 2026 GDP growth',      tag:'macro', priority:'high'   },
  { date:'2026-07-29', name:'BOJ Meeting',       desc:'Bank of Japan policy — Jul 29–30',          tag:'boj',   priority:'medium' },
  { date:'2026-08-11', name:'US CPI Release',    desc:'July CPI inflation data',                   tag:'macro', priority:'medium' },
  { date:'2026-09-15', name:'FOMC Meeting',      desc:'Fed rate decision — Sep 15–16',             tag:'fed',   priority:'high'   },
  { date:'2026-09-16', name:'BOJ Meeting',       desc:'Bank of Japan policy — Sep 16–17',          tag:'boj',   priority:'medium' },
  { date:'2026-11-03', name:'FOMC Meeting',      desc:'Fed rate decision — Nov 3–4',               tag:'fed',   priority:'high'   },
  { date:'2026-12-08', name:'FOMC Meeting',      desc:'Fed rate decision — Dec 8–9',               tag:'fed',   priority:'high'   },
];

function EarningsPage({ defaultTab }) {
  const [earnings, setEarnings]     = React.useState([]);
  const [loading, setLoading]       = React.useState(true);
  const [activeTab, setActiveTab]   = React.useState(defaultTab || 'earnings');

  React.useEffect(() => {
    fetch(`${API_URL}/earnings/calendar`)
      .then(r => r.ok ? r.json() : { earningsCalendar: [] })
      .then(d => { setEarnings(d.earningsCalendar || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const tagStyle = tag => {
    const map = { fed:'#F59E0B', boj:'#EF4444', macro:'#8B5CF6', event:'#10B981' };
    return { background: (map[tag]||'#666') + '22', color: map[tag]||'#999',
      border: `1px solid ${(map[tag]||'#666')}44`, borderRadius:4,
      padding:'2px 7px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' };
  };

  const priBadge = p => {
    const c = p==='high'?'#EF4444':p==='medium'?'#F59E0B':'#6B7280';
    return { width:6, height:6, borderRadius:'50%', background:c, flexShrink:0 };
  };

  const hourLabel = h => h==='bmo'?'pre-market':h==='amc'?'after-close':'';

  const today = new Date().toISOString().split('T')[0];
  const grouped = {};
  for (const e of earnings) {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  }
  const sortedDates = Object.keys(grouped).sort();

  const ecoUpcoming = ECOCAL_2026
    .filter(e => e.date >= today)
    .sort((a,b) => a.date.localeCompare(b.date));

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Earnings & Calendar</h1>
          <p className="page-sub">Upcoming earnings reports · macro events</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--surf)',borderRadius:10,padding:4,width:'fit-content'}}>
        {[['earnings','Earnings Reports'],['ecocal','Economic Calendar']].map(([id,label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{padding:'7px 18px',borderRadius:7,border:'none',cursor:'pointer',fontSize:13,fontWeight:600,
              background:activeTab===id?'var(--surf2)':'transparent',
              color:activeTab===id?'var(--fg)':'var(--fg3)',transition:'all 0.15s'}}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'earnings' && (
        loading ? (
          <div className="card" style={{textAlign:'center',padding:40,color:'var(--fg3)'}}>
            Loading earnings calendar…
          </div>
        ) : earnings.length === 0 ? (
          <div className="card" style={{textAlign:'center',padding:40}}>
            <div style={{fontSize:32,marginBottom:12}}>📅</div>
            <div style={{color:'var(--fg3)',fontSize:14}}>No earnings data — requires Finnhub API key with earnings access</div>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {sortedDates.map(date => {
              const d = new Date(date + 'T12:00:00Z');
              const isPast = date < today;
              return (
                <div key={date}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--fg3)',letterSpacing:'0.08em',
                    textTransform:'uppercase',marginBottom:8,fontFamily:'var(--font-mono)'}}>
                    {d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
                    {date === today && <span style={{marginLeft:8,color:'var(--red)',fontSize:10}}>TODAY</span>}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {grouped[date].map(e => (
                      <div key={e.symbol} className="card"
                        style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:12,
                          opacity:isPast?0.55:1}}>
                        <div style={{width:40,height:40,borderRadius:8,background:'var(--red-dim)',
                          display:'flex',alignItems:'center',justifyContent:'center',
                          color:'var(--red)',fontWeight:800,fontSize:13,fontFamily:'var(--font-mono)',flexShrink:0}}>
                          {e.symbol.slice(0,3)}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:14,color:'var(--fg)'}}>{e.symbol}</div>
                          <div style={{fontSize:12,color:'var(--fg3)',marginTop:2}}>
                            {hourLabel(e.hour) || 'Report date'}
                            {e.epsEstimate != null && ` · EPS est: $${e.epsEstimate}`}
                            {e.revenueEstimate != null && ` · Rev est: $${(e.revenueEstimate/1e9).toFixed(1)}B`}
                          </div>
                        </div>
                        <span style={{fontSize:11,color:'var(--fg3)',fontFamily:'var(--font-mono)',
                          background:'var(--surf)',padding:'4px 10px',borderRadius:5}}>
                          {e.hour==='bmo'?'🌅 Pre':e.hour==='amc'?'🌆 Post':'📊'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {activeTab === 'ecocal' && (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {ecoUpcoming.map((evt, i) => {
            const d = new Date(evt.date + 'T12:00:00Z');
            const isToday = evt.date === today;
            const daysAway = Math.round((new Date(evt.date) - new Date(today)) / 86400000);
            return (
              <div key={i} className="card" style={{padding:'14px 18px',display:'flex',gap:14,alignItems:'center'}}>
                <div style={{width:52,textAlign:'center',flexShrink:0}}>
                  <div style={{fontSize:10,color:'var(--fg3)',fontFamily:'var(--font-mono)',textTransform:'uppercase'}}>
                    {d.toLocaleDateString('en-US',{month:'short'})}
                  </div>
                  <div style={{fontSize:22,fontWeight:800,color:isToday?'var(--red)':'var(--fg)',lineHeight:1.1}}>
                    {d.getUTCDate()}
                  </div>
                  <div style={{fontSize:9,color:'var(--fg3)',fontFamily:'var(--font-mono)'}}>
                    {isToday?'TODAY':daysAway<=7?`${daysAway}d`:''}
                  </div>
                </div>
                <div style={{borderLeft:'2px solid var(--bdr)',paddingLeft:14,flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <div style={priBadge(evt.priority)} />
                    <span style={{fontWeight:700,fontSize:14,color:'var(--fg)'}}>{evt.name}</span>
                    <span style={tagStyle(evt.tag)}>{evt.tag}</span>
                  </div>
                  <div style={{fontSize:12,color:'var(--fg3)'}}>{evt.desc}</div>
                </div>
                <div>
                  <span style={{...priBadge(evt.priority), width:'auto', height:'auto', borderRadius:4,
                    background:evt.priority==='high'?'#EF444422':evt.priority==='medium'?'#F59E0B22':'#6B728022',
                    color:evt.priority==='high'?'#EF4444':evt.priority==='medium'?'#F59E0B':'#6B7280',
                    padding:'3px 8px', fontSize:10, fontWeight:700,
                    textTransform:'uppercase',letterSpacing:'0.06em', border:'none'}}>
                    {evt.priority}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── TOOLS PAGE (Position Sizing Calculator + Cost Basis P&L) ─────────────────

function ToolsPage() {
  const [tab, setTab] = React.useState('sizing');

  // Position Sizing Calculator state
  const [capital, setCapital]       = React.useState('100000');
  const [riskPct, setRiskPct]       = React.useState('1');
  const [entryPrice, setEntryPrice] = React.useState('');
  const [stopPrice, setStopPrice]   = React.useState('');
  const [targetPrice, setTargetPrice] = React.useState('');

  // Cost Basis / P&L state — load from backend
  const [positions, setPositions] = React.useState([]);
  React.useEffect(() => {
    fetch(`${API_URL}/positions`).then(r => r.ok ? r.json() : []).then(setPositions).catch(() => {});
  }, []);
  const [liveData, setLiveData] = React.useState({});
  const [loadingPL, setLoadingPL] = React.useState(true);

  React.useEffect(() => {
    if (tab !== 'pnl' || positions.length === 0) { setLoadingPL(false); return; }
    setLoadingPL(true);
    Promise.all(positions.map(p =>
      fetch(`${API_URL}/stocks/live/${p.ticker}`).then(r => r.ok ? r.json() : null).catch(() => null)
    )).then(results => {
      const map = {};
      positions.forEach((p, i) => { if (results[i]) map[p.ticker] = results[i]; });
      setLiveData(map);
      setLoadingPL(false);
    });
  }, [tab, positions.length]);

  // Sizing calc
  const capNum   = parseFloat(capital) || 0;
  const riskNum  = parseFloat(riskPct) || 0;
  const entryNum = parseFloat(entryPrice) || 0;
  const stopNum  = parseFloat(stopPrice) || 0;
  const targetNum = parseFloat(targetPrice) || 0;
  const riskDollar = capNum * (riskNum / 100);
  const riskPerShare = entryNum && stopNum ? Math.abs(entryNum - stopNum) : 0;
  const shares = riskPerShare > 0 ? Math.floor(riskDollar / riskPerShare) : 0;
  const positionValue = shares * entryNum;
  const positionPct   = capNum > 0 ? (positionValue / capNum) * 100 : 0;
  const rewardRisk    = targetNum && riskPerShare > 0
    ? Math.abs(targetNum - entryNum) / riskPerShare : 0;

  const inp = (val, set, placeholder, prefix='$') => (
    <div style={{flex:1}}>
      <div style={{fontSize:11,color:'var(--fg3)',marginBottom:5,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em'}}>{placeholder}</div>
      <div style={{position:'relative'}}>
        <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'var(--fg3)',fontSize:13}}>{prefix}</span>
        <input type="number" value={val} onChange={e=>set(e.target.value)} placeholder="0"
          style={{width:'100%',padding:'9px 10px 9px 24px',border:'1px solid var(--bdr)',borderRadius:8,
            fontSize:14,background:'var(--surf)',color:'var(--fg)',boxSizing:'border-box'}} />
      </div>
    </div>
  );

  const stat = (label, value, color='var(--fg)') => (
    <div style={{flex:1,background:'var(--surf)',borderRadius:10,padding:'14px 18px',minWidth:120}}>
      <div style={{fontSize:10,color:'var(--fg3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>{label}</div>
      <div style={{fontSize:22,fontWeight:800,color,fontFamily:'var(--font-mono)'}}>{value}</div>
    </div>
  );

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tools</h1>
          <p className="page-sub">Position sizing · cost basis · P&amp;L analysis</p>
        </div>
      </div>

      <div style={{display:'flex',gap:4,marginBottom:24,background:'var(--surf)',borderRadius:10,padding:4,width:'fit-content'}}>
        {[['sizing','Position Sizing'],['pnl','Cost Basis & P&L']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{padding:'7px 18px',borderRadius:7,border:'none',cursor:'pointer',fontSize:13,fontWeight:600,
              background:tab===id?'var(--surf2)':'transparent',
              color:tab===id?'var(--fg)':'var(--fg3)',transition:'all 0.15s'}}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'sizing' && (
        <div style={{display:'flex',flexDirection:'column',gap:16,maxWidth:640}}>
          <div className="card">
            <div style={{fontSize:12,color:'var(--fg3)',marginBottom:16,letterSpacing:'0.04em'}}>
              ACCOUNT SETTINGS
            </div>
            <div style={{display:'flex',gap:12}}>
              {inp(capital, setCapital, 'Account Capital')}
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:'var(--fg3)',marginBottom:5,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em'}}>Risk per Trade</div>
                <div style={{position:'relative'}}>
                  <input type="number" value={riskPct} onChange={e=>setRiskPct(e.target.value)} placeholder="1" step="0.1" min="0.1" max="10"
                    style={{width:'100%',padding:'9px 28px 9px 10px',border:'1px solid var(--bdr)',borderRadius:8,
                      fontSize:14,background:'var(--surf)',color:'var(--fg)',boxSizing:'border-box'}} />
                  <span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'var(--fg3)',fontSize:13}}>%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{fontSize:12,color:'var(--fg3)',marginBottom:16,letterSpacing:'0.04em'}}>TRADE DETAILS</div>
            <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
              {inp(entryPrice, setEntryPrice, 'Entry Price')}
              {inp(stopPrice, setStopPrice, 'Stop Loss')}
              {inp(targetPrice, setTargetPrice, 'Target Price')}
            </div>
          </div>

          {entryNum > 0 && stopNum > 0 && riskDollar > 0 && (
            <div className="card" style={{background:'var(--red-dim)',border:'1px solid var(--red)',borderRadius:12}}>
              <div style={{fontSize:12,color:'var(--red)',marginBottom:14,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase'}}>
                Calculated Position
              </div>
              <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                {stat('Shares to Buy', shares > 0 ? shares.toLocaleString() : '—')}
                {stat('Position Size', `$${positionValue.toLocaleString(undefined,{maximumFractionDigits:0})}`)}
                {stat('% of Portfolio', `${positionPct.toFixed(1)}%`, positionPct > 20 ? '#EF4444' : 'var(--fg)')}
                {targetNum > 0 && stat('Risk:Reward', rewardRisk > 0 ? `1:${rewardRisk.toFixed(1)}` : '—',
                  rewardRisk >= 2 ? '#22c55e' : rewardRisk >= 1 ? '#F59E0B' : '#EF4444')}
              </div>
              {positionPct > 25 && (
                <div style={{marginTop:12,padding:'8px 12px',background:'#EF444422',borderRadius:6,fontSize:12,color:'#EF4444'}}>
                  ⚠ Position exceeds 25% of portfolio — consider reducing size or risk %
                </div>
              )}
              {rewardRisk > 0 && rewardRisk < 1.5 && (
                <div style={{marginTop:8,padding:'8px 12px',background:'#F59E0B22',borderRadius:6,fontSize:12,color:'#F59E0B'}}>
                  ⚠ Risk:Reward below 1:1.5 — consider a better entry or wider target
                </div>
              )}
            </div>
          )}

          <div className="card" style={{fontSize:12,color:'var(--fg3)',lineHeight:1.6}}>
            <strong style={{color:'var(--fg)'}}>How it works:</strong> Risk dollar = Capital × Risk %.
            Shares = Risk Dollar ÷ |Entry − Stop|. This ensures each trade risks the same fixed % of your account,
            controlling drawdown regardless of volatility. Aim for R:R ≥ 2:1.
          </div>
        </div>
      )}

      {tab === 'pnl' && (
        <div>
          {loadingPL ? (
            <div className="card" style={{textAlign:'center',padding:40,color:'var(--fg3)'}}>Loading prices…</div>
          ) : positions.length === 0 ? (
            <div className="card" style={{textAlign:'center',padding:40}}>
              <div style={{fontSize:32,marginBottom:12}}>📊</div>
              <div style={{color:'var(--fg3)',fontSize:14}}>Add positions in the Portfolio tab to see P&L here</div>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {positions.map(p => {
                const live = liveData[p.ticker];
                const price    = live?.price || 0;
                const cost     = p.costBasis || 0;
                const shares   = p.shares || 0;
                const curVal   = price * shares;
                const costVal  = cost * shares;
                const pnlDol   = curVal - costVal;
                const pnlPct   = costVal > 0 ? (pnlDol / costVal) * 100 : 0;
                const dayChg   = (live?.change || 0) * shares;
                const isGain   = pnlDol >= 0;
                return (
                  <div key={p.ticker} className="card" style={{padding:'16px 20px'}}>
                    <div style={{display:'flex',alignItems:'flex-start',gap:16}}>
                      <div style={{width:44,height:44,borderRadius:10,background:'var(--red-dim)',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        color:'var(--red)',fontWeight:800,fontSize:12,fontFamily:'var(--font-mono)',flexShrink:0}}>
                        {p.ticker.slice(0,4)}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <span style={{fontWeight:700,fontSize:15}}>{p.ticker}</span>
                          <span style={{fontWeight:800,fontSize:16,color:isGain?'#22c55e':'#EF4444',fontFamily:'var(--font-mono)'}}>
                            {isGain?'+':''}{pnlDol >= 0?'':'-'}${Math.abs(pnlDol).toFixed(2)}
                          </span>
                        </div>
                        <div style={{display:'flex',gap:16,marginTop:8,flexWrap:'wrap'}}>
                          <div style={{fontSize:12,color:'var(--fg3)'}}>
                            <span style={{color:'var(--fg2)'}}>{shares} shares</span> @ ${cost.toFixed(2)} cost
                          </div>
                          <div style={{fontSize:12,color:'var(--fg3)'}}>
                            Current: <span style={{color:'var(--fg)'}}>${price.toFixed(2)}</span>
                          </div>
                          <div style={{fontSize:12,color:isGain?'#22c55e':'#EF4444',fontWeight:600}}>
                            {isGain?'+':''}{pnlPct.toFixed(2)}% total return
                          </div>
                          <div style={{fontSize:12,color:dayChg>=0?'#22c55e':'#EF4444'}}>
                            Today: {dayChg>=0?'+':''}{dayChg.toFixed(2)}
                          </div>
                        </div>
                        {/* P&L bar */}
                        <div style={{marginTop:10,height:4,background:'var(--surf)',borderRadius:2,overflow:'hidden'}}>
                          <div style={{height:'100%',borderRadius:2,width:`${Math.min(Math.abs(pnlPct),100)}%`,
                            background:isGain?'#22c55e':'#EF4444',transition:'width 0.5s'}} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Summary */}
              {(() => {
                const totalCost = positions.reduce((s,p) => s + (p.costBasis||0)*p.shares, 0);
                const totalVal  = positions.reduce((s,p) => {
                  const live = liveData[p.ticker];
                  return s + (live?.price||0)*p.shares;
                }, 0);
                const totalPnl  = totalVal - totalCost;
                const totalPct  = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
                const isG = totalPnl >= 0;
                return (
                  <div className="card" style={{background:isG?'#0f2218':'#1f0f0f',
                    border:`1px solid ${isG?'#22c55e33':'#ef444433'}`,padding:'16px 20px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <div style={{fontSize:11,color:'var(--fg3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>Total Portfolio P&L</div>
                        <div style={{fontSize:11,color:'var(--fg3)'}}>Cost basis: ${totalCost.toLocaleString(undefined,{maximumFractionDigits:0})} · Market value: ${totalVal.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:24,fontWeight:800,color:isG?'#22c55e':'#EF4444',fontFamily:'var(--font-mono)'}}>
                          {isG?'+':''}{totalPct.toFixed(2)}%
                        </div>
                        <div style={{fontSize:14,color:isG?'#22c55e':'#EF4444',fontFamily:'var(--font-mono)'}}>
                          {isG?'+':''}{totalPnl >= 0 ? '' : '-'}${Math.abs(totalPnl).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ANALYTICS PAGE (Correlation Heatmap + Unusual Volume) ────────────────────

function AnalyticsPage() {
  const [tab, setTab]             = React.useState('heatmap');
  const [matrix, setMatrix]       = React.useState(null);
  const [tickers, setTickers]     = React.useState([]);
  const [loadingHM, setLoadingHM] = React.useState(false);
  const [customTickers, setCustomTickers] = React.useState('NVDA,AAPL,MSFT,GOOGL,TSLA,AMD,META,AMZN');
  const [unusual, setUnusual]     = React.useState([]);
  const [loadingUV, setLoadingUV] = React.useState(true);

  // Load unusual volume immediately
  React.useEffect(() => {
    fetch(`${API_URL}/analytics/unusual-volume`)
      .then(r => r.ok ? r.json() : { unusual: [] })
      .then(d => { setUnusual(d.unusual || []); setLoadingUV(false); })
      .catch(() => setLoadingUV(false));
  }, []);

  function fetchCorrelation() {
    setLoadingHM(true);
    setMatrix(null);
    fetch(`${API_URL}/analytics/correlation?tickers=${encodeURIComponent(customTickers)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.matrix) { setMatrix(d.matrix); setTickers(d.tickers); }
        setLoadingHM(false);
      })
      .catch(() => setLoadingHM(false));
  }

  // Color for correlation value
  function corrColor(v) {
    if (v === undefined || v === null) return 'var(--surf)';
    const abs = Math.abs(v);
    if (v > 0) {
      const g = Math.round(34 + (34 * abs)), b = Math.round(34 + (34 * abs));
      const r = Math.round(34 + abs * 188);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      const r = Math.round(34 + (34 * abs)), g = Math.round(34 + (34 * abs));
      const b = Math.round(34 + abs * 100);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }

  function corrColorNew(v) {
    if (v >= 0.7) return '#22c55e';
    if (v >= 0.3) return '#a3e635';
    if (v >= 0)   return '#fbbf24';
    if (v >= -0.3) return '#f97316';
    return '#ef4444';
  }

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-sub">Correlation heatmap · unusual volume</p>
        </div>
      </div>

      <div style={{display:'flex',gap:4,marginBottom:24,background:'var(--surf)',borderRadius:10,padding:4,width:'fit-content'}}>
        {[['heatmap','Correlation Heatmap'],['unusual','Unusual Volume']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{padding:'7px 18px',borderRadius:7,border:'none',cursor:'pointer',fontSize:13,fontWeight:600,
              background:tab===id?'var(--surf2)':'transparent',
              color:tab===id?'var(--fg)':'var(--fg3)',transition:'all 0.15s'}}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'heatmap' && (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="card" style={{display:'flex',gap:12,alignItems:'center'}}>
            <input
              value={customTickers}
              onChange={e => setCustomTickers(e.target.value)}
              placeholder="NVDA,AAPL,MSFT,AMZN (up to 10)"
              style={{flex:1,padding:'9px 12px',border:'1px solid var(--bdr)',borderRadius:8,
                fontSize:13,background:'var(--surf)',color:'var(--fg)'}}
            />
            <button onClick={fetchCorrelation} disabled={loadingHM}
              style={{padding:'9px 20px',background:'var(--red)',color:'white',border:'none',borderRadius:8,
                fontSize:13,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
              {loadingHM ? 'Loading…' : 'Compute'}
            </button>
          </div>

          {!matrix && !loadingHM && (
            <div className="card" style={{textAlign:'center',padding:40}}>
              <div style={{fontSize:32,marginBottom:12}}>📊</div>
              <div style={{color:'var(--fg3)',fontSize:14}}>Enter tickers and click Compute to generate the 60-day correlation matrix</div>
            </div>
          )}

          {loadingHM && (
            <div className="card" style={{textAlign:'center',padding:40,color:'var(--fg3)'}}>
              Fetching 60-day price history for {customTickers.split(',').length} stocks…
            </div>
          )}

          {matrix && tickers.length > 0 && (
            <div className="card">
              <div style={{overflowX:'auto'}}>
                <table style={{borderCollapse:'collapse',fontFamily:'var(--font-mono)',fontSize:11}}>
                  <thead>
                    <tr>
                      <th style={{padding:'6px 8px',color:'var(--fg3)',textAlign:'left',minWidth:60}}></th>
                      {tickers.map(t => (
                        <th key={t} style={{padding:'6px 8px',color:'var(--fg3)',fontWeight:700,textAlign:'center',minWidth:55}}>{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tickers.map(row => (
                      <tr key={row}>
                        <td style={{padding:'6px 8px',fontWeight:700,color:'var(--fg)',fontSize:11}}>{row}</td>
                        {tickers.map(col => {
                          const v = matrix[row]?.[col];
                          const isD = row === col;
                          return (
                            <td key={col} style={{padding:'6px 4px',textAlign:'center'}}>
                              <div style={{
                                width:50,height:32,borderRadius:5,
                                background:isD?'var(--red-dim)':
                                  v >= 0.7 ? '#22c55e33' :
                                  v >= 0.3 ? '#a3e63533' :
                                  v >= 0   ? '#fbbf2422' :
                                  v >= -0.3? '#f9731622' : '#ef444433',
                                display:'flex',alignItems:'center',justifyContent:'center',
                                color:isD?'var(--red)':corrColorNew(v),
                                fontWeight:700,fontSize:11,
                              }}>
                                {v != null ? (isD ? '1.00' : v.toFixed(2)) : '—'}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Legend */}
              <div style={{display:'flex',gap:16,marginTop:16,flexWrap:'wrap',fontSize:11,color:'var(--fg3)'}}>
                {[['#22c55e33','#22c55e','≥ 0.70 Strong positive'],['#a3e63533','#a3e635','0.30–0.70 Moderate'],
                  ['#fbbf2422','#fbbf24','0–0.30 Weak/None'],['#ef444433','#ef4444','< 0 Negative']].map(([bg,c,label]) => (
                  <div key={label} style={{display:'flex',alignItems:'center',gap:6}}>
                    <div style={{width:24,height:16,borderRadius:3,background:bg,border:`1px solid ${c}44`}} />
                    <span style={{color:c}}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'unusual' && (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div className="card" style={{padding:'12px 16px',background:'var(--surf)',fontSize:12,color:'var(--fg3)'}}>
            Stocks trading at ≥1.3× average volume from portfolio watchlist. Updates every 5 min.
            <span style={{marginLeft:8,color:'var(--fg3)',fontSize:11}}>
              Note: Dark pool flow data requires premium data subscriptions (CBOE, Unusual Whales).
              Volume ratios shown here use standard exchange data.
            </span>
          </div>
          {loadingUV ? (
            <div className="card" style={{textAlign:'center',padding:40,color:'var(--fg3)'}}>Loading…</div>
          ) : unusual.length === 0 ? (
            <div className="card" style={{textAlign:'center',padding:40}}>
              <div style={{fontSize:32,marginBottom:12}}>📈</div>
              <div style={{color:'var(--fg3)',fontSize:14}}>No unusual volume detected in portfolio stocks right now</div>
            </div>
          ) : (
            unusual.map(s => {
              const up = (s.changePercent||0) >= 0;
              const ratioColor = s.ratio >= 3 ? '#EF4444' : s.ratio >= 2 ? '#F59E0B' : '#22c55e';
              return (
                <div key={s.symbol} className="card" style={{padding:'14px 18px',display:'flex',gap:16,alignItems:'center'}}>
                  <div style={{width:44,height:44,borderRadius:10,background:'var(--red-dim)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    color:'var(--red)',fontWeight:800,fontSize:12,fontFamily:'var(--font-mono)',flexShrink:0}}>
                    {s.symbol.slice(0,4)}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                      <span style={{fontWeight:700,fontSize:15}}>{s.symbol}</span>
                      <span style={{fontWeight:700,fontSize:15,color:up?'#22c55e':'#EF4444',fontFamily:'var(--font-mono)'}}>
                        ${(s.price||0).toFixed(2)} <span style={{fontSize:12}}>{up?'+':''}{(s.changePercent||0).toFixed(2)}%</span>
                      </span>
                    </div>
                    <div style={{display:'flex',gap:12,fontSize:12,color:'var(--fg3)'}}>
                      <span>Vol: <strong style={{color:'var(--fg)'}}>{s.volume?.toLocaleString()}</strong></span>
                      <span>Avg: <strong style={{color:'var(--fg)'}}>{s.avgVolume?.toLocaleString()}</strong></span>
                      <span style={{color:ratioColor,fontWeight:700}}>{s.ratio.toFixed(1)}× avg</span>
                    </div>
                  </div>
                  <div style={{textAlign:'center',background:ratioColor+'22',border:`1px solid ${ratioColor}44`,
                    borderRadius:8,padding:'8px 14px'}}>
                    <div style={{fontSize:18,fontWeight:800,color:ratioColor,fontFamily:'var(--font-mono)'}}>{s.ratio.toFixed(1)}×</div>
                    <div style={{fontSize:10,color:'var(--fg3)',fontWeight:600}}>VOLUME</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── PUSH NOTIFICATIONS SETTINGS ─────────────────────────────────────────────

function PushSettingsPage() {
  const [status, setStatus]         = React.useState('idle'); // idle | requesting | subscribed | denied | unsupported
  const [vapidKey, setVapidKey]     = React.useState(null);
  const [email, setEmail]           = React.useState('');
  const [emailSaved, setEmailSaved] = React.useState(false);

  React.useEffect(() => {
    // Check existing subscription
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported'); return;
    }
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => {
      if (sub) setStatus('subscribed');
    });
    // Fetch VAPID public key
    fetch(`${API_URL}/push/vapid-public`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.key) setVapidKey(d.key); })
      .catch(() => {});
  }, []);

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  async function subscribe() {
    if (!vapidKey) { alert('Push notifications not configured on server (VAPID keys missing)'); return; }
    setStatus('requesting');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setStatus('denied'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      await fetch(`${API_URL}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      setStatus('subscribed');
    } catch (err) {
      console.error('Push subscribe error:', err);
      setStatus('idle');
      alert('Could not subscribe: ' + err.message);
    }
  }

  async function unsubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`${API_URL}/push/subscribe`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('idle');
    } catch (err) {
      alert('Could not unsubscribe: ' + err.message);
    }
  }

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-sub">Push alerts · daily email digest</p>
        </div>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:16,maxWidth:560}}>
        {/* Push Notifications */}
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
            <div>
              <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Browser Push Notifications</div>
              <div style={{fontSize:12,color:'var(--fg3)'}}>Receive real-time alerts when price targets are hit</div>
            </div>
            <div style={{width:10,height:10,borderRadius:'50%',marginTop:4,
              background:status==='subscribed'?'#22c55e':status==='denied'?'#EF4444':'#6B7280'}} />
          </div>

          {status === 'unsupported' && (
            <div style={{padding:'12px',background:'#F59E0B22',borderRadius:8,fontSize:13,color:'#F59E0B'}}>
              Your browser doesn't support push notifications. Try Chrome or Firefox.
            </div>
          )}
          {status === 'subscribed' && (
            <div>
              <div style={{padding:'10px 14px',background:'#22c55e22',borderRadius:8,fontSize:13,color:'#22c55e',marginBottom:12}}>
                ✓ Push notifications are active on this device
              </div>
              <button onClick={unsubscribe}
                style={{padding:'8px 16px',background:'var(--surf)',color:'var(--fg3)',border:'1px solid var(--bdr)',borderRadius:8,fontSize:13,cursor:'pointer'}}>
                Unsubscribe
              </button>
            </div>
          )}
          {status === 'denied' && (
            <div style={{padding:'12px',background:'#EF444422',borderRadius:8,fontSize:13,color:'#EF4444'}}>
              Notifications blocked. Enable them in your browser settings → Site permissions.
            </div>
          )}
          {(status === 'idle' || status === 'requesting') && status !== 'unsupported' && (
            <button onClick={subscribe} disabled={status==='requesting'}
              style={{padding:'10px 20px',background:'var(--red)',color:'white',border:'none',borderRadius:8,
                fontSize:13,fontWeight:600,cursor:'pointer'}}>
              {status === 'requesting' ? 'Requesting permission…' : 'Enable Push Notifications'}
            </button>
          )}

          {!vapidKey && status !== 'unsupported' && (
            <div style={{marginTop:12,padding:'10px 14px',background:'var(--surf)',borderRadius:8,fontSize:12,color:'var(--fg3)'}}>
              To enable push notifications, set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in your Render environment variables.
              Generate keys with: <code style={{fontFamily:'var(--font-mono)',color:'var(--fg)'}}>web-push generate-vapid-keys</code>
            </div>
          )}
        </div>

        {/* Email Digest */}
        <div className="card">
          <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Daily Email Digest</div>
          <div style={{fontSize:12,color:'var(--fg3)',marginBottom:16}}>
            Sent weekdays at 7am ET — portfolio summary, top movers, upcoming events
          </div>
          <div style={{padding:'12px 14px',background:'var(--surf)',borderRadius:8,fontSize:12,color:'var(--fg3)',lineHeight:1.6}}>
            Configure in Render environment variables:<br/>
            <code style={{fontFamily:'var(--font-mono)',color:'var(--fg)'}}>EMAIL_FROM</code> — sender Gmail address<br/>
            <code style={{fontFamily:'var(--font-mono)',color:'var(--fg)'}}>EMAIL_PASS</code> — Gmail App Password<br/>
            <code style={{fontFamily:'var(--font-mono)',color:'var(--fg)'}}>EMAIL_TO</code> — recipient email address
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── NETWORKING PAGE (Spider Web Graph + List View) ──────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// Build edges between contacts that share company / school / location
function buildEdges(contacts, filters = { company: true, school: true, location: false }) {
  // Group contacts by field, then connect pairs — but cap group size to prevent hairballs
  function groupEdges(field, type, color, maxGroupSize) {
    if (!filters[type]) return [];
    const groups = {};
    for (const c of contacts) {
      const key = c[field]?.trim()?.toLowerCase();
      if (!key) continue;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c.id);
    }
    const edges = [], seen = new Set();
    for (const members of Object.values(groups)) {
      if (members.length < 2 || members.length > maxGroupSize) continue;
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const k = [members[i], members[j]].sort().join('|');
          if (!seen.has(k)) { seen.add(k); edges.push({ source: members[i], target: members[j], type, color }); }
        }
      }
    }
    return edges;
  }
  return [
    ...groupEdges('company',  'company',  '#4a9eff', 12),  // up to 12 per company
    ...groupEdges('school',   'school',   '#4ade80', 12),  // up to 12 per school
    ...groupEdges('location', 'location', '#fbbf24',  6),  // cap at 6 for location (off by default)
  ];
}

function NetworkGraph({ contacts, onSelectNode, selectedId, edgeFilters }) {
  const containerRef = React.useRef(null);
  const svgRef       = React.useRef(null);
  const animRef      = React.useRef(null);
  const dragRef      = React.useRef(null);   // { id, offsetX, offsetY }
  const panRef       = React.useRef(null);   // { startX, startY, tx, ty }
  const nodesRef     = React.useRef([]);

  const [nodes,     setNodes]     = React.useState([]);
  const [edges,     setEdges]     = React.useState([]);
  const [transform, setTransform] = React.useState({ x: 0, y: 0, k: 1 });
  const [size,      setSize]      = React.useState({ w: 800, h: 560 });

  // Measure container
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Build graph when contacts change
  React.useEffect(() => {
    if (contacts.length === 0) { setNodes([]); setEdges([]); return; }
    const { w, h } = size;
    const cx = w / 2, cy = h / 2;
    const r  = Math.min(w, h) * 0.28;
    const n  = contacts.map((c, i) => {
      const angle = (i / contacts.length) * 2 * Math.PI;
      return {
        id: c.id, label: c.name, company: c.company,
        school: c.school, location: c.location,
        x: cx + r * Math.cos(angle) + (Math.random() - 0.5) * 60,
        y: cy + r * Math.sin(angle) + (Math.random() - 0.5) * 60,
        vx: 0, vy: 0,
      };
    });
    const e = buildEdges(contacts, edgeFilters);
    nodesRef.current = n;
    setNodes([...n]);
    setEdges(e);
  }, [contacts.length, size.w, JSON.stringify(edgeFilters)]);

  // Force simulation
  React.useEffect(() => {
    if (nodes.length === 0) return;
    let frame = 0;
    let running = true;
    const simEdges = buildEdges(contacts, edgeFilters);
    const simNodes = nodesRef.current.map(n => ({ ...n }));

    function tick() {
      if (!running || frame > 500) return;
      frame++;
      const { w, h } = size;
      // Stronger repulsion + longer springs = much more spread out
      const repulsion = 9000, springLen = 220, springK = 0.018, damping = 0.74, gravity = 0.006;
      const cx = w / 2, cy = h / 2;
      const deg = {};
      for (const e of simEdges) { deg[e.source] = (deg[e.source]||0)+1; deg[e.target] = (deg[e.target]||0)+1; }

      for (let i = 0; i < simNodes.length; i++) {
        const ni = simNodes[i];
        if (dragRef.current?.id === ni.id) continue;
        let fx = 0, fy = 0;

        for (let j = 0; j < simNodes.length; j++) {
          if (i === j) continue;
          const nj = simNodes[j];
          const dx = ni.x - nj.x || 0.01, dy = ni.y - nj.y || 0.01;
          const d2 = dx*dx + dy*dy, d = Math.sqrt(d2) || 1;
          const f = repulsion / d2;
          fx += (dx/d)*f; fy += (dy/d)*f;
        }
        for (const e of simEdges) {
          if (e.source !== ni.id && e.target !== ni.id) continue;
          const otherId = e.source === ni.id ? e.target : e.source;
          const nj = simNodes.find(n => n.id === otherId);
          if (!nj) continue;
          const dx = nj.x-ni.x, dy = nj.y-ni.y;
          const d = Math.sqrt(dx*dx+dy*dy)||1;
          const stretch = (d - springLen) * springK;
          fx += (dx/d)*stretch; fy += (dy/d)*stretch;
        }
        fx += (cx - ni.x) * gravity;
        fy += (cy - ni.y) * gravity;
        ni.vx = (ni.vx + fx) * damping;
        ni.vy = (ni.vy + fy) * damping;
        ni.x = Math.max(60, Math.min(w-60, ni.x + ni.vx));
        ni.y = Math.max(40, Math.min(h-40, ni.y + ni.vy));
      }
      nodesRef.current = simNodes;
      setNodes([...simNodes]);
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [contacts.length]);

  // Degree map for node sizing
  const degree = {};
  for (const e of edges) { degree[e.source]=(degree[e.source]||0)+1; degree[e.target]=(degree[e.target]||0)+1; }

  // Node color: dominant edge type → color, isolated → dim gray
  function nodeColor(nodeId, isSelected) {
    if (isSelected) return '#E0001E';
    const ne = edges.filter(e => e.source===nodeId||e.target===nodeId);
    if (ne.length === 0) return '#4a4a5a';
    const types = ne.map(e=>e.type);
    const dominant = ['company','school','location'].find(t=>types.includes(t)) || types[0];
    return dominant==='company'?'#4a9eff':dominant==='school'?'#4ade80':'#fbbf24';
  }

  // Node radius: 4px base, +2px per connection, max 10
  function nodeRadius(nodeId) {
    const d = degree[nodeId] || 0;
    return Math.min(4 + d * 2, 12);
  }

  // ── Pointer interactions ──────────────────────────────────────────────────────

  // Convert screen coords → SVG world coords
  function screenToWorld(cx, cy) {
    const { x, y, k } = transform;
    return { wx: (cx - x) / k, wy: (cy - y) / k };
  }

  function getClientXY(e) {
    if (e.touches) return { cx: e.touches[0].clientX, cy: e.touches[0].clientY };
    return { cx: e.clientX, cy: e.clientY };
  }

  function svgClientOffset(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const { cx, cy } = getClientXY(e);
    return { cx: cx - rect.left, cy: cy - rect.top };
  }

  function onNodePointerDown(e, nodeId) {
    e.stopPropagation();
    e.preventDefault();
    const { cx, cy } = svgClientOffset(e);
    const { wx, wy } = screenToWorld(cx, cy);
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;
    dragRef.current = { id: nodeId, dx: wx - node.x, dy: wy - node.y };

    function onMove(ev) {
      const { cx: mx, cy: my } = svgClientOffset(ev);
      const { wx: wx2, wy: wy2 } = screenToWorld(mx, my);
      nodesRef.current = nodesRef.current.map(n =>
        n.id === nodeId ? { ...n, x: wx2 - dragRef.current.dx, y: wy2 - dragRef.current.dy, vx: 0, vy: 0 } : n
      );
      setNodes([...nodesRef.current]);
    }
    function onUp(ev) {
      // If barely moved → treat as click (select)
      const { cx: ux, cy: uy } = svgClientOffset(ev);
      const { wx: wx2, wy: wy2 } = screenToWorld(ux, uy);
      const node2 = nodesRef.current.find(n => n.id === nodeId);
      if (node2 && Math.hypot(wx2-node2.x, wy2-node2.y) < 6) {
        onSelectNode(nodeId === selectedId ? null : nodeId);
      }
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }

  function onSvgPointerDown(e) {
    if (e.target !== svgRef.current && e.target.closest('g[data-node]')) return;
    const { cx, cy } = svgClientOffset(e);
    panRef.current = { startX: cx, startY: cy, tx: transform.x, ty: transform.y };

    function onMove(ev) {
      if (!panRef.current) return;
      const { cx: mx, cy: my } = svgClientOffset(ev);
      setTransform(t => ({ ...t, x: panRef.current.tx + (mx - panRef.current.startX), y: panRef.current.ty + (my - panRef.current.startY) }));
    }
    function onUp() {
      panRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }

  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.88;
    const { cx, cy } = svgClientOffset(e);
    setTransform(t => {
      const k2 = Math.max(0.15, Math.min(5, t.k * factor));
      // Zoom toward cursor
      const x2 = cx - (cx - t.x) * (k2 / t.k);
      const y2 = cy - (cy - t.y) * (k2 / t.k);
      return { x: x2, y: y2, k: k2 };
    });
  }

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const selected = contacts.find(c => c.id === selectedId);

  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Graph canvas */}
      <div ref={containerRef} style={{ width: '100%', height: 520, borderRadius: 12, overflow: 'hidden', background: '#0d0d12', position: 'relative' }}>
        <svg ref={svgRef} width="100%" height="100%"
          style={{ display: 'block', cursor: 'grab', touchAction: 'none', userSelect: 'none' }}
          onMouseDown={onSvgPointerDown}
          onTouchStart={onSvgPointerDown}
          onWheel={onWheel}>

          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {/* Edges — straight, thin, colored */}
            {edges.map((e, i) => {
              const s = nodeMap[e.source], t = nodeMap[e.target];
              if (!s || !t) return null;
              const isConnectedToSelected = selectedId && (e.source===selectedId||e.target===selectedId);
              return (
                <line key={i}
                  x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  stroke={e.color}
                  strokeWidth={isConnectedToSelected ? 1.2 : 0.6}
                  strokeOpacity={isConnectedToSelected ? 0.8 : 0.3}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map(n => {
              const isSelected  = n.id === selectedId;
              const r           = nodeRadius(n.id);
              const color       = nodeColor(n.id, isSelected);
              const isConnected = selectedId && edges.some(e => (e.source===n.id||e.target===n.id) && (e.source===selectedId||e.target===selectedId));
              const dimmed      = selectedId && !isSelected && !isConnected;
              return (
                <g key={n.id} data-node="1"
                  onMouseDown={ev => onNodePointerDown(ev, n.id)}
                  onTouchStart={ev => onNodePointerDown(ev, n.id)}
                  style={{ cursor: 'pointer', opacity: dimmed ? 0.3 : 1 }}>

                  {/* Glow behind selected/connected nodes */}
                  {(isSelected || isConnected) && (
                    <circle cx={n.x} cy={n.y} r={r + 6}
                      fill={color} fillOpacity={isSelected ? 0.25 : 0.12} />
                  )}

                  {/* Node dot */}
                  <circle cx={n.x} cy={n.y} r={r}
                    fill={color}
                    fillOpacity={isSelected ? 1 : 0.85}
                  />

                  {/* Label — floats to the right of the dot */}
                  <text x={n.x + r + 5} y={n.y}
                    dominantBaseline="central"
                    fontSize={Math.min(10 + r * 0.3, 12)}
                    fontFamily="'Space Grotesk',system-ui,sans-serif"
                    fontWeight={isSelected ? 700 : 400}
                    fill={isSelected ? '#fff' : dimmed ? '#555' : '#aaa'}
                    style={{ pointerEvents: 'none' }}>
                    {n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Legend overlay */}
        <div style={{ position:'absolute', bottom:10, left:12, display:'flex', gap:12, pointerEvents:'none' }}>
          {[['#4a9eff','Company'],['#4ade80','School'],['#fbbf24','Location']].map(([c,l]) => (
            <div key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'#666', fontFamily:'var(--font-mono)' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:c }} />
              {l}
            </div>
          ))}
        </div>

        {/* Zoom hint */}
        <div style={{ position:'absolute', bottom:10, right:12, fontSize:10, color:'#444', fontFamily:'var(--font-mono)', pointerEvents:'none' }}>
          scroll to zoom · drag to pan
        </div>

        {/* Zoom controls */}
        <div style={{ position:'absolute', top:10, right:12, display:'flex', flexDirection:'column', gap:4 }}>
          {[['＋', 1.25], ['−', 0.8], ['⊙', null]].map(([label, factor]) => (
            <button key={label} onClick={() => {
              if (!factor) { setTransform({ x: 0, y: 0, k: 1 }); return; }
              setTransform(t => ({ x: t.x, y: t.y, k: Math.max(0.15, Math.min(5, t.k * factor)) }));
            }} style={{ width:28, height:28, background:'#1a1a24', border:'1px solid #2a2a38', borderRadius:6, color:'#aaa', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Selected contact detail */}
      {selected && (
        <div style={{ marginTop:10, padding:'12px 16px', background:'var(--surf)', borderRadius:10, border:'1px solid var(--bdr)', display:'flex', gap:12, alignItems:'flex-start' }}>
          <div style={{ width:38, height:38, borderRadius:'50%', background:'var(--red-dim)', color:'var(--red)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-mono)', fontWeight:800, fontSize:12, flexShrink:0 }}>
            {initials(selected.name)}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:3 }}>{selected.name}</div>
            {selected.role && <div style={{ fontSize:12, color:'var(--fg3)', marginBottom:6 }}>{selected.role}</div>}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {selected.company  && <span style={{ fontSize:11, padding:'2px 7px', background:'#4a9eff22', color:'#4a9eff', border:'1px solid #4a9eff44', borderRadius:4 }}>🏢 {selected.company}</span>}
              {selected.school   && <span style={{ fontSize:11, padding:'2px 7px', background:'#4ade8022', color:'#4ade80', border:'1px solid #4ade8044', borderRadius:4 }}>🎓 {selected.school}</span>}
              {selected.location && <span style={{ fontSize:11, padding:'2px 7px', background:'#fbbf2422', color:'#fbbf24', border:'1px solid #fbbf2444', borderRadius:4 }}>📍 {selected.location}</span>}
            </div>
            {selected.notes && <div style={{ fontSize:11, color:'var(--fg3)', marginTop:6, fontStyle:'italic' }}>{selected.notes}</div>}
          </div>
          <button onClick={() => onSelectNode(null)} style={{ color:'var(--fg3)', background:'none', border:'none', fontSize:16, cursor:'pointer', padding:4 }}>✕</button>
        </div>
      )}
    </div>
  );
}

function NetworkingPage() {
  const [contacts, setContacts]     = React.useState([]);
  const [view, setView]             = React.useState('graph');
  const [showAdd, setShowAdd]       = React.useState(false);
  const [selectedId, setSelectedId] = React.useState(null);
  const [loadingNet, setLoadingNet] = React.useState(true);
  const [form, setForm]             = React.useState({ name: '', role: '', company: '', school: '', location: '', linkedIn: '', notes: '' });
  const [editing, setEditing]       = React.useState(null); // contact being edited
  const [editForm, setEditForm]     = React.useState({});
  const [edgeFilters, setEdgeFilters] = React.useState({ company: true, school: true, location: false });

  // Load from backend
  React.useEffect(() => {
    fetch(`${API_URL}/contacts`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        // Normalize: backend uses _id, graph uses id
        setContacts(data.map(c => ({ ...c, id: c._id })));
        setLoadingNet(false);
      })
      .catch(() => setLoadingNet(false));
  }, []);

  function addContact(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    fetch(`${API_URL}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
      .then(r => r.ok ? r.json() : null)
      .then(saved => {
        if (saved) setContacts(p => [...p, { ...saved, id: saved._id }]);
        setForm({ name: '', role: '', company: '', school: '', location: '', linkedIn: '', notes: '' });
        setShowAdd(false);
      })
      .catch(() => {});
  }

  function removeContact(id) {
    fetch(`${API_URL}/contacts/${id}`, { method: 'DELETE' }).catch(() => {});
    setContacts(p => p.filter(c => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function startEdit(contact) {
    setEditing(contact);
    setEditForm({ name: contact.name || '', role: contact.role || '', company: contact.company || '', school: contact.school || '', location: contact.location || '', linkedIn: contact.linkedIn || '', notes: contact.notes || '' });
  }

  function saveEdit(e) {
    e.preventDefault();
    if (!editForm.name.trim() || !editing) return;
    fetch(`${API_URL}/contacts/${editing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
      .then(r => r.ok ? r.json() : null)
      .then(saved => {
        if (saved) {
          setContacts(p => p.map(c => c.id === editing.id ? { ...saved, id: saved._id } : c));
        }
        setEditing(null);
      })
      .catch(() => setEditing(null));
  }

  const selected = contacts.find(c => c.id === selectedId);
  const edges     = buildEdges(contacts, edgeFilters);

  // Group contacts by company / school / location
  function groupBy(field) {
    const groups = {};
    for (const c of contacts) {
      const key = c[field]?.trim() || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }

  const fieldInput = (label, field, placeholder) => (
    <div>
      <div style={{ fontSize: 11, color: 'var(--fg3)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <input value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} placeholder={placeholder}
        style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--bdr)', borderRadius: 8, fontSize: 13, background: 'var(--surf)', color: 'var(--fg)', boxSizing: 'border-box' }} />
    </div>
  );

  const editFieldInput = (label, field, placeholder) => (
    <div>
      <div style={{ fontSize: 11, color: 'var(--fg3)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <input value={editForm[field] || ''} onChange={e => setEditForm(p => ({ ...p, [field]: e.target.value }))} placeholder={placeholder}
        style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--bdr)', borderRadius: 8, fontSize: 13, background: 'var(--surf)', color: 'var(--fg)', boxSizing: 'border-box' }} />
    </div>
  );

  return (
    <div className="page-root">
      {/* Edit Modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--bdr)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Edit Contact</div>
              <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--fg3)' }}>✕</button>
            </div>
            <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {editFieldInput('Name *', 'name', 'Full name')}
                {editFieldInput('Role', 'role', 'e.g. Partner at a16z')}
                {editFieldInput('Company', 'company', 'Current employer')}
                {editFieldInput('School', 'school', 'e.g. Wharton')}
                {editFieldInput('Location', 'location', 'e.g. San Francisco')}
                {editFieldInput('LinkedIn', 'linkedIn', 'URL or username')}
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--fg3)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes</div>
                <textarea value={editForm.notes || ''} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} placeholder="How you met, context, follow-ups…" rows={2}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--bdr)', borderRadius: 8, fontSize: 13, background: 'var(--surf)', color: 'var(--fg)', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setEditing(null)}
                  style={{ padding: '9px 18px', background: 'transparent', color: 'var(--fg3)', border: '1px solid var(--bdr)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button type="submit"
                  style={{ padding: '9px 20px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Network</h1>
          <p className="page-sub">{contacts.length} contacts · {edges.length} connections</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Edge filters — only shown in graph view */}
          {view === 'graph' && (
            <div style={{ display: 'flex', gap: 4 }}>
              {[['company','Co.','#4a9eff'], ['school','School','#4ade80'], ['location','City','#fbbf24']].map(([type, label, color]) => (
                <button key={type} onClick={() => setEdgeFilters(f => ({ ...f, [type]: !f[type] }))}
                  style={{ padding: '5px 9px', borderRadius: 6, border: `1px solid ${edgeFilters[type] ? color : 'var(--bdr)'}`,
                    background: edgeFilters[type] ? `${color}22` : 'var(--surf)', color: edgeFilters[type] ? color : 'var(--fg3)',
                    cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all 0.15s' }}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {/* View toggle */}
          <div style={{ display: 'flex', background: 'var(--surf)', borderRadius: 8, padding: 3, border: '1px solid var(--bdr)' }}>
            {[['graph', '⬡'], ['list', '≡']].map(([v, icon]) => (
              <button key={v} onClick={() => setView(v)}
                style={{ padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14,
                  background: view === v ? 'var(--surf2)' : 'transparent', color: view === v ? 'var(--fg)' : 'var(--fg3)' }}>
                {icon}
              </button>
            ))}
          </div>
          <button onClick={() => setShowAdd(o => !o)}
            style={{ padding: '7px 14px', background: showAdd ? 'var(--surf2)' : 'var(--red)', color: showAdd ? 'var(--fg)' : 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {showAdd ? '✕' : '+ Add'}
          </button>
        </div>
      </div>

      {/* Add Contact Form */}
      {showAdd && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: 'var(--fg)' }}>New Contact</div>
          <form onSubmit={addContact} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {fieldInput('Name *', 'name', 'Full name')}
              {fieldInput('Role', 'role', 'e.g. Partner at a16z')}
              {fieldInput('Company', 'company', 'Current employer')}
              {fieldInput('School', 'school', 'e.g. Wharton')}
              {fieldInput('Location', 'location', 'e.g. San Francisco')}
              {fieldInput('LinkedIn', 'linkedIn', 'URL or username')}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg3)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes</div>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="How you met, context, follow-ups…" rows={2}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--bdr)', borderRadius: 8, fontSize: 13, background: 'var(--surf)', color: 'var(--fg)', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" style={{ padding: '9px 20px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Add to Network
              </button>
            </div>
          </form>
        </div>
      )}

      {contacts.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🕸</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Build your network graph</div>
          <div style={{ color: 'var(--fg3)', fontSize: 13, maxWidth: 320, margin: '0 auto' }}>
            Add contacts and the graph will automatically connect people who share companies, schools, or locations.
          </div>
        </div>
      )}

      {contacts.length > 0 && view === 'graph' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <NetworkGraph contacts={contacts} onSelectNode={setSelectedId} selectedId={selectedId} edgeFilters={edgeFilters} />

          {/* Selected contact detail card */}
          {selected && (
            <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--red-dim)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                {initials(selected.name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{selected.name}</div>
                {selected.role && <div style={{ fontSize: 12, color: 'var(--fg3)', marginBottom: 6 }}>{selected.role}</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selected.company && <span style={{ fontSize: 11, padding: '2px 8px', background: '#3B82F622', color: '#3B82F6', border: '1px solid #3B82F644', borderRadius: 4 }}>🏢 {selected.company}</span>}
                  {selected.school  && <span style={{ fontSize: 11, padding: '2px 8px', background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', borderRadius: 4 }}>🎓 {selected.school}</span>}
                  {selected.location && <span style={{ fontSize: 11, padding: '2px 8px', background: '#F59E0B22', color: '#F59E0B', border: '1px solid #F59E0B44', borderRadius: 4 }}>📍 {selected.location}</span>}
                </div>
                {selected.notes && <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 8, fontStyle: 'italic' }}>{selected.notes}</div>}
                {/* Mutual connections */}
                {(() => {
                  const mutuals = edges.filter(e => e.source === selectedId || e.target === selectedId);
                  if (mutuals.length === 0) return null;
                  return (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--fg3)' }}>
                      {mutuals.length} connection{mutuals.length !== 1 ? 's' : ''} —
                      {[...new Set(mutuals.map(e => e.type))].join(', ')}
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={() => startEdit(selected)}
                  style={{ padding: '4px 10px', background: 'var(--surf2)', color: 'var(--fg)', border: '1px solid var(--bdr)', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                  Edit
                </button>
                <button onClick={() => removeContact(selected.id)}
                  style={{ padding: '4px 10px', background: 'transparent', color: 'var(--fg3)', border: '1px solid var(--bdr)', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                  Remove
                </button>
              </div>
            </div>
          )}

          {/* Cluster summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[['Company', 'company', '#3B82F6'], ['School', 'school', '#22c55e'], ['Location', 'location', '#F59E0B']].map(([label, field, color]) => {
              const groups = groupBy(field).filter(([k]) => k !== 'Unknown');
              if (groups.length === 0) return null;
              const top = groups[0];
              return (
                <div key={field} className="card" style={{ padding: '12px 14px', borderTop: `2px solid ${color}` }}>
                  <div style={{ fontSize: 10, color: 'var(--fg3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg)', marginBottom: 2 }}>{top[0]}</div>
                  <div style={{ fontSize: 11, color }}>
                    {top[1].length} contact{top[1].length !== 1 ? 's' : ''}
                    {groups.length > 1 ? ` · ${groups.length} ${label.toLowerCase()}s` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {contacts.length > 0 && view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Group by company */}
          {groupBy('company').map(([company, members]) => (
            <div key={company}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 0 6px', fontFamily: 'var(--font-mono)' }}>
                🏢 {company} · {members.length}
              </div>
              {members.map(c => (
                <div key={c.id} className="card" style={{ padding: '12px 16px', marginBottom: 6, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--red-dim)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 11, flexShrink: 0 }}>
                    {initials(c.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 1 }}>
                      {[c.role, c.school, c.location].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {c.linkedIn && (
                      <a href={c.linkedIn.startsWith('http') ? c.linkedIn : `https://linkedin.com/in/${c.linkedIn}`} target="_blank" rel="noreferrer"
                        style={{ padding: '4px 8px', fontSize: 11, background: '#0A66C222', color: '#0A66C2', border: '1px solid #0A66C244', borderRadius: 5, textDecoration: 'none' }}>
                        in
                      </a>
                    )}
                    <button onClick={() => startEdit(c)}
                      style={{ padding: '4px 8px', background: 'var(--surf2)', color: 'var(--fg)', border: '1px solid var(--bdr)', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                      Edit
                    </button>
                    <button onClick={() => removeContact(c.id)}
                      style={{ padding: '4px 8px', background: 'transparent', color: 'var(--fg3)', border: '1px solid var(--bdr)', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AI ASSISTANT PAGE ────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  "What's moved the most in my watchlist today?",
  "Summarize my portfolio P&L",
  "Who in my network works in private credit?",
  "What are the key macro risks this week?",
  "Draft talking points for my next investor meeting",
];

function AssistantPage() {
  const [conversations, setConversations] = React.useState([]);
  const [activeId,      setActiveId]      = React.useState(null);
  const [messages,      setMessages]      = React.useState([]);
  const [input,         setInput]         = React.useState('');
  const [loading,       setLoading]       = React.useState(false);
  const [loadingConvos, setLoadingConvos] = React.useState(true);
  const [sidebarOpen,   setSidebarOpen]   = React.useState(true);
  const bottomRef = React.useRef(null);
  const inputRef  = React.useRef(null);

  // Load conversation list
  React.useEffect(() => {
    fetch(`${API_URL}/assistant/conversations`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setConversations(data); setLoadingConvos(false); })
      .catch(() => setLoadingConvos(false));
  }, []);

  // Load messages when conversation selected
  React.useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    fetch(`${API_URL}/assistant/conversations/${activeId}`)
      .then(r => r.ok ? r.json() : null)
      .then(c => { if (c) setMessages(c.messages || []); })
      .catch(() => {});
  }, [activeId]);

  // Scroll to bottom on new message
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setLoading(true);
    const optimistic = { role: 'user', content: msg, timestamp: new Date() };
    setMessages(p => [...p, optimistic]);

    try {
      const res = await fetch(`${API_URL}/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, conversationId: activeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error || 'Something went wrong.';
        const hint = res.status === 500 || res.status === 401 || res.status === 403
          ? `${errMsg}\n\nMake sure GEMINI_API_KEY is set in your Render environment variables.`
          : errMsg;
        setMessages(p => [...p, { role: 'assistant', content: hint, timestamp: new Date() }]);
      } else if (data.conversationId) {
        setActiveId(data.conversationId);
        setMessages(p => [...p, { role: 'assistant', content: data.message, timestamp: new Date() }]);
        // Update conversation list
        setConversations(prev => {
          const exists = prev.find(c => c._id === data.conversationId);
          if (exists) return prev.map(c => c._id === data.conversationId ? { ...c, title: data.title, updatedAt: new Date() } : c);
          return [{ _id: data.conversationId, title: data.title, updatedAt: new Date() }, ...prev];
        });
      }
    } catch (err) {
      setMessages(p => [...p, { role: 'assistant', content: 'Could not reach the backend. Is Render still deploying?', timestamp: new Date() }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  }

  function newConversation() {
    setActiveId(null);
    setMessages([]);
    inputRef.current?.focus();
  }

  function deleteConversation(id, e) {
    e.stopPropagation();
    fetch(`${API_URL}/assistant/conversations/${id}`, { method: 'DELETE' }).catch(() => {});
    setConversations(p => p.filter(c => c._id !== id));
    if (activeId === id) newConversation();
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function renderContent(text) {
    // Simple markdown: bold, code blocks, bullets
    return text
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return <div key={i} style={{ fontWeight: 700, marginTop: 8, marginBottom: 2, color: 'var(--fg)' }}>{line.slice(2, -2)}</div>;
        }
        if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
          return <div key={i} style={{ paddingLeft: 12, marginBottom: 2 }}>· {line.slice(2)}</div>;
        }
        if (line === '') return <div key={i} style={{ height: 6 }} />;
        // Inline bold
        const parts = line.split(/\*\*(.+?)\*\*/g);
        return (
          <div key={i} style={{ marginBottom: 1 }}>
            {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
          </div>
        );
      });
  }

  const isNew = !activeId && messages.length === 0;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* Conversation sidebar */}
      {sidebarOpen && (
        <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--bdr)', background: 'var(--bg)' }}>
          <div style={{ padding: '14px 12px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--bdr)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Conversations</span>
            <button onClick={newConversation}
              style={{ padding: '4px 10px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              + New
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
            {loadingConvos && <div style={{ padding: 12, fontSize: 12, color: 'var(--fg3)' }}>Loading…</div>}
            {!loadingConvos && conversations.length === 0 && (
              <div style={{ padding: 12, fontSize: 12, color: 'var(--fg3)' }}>No conversations yet</div>
            )}
            {conversations.map(c => (
              <div key={c._id} onClick={() => setActiveId(c._id)}
                style={{ padding: '8px 10px', borderRadius: 8, marginBottom: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  background: activeId === c._id ? 'var(--surf2)' : 'transparent' }}>
                <div style={{ flex: 1, fontSize: 12, color: activeId === c._id ? 'var(--fg)' : 'var(--fg2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.title || 'Untitled'}
                </div>
                <button onClick={e => deleteConversation(c._id, e)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--fg3)', opacity: 0, flexShrink: 0,
                    transition: 'opacity 0.15s' }}
                  onMouseEnter={e => e.target.style.opacity = 1}
                  onMouseLeave={e => e.target.style.opacity = 0}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--bdr)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(o => !o)}
            style={{ background: 'none', border: '1px solid var(--bdr)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 14, color: 'var(--fg3)' }}>
            ☰
          </button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg)' }}>AI Assistant</div>
            <div style={{ fontSize: 11, color: 'var(--fg3)' }}>Context-aware · knows your portfolio, watchlist & network</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isNew && (
            <div style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>✦</div>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6, color: 'var(--fg)' }}>What can I help with?</div>
                <div style={{ fontSize: 13, color: 'var(--fg3)' }}>I have your live portfolio, watchlist, network, and market data.</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {QUICK_PROMPTS.map(p => (
                  <button key={p} onClick={() => sendMessage(p)}
                    style={{ padding: '12px 16px', background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 10, fontSize: 13, color: 'var(--fg2)', cursor: 'pointer', textAlign: 'left',
                      transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surf2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--surf)'}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '100%' }}>
              <div style={{
                maxWidth: '72%', padding: '12px 16px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.role === 'user' ? 'var(--red)' : 'var(--surf)',
                color: m.role === 'user' ? 'white' : 'var(--fg)',
                fontSize: 13, lineHeight: 1.6,
                border: m.role === 'assistant' ? '1px solid var(--bdr)' : 'none',
              }}>
                {m.role === 'assistant' ? renderContent(m.content) : m.content}
              </div>
              {m.timestamp && (
                <div style={{ fontSize: 10, color: 'var(--fg3)', marginTop: 3, padding: '0 4px' }}>
                  {formatTime(m.timestamp)}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fg3)', fontSize: 13 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', animation: 'pulse 1s infinite' }} />
              Thinking…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--bdr)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 12, padding: '8px 12px', alignItems: 'flex-end' }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
              rows={1}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: 13, color: 'var(--fg)', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto', fontFamily: 'inherit' }}
            />
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
              style={{ padding: '6px 14px', background: input.trim() && !loading ? 'var(--red)' : 'var(--surf2)', color: input.trim() && !loading ? 'white' : 'var(--fg3)',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: input.trim() && !loading ? 'pointer' : 'default', flexShrink: 0, transition: 'all 0.15s' }}>
              ↑
            </button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--fg3)', marginTop: 5, textAlign: 'center' }}>
            Powered by Claude · Live data injected from your dashboard
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── NOTES PAGE ───────────────────────────────────────────────────────────────

function NotesPage() {
  const [notes,      setNotes]      = React.useState([]);
  const [loading,    setLoading]    = React.useState(true);
  const [search,     setSearch]     = React.useState('');
  const [showForm,   setShowForm]   = React.useState(false);
  const [editing,    setEditing]    = React.useState(null);  // note being edited
  const [form,       setForm]       = React.useState({ title: '', body: '', ticker: '', tags: '' });
  const [expanded,   setExpanded]   = React.useState(null);  // note id expanded

  React.useEffect(() => {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    fetch(`${API_URL}/notes${params}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setNotes(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [search]);

  const EMPTY_FORM = { title: '', body: '', ticker: '', tags: '' };

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(note, e) {
    e.stopPropagation();
    setEditing(note);
    setForm({ title: note.title, body: note.body || '', ticker: note.ticker || '', tags: (note.tags || []).join(', ') });
    setShowForm(true);
  }

  async function saveNote(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      body:  form.body,
      ticker: form.ticker.trim().toUpperCase() || undefined,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    };
    if (editing) {
      const res = await fetch(`${API_URL}/notes/${editing._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const updated = await res.json();
      setNotes(p => p.map(n => n._id === editing._id ? updated : n));
    } else {
      const res = await fetch(`${API_URL}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const created = await res.json();
      setNotes(p => [created, ...p]);
    }
    setShowForm(false);
    setEditing(null);
  }

  async function deleteNote(id, e) {
    e.stopPropagation();
    await fetch(`${API_URL}/notes/${id}`, { method: 'DELETE' });
    setNotes(p => p.filter(n => n._id !== id));
    if (expanded === id) setExpanded(null);
  }

  async function togglePin(note, e) {
    e.stopPropagation();
    const res = await fetch(`${API_URL}/notes/${note._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinned: !note.pinned }) });
    const updated = await res.json();
    setNotes(p => p.map(n => n._id === note._id ? updated : n));
  }

  function relativeTime(ts) {
    const diff = Date.now() - new Date(ts);
    const h = Math.floor(diff / 3600000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="page-root">
      {/* Note form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--bdr)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{editing ? 'Edit Note' : 'New Note'}</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--fg3)' }}>✕</button>
            </div>
            <form onSubmit={saveNote} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Title *" required
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--bdr)', borderRadius: 8, fontSize: 14, fontWeight: 600, background: 'var(--surf)', color: 'var(--fg)', boxSizing: 'border-box' }} />
              <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} placeholder="Notes, thesis, research…" rows={6}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--bdr)', borderRadius: 8, fontSize: 13, background: 'var(--surf)', color: 'var(--fg)', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--fg3)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Linked Ticker</div>
                  <input value={form.ticker} onChange={e => setForm(p => ({ ...p, ticker: e.target.value }))} placeholder="e.g. AAPL"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--bdr)', borderRadius: 8, fontSize: 13, background: 'var(--surf)', color: 'var(--fg)', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--fg3)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tags (comma-sep)</div>
                  <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="e.g. thesis, japan, macro"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--bdr)', borderRadius: 8, fontSize: 13, background: 'var(--surf)', color: 'var(--fg)', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding: '9px 18px', background: 'transparent', color: 'var(--fg3)', border: '1px solid var(--bdr)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button type="submit"
                  style={{ padding: '9px 20px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {editing ? 'Save Changes' : 'Create Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="page-title">Research Notes</h1>
          <p className="page-sub">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew}
          style={{ padding: '8px 16px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          + Note
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16, position: 'relative' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes…"
          style={{ width: '100%', padding: '10px 16px 10px 36px', border: '1px solid var(--bdr)', borderRadius: 10, fontSize: 13, background: 'var(--surf)', color: 'var(--fg)', boxSizing: 'border-box' }} />
        <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg3)', fontSize: 14 }}>⌕</div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 48, color: 'var(--fg3)', fontSize: 13 }}>Loading…</div>}

      {!loading && notes.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No notes yet</div>
          <div style={{ color: 'var(--fg3)', fontSize: 13, marginBottom: 16 }}>Capture investment theses, meeting prep, research — linked to tickers and contacts.</div>
          <button onClick={openNew} style={{ padding: '9px 20px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Create your first note
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notes.map(note => (
          <div key={note._id} className="card" style={{ cursor: 'pointer', transition: 'border-color 0.15s', borderColor: expanded === note._id ? 'var(--red)' : undefined }}
            onClick={() => setExpanded(expanded === note._id ? null : note._id)}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  {note.pinned && <span style={{ fontSize: 10, color: 'var(--amber)' }}>📌</span>}
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--fg)' }}>{note.title}</span>
                  {note.ticker && <span style={{ fontSize: 10, padding: '1px 6px', background: 'var(--red-dim)', color: 'var(--red)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{note.ticker}</span>}
                  {(note.tags || []).map(t => (
                    <span key={t} style={{ fontSize: 10, padding: '1px 6px', background: 'var(--surf2)', color: 'var(--fg3)', borderRadius: 4 }}>{t}</span>
                  ))}
                </div>
                {note.body && !expanded !== note._id && (
                  <div style={{ fontSize: 12, color: 'var(--fg3)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: expanded === note._id ? 'unset' : 2, WebkitBoxOrient: 'vertical' }}>
                    {note.body}
                  </div>
                )}
                {expanded === note._id && note.body && (
                  <div style={{ fontSize: 13, color: 'var(--fg2)', lineHeight: 1.7, marginTop: 8, whiteSpace: 'pre-wrap' }}>{note.body}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--fg3)' }}>{relativeTime(note.updatedAt)}</span>
                <button onClick={e => togglePin(note, e)} title={note.pinned ? 'Unpin' : 'Pin'}
                  style={{ background: 'none', border: '1px solid var(--bdr)', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', fontSize: 11, color: note.pinned ? 'var(--amber)' : 'var(--fg3)' }}>
                  📌
                </button>
                <button onClick={e => openEdit(note, e)}
                  style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--fg)', fontWeight: 600 }}>
                  Edit
                </button>
                <button onClick={e => deleteNote(note._id, e)}
                  style={{ background: 'none', border: '1px solid var(--bdr)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--fg3)' }}>
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DEAL FLOW PAGE ───────────────────────────────────────────────────────────

const DEAL_STAGES = [
  { id: 'watching',   label: 'Watching',   color: '#6b7280' },
  { id: 'thesis',     label: 'Thesis',     color: '#3B82F6' },
  { id: 'conviction', label: 'Conviction', color: '#A855F7' },
  { id: 'position',   label: 'In Position', color: '#22c55e' },
  { id: 'passed',     label: 'Passed',     color: '#ef4444' },
  { id: 'exited',     label: 'Exited',     color: '#f59e0b' },
];

const PRIORITY_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#6b7280' };

function DealsPage() {
  const [deals,    setDeals]    = React.useState([]);
  const [loading,  setLoading]  = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [selected, setSelected] = React.useState(null);  // deal _id expanded
  const [form,     setForm]     = React.useState({ company: '', ticker: '', stage: 'watching', thesis: '', targetPrice: '', catalysts: '', risks: '', notes: '', priority: 'medium' });

  React.useEffect(() => {
    fetch(`${API_URL}/deals`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setDeals(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const EMPTY_FORM = { company: '', ticker: '', stage: 'watching', thesis: '', targetPrice: '', catalysts: '', risks: '', notes: '', priority: 'medium' };

  async function saveDeal(e) {
    e.preventDefault();
    if (!form.company.trim()) return;
    const payload = {
      ...form,
      ticker: form.ticker?.toUpperCase() || undefined,
      targetPrice: form.targetPrice ? Number(form.targetPrice) : undefined,
      catalysts: form.catalysts.split('\n').map(s => s.trim()).filter(Boolean),
      risks:     form.risks.split('\n').map(s => s.trim()).filter(Boolean),
    };
    if (selected && deals.find(d => d._id === selected)) {
      const res = await fetch(`${API_URL}/deals/${selected}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const updated = await res.json();
      setDeals(p => p.map(d => d._id === selected ? updated : d));
    } else {
      const res = await fetch(`${API_URL}/deals`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const created = await res.json();
      setDeals(p => [created, ...p]);
    }
    setShowForm(false);
    setForm(EMPTY_FORM);
    setSelected(null);
  }

  function openEdit(deal) {
    setSelected(deal._id);
    setForm({
      company: deal.company, ticker: deal.ticker || '', stage: deal.stage,
      thesis: deal.thesis || '', targetPrice: deal.targetPrice || '',
      catalysts: (deal.catalysts || []).join('\n'), risks: (deal.risks || []).join('\n'),
      notes: deal.notes || '', priority: deal.priority || 'medium',
    });
    setShowForm(true);
  }

  async function moveStage(deal, dir) {
    const idx = DEAL_STAGES.findIndex(s => s.id === deal.stage);
    const next = DEAL_STAGES[idx + dir];
    if (!next) return;
    const res = await fetch(`${API_URL}/deals/${deal._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: next.id }) });
    const updated = await res.json();
    setDeals(p => p.map(d => d._id === deal._id ? updated : d));
  }

  async function deleteDeal(id, e) {
    e.stopPropagation();
    await fetch(`${API_URL}/deals/${id}`, { method: 'DELETE' });
    setDeals(p => p.filter(d => d._id !== id));
    if (selected === id) setSelected(null);
  }

  const byStage = Object.fromEntries(DEAL_STAGES.map(s => [s.id, deals.filter(d => d.stage === s.id)]));

  const fieldStyle = { width: '100%', padding: '8px 12px', border: '1px solid var(--bdr)', borderRadius: 8, fontSize: 13, background: 'var(--surf)', color: 'var(--fg)', boxSizing: 'border-box' };
  const labelStyle = { fontSize: 11, color: 'var(--fg3)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' };

  return (
    <div className="page-root">
      {/* Deal form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); setSelected(null); } }}>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--bdr)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selected && deals.find(d => d._id === selected) ? 'Edit Deal' : 'New Deal'}</div>
              <button onClick={() => { setShowForm(false); setSelected(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--fg3)' }}>✕</button>
            </div>
            <form onSubmit={saveDeal} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div><div style={labelStyle}>Company *</div><input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="Company name" required style={fieldStyle} /></div>
                <div><div style={labelStyle}>Ticker</div><input value={form.ticker} onChange={e => setForm(p => ({ ...p, ticker: e.target.value }))} placeholder="e.g. AAPL" style={fieldStyle} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><div style={labelStyle}>Stage</div>
                  <select value={form.stage} onChange={e => setForm(p => ({ ...p, stage: e.target.value }))} style={{ ...fieldStyle }}>
                    {DEAL_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div><div style={labelStyle}>Priority</div>
                  <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={{ ...fieldStyle }}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div><div style={labelStyle}>Target Price</div><input type="number" value={form.targetPrice} onChange={e => setForm(p => ({ ...p, targetPrice: e.target.value }))} placeholder="$0.00" style={fieldStyle} /></div>
              </div>
              <div><div style={labelStyle}>Investment Thesis</div>
                <textarea value={form.thesis} onChange={e => setForm(p => ({ ...p, thesis: e.target.value }))} placeholder="Why is this interesting? What's the edge?" rows={3} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.6 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><div style={labelStyle}>Catalysts (one per line)</div>
                  <textarea value={form.catalysts} onChange={e => setForm(p => ({ ...p, catalysts: e.target.value }))} placeholder="Earnings beat&#10;New product launch&#10;Rate cut" rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
                </div>
                <div><div style={labelStyle}>Risks (one per line)</div>
                  <textarea value={form.risks} onChange={e => setForm(p => ({ ...p, risks: e.target.value }))} placeholder="Regulatory risk&#10;FX exposure&#10;Competition" rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
                </div>
              </div>
              <div><div style={labelStyle}>Notes</div>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Anything else…" rows={2} style={{ ...fieldStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => { setShowForm(false); setSelected(null); }} style={{ padding: '9px 18px', background: 'transparent', color: 'var(--fg3)', border: '1px solid var(--bdr)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '9px 20px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Save Deal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Deal Flow</h1>
          <p className="page-sub">{deals.length} deal{deals.length !== 1 ? 's' : ''} tracked</p>
        </div>
        <button onClick={() => { setSelected(null); setForm(EMPTY_FORM); setShowForm(true); }}
          style={{ padding: '8px 16px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Deal
        </button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 48, color: 'var(--fg3)', fontSize: 13 }}>Loading…</div>}

      {!loading && deals.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔭</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No deals tracked yet</div>
          <div style={{ color: 'var(--fg3)', fontSize: 13, marginBottom: 16 }}>Track investment ideas from first look through exit. Build your thesis, log catalysts and risks, move deals through stages.</div>
          <button onClick={() => { setForm(EMPTY_FORM); setShowForm(true); }} style={{ padding: '9px 20px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Add your first deal
          </button>
        </div>
      )}

      {/* Pipeline columns */}
      {deals.length > 0 && (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 12 }}>
          {DEAL_STAGES.map(stage => {
            const stageDeals = byStage[stage.id] || [];
            return (
              <div key={stage.id} style={{ minWidth: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Column header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'var(--surf)', border: '1px solid var(--bdr)', borderTop: `2px solid ${stage.color}` }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: stage.color }}>{stage.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--fg3)', marginLeft: 'auto' }}>{stageDeals.length}</span>
                </div>
                {/* Deal cards */}
                {stageDeals.map(deal => {
                  const stageIdx = DEAL_STAGES.findIndex(s => s.id === deal.stage);
                  return (
                    <div key={deal._id} className="card" style={{ padding: '12px 14px', cursor: 'pointer' }} onClick={() => openEdit(deal)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg)' }}>{deal.company}</div>
                          {deal.ticker && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--red)', marginTop: 1 }}>{deal.ticker}</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: `${PRIORITY_COLOR[deal.priority]}22`, color: PRIORITY_COLOR[deal.priority], fontWeight: 700, textTransform: 'uppercase' }}>
                            {deal.priority}
                          </span>
                          <button onClick={e => deleteDeal(deal._id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--fg3)' }}>✕</button>
                        </div>
                      </div>
                      {deal.thesis && <div style={{ fontSize: 11, color: 'var(--fg3)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 8 }}>{deal.thesis}</div>}
                      {deal.targetPrice && <div style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>Target: ${deal.targetPrice}</div>}
                      {/* Stage move buttons */}
                      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                        {stageIdx > 0 && <button onClick={e => { e.stopPropagation(); moveStage(deal, -1); }} style={{ flex: 1, padding: '3px 0', background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 5, fontSize: 10, cursor: 'pointer', color: 'var(--fg3)' }}>← Back</button>}
                        {stageIdx < DEAL_STAGES.length - 1 && <button onClick={e => { e.stopPropagation(); moveStage(deal, 1); }} style={{ flex: 1, padding: '3px 0', background: 'var(--surf2)', border: `1px solid ${DEAL_STAGES[stageIdx + 1].color}44`, borderRadius: 5, fontSize: 10, cursor: 'pointer', color: DEAL_STAGES[stageIdx + 1].color, fontWeight: 700 }}>Next →</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MEETINGS PAGE ────────────────────────────────────────────────────────────

function MeetingsPage() {
  const [meetings,  setMeetings]  = React.useState([]);
  const [contacts,  setContacts]  = React.useState([]);
  const [loading,   setLoading]   = React.useState(true);
  const [showForm,  setShowForm]  = React.useState(false);
  const [expanded,  setExpanded]  = React.useState(null);  // meeting _id
  const [genBrief,  setGenBrief]  = React.useState(null);  // meeting _id generating brief
  const [savingNotes, setSavingNotes] = React.useState(null);
  const [form, setForm] = React.useState({ contactName: '', contactId: '', company: '', date: '', type: 'call', agenda: '' });

  React.useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/meetings`).then(r => r.ok ? r.json() : []),
      fetch(`${API_URL}/contacts`).then(r => r.ok ? r.json() : []),
    ])
      .then(([m, c]) => {
        setMeetings(m);
        setContacts(c.map(x => ({ ...x, id: x._id })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function createMeeting(e) {
    e.preventDefault();
    const res = await fetch(`${API_URL}/meetings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const created = await res.json();
    setMeetings(p => [...p, created].sort((a, b) => new Date(a.date) - new Date(b.date)));
    setShowForm(false);
    setForm({ contactName: '', contactId: '', company: '', date: '', type: 'call', agenda: '' });
  }

  async function generateBrief(meeting) {
    setGenBrief(meeting._id);
    try {
      const res = await fetch(`${API_URL}/meetings/${meeting._id}/brief`, { method: 'POST' });
      const data = await res.json();
      if (data.brief) {
        setMeetings(p => p.map(m => m._id === meeting._id ? { ...m, brief: data.brief } : m));
      }
    } catch (err) { console.error(err); }
    setGenBrief(null);
  }

  async function savePostCallNotes(meeting, notes) {
    setSavingNotes(meeting._id);
    await fetch(`${API_URL}/meetings/${meeting._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postCallNotes: notes, status: 'completed' }) });
    setMeetings(p => p.map(m => m._id === meeting._id ? { ...m, postCallNotes: notes, status: 'completed' } : m));
    setSavingNotes(null);
  }

  async function deleteMeeting(id, e) {
    e.stopPropagation();
    await fetch(`${API_URL}/meetings/${id}`, { method: 'DELETE' });
    setMeetings(p => p.filter(m => m._id !== id));
    if (expanded === id) setExpanded(null);
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function isUpcoming(d) { return new Date(d) > new Date(); }

  const upcoming = meetings.filter(m => m.status === 'upcoming' && isUpcoming(m.date));
  const past     = meetings.filter(m => m.status === 'completed' || !isUpcoming(m.date));

  const TYPE_COLORS = { call: '#3B82F6', coffee: '#f59e0b', interview: '#A855F7', intro: '#22c55e', 'follow-up': '#ec4899', other: '#6b7280' };

  const fieldStyle = { width: '100%', padding: '8px 12px', border: '1px solid var(--bdr)', borderRadius: 8, fontSize: 13, background: 'var(--surf)', color: 'var(--fg)', boxSizing: 'border-box' };
  const labelStyle = { fontSize: 11, color: 'var(--fg3)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' };

  function MeetingCard({ meeting }) {
    const [notes, setNotes]     = React.useState(meeting.postCallNotes || '');
    const isOpen = expanded === meeting._id;
    const color  = TYPE_COLORS[meeting.type] || '#6b7280';

    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `3px solid ${color}` }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
          onClick={() => setExpanded(isOpen ? null : meeting._id)}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--fg)' }}>{meeting.contactName}</span>
              {meeting.company && <span style={{ fontSize: 11, color: 'var(--fg3)' }}>@ {meeting.company}</span>}
              <span style={{ fontSize: 10, padding: '1px 6px', background: `${color}22`, color, borderRadius: 4, fontWeight: 700, textTransform: 'capitalize' }}>{meeting.type}</span>
              {meeting.status === 'completed' && <span style={{ fontSize: 10, padding: '1px 6px', background: '#22c55e22', color: '#22c55e', borderRadius: 4, fontWeight: 700 }}>Done</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 3 }}>{formatDate(meeting.date)}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {!meeting.brief && (
              <button onClick={e => { e.stopPropagation(); generateBrief(meeting); }} disabled={genBrief === meeting._id}
                style={{ padding: '4px 10px', background: genBrief === meeting._id ? 'var(--surf2)' : 'var(--red)', color: genBrief === meeting._id ? 'var(--fg3)' : 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                {genBrief === meeting._id ? '…' : '✦ Brief'}
              </button>
            )}
            {meeting.brief && (
              <span style={{ fontSize: 10, padding: '2px 7px', background: '#22c55e22', color: '#22c55e', borderRadius: 4, fontWeight: 700 }}>Brief ready</span>
            )}
            <button onClick={e => deleteMeeting(meeting._id, e)} style={{ background: 'none', border: '1px solid var(--bdr)', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', fontSize: 11, color: 'var(--fg3)' }}>✕</button>
            <span style={{ color: 'var(--fg3)', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Expanded content */}
        {isOpen && (
          <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--bdr)', paddingTop: 14 }}>
            {meeting.agenda && (
              <div style={{ marginBottom: 12 }}>
                <div style={labelStyle}>Agenda</div>
                <div style={{ fontSize: 13, color: 'var(--fg2)', lineHeight: 1.6 }}>{meeting.agenda}</div>
              </div>
            )}

            {meeting.brief ? (
              <div style={{ marginBottom: 12 }}>
                <div style={labelStyle}>✦ AI Brief</div>
                <div style={{ fontSize: 12.5, color: 'var(--fg2)', lineHeight: 1.7, background: 'var(--surf)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--bdr)', whiteSpace: 'pre-wrap' }}>
                  {meeting.brief}
                </div>
              </div>
            ) : (
              <button onClick={() => generateBrief(meeting)} disabled={genBrief === meeting._id}
                style={{ padding: '8px 16px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
                {genBrief === meeting._id ? 'Generating brief…' : '✦ Generate AI Brief'}
              </button>
            )}

            <div>
              <div style={labelStyle}>Post-Call Notes</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Key takeaways, follow-ups, next steps…" rows={3}
                style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.6, marginBottom: 8 }} />
              <button onClick={() => savePostCallNotes(meeting, notes)} disabled={savingNotes === meeting._id}
                style={{ padding: '7px 16px', background: 'var(--surf2)', color: 'var(--fg)', border: '1px solid var(--bdr)', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {savingNotes === meeting._id ? 'Saving…' : 'Save Notes'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-root">
      {/* Add meeting modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--bdr)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Schedule Meeting</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--fg3)' }}>✕</button>
            </div>
            <form onSubmit={createMeeting} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={labelStyle}>Contact *</div>
                <select value={form.contactId} onChange={e => {
                  const c = contacts.find(x => x._id === e.target.value);
                  setForm(p => ({ ...p, contactId: e.target.value, contactName: c ? c.name : '', company: c ? (c.company || '') : '' }));
                }} style={fieldStyle}>
                  <option value="">— Select from network or type below —</option>
                  {contacts.map(c => <option key={c._id} value={c._id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
                </select>
              </div>
              {!form.contactId && (
                <input value={form.contactName} onChange={e => setForm(p => ({ ...p, contactName: e.target.value }))} placeholder="Or type contact name *" required={!form.contactId} style={fieldStyle} />
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><div style={labelStyle}>Company</div><input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} style={fieldStyle} /></div>
                <div><div style={labelStyle}>Type</div>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={fieldStyle}>
                    {['call','coffee','interview','intro','follow-up','other'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div><div style={labelStyle}>Date & Time *</div>
                <input type="datetime-local" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required style={fieldStyle} />
              </div>
              <div><div style={labelStyle}>Agenda / Context</div>
                <textarea value={form.agenda} onChange={e => setForm(p => ({ ...p, agenda: e.target.value }))} placeholder="What's the meeting about? What do you want to accomplish?" rows={2} style={{ ...fieldStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '9px 18px', background: 'transparent', color: 'var(--fg3)', border: '1px solid var(--bdr)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '9px 20px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add Meeting</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Meetings</h1>
          <p className="page-sub">{upcoming.length} upcoming · {past.length} past</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ padding: '8px 16px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Schedule
        </button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 48, color: 'var(--fg3)' }}>Loading…</div>}

      {!loading && meetings.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No meetings yet</div>
          <div style={{ color: 'var(--fg3)', fontSize: 13, marginBottom: 16 }}>Schedule meetings with your network contacts. Get AI-generated briefs before each call and log post-call notes.</div>
          <button onClick={() => setShowForm(true)} style={{ padding: '9px 20px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Schedule a meeting
          </button>
        </div>
      )}

      {upcoming.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Upcoming</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcoming.map(m => <MeetingCard key={m._id} meeting={m} />)}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Past</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {past.map(m => <MeetingCard key={m._id} meeting={m} />)}
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  PortfolioPage, JapanPage, NewsPage, VoicesPage, StockPage, WatchlistPage, AlertsPanel,
  EarningsPage, ToolsPage, AnalyticsPage, PushSettingsPage, NetworkingPage,
  AssistantPage, NotesPage, DealsPage, MeetingsPage,
});
