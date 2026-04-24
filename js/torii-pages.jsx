// ─── TORII SUB-PAGES: Portfolio, Japan, News, Voices, Stock ──────────────────

const API_URL = 'https://torii-backend.onrender.com/api';

// ─── RESPONSIVE HOOK ──────────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = React.useState(window.innerWidth < 720);
  React.useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 720);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return mobile;
}

// ─── PORTFOLIO PAGE ───────────────────────────────────────────────────────────

function PortfolioPage({ onNav }) {
  const isMobile   = useIsMobile();
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
      <div className="kpi-grid" style={{gridTemplateColumns:isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',marginBottom:16}}>
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

      <div className="portfolio-main-grid" style={{display:'grid',gridTemplateColumns:isMobile ? '1fr' : '1fr 280px',gap:14,alignItems:'start'}}>
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
                {!isMobile && <th>Name</th>}
                {!isMobile && <th style={{textAlign:'right'}}>Shares</th>}
                <th style={{textAlign:'right'}}>Price</th>
                <th style={{textAlign:'right'}}>Day</th>
                <th style={{textAlign:'right'}}>Value</th>
                {!isMobile && <th style={{textAlign:'right'}}>Alloc</th>}
                <th style={{width:36}}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isMobile ? 5 : 8} style={{textAlign:'center',padding:32,color:'var(--fg3)',fontFamily:'var(--font-mono)',fontSize:12}}>Loading prices…</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={isMobile ? 5 : 8} style={{textAlign:'center',padding:32,color:'var(--fg3)',fontFamily:'var(--font-mono)',fontSize:12}}>
                  No positions yet — click <strong style={{color:'var(--fg)'}}>+ Add Position</strong> to get started
                </td></tr>
              ) : sorted.map(h => {
                const up = h.pct >= 0;
                const color = up ? 'var(--green)' : 'var(--red-loss)';
                return (
                  <tr key={h.ticker}>
                    <td onClick={() => onNav(`stock-${h.ticker}`)} style={{cursor:'pointer'}}>
                      <span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:12,color:'var(--fg)'}}>{h.ticker}</span>
                      {isMobile && <div style={{fontSize:10,color:'var(--fg3)'}}>{h.name}</div>}
                    </td>
                    {!isMobile && <td onClick={() => onNav(`stock-${h.ticker}`)} style={{cursor:'pointer'}}>
                      <span style={{fontSize:11,color:'var(--fg2)'}}>{h.name}</span>
                    </td>}
                    {!isMobile && <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--fg3)'}}>{h.shares}</td>}
                    <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:12,color:'var(--fg)'}}>${(h.price||0).toFixed(2)}</td>
                    <td style={{textAlign:'right'}}>
                      <span style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,color}}>
                        {up?'+':''}{(h.pct||0).toFixed(2)}%
                      </span>
                    </td>
                    <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600,color:'var(--fg)'}}>
                      ${(h.value||0).toLocaleString('en-US',{maximumFractionDigits:0})}
                    </td>
                    {!isMobile && <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--fg3)'}}>
                      {total > 0 ? ((h.value/total)*100).toFixed(1) : '0.0'}%
                    </td>}
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

function JapanPage({ onNav }) {
  const isMobile   = useIsMobile();
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
      <div className="kpi-grid" style={{gridTemplateColumns:isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',marginBottom:16}}>
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
                <tr key={s.symbol} onClick={() => onNav && onNav(`stock-${s.symbol}`)}
                  style={{ cursor: onNav ? 'pointer' : 'default' }}
                  onMouseEnter={e => { if (onNav) e.currentTarget.style.background = 'var(--surf2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
                  <td><span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:12,color:'var(--red)'}}>{s.symbol}</span></td>
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
  const isMobile   = useIsMobile();
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
      <div style={{display:'grid',gridTemplateColumns:isMobile ? '1fr 1fr' : 'repeat(3,1fr)',gap:8,marginBottom:16}}>
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
  const isMobile   = useIsMobile();
  const [quote, setQuote]         = React.useState(null);
  const [loadingQ, setLoadingQ]   = React.useState(true);
  const [timeframe, setTimeframe] = React.useState('5D');
  const [chartPrices, setChartPrices] = React.useState([]);
  const [chartLabels, setChartLabels] = React.useState([]);
  const [chartLoading, setChartLoading] = React.useState(false);
  const [relatedNews, setRelatedNews]   = React.useState([]);

  // Position from localStorage cache (portfolio page keeps this in sync)
  const pos = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('torii_portfolio');
      const saved = raw ? JSON.parse(raw) : [];
      return saved.find(p => p.ticker === ticker) || null;
    } catch { return null; }
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
      <div className="kpi-grid" style={{gridTemplateColumns:isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',marginBottom:14}}>
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

function WatchlistPage({ onNav, defaultTab }) {
  const [tab,      setTab]      = React.useState(defaultTab || 'watchlist');
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
          <p className="page-sub">Track securities · alerts · intelligence</p>
        </div>
        {tab === 'watchlist' && (
          <button className="btn-primary" onClick={() => setShowAdd(!showAdd)} style={{padding:'8px 16px',fontSize:13}}>
            {showAdd ? '✕' : '+ Add'} Security
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:16, background:'var(--surf)', borderRadius:10, padding:4, width:'fit-content' }}>
        {[['watchlist','Watchlist'],['intel','WL Intelligence']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding:'7px 18px', borderRadius:7, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
              background: tab===id?'var(--surf2)':'transparent', color: tab===id?'var(--fg)':'var(--fg3)', transition:'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'intel' && <WatchlistIntelPage />}

      {tab === 'watchlist' && <>
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
      </>}
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

// ─── HUB-NODE GRAPH: company/school/location as actual hub nodes ──────────────
// Contacts spring toward their hub nodes instead of connecting peer-to-peer.
function buildHubGraph(contacts, filters = { company: true, school: true, location: false }) {
  const contactNodes = contacts.map(c => ({
    id: c.id, label: c.name, initials: initials(c.name), nodeType: 'contact',
    company: c.company, school: c.school, location: c.location,
    x: 0, y: 0, vx: 0, vy: 0,
  }));
  const hubMap = {};
  const edges = [];

  function processField(field, type, color, maxSize, minCount = 2) {
    if (!filters[type]) return;
    const counts = {};
    for (const c of contacts) { const v = c[field]?.trim(); if (v) counts[v] = (counts[v]||0) + 1; }
    for (const c of contacts) {
      const v = c[field]?.trim();
      if (!v || counts[v] < minCount || counts[v] > maxSize) continue;
      const key = `hub|${type}|${v.toLowerCase()}`;
      if (!hubMap[key]) {
        hubMap[key] = { id: key, label: v.length > 20 ? v.slice(0,18)+'…' : v, nodeType: type, color, count: counts[v], x: 0, y: 0, vx: 0, vy: 0 };
      }
      edges.push({ source: c.id, target: key, type, color });
    }
  }
  processField('company', 'company', '#4a9eff', 20);
  processField('school',  'school',  '#4ade80', 20);
  processField('location','location','#fbbf24', 500, 1); // cities can have many contacts — no practical cap

  const hubNodes = Object.values(hubMap);
  return { contactNodes, hubNodes, allNodes: [...contactNodes, ...hubNodes], edges };
}

function NetworkGraph({ contacts, onSelectNode, selectedId, edgeFilters }) {
  const containerRef = React.useRef(null);
  const svgRef       = React.useRef(null);
  const animRef      = React.useRef(null);
  const dragRef      = React.useRef(null);
  const panRef       = React.useRef(null);
  const nodesRef     = React.useRef([]);
  const edgesRef     = React.useRef([]);

  const [allNodes,  setAllNodes]  = React.useState([]);
  const [edges,     setEdges]     = React.useState([]);
  const [transform, setTransform] = React.useState({ x: 0, y: 0, k: 1 });
  const [size,      setSize]      = React.useState({ w: 800, h: 520 });

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    if (contacts.length === 0) { setAllNodes([]); setEdges([]); nodesRef.current = []; edgesRef.current = []; return; }
    const { w, h } = size;
    const cx = w / 2, cy = h / 2;
    const graph = buildHubGraph(contacts, edgeFilters);
    // Hubs fan out in a ring, contacts scatter near center
    const hubR = Math.min(w, h) * 0.33;
    graph.hubNodes.forEach((hub, i) => {
      const angle = (i / Math.max(graph.hubNodes.length, 1)) * 2 * Math.PI;
      hub.x = cx + hubR * Math.cos(angle) + (Math.random() - 0.5) * 40;
      hub.y = cy + hubR * Math.sin(angle) + (Math.random() - 0.5) * 40;
    });
    graph.contactNodes.forEach(cn => {
      cn.x = cx + (Math.random() - 0.5) * Math.min(w, h) * 0.55;
      cn.y = cy + (Math.random() - 0.5) * Math.min(w, h) * 0.55;
    });
    nodesRef.current = graph.allNodes;
    edgesRef.current = graph.edges;
    setAllNodes([...graph.allNodes]);
    setEdges(graph.edges);
  }, [contacts.length, size.w, JSON.stringify(edgeFilters)]);

  React.useEffect(() => {
    if (allNodes.length === 0) return;
    let frame = 0, running = true;
    function tick() {
      if (!running || frame > 700) return;
      frame++;
      const sn = nodesRef.current;
      const se = edgesRef.current;
      const { w, h } = size;
      const cx = w / 2, cy = h / 2;
      for (const ni of sn) {
        if (dragRef.current?.id === ni.id) continue;
        const isHub = ni.nodeType !== 'contact';
        let fx = 0, fy = 0;
        for (const nj of sn) {
          if (ni.id === nj.id) continue;
          const dx = ni.x - nj.x || 0.01, dy = ni.y - nj.y || 0.01;
          const d2 = dx*dx + dy*dy || 1, d = Math.sqrt(d2);
          const jIsHub = nj.nodeType !== 'contact';
          const rep = (isHub && jIsHub) ? 30000 : (isHub || jIsHub) ? 6000 : 2800;
          const f = rep / d2;
          fx += (dx/d)*f; fy += (dy/d)*f;
        }
        for (const e of se) {
          if (e.source !== ni.id && e.target !== ni.id) continue;
          const otherId = e.source === ni.id ? e.target : e.source;
          const nj = sn.find(n => n.id === otherId);
          if (!nj) continue;
          const dx = nj.x - ni.x, dy = nj.y - ni.y;
          const d = Math.sqrt(dx*dx + dy*dy) || 1;
          const stretch = (d - 90) * 0.045;
          fx += (dx/d)*stretch; fy += (dy/d)*stretch;
        }
        const grav = isHub ? 0.005 : 0.002;
        fx += (cx - ni.x) * grav;
        fy += (cy - ni.y) * grav;
        ni.vx = (ni.vx + fx) * 0.76;
        ni.vy = (ni.vy + fy) * 0.76;
        ni.x = Math.max(55, Math.min(w - 55, ni.x + ni.vx));
        ni.y = Math.max(40, Math.min(h - 40, ni.y + ni.vy));
      }
      nodesRef.current = [...sn];
      setAllNodes([...sn]);
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [allNodes.length]);

  function svgOffset(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const pt = e.touches ? e.touches[0] : e;
    return { cx: pt.clientX - rect.left, cy: pt.clientY - rect.top };
  }
  function screenToWorld(cx, cy) {
    const { x, y, k } = transform;
    return { wx: (cx - x) / k, wy: (cy - y) / k };
  }

  function onNodeDown(e, nodeId) {
    e.stopPropagation(); e.preventDefault();
    const { cx, cy } = svgOffset(e);
    const { wx, wy } = screenToWorld(cx, cy);
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;
    dragRef.current = { id: nodeId, dx: wx - node.x, dy: wy - node.y, moved: false };
    const startCx = cx, startCy = cy;
    function onMove(ev) {
      const { cx: mx, cy: my } = svgOffset(ev);
      if (Math.hypot(mx - startCx, my - startCy) > 5) dragRef.current.moved = true;
      const { wx: wx2, wy: wy2 } = screenToWorld(mx, my);
      nodesRef.current = nodesRef.current.map(n =>
        n.id === nodeId ? { ...n, x: wx2 - dragRef.current.dx, y: wy2 - dragRef.current.dy, vx: 0, vy: 0 } : n
      );
      setAllNodes([...nodesRef.current]);
    }
    function onUp() {
      const moved = dragRef.current?.moved;
      dragRef.current = null;
      if (!moved) {
        const node = nodesRef.current.find(n => n.id === nodeId);
        if (node?.nodeType === 'contact') onSelectNode(nodeId === selectedId ? null : nodeId);
      }
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

  function onSvgDown(e) {
    if (e.target !== svgRef.current) return;
    const { cx, cy } = svgOffset(e);
    panRef.current = { startX: cx, startY: cy, tx: transform.x, ty: transform.y };
    function onMove(ev) {
      if (!panRef.current) return;
      const { cx: mx, cy: my } = svgOffset(ev);
      setTransform(t => ({ ...t, x: panRef.current.tx + mx - panRef.current.startX, y: panRef.current.ty + my - panRef.current.startY }));
    }
    function onUp() { panRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.88;
    const { cx, cy } = svgOffset(e);
    setTransform(t => {
      const k2 = Math.max(0.15, Math.min(5, t.k * factor));
      return { x: cx - (cx - t.x) * (k2 / t.k), y: cy - (cy - t.y) * (k2 / t.k), k: k2 };
    });
  }

  const contactNodes = allNodes.filter(n => n.nodeType === 'contact');
  const hubNodes     = allNodes.filter(n => n.nodeType !== 'contact');

  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div ref={containerRef} style={{ width: '100%', height: 520, borderRadius: 12, overflow: 'hidden', background: '#080810', position: 'relative' }}>
        <svg ref={svgRef} width="100%" height="100%"
          style={{ display: 'block', cursor: 'grab', touchAction: 'none', userSelect: 'none' }}
          onMouseDown={onSvgDown} onTouchStart={onSvgDown} onWheel={onWheel}>
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>

            {/* Hub glow halos */}
            {hubNodes.map(hub => (
              <circle key={`glow-${hub.id}`} cx={hub.x} cy={hub.y} r={54} fill={hub.color} fillOpacity={0.04} />
            ))}

            {/* Edges */}
            {edges.map((e, i) => {
              const src = allNodes.find(n => n.id === e.source);
              const tgt = allNodes.find(n => n.id === e.target);
              if (!src || !tgt) return null;
              const isActive = selectedId && (e.source === selectedId || e.target === selectedId);
              return <line key={i} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                stroke={e.color} strokeWidth={isActive ? 1.6 : 0.7} strokeOpacity={isActive ? 0.85 : 0.28} />;
            })}

            {/* Hub nodes — labeled circles */}
            {hubNodes.map(hub => (
              <g key={hub.id} onMouseDown={ev => onNodeDown(ev, hub.id)} onTouchStart={ev => onNodeDown(ev, hub.id)} style={{ cursor: 'grab' }}>
                <circle cx={hub.x} cy={hub.y} r={28} fill={hub.color + '1a'} stroke={hub.color} strokeWidth={1.8} />
                <text x={hub.x} y={hub.y - 4} textAnchor="middle" dominantBaseline="middle"
                  fill={hub.color} fontSize={8} fontWeight={700}
                  style={{ fontFamily: 'var(--font-ui)', pointerEvents: 'none', letterSpacing: '0.03em' }}>
                  {hub.label}
                </text>
                <text x={hub.x} y={hub.y + 12} textAnchor="middle"
                  fill={hub.color} fontSize={7} fillOpacity={0.65}
                  style={{ fontFamily: 'var(--font-mono)', pointerEvents: 'none' }}>
                  {hub.count}
                </text>
              </g>
            ))}

            {/* Contact nodes — small initials dots */}
            {contactNodes.map(cn => {
              const isSel   = cn.id === selectedId;
              const isConn  = selectedId && edges.some(e => (e.source === cn.id || e.target === cn.id) && (e.source === selectedId || e.target === selectedId));
              const dimmed  = selectedId && !isSel && !isConn;
              const r = isSel ? 13 : 9;
              return (
                <g key={cn.id} onMouseDown={ev => onNodeDown(ev, cn.id)} onTouchStart={ev => onNodeDown(ev, cn.id)}
                  style={{ cursor: 'pointer', opacity: dimmed ? 0.22 : 1 }}>
                  {isSel && <circle cx={cn.x} cy={cn.y} r={r + 7} fill="var(--red)" fillOpacity={0.2} />}
                  <circle cx={cn.x} cy={cn.y} r={r}
                    fill={isSel ? 'var(--red)' : '#141422'}
                    stroke={isSel ? 'var(--red)' : isConn ? '#5566bb' : '#2a2a42'}
                    strokeWidth={isSel ? 2.5 : 1.2} />
                  <text x={cn.x} y={cn.y} textAnchor="middle" dominantBaseline="middle"
                    fill={isSel ? 'white' : '#7788aa'} fontSize={6} fontWeight={700}
                    style={{ fontFamily: 'var(--font-mono)', pointerEvents: 'none' }}>
                    {cn.initials}
                  </text>
                  {isSel && (
                    <text x={cn.x} y={cn.y + r + 9} textAnchor="middle"
                      fill="rgba(255,255,255,0.9)" fontSize={8} fontWeight={600}
                      style={{ fontFamily: 'var(--font-ui)', pointerEvents: 'none' }}>
                      {cn.label.split(' ')[0]}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: 10, left: 12, display: 'flex', gap: 14, pointerEvents: 'none' }}>
          {[['#4a9eff', 'Company'], ['#4ade80', 'School'], ['#fbbf24', 'City']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#555', fontFamily: 'var(--font-mono)' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
              {l}
            </div>
          ))}
        </div>

        {/* Zoom controls */}
        <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[['＋', 1.25], ['−', 0.8], ['⊙', null]].map(([label, factor]) => (
            <button key={label} onClick={() => {
              if (!factor) { setTransform({ x: 0, y: 0, k: 1 }); return; }
              setTransform(t => ({ ...t, k: Math.max(0.15, Math.min(5, t.k * factor)) }));
            }} style={{ width: 28, height: 28, background: '#14142088', border: '1px solid #2a2a44', borderRadius: 6, color: '#888', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 10, color: '#444', fontFamily: 'var(--font-mono)', pointerEvents: 'none' }}>
          scroll to zoom · drag to pan
        </div>
      </div>
    </div>
  );
}

function NetworkingPage() {
  const isMobile   = useIsMobile();
  const [contacts, setContacts]     = React.useState([]);
  const [view, setView]             = React.useState('graph');
  const [showAdd, setShowAdd]       = React.useState(false);
  const [selectedId, setSelectedId] = React.useState(null);
  const [loadingNet, setLoadingNet] = React.useState(true);
  const [form, setForm]             = React.useState({ name: '', role: '', company: '', school: '', location: '', linkedIn: '', notes: '' });
  const [editing, setEditing]       = React.useState(null); // contact being edited
  const [editForm, setEditForm]     = React.useState({});
  const [edgeFilters, setEdgeFilters] = React.useState({ company: true, school: true, location: true });
  const [touchingId, setTouchingId] = React.useState(null);

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

  async function touchContact(id) {
    setTouchingId(id);
    try {
      await fetch(`${API_URL}/contacts/${id}/touch`, { method: 'POST' });
      const now = new Date().toISOString();
      setContacts(p => p.map(c => c.id === id ? { ...c, lastContactedAt: now } : c));
    } catch {}
    setTouchingId(null);
  }

  function daysSince(ts) {
    if (!ts) return null;
    return Math.floor((Date.now() - new Date(ts)) / 86400000);
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
  // Compute hub counts for subtitle
  const hubGraph = React.useMemo(() => buildHubGraph(contacts, edgeFilters), [contacts.length, JSON.stringify(edgeFilters)]);

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
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
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
          <p className="page-sub">{contacts.length} contacts · {hubGraph.hubNodes.length} clusters</p>
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
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
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
                {/* Cluster memberships */}
                {(() => {
                  const tags = [];
                  if (selected?.company && edgeFilters.company) tags.push(`🏢 ${selected.company}`);
                  if (selected?.school  && edgeFilters.school)  tags.push(`🎓 ${selected.school}`);
                  if (selected?.location && edgeFilters.location) tags.push(`📍 ${selected.location}`);
                  if (tags.length === 0) return null;
                  return (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--fg3)' }}>
                      Connected via: {tags.join(' · ')}
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={() => touchContact(selected.id)} disabled={touchingId === selected.id}
                  style={{ padding: '4px 10px', background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {touchingId === selected.id ? '…' : '✓ Touch'}
                </button>
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
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 }}>
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
              {members.map(c => {
                const days = daysSince(c.lastContactedAt);
                const stale = days !== null && days > 30;
                const warn = days !== null && days > 14 && days <= 30;
                return (
                  <div key={c.id} className="card" style={{ padding: '12px 16px', marginBottom: 6, display: 'flex', gap: 12, alignItems: 'center', borderLeft: stale ? '3px solid #ef4444' : warn ? '3px solid #f59e0b' : undefined }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--red-dim)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 11, flexShrink: 0 }}>
                      {initials(c.name)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg3)', marginTop: 1 }}>
                        {[c.role, c.school, c.location].filter(Boolean).join(' · ')}
                      </div>
                      {days !== null && (
                        <div style={{ fontSize: 10, marginTop: 3, color: stale ? '#ef4444' : warn ? '#f59e0b' : 'var(--fg3)', fontFamily: 'var(--font-mono)' }}>
                          {stale ? '⚠ ' : ''}Last contact: {days === 0 ? 'today' : `${days}d ago`}
                        </div>
                      )}
                      {days === null && (
                        <div style={{ fontSize: 10, marginTop: 3, color: 'var(--fg3)', fontFamily: 'var(--font-mono)' }}>Never contacted</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                      <button onClick={() => touchContact(c.id)} disabled={touchingId === c.id}
                        style={{ padding: '4px 8px', background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {touchingId === c.id ? '…' : '✓ Touch'}
                      </button>
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
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AI ASSISTANT PAGE ────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  { text: "What's moved the most in my watchlist today?", icon: "📈" },
  { text: "Summarize my portfolio P&L",                  icon: "💼" },
  { text: "Who in my network works in private credit?",  icon: "🕸" },
  { text: "What are the key macro risks this week?",     icon: "⚠" },
  { text: "Draft talking points for my next investor meeting", icon: "📋" },
  { text: "Add Jane Smith at Goldman to my network",     icon: "➕" },
  { text: "Log a note on SONY titled 'Q2 thesis'",       icon: "📝" },
];

function AssistantPage() {
  const isMobile = useIsMobile();
  const [conversations, setConversations] = React.useState([]);
  const [activeId,      setActiveId]      = React.useState(null);
  const [messages,      setMessages]      = React.useState([]);
  const [input,         setInput]         = React.useState('');
  const [loading,       setLoading]       = React.useState(false);
  const [loadingConvos, setLoadingConvos] = React.useState(true);
  const [sidebarOpen,   setSidebarOpen]   = React.useState(() => window.innerWidth >= 720);
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
          ? `${errMsg}\n\nMake sure GROQ_API_KEY is set in your Render environment variables.`
          : errMsg;
        setMessages(p => [...p, { role: 'assistant', content: hint, timestamp: new Date() }]);
      } else if (data.conversationId) {
        setActiveId(data.conversationId);
        setMessages(p => [...p, { role: 'assistant', content: data.message, action: data.action || null, timestamp: new Date() }]);
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
    <div style={{ display: 'flex', height: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* Conversation sidebar — on mobile shows as overlay */}
      {sidebarOpen && (
        <div style={{
          width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderRight: '1px solid var(--bdr)', background: 'var(--bg)',
          ...(isMobile ? { position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 100, boxShadow: '4px 0 20px rgba(0,0,0,0.4)' } : {})
        }}>
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
                  <button key={p.text} onClick={() => sendMessage(p.text)}
                    style={{ padding: '12px 16px', background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 10, fontSize: 13, color: 'var(--fg2)', cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surf2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--surf)'}>
                    <span style={{ fontSize: 16 }}>{p.icon}</span>
                    {p.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            // Strip action confirmation prefix from assistant content to avoid duplication
            const actionIcons = { add_contact: '👤', add_note: '📝', move_deal: '📌' };
            const bodyContent = m.action
              ? m.content.replace(m.action.confirmation + '\n\n', '').replace(m.action.confirmation, '').trimStart()
              : m.content;
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '100%', gap: 6 }}>
                {/* Action confirmation card */}
                {m.action && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)',
                    borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#4ade80',
                    maxWidth: '72%',
                  }}>
                    <span>{actionIcons[m.action.type] || '✓'}</span>
                    <span>{m.action.confirmation.replace(/^\✓\s*/, '')}</span>
                  </div>
                )}
                <div style={{
                  maxWidth: '72%', padding: '12px 16px', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: m.role === 'user' ? 'var(--red)' : 'var(--surf)',
                  color: m.role === 'user' ? 'white' : 'var(--fg)',
                  fontSize: 13, lineHeight: 1.6,
                  border: m.role === 'assistant' ? '1px solid var(--bdr)' : 'none',
                }}>
                  {m.role === 'assistant' ? renderContent(bodyContent) : m.content}
                </div>
                {m.timestamp && (
                  <div style={{ fontSize: 10, color: 'var(--fg3)', marginTop: 0, padding: '0 4px' }}>
                    {formatTime(m.timestamp)}
                  </div>
                )}
              </div>
            );
          })}

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
            Powered by Llama 3.3 (Groq) · Live data injected from your dashboard
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── NOTES PAGE ───────────────────────────────────────────────────────────────

function NotesPage() {
  const isMobile   = useIsMobile();
  const [notes,      setNotes]      = React.useState([]);
  const [loading,    setLoading]    = React.useState(true);
  const [search,     setSearch]     = React.useState('');
  const [activeTag,  setActiveTag]  = React.useState(null);
  const [showForm,   setShowForm]   = React.useState(false);
  const [editing,    setEditing]    = React.useState(null);  // note being edited
  const [form,       setForm]       = React.useState({ title: '', body: '', ticker: '', tags: '' });
  const [expanded,   setExpanded]   = React.useState(null);  // note id expanded
  // Voice capture
  const [recording,  setRecording]  = React.useState(false);
  const [voiceStatus, setVoiceStatus] = React.useState('');
  const recognitionRef = React.useRef(null);

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

  function startVoiceCapture() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus('Voice capture not supported in this browser. Try Chrome or Safari.');
      setTimeout(() => setVoiceStatus(''), 4000);
      return;
    }
    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = false;
    recog.lang = 'en-US';
    recognitionRef.current = recog;
    let transcript = '';

    recog.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) transcript += e.results[i][0].transcript + ' ';
      }
    };
    recog.onerror = (e) => {
      setRecording(false);
      setVoiceStatus('Voice error: ' + e.error);
      setTimeout(() => setVoiceStatus(''), 4000);
    };
    recog.onend = async () => {
      setRecording(false);
      if (!transcript.trim()) { setVoiceStatus(''); return; }
      setVoiceStatus('Summarizing with AI…');
      try {
        // Send transcript to assistant to summarize as bullet points
        const res = await fetch(`${API_URL}/assistant/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Please summarize the following voice note into concise bullet points and create a title for it. Return ONLY title on first line, then bullets starting with "• ". Voice note: "${transcript.trim()}"`,
            conversationId: null,
          }),
        });
        const data = await res.json();
        if (data.message) {
          const lines = data.message.trim().split('\n').filter(Boolean);
          const title = lines[0].replace(/^(title:|#+ ?)/i, '').trim() || 'Voice Note';
          const body = lines.slice(1).join('\n');
          const payload = {
            title: title + ' 🎙',
            body,
            tags: ['voice'],
          };
          const noteRes = await fetch(`${API_URL}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const created = await noteRes.json();
          setNotes(p => [created, ...p]);
          setVoiceStatus('✓ Note saved!');
        }
      } catch {
        setVoiceStatus('Could not summarize. Try again.');
      }
      setTimeout(() => setVoiceStatus(''), 3000);
    };

    recog.start();
    setRecording(true);
    setVoiceStatus('Listening… tap mic to stop');
  }

  function stopVoiceCapture() {
    recognitionRef.current?.stop();
    setRecording(false);
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
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
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
          <p className="page-sub">{notes.length} note{notes.length !== 1 ? 's' : ''} · {notes.filter(n => n.pinned).length} pinned</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Voice status */}
          {voiceStatus && (
            <span style={{ fontSize: 11, color: voiceStatus.startsWith('✓') ? '#4ade80' : 'var(--fg3)', fontFamily: 'var(--font-mono)', animation: recording ? 'pulse 1s infinite' : 'none' }}>
              {voiceStatus}
            </span>
          )}
          {/* Mic button */}
          <button onClick={recording ? stopVoiceCapture : startVoiceCapture}
            title={recording ? 'Stop recording' : 'Voice capture → AI note'}
            style={{ padding: '8px 10px', background: recording ? '#ef4444' : 'var(--surf)', color: recording ? 'white' : 'var(--fg3)', border: `1px solid ${recording ? '#ef4444' : 'var(--bdr)'}`, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            {recording ? 'Stop' : 'Voice'}
          </button>
          <button onClick={openNew}
            style={{ padding: '8px 16px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            + Note
          </button>
        </div>
      </div>

      {/* Search + tag filter */}
      <div style={{ marginBottom: 12, position: 'relative' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes…"
          style={{ width: '100%', padding: '10px 16px 10px 36px', border: '1px solid var(--bdr)', borderRadius: 10, fontSize: 13, background: 'var(--surf)', color: 'var(--fg)', boxSizing: 'border-box' }} />
        <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg3)', fontSize: 14 }}>⌕</div>
      </div>
      {/* Tag filter chips */}
      {(() => {
        const allTags = [...new Set(notes.flatMap(n => n.tags || []))];
        if (allTags.length === 0) return null;
        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {allTags.map(tag => (
              <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                style={{ padding: '3px 10px', borderRadius: 20, border: `1px solid ${activeTag === tag ? 'var(--red)' : 'var(--bdr)'}`,
                  background: activeTag === tag ? 'var(--red-dim)' : 'var(--surf)', color: activeTag === tag ? 'var(--red)' : 'var(--fg3)',
                  fontSize: 11, cursor: 'pointer', fontWeight: activeTag === tag ? 700 : 400 }}>
                #{tag}
              </button>
            ))}
          </div>
        );
      })()}

      {loading && <div style={{ textAlign: 'center', padding: 48, color: 'var(--fg3)', fontSize: 13 }}>Loading…</div>}

      {!loading && notes.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>📝</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>No notes yet</div>
          <div style={{ color: 'var(--fg3)', fontSize: 13, marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>
            Capture investment theses, meeting prep, research — linked to tickers and contacts.
          </div>
          <button onClick={openNew} style={{ padding: '10px 22px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Create your first note
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
        {notes.filter(note => !activeTag || (note.tags || []).includes(activeTag)).map(note => (
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
  const isMobile   = useIsMobile();
  const [deals,    setDeals]    = React.useState([]);
  const [loading,  setLoading]  = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [selected, setSelected] = React.useState(null);  // deal _id expanded
  const [mobileStage, setMobileStage] = React.useState('watching'); // mobile filter
  const [form,     setForm]     = React.useState({ company: '', ticker: '', stage: 'watching', thesis: '', targetPrice: '', catalysts: '', risks: '', notes: '', priority: 'medium' });
  const [memoLoading, setMemoLoading] = React.useState(null); // deal _id loading memo
  const [expandedMemo, setExpandedMemo] = React.useState(null); // deal _id showing memo

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

  async function generateMemo(deal, e) {
    e.stopPropagation();
    setMemoLoading(deal._id);
    try {
      const res = await fetch(`${API_URL}/memos/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal._id }),
      });
      const data = await res.json();
      if (data.memo) {
        setDeals(p => p.map(d => d._id === deal._id ? { ...d, memo: data.memo } : d));
        setExpandedMemo(deal._id);
      }
    } catch {}
    setMemoLoading(null);
  }

  function dealAgeDays(deal) {
    const ts = deal.updatedAt || deal.createdAt;
    if (!ts) return null;
    return Math.floor((Date.now() - new Date(ts)) / 86400000);
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
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 10 }}>
                <div><div style={labelStyle}>Company *</div><input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="Company name" required style={fieldStyle} /></div>
                <div><div style={labelStyle}>Ticker</div><input value={form.ticker} onChange={e => setForm(p => ({ ...p, ticker: e.target.value }))} placeholder="e.g. AAPL" style={fieldStyle} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
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
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>🔭</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>No deals tracked yet</div>
          <div style={{ color: 'var(--fg3)', fontSize: 13, marginBottom: 20, maxWidth: 380, margin: '0 auto 20px' }}>
            Track investment ideas from first look through exit. Build your thesis, log catalysts and risks, move deals through stages.
          </div>
          <button onClick={() => { setForm(EMPTY_FORM); setShowForm(true); }} style={{ padding: '10px 22px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Add your first deal
          </button>
        </div>
      )}

      {/* Stats row */}
      {!loading && deals.length > 0 && (
        <div className="kpi-grid" style={{ gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', marginBottom: 16 }}>
          {[
            { label: 'Watching', value: byStage['watching']?.length || 0, color: '#6b7280' },
            { label: 'Thesis / Conviction', value: ((byStage['thesis']?.length || 0) + (byStage['conviction']?.length || 0)), color: '#A855F7' },
            { label: 'In Position', value: byStage['position']?.length || 0, color: '#22c55e' },
            { label: 'Total Tracked', value: deals.length, color: 'var(--fg)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="stat-card">
              <span className="stat-label">{label}</span>
              <span className="stat-value" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── MOBILE: stage filter chips + flat list ── */}
      {!loading && deals.length > 0 && isMobile && (
        <div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
            {DEAL_STAGES.map(stage => {
              const count = byStage[stage.id]?.length || 0;
              const active = mobileStage === stage.id;
              return (
                <button key={stage.id} onClick={() => setMobileStage(stage.id)}
                  style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${active ? stage.color : 'var(--bdr)'}`,
                    background: active ? `${stage.color}22` : 'var(--surf)', color: active ? stage.color : 'var(--fg3)',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {stage.label} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(byStage[mobileStage] || []).length === 0 && (
              <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--fg3)', fontSize: 13 }}>
                No deals in this stage
              </div>
            )}
            {(byStage[mobileStage] || []).map(deal => {
              const stageIdx = DEAL_STAGES.findIndex(s => s.id === deal.stage);
              const stage = DEAL_STAGES[stageIdx];
              return (
                <div key={deal._id} className="card" style={{ padding: '14px 16px', borderLeft: `3px solid ${stage.color}` }} onClick={() => openEdit(deal)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg)' }}>{deal.company}</div>
                      {deal.ticker && <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--red)' }}>{deal.ticker}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: `${PRIORITY_COLOR[deal.priority]}22`, color: PRIORITY_COLOR[deal.priority], fontWeight: 700, textTransform: 'uppercase' }}>{deal.priority}</span>
                      <button onClick={e => deleteDeal(deal._id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--fg3)', padding: 2 }}>✕</button>
                    </div>
                  </div>
                  {deal.thesis && <div style={{ fontSize: 12, color: 'var(--fg3)', lineHeight: 1.5, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{deal.thesis}</div>}
                  {deal.targetPrice && <div style={{ fontSize: 12, color: '#22c55e', fontFamily: 'var(--font-mono)' }}>Target: ${deal.targetPrice}</div>}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    {stageIdx > 0 && <button onClick={e => { e.stopPropagation(); moveStage(deal, -1); setMobileStage(DEAL_STAGES[stageIdx-1].id); }} style={{ flex: 1, padding: '5px 0', background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: 'var(--fg3)', fontWeight: 600 }}>← Back</button>}
                    {stageIdx < DEAL_STAGES.length - 1 && <button onClick={e => { e.stopPropagation(); moveStage(deal, 1); setMobileStage(DEAL_STAGES[stageIdx+1].id); }} style={{ flex: 1, padding: '5px 0', background: 'var(--surf2)', border: `1px solid ${DEAL_STAGES[stageIdx+1].color}55`, borderRadius: 6, fontSize: 11, cursor: 'pointer', color: DEAL_STAGES[stageIdx+1].color, fontWeight: 700 }}>Next →</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DESKTOP: pipeline kanban ── */}
      {!loading && deals.length > 0 && !isMobile && (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 12 }}>
          {DEAL_STAGES.map(stage => {
            const stageDeals = byStage[stage.id] || [];
            return (
              <div key={stage.id} style={{ minWidth: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', borderRadius: 8, background: 'var(--surf)', border: '1px solid var(--bdr)', borderTop: `2px solid ${stage.color}` }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: stage.color }}>{stage.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--fg3)', marginLeft: 'auto' }}>{stageDeals.length}</span>
                </div>
                {stageDeals.map(deal => {
                  const stageIdx = DEAL_STAGES.findIndex(s => s.id === deal.stage);
                  const age = dealAgeDays(deal);
                  const isStale = age !== null && age > 21;
                  return (
                    <div key={deal._id} className="card" style={{ padding: '12px 14px', cursor: 'pointer', transition: 'border-color 0.15s', borderLeft: isStale ? '2px solid #f59e0b' : undefined }} onClick={() => openEdit(deal)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.company}</div>
                          {deal.ticker && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--red)', marginTop: 1 }}>{deal.ticker}</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: `${PRIORITY_COLOR[deal.priority]}22`, color: PRIORITY_COLOR[deal.priority], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {deal.priority}
                          </span>
                          {isStale && <span style={{ fontSize: 9, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>{age}d old</span>}
                          <button onClick={e => deleteDeal(deal._id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--fg3)', padding: '1px 2px', lineHeight: 1 }}>✕</button>
                        </div>
                      </div>
                      {deal.thesis && <div style={{ fontSize: 11, color: 'var(--fg3)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 8 }}>{deal.thesis}</div>}
                      {deal.targetPrice && <div style={{ fontSize: 11, color: '#22c55e', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>Target: ${deal.targetPrice}</div>}
                      {(deal.catalysts?.length > 0 || deal.risks?.length > 0) && (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                          {deal.catalysts?.length > 0 && <span style={{ fontSize: 9, color: '#22c55e', fontFamily: 'var(--font-mono)' }}>↑ {deal.catalysts.length} catalyst{deal.catalysts.length > 1 ? 's' : ''}</span>}
                          {deal.risks?.length > 0 && <span style={{ fontSize: 9, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>⚠ {deal.risks.length} risk{deal.risks.length > 1 ? 's' : ''}</span>}
                        </div>
                      )}
                      {/* Memo section */}
                      {deal.memo && expandedMemo === deal._id && (
                        <div onClick={e => e.stopPropagation()} style={{ marginBottom: 8, padding: '8px 10px', background: 'var(--surf2)', borderRadius: 6, border: '1px solid var(--bdr)', fontSize: 10, color: 'var(--fg2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>
                          {deal.memo}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                        {stageIdx > 0 && <button onClick={e => { e.stopPropagation(); moveStage(deal, -1); }} style={{ flex: 1, padding: '3px 0', background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 5, fontSize: 10, cursor: 'pointer', color: 'var(--fg3)', fontWeight: 600 }}>← Back</button>}
                        {stageIdx < DEAL_STAGES.length - 1 && <button onClick={e => { e.stopPropagation(); moveStage(deal, 1); }} style={{ flex: 1, padding: '3px 0', background: 'var(--surf2)', border: `1px solid ${DEAL_STAGES[stageIdx + 1].color}44`, borderRadius: 5, fontSize: 10, cursor: 'pointer', color: DEAL_STAGES[stageIdx + 1].color, fontWeight: 700 }}>Next →</button>}
                        <button onClick={e => deal.memo ? (e.stopPropagation(), setExpandedMemo(expandedMemo === deal._id ? null : deal._id)) : generateMemo(deal, e)}
                          disabled={memoLoading === deal._id}
                          style={{ padding: '3px 7px', background: deal.memo ? 'rgba(168,85,247,0.1)' : 'var(--surf2)', border: `1px solid ${deal.memo ? '#A855F744' : 'var(--bdr)'}`, borderRadius: 5, fontSize: 10, cursor: 'pointer', color: deal.memo ? '#A855F7' : 'var(--fg3)', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
                          {memoLoading === deal._id ? '…' : deal.memo ? (expandedMemo === deal._id ? 'Hide' : 'Memo') : 'AI Memo'}
                        </button>
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
  const isMobile   = useIsMobile();
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

  function daysUntil(d) {
    const diff = new Date(d) - new Date();
    const days = Math.ceil(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `in ${days}d`;
  }

  const upcoming = meetings.filter(m => m.status === 'upcoming' && isUpcoming(m.date));
  const past     = meetings.filter(m => m.status === 'completed' || !isUpcoming(m.date));
  const nextMeeting = upcoming.sort((a, b) => new Date(a.date) - new Date(b.date))[0];

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
              {isUpcoming(meeting.date) && <span style={{ fontSize: 10, padding: '1px 6px', background: 'var(--red-dim)', color: 'var(--red)', borderRadius: 4, fontWeight: 700 }}>{daysUntil(meeting.date)}</span>}
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
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
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

      {/* Stats row */}
      {!loading && meetings.length > 0 && (
        <div className="kpi-grid" style={{ gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', marginBottom: 16 }}>
          <div className="stat-card accent">
            <span className="stat-label">Next Meeting</span>
            {nextMeeting ? <>
              <span className="stat-value" style={{ fontSize: 16 }}>{nextMeeting.contactName.split(' ')[0]}</span>
              <span className="stat-change" style={{ color: 'var(--green)' }}>{daysUntil(nextMeeting.date)}</span>
            </> : <>
              <span className="stat-value">—</span>
              <span className="stat-change" style={{ color: 'var(--fg3)' }}>none scheduled</span>
            </>}
          </div>
          <div className="stat-card">
            <span className="stat-label">Upcoming</span>
            <span className="stat-value">{upcoming.length}</span>
            <span className="stat-change" style={{ color: 'var(--fg3)' }}>calls scheduled</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Completed</span>
            <span className="stat-value">{past.length}</span>
            <span className="stat-change" style={{ color: 'var(--fg3)' }}>{past.filter(m => m.brief).length} with AI briefs</span>
          </div>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 48, color: 'var(--fg3)' }}>Loading…</div>}

      {!loading && meetings.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>📅</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>No meetings yet</div>
          <div style={{ color: 'var(--fg3)', fontSize: 13, marginBottom: 20, maxWidth: 380, margin: '0 auto 20px' }}>
            Schedule meetings with your network contacts. Get AI-generated briefs before each call and log post-call notes after.
          </div>
          <button onClick={() => setShowForm(true)} style={{ padding: '10px 22px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
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

// ─── TRADE JOURNAL PAGE ───────────────────────────────────────────────────────

const TIMEFRAME_COLORS = { day: '#f59e0b', swing: '#3b82f6', position: '#a855f7', 'long-term': '#22c55e' };
const OUTCOME_COLORS   = { confirmed: '#22c55e', invalidated: '#ef4444', partial: '#f59e0b', pending: 'var(--fg3)' };
const OUTCOME_LABELS   = { confirmed: '✓ Confirmed', invalidated: '✗ Invalidated', partial: '~ Partial', pending: '⏳ Pending' };
const ACTION_COLORS    = { buy: '#22c55e', sell: '#ef4444', short: '#f97316', cover: '#3b82f6' };

function JournalPage() {
  const isMobile = useIsMobile();
  const [trades,    setTrades]    = React.useState([]);
  const [stats,     setStats]     = React.useState(null);
  const [loading,   setLoading]   = React.useState(true);
  const [filter,    setFilter]    = React.useState('all');
  const [showForm,  setShowForm]  = React.useState(false);
  const [closing,   setClosing]   = React.useState(null); // trade being closed
  const [expanded,  setExpanded]  = React.useState(null);
  const [form, setForm] = React.useState({ ticker:'', action:'buy', date: new Date().toISOString().slice(0,16), price:'', quantity:'', thesis:'', timeframe:'position', conviction:7, catalysts:'' });
  const [closeForm, setCloseForm] = React.useState({ exitPrice:'', exitDate: new Date().toISOString().slice(0,10), thesisOutcome:'pending', postMortem:'' });

  const EMPTY_FORM = { ticker:'', action:'buy', date: new Date().toISOString().slice(0,16), price:'', quantity:'', thesis:'', timeframe:'position', conviction:7, catalysts:'' };

  function loadAll() {
    const q = filter === 'all' ? '' : `?status=${filter}`;
    Promise.all([
      fetch(`${API_URL}/trades${q}`).then(r => r.json()).catch(() => []),
      fetch(`${API_URL}/trades/stats`).then(r => r.json()).catch(() => null),
    ]).then(([t, s]) => { setTrades(Array.isArray(t) ? t : []); setStats(s); setLoading(false); });
  }
  React.useEffect(() => { setLoading(true); loadAll(); }, [filter]);

  async function saveTrade(e) {
    e.preventDefault();
    const payload = { ...form, price: parseFloat(form.price), quantity: parseFloat(form.quantity), catalysts: form.catalysts.split('\n').filter(Boolean) };
    const res = await fetch(`${API_URL}/trades`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const created = await res.json();
    setTrades(p => [created, ...p]);
    setShowForm(false); setForm(EMPTY_FORM);
    fetch(`${API_URL}/trades/stats`).then(r=>r.json()).then(setStats).catch(()=>{});
  }

  async function closeTrade(e) {
    e.preventDefault();
    if (!closing) return;
    const payload = { status:'closed', exitPrice: parseFloat(closeForm.exitPrice), exitDate: closeForm.exitDate, thesisOutcome: closeForm.thesisOutcome, postMortem: closeForm.postMortem };
    const res = await fetch(`${API_URL}/trades/${closing._id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const updated = await res.json();
    setTrades(p => p.map(t => t._id === closing._id ? updated : t));
    setClosing(null);
    fetch(`${API_URL}/trades/stats`).then(r=>r.json()).then(setStats).catch(()=>{});
  }

  async function deleteTrade(id, e) {
    e.stopPropagation();
    await fetch(`${API_URL}/trades/${id}`, { method:'DELETE' });
    setTrades(p => p.filter(t => t._id !== id));
    fetch(`${API_URL}/trades/stats`).then(r=>r.json()).then(setStats).catch(()=>{});
  }

  function tradePnl(t) {
    if (t.status !== 'closed' || !t.exitPrice) return null;
    const mult = (t.action === 'buy' || t.action === 'cover') ? 1 : -1;
    return { val: mult * (t.exitPrice - t.price) * t.quantity, pct: mult * (t.exitPrice - t.price) / t.price * 100 };
  }

  const fld = { width:'100%', padding:'8px 12px', border:'1px solid var(--bdr)', borderRadius:8, fontSize:13, background:'var(--surf)', color:'var(--fg)', boxSizing:'border-box' };
  const lbl = { fontSize:11, color:'var(--fg3)', marginBottom:4, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' };
  const visibleTrades = filter === 'all' ? trades : trades.filter(t => t.status === filter);

  return (
    <div className="page-root">
      {/* Add trade modal */}
      {showForm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
          onClick={e => { if (e.target===e.currentTarget) setShowForm(false); }}>
          <div style={{background:'var(--bg)',border:'1px solid var(--bdr)',borderRadius:14,padding:24,width:'100%',maxWidth:560,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
              <div style={{fontWeight:700,fontSize:15}}>Log Trade</div>
              <button onClick={() => setShowForm(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:'var(--fg3)'}}>✕</button>
            </div>
            <form onSubmit={saveTrade} style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:10}}>
                <div><div style={lbl}>Ticker *</div><input value={form.ticker} onChange={e=>setForm(p=>({...p,ticker:e.target.value.toUpperCase()}))} placeholder="AAPL" required style={fld}/></div>
                <div><div style={lbl}>Action *</div>
                  <select value={form.action} onChange={e=>setForm(p=>({...p,action:e.target.value}))} style={fld}>
                    {['buy','sell','short','cover'].map(a=><option key={a} value={a}>{a.charAt(0).toUpperCase()+a.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr 1fr',gap:10}}>
                <div><div style={lbl}>Price *</div><input type="number" step="0.01" value={form.price} onChange={e=>setForm(p=>({...p,price:e.target.value}))} placeholder="0.00" required style={fld}/></div>
                <div><div style={lbl}>Quantity *</div><input type="number" step="0.01" value={form.quantity} onChange={e=>setForm(p=>({...p,quantity:e.target.value}))} placeholder="0" required style={fld}/></div>
                <div><div style={lbl}>Date *</div><input type="datetime-local" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} required style={fld}/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:10}}>
                <div><div style={lbl}>Timeframe</div>
                  <select value={form.timeframe} onChange={e=>setForm(p=>({...p,timeframe:e.target.value}))} style={fld}>
                    {['day','swing','position','long-term'].map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><div style={lbl}>Conviction {form.conviction}/10</div>
                  <input type="range" min={1} max={10} value={form.conviction} onChange={e=>setForm(p=>({...p,conviction:Number(e.target.value)}))}
                    style={{width:'100%',marginTop:10,accentColor:'var(--red)'}}/>
                </div>
              </div>
              <div><div style={lbl}>Investment Thesis</div>
                <textarea value={form.thesis} onChange={e=>setForm(p=>({...p,thesis:e.target.value}))} placeholder="Why this trade? What's the edge?" rows={3} style={{...fld,resize:'vertical',lineHeight:1.6}}/>
              </div>
              <div><div style={lbl}>Catalysts (one per line)</div>
                <textarea value={form.catalysts} onChange={e=>setForm(p=>({...p,catalysts:e.target.value}))} placeholder="Earnings beat&#10;Product launch" rows={2} style={{...fld,resize:'vertical'}}/>
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
                <button type="button" onClick={()=>setShowForm(false)} style={{padding:'9px 18px',background:'transparent',color:'var(--fg3)',border:'1px solid var(--bdr)',borderRadius:8,fontSize:13,cursor:'pointer'}}>Cancel</button>
                <button type="submit" style={{padding:'9px 20px',background:'var(--red)',color:'white',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>Log Trade</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close trade modal */}
      {closing && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
          onClick={e=>{if(e.target===e.currentTarget)setClosing(null);}}>
          <div style={{background:'var(--bg)',border:'1px solid var(--bdr)',borderRadius:14,padding:24,width:'100%',maxWidth:460}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Close Trade — {closing.ticker}</div>
            <div style={{fontSize:12,color:'var(--fg3)',marginBottom:18}}>Entry: ${closing.price} × {closing.quantity} shares</div>
            <form onSubmit={closeTrade} style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div><div style={lbl}>Exit Price *</div><input type="number" step="0.01" value={closeForm.exitPrice} onChange={e=>setCloseForm(p=>({...p,exitPrice:e.target.value}))} placeholder="0.00" required style={fld}/></div>
                <div><div style={lbl}>Exit Date</div><input type="date" value={closeForm.exitDate} onChange={e=>setCloseForm(p=>({...p,exitDate:e.target.value}))} style={fld}/></div>
              </div>
              <div><div style={lbl}>Thesis Outcome</div>
                <select value={closeForm.thesisOutcome} onChange={e=>setCloseForm(p=>({...p,thesisOutcome:e.target.value}))} style={fld}>
                  <option value="confirmed">✓ Confirmed — thesis played out</option>
                  <option value="partial">~ Partial — partially right</option>
                  <option value="invalidated">✗ Invalidated — thesis was wrong</option>
                  <option value="pending">⏳ Pending — still watching</option>
                </select>
              </div>
              <div><div style={lbl}>Post-Mortem / Lessons</div>
                <textarea value={closeForm.postMortem} onChange={e=>setCloseForm(p=>({...p,postMortem:e.target.value}))} placeholder="What happened? What did you learn?" rows={3} style={{...fld,resize:'vertical',lineHeight:1.6}}/>
              </div>
              {closeForm.exitPrice && (
                (() => {
                  const mult = (closing.action==='buy'||closing.action==='cover')?1:-1;
                  const pnl = mult*(parseFloat(closeForm.exitPrice)-closing.price)*closing.quantity;
                  const pct = mult*(parseFloat(closeForm.exitPrice)-closing.price)/closing.price*100;
                  return <div style={{padding:'10px 14px',background:pnl>=0?'rgba(34,197,94,0.08)':'rgba(239,68,68,0.08)',border:`1px solid ${pnl>=0?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.3)'}`,borderRadius:8,fontSize:13,fontFamily:'var(--font-mono)',fontWeight:700,color:pnl>=0?'#22c55e':'#ef4444'}}>
                    P&L: {pnl>=0?'+':''}{pnl.toFixed(2)} ({pct>=0?'+':''}{pct.toFixed(2)}%)
                  </div>;
                })()
              )}
              <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
                <button type="button" onClick={()=>setClosing(null)} style={{padding:'9px 18px',background:'transparent',color:'var(--fg3)',border:'1px solid var(--bdr)',borderRadius:8,fontSize:13,cursor:'pointer'}}>Cancel</button>
                <button type="submit" style={{padding:'9px 20px',background:'var(--red)',color:'white',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>Close Trade</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
        <div>
          <h1 className="page-title">Trade Journal</h1>
          <p className="page-sub">{trades.length} trades logged{stats?.winRate!=null?` · ${stats.winRate.toFixed(0)}% win rate`:''}</p>
        </div>
        <button onClick={()=>setShowForm(true)} style={{padding:'8px 16px',background:'var(--red)',color:'white',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',flexShrink:0}}>+ Log Trade</button>
      </div>

      {/* Stats */}
      {stats && stats.totalTrades > 0 && (
        <div className="kpi-grid" style={{gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(4,1fr)',marginBottom:16}}>
          {[
            { label:'Win Rate',        value: stats.winRate!=null ? `${stats.winRate.toFixed(0)}%` : '—',  color: stats.winRate>=50?'#22c55e':'#ef4444' },
            { label:'Total P&L',       value: stats.totalPnl!=null ? `${stats.totalPnl>=0?'+':''}$${Math.abs(stats.totalPnl).toFixed(0)}` : '—', color: stats.totalPnl>=0?'#22c55e':'#ef4444' },
            { label:'Thesis Accuracy', value: stats.thesisAccuracy!=null ? `${stats.thesisAccuracy.toFixed(0)}%` : '—', color:'var(--fg)' },
            { label:'Avg Conviction',  value: stats.avgConviction!=null ? `${stats.avgConviction.toFixed(1)}/10` : '—', color:'var(--fg)' },
          ].map(({label,value,color})=>(
            <div key={label} className="stat-card"><span className="stat-label">{label}</span><span className="stat-value" style={{color}}>{value}</span></div>
          ))}
        </div>
      )}

      {/* Filter chips */}
      <div style={{display:'flex',gap:6,marginBottom:14}}>
        {['all','open','closed'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{padding:'5px 14px',borderRadius:20,border:`1px solid ${filter===f?'var(--red)':'var(--bdr)'}`,background:filter===f?'var(--red-dim)':'var(--surf)',color:filter===f?'var(--red)':'var(--fg3)',fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'capitalize'}}>
            {f}
          </button>
        ))}
      </div>

      {loading && <div style={{textAlign:'center',padding:48,color:'var(--fg3)'}}>Loading…</div>}

      {!loading && trades.length===0 && (
        <div className="card" style={{textAlign:'center',padding:'56px 24px'}}>
          <div style={{fontSize:48,marginBottom:14}}>📓</div>
          <div style={{fontWeight:700,fontSize:18,marginBottom:8}}>No trades logged yet</div>
          <div style={{color:'var(--fg3)',fontSize:13,marginBottom:20,maxWidth:380,margin:'0 auto 20px'}}>Track every trade with entry thesis, conviction level, and outcome. Learn from what works and what doesn't.</div>
          <button onClick={()=>setShowForm(true)} style={{padding:'10px 22px',background:'var(--red)',color:'white',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>Log your first trade</button>
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {visibleTrades.map(trade => {
          const pnl = tradePnl(trade);
          const isExp = expanded===trade._id;
          return (
            <div key={trade._id} className="card" style={{cursor:'pointer',borderLeft:`3px solid ${ACTION_COLORS[trade.action]||'var(--bdr)'}`}}
              onClick={()=>setExpanded(isExp?null:trade._id)}>
              <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                    <span style={{fontFamily:'var(--font-mono)',fontWeight:800,fontSize:15,color:'var(--fg)'}}>{trade.ticker}</span>
                    <span style={{fontSize:11,padding:'2px 7px',borderRadius:4,background:`${ACTION_COLORS[trade.action]}22`,color:ACTION_COLORS[trade.action],fontWeight:700,textTransform:'uppercase'}}>{trade.action}</span>
                    <span style={{fontSize:11,padding:'2px 7px',borderRadius:4,background:`${TIMEFRAME_COLORS[trade.timeframe]||'#6b7280'}22`,color:TIMEFRAME_COLORS[trade.timeframe]||'#6b7280',fontWeight:600}}>{trade.timeframe}</span>
                    {trade.status==='closed' && pnl && (
                      <span style={{fontSize:12,fontFamily:'var(--font-mono)',fontWeight:700,color:pnl.val>=0?'#22c55e':'#ef4444'}}>
                        {pnl.val>=0?'+':''}${Math.abs(pnl.val).toFixed(0)} ({pnl.pct>=0?'+':''}{pnl.pct.toFixed(1)}%)
                      </span>
                    )}
                    {trade.status==='closed' && (
                      <span style={{fontSize:10,padding:'2px 7px',borderRadius:4,background:`${OUTCOME_COLORS[trade.thesisOutcome]}22`,color:OUTCOME_COLORS[trade.thesisOutcome],fontWeight:700}}>{OUTCOME_LABELS[trade.thesisOutcome]}</span>
                    )}
                    {trade.status==='open' && <span style={{fontSize:10,padding:'2px 6px',borderRadius:4,background:'rgba(74,222,128,0.1)',color:'#4ade80',fontWeight:700}}>OPEN</span>}
                  </div>
                  <div style={{fontSize:12,color:'var(--fg3)',fontFamily:'var(--font-mono)'}}>
                    ${trade.price.toFixed(2)} × {trade.quantity} · {new Date(trade.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                    {trade.exitPrice ? ` → $${trade.exitPrice.toFixed(2)}` : ''}
                  </div>
                  {trade.thesis && <div style={{fontSize:12,color:'var(--fg2)',marginTop:4,lineHeight:1.5,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:isExp?'unset':2,WebkitBoxOrient:'vertical'}}>{trade.thesis}</div>}
                  {isExp && trade.postMortem && (
                    <div style={{marginTop:8,padding:'8px 12px',background:'var(--surf2)',borderRadius:6,fontSize:12,color:'var(--fg2)',lineHeight:1.6}}>
                      <div style={{fontSize:10,fontWeight:700,color:'var(--fg3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Post-Mortem</div>
                      {trade.postMortem}
                    </div>
                  )}
                  {isExp && trade.catalysts?.length>0 && (
                    <div style={{marginTop:6,display:'flex',gap:6,flexWrap:'wrap'}}>
                      {trade.catalysts.map((c,i)=><span key={i} style={{fontSize:10,padding:'2px 8px',background:'var(--surf2)',borderRadius:4,color:'var(--fg3)'}}>↑ {c}</span>)}
                    </div>
                  )}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:5,alignItems:'flex-end',flexShrink:0}}>
                  <div style={{fontSize:10,color:'var(--fg3)',fontFamily:'var(--font-mono)'}}>C:{trade.conviction}/10</div>
                  {trade.status==='open' && (
                    <button onClick={e=>{e.stopPropagation();setClosing(trade);setCloseForm({exitPrice:'',exitDate:new Date().toISOString().slice(0,10),thesisOutcome:'pending',postMortem:''});}}
                      style={{padding:'4px 10px',background:'var(--surf2)',color:'var(--fg)',border:'1px solid var(--bdr)',borderRadius:6,fontSize:11,cursor:'pointer',fontWeight:600,whiteSpace:'nowrap'}}>
                      Close
                    </button>
                  )}
                  <button onClick={e=>deleteTrade(trade._id,e)} style={{padding:'4px 8px',background:'transparent',color:'var(--fg3)',border:'1px solid var(--bdr)',borderRadius:6,fontSize:11,cursor:'pointer'}}>✕</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SENTIMENT PAGE ───────────────────────────────────────────────────────────

function SentimentPage() {
  const isMobile = useIsMobile();
  const [tickers,   setTickers]   = React.useState([]);
  const [results,   setResults]   = React.useState([]);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analyzed,  setAnalyzed]  = React.useState(false);
  const [addInput,  setAddInput]  = React.useState('');

  // Pre-load portfolio + watchlist tickers
  React.useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/positions`).then(r=>r.ok?r.json():[]).catch(()=>[]),
      fetch(`${API_URL}/watchlist`).then(r=>r.ok?r.json():[]).catch(()=>[]),
    ]).then(([pos, wl]) => {
      const allTickers = [...new Set([
        ...pos.map(p=>p.ticker),
        ...wl.map(w=>w.symbol||w.ticker),
      ])].filter(Boolean).slice(0, 12);
      setTickers(allTickers);
    });
  }, []);

  async function analyze() {
    if (tickers.length === 0) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`${API_URL}/sentiment/analyze`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ tickers }),
      });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setAnalyzed(true);
    } catch { setResults([]); }
    setAnalyzing(false);
  }

  function addTicker() {
    const t = addInput.trim().toUpperCase();
    if (!t || tickers.includes(t)) { setAddInput(''); return; }
    setTickers(p=>[...p, t]);
    setAddInput('');
  }

  function sentimentColor(score) {
    if (score > 0.3) return '#22c55e';
    if (score < -0.3) return '#ef4444';
    return '#6b7280';
  }
  function sentimentLabel(score) {
    if (score > 0.5) return 'Very Bullish';
    if (score > 0.2) return 'Bullish';
    if (score < -0.5) return 'Very Bearish';
    if (score < -0.2) return 'Bearish';
    return 'Neutral';
  }

  return (
    <div className="page-root">
      <div className="page-header" style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
        <div>
          <h1 className="page-title">Sentiment Analysis</h1>
          <p className="page-sub">AI-powered news &amp; social sentiment per ticker</p>
        </div>
        <button onClick={analyze} disabled={analyzing||tickers.length===0}
          style={{padding:'8px 16px',background:analyzing?'var(--surf2)':'var(--red)',color:analyzing?'var(--fg3)':'white',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:analyzing?'default':'pointer',flexShrink:0}}>
          {analyzing ? '⟳ Analyzing…' : '⟳ Analyze'}
        </button>
      </div>

      {/* Ticker selector */}
      <div className="card" style={{marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:'var(--fg3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>Tickers to Analyze</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
          {tickers.map(t=>(
            <div key={t} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',background:'var(--surf2)',border:'1px solid var(--bdr)',borderRadius:20}}>
              <span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:12,color:'var(--fg)'}}>{t}</span>
              <button onClick={()=>setTickers(p=>p.filter(x=>x!==t))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--fg3)',fontSize:12,lineHeight:1,padding:'0 2px'}}>×</button>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:8}}>
          <input value={addInput} onChange={e=>setAddInput(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&addTicker()} placeholder="Add ticker…"
            style={{flex:1,padding:'7px 12px',border:'1px solid var(--bdr)',borderRadius:8,fontSize:13,background:'var(--surf)',color:'var(--fg)'}}/>
          <button onClick={addTicker} style={{padding:'7px 14px',background:'var(--surf2)',color:'var(--fg)',border:'1px solid var(--bdr)',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>Add</button>
        </div>
        <div style={{fontSize:11,color:'var(--fg3)',marginTop:8}}>Pre-loaded from your portfolio &amp; watchlist. Analysis reads recent news headlines through AI.</div>
      </div>

      {!analyzed && !analyzing && (
        <div className="card" style={{textAlign:'center',padding:'48px 24px'}}>
          <div style={{fontSize:44,marginBottom:12}}>📡</div>
          <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>Ready to analyze</div>
          <div style={{color:'var(--fg3)',fontSize:13,maxWidth:380,margin:'0 auto 20px'}}>Click Analyze to run AI sentiment scoring across recent news for each ticker. Takes ~10 seconds.</div>
          <button onClick={analyze} disabled={tickers.length===0} style={{padding:'10px 22px',background:'var(--red)',color:'white',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer'}}>Run Sentiment Analysis</button>
        </div>
      )}

      {analyzing && (
        <div style={{textAlign:'center',padding:48,color:'var(--fg3)'}}>
          <div style={{fontSize:13,marginBottom:8}}>Scanning news &amp; AI scoring {tickers.length} tickers…</div>
          <div style={{fontSize:11,fontFamily:'var(--font-mono)'}}>This takes about 10–20 seconds</div>
        </div>
      )}

      {analyzed && !analyzing && (
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(2,1fr)',gap:10}}>
          {results.map(r => {
            const color = sentimentColor(r.score||0);
            const pct = Math.round(Math.abs(r.score||0)*100);
            const barWidth = `${Math.min(pct,100)}%`;
            return (
              <div key={r.ticker} className="card" style={{padding:'16px 18px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <div>
                    <div style={{fontFamily:'var(--font-mono)',fontWeight:800,fontSize:16,color:'var(--fg)'}}>{r.ticker}</div>
                    <div style={{fontSize:12,fontWeight:700,color,marginTop:2}}>{sentimentLabel(r.score||0)}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:22,fontWeight:800,fontFamily:'var(--font-mono)',color}}>{r.score>=0?'+':''}{((r.score||0)*100).toFixed(0)}</div>
                    <div style={{fontSize:10,color:'var(--fg3)'}}>score</div>
                  </div>
                </div>
                {/* Sentiment bar */}
                <div style={{height:6,background:'var(--surf2)',borderRadius:3,marginBottom:10,overflow:'hidden',position:'relative'}}>
                  <div style={{position:'absolute',left:'50%',top:0,bottom:0,width:1,background:'var(--bdr)'}}/>
                  <div style={{position:'absolute',height:'100%',background:color,borderRadius:3,
                    ...(r.score>=0 ? {left:'50%',width:`${pct/2}%`} : {right:'50%',width:`${pct/2}%`})}}/>
                </div>
                {/* Confidence */}
                {r.confidence!=null && (
                  <div style={{fontSize:11,color:'var(--fg3)',marginBottom:8}}>
                    Confidence: <span style={{fontWeight:600,color:'var(--fg2)'}}>{Math.round((r.confidence||0)*100)}%</span>
                    {r.headline && <span style={{marginLeft:8,fontStyle:'italic'}}>"{r.headline.slice(0,60)}{r.headline.length>60?'…':''}"</span>}
                  </div>
                )}
                {/* Drivers */}
                {r.drivers?.length>0 && (
                  <div style={{display:'flex',flexDirection:'column',gap:3}}>
                    {r.drivers.slice(0,3).map((d,i)=>(
                      <div key={i} style={{fontSize:11,color:'var(--fg3)',paddingLeft:10,borderLeft:`2px solid ${color}44`}}>· {d}</div>
                    ))}
                  </div>
                )}
                {(!r.drivers||r.drivers.length===0) && r.headline && (
                  <div style={{fontSize:11,color:'var(--fg3)'}}>No recent news coverage found</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SCENARIO PAGE ────────────────────────────────────────────────────────────

const SCENARIOS = [
  { id:'tech_selloff', name:'Tech Selloff',     desc:'QQQ −20% AI de-rate',       icon:'💻', color:'#ef4444',
    shocks:{ semis:-0.30, bigtech:-0.20, tech_etf:-0.20, market_etf:-0.12, japan_etf:-0.08, japan:-0.10, gold:0.05, oil:-0.05, general:-0.08 } },
  { id:'market_crash', name:'Market Crash',     desc:'S&P −30%, VIX spikes to 45',icon:'📉', color:'#dc2626',
    shocks:{ semis:-0.40, bigtech:-0.30, tech_etf:-0.30, market_etf:-0.30, japan_etf:-0.22, japan:-0.25, gold:0.12, oil:-0.20, general:-0.28 } },
  { id:'rate_spike',   name:'Rate Spike +100bp',desc:'10Y yield → 6%',             icon:'📈', color:'#f59e0b',
    shocks:{ semis:-0.18, bigtech:-0.15, tech_etf:-0.15, market_etf:-0.10, japan_etf:0.02, japan:0.03, gold:-0.08, oil:0.02, general:-0.08 } },
  { id:'yen_strength', name:'Yen Strength',     desc:'USD/JPY −10% yen rally',     icon:'🇯🇵', color:'#8b5cf6',
    shocks:{ semis:-0.03, bigtech:-0.02, tech_etf:-0.02, market_etf:-0.01, japan_etf:-0.10, japan:-0.12, gold:0.04, oil:0.02, general:-0.02 } },
  { id:'oil_spike',    name:'Oil Spike +30%',   desc:'Brent surges on supply shock',icon:'🛢', color:'#f97316',
    shocks:{ semis:-0.04, bigtech:-0.03, tech_etf:-0.03, market_etf:-0.04, japan_etf:-0.04, japan:-0.05, gold:0.05, oil:0.30, general:-0.04 } },
  { id:'bull_rip',     name:'Bull Market Rip',  desc:'S&P +15%, risk-on everything',icon:'🚀', color:'#22c55e',
    shocks:{ semis:0.28, bigtech:0.18, tech_etf:0.18, market_etf:0.15, japan_etf:0.10, japan:0.12, gold:-0.05, oil:0.06, general:0.12 } },
];

function classifyTicker(ticker) {
  const t = (ticker||'').toUpperCase();
  if (t.endsWith('.T')) return 'japan';
  if (['EWJ','DXJ'].includes(t)) return 'japan_etf';
  if (['NVDA','AMD','TSM','ASML','AMAT','LRCX','MU'].includes(t)) return 'semis';
  if (['MSFT','GOOGL','AAPL','AMZN','META','NFLX'].includes(t)) return 'bigtech';
  if (['QQQ','TQQQ','XLK'].includes(t)) return 'tech_etf';
  if (['SPY','VOO','IVV','VTI'].includes(t)) return 'market_etf';
  if (t.includes('GC') || t==='GOLD' || t==='GLD') return 'gold';
  if (t.includes('CL') || t==='OIL' || t==='USO') return 'oil';
  return 'general';
}

function ScenarioPage() {
  const isMobile = useIsMobile();
  const [positions,  setPositions]  = React.useState([]);
  const [stocks,     setStocks]     = React.useState({});
  const [selected,   setSelected]   = React.useState('tech_selloff');
  const [loading,    setLoading]    = React.useState(true);
  const [customShock, setCustomShock] = React.useState('');
  const [aiNarrative, setAiNarrative] = React.useState('');
  const [aiLoading,  setAiLoading]  = React.useState(false);

  React.useEffect(() => {
    fetch(`${API_URL}/positions`).then(r=>r.ok?r.json():[]).then(pos => {
      setPositions(pos);
      return Promise.all(pos.map(p =>
        fetch(`${API_URL}/stocks/live/${p.ticker}`).then(r=>r.ok?r.json():null).catch(()=>null)
      ));
    }).then(liveData => {
      const map = {};
      liveData.forEach((d,i) => { if (d?.price) map[positions[i]?.ticker||''] = d; });
      // If positions loaded async, use a ref pattern
    }).catch(()=>{});
    // Simpler: fetch positions then stocks
    fetch(`${API_URL}/positions`).then(r=>r.ok?r.json():[]).catch(()=>[]).then(async pos => {
      setPositions(pos);
      const map = {};
      await Promise.all(pos.map(async p => {
        try {
          const d = await fetch(`${API_URL}/stocks/live/${p.ticker}`).then(r=>r.ok?r.json():null);
          if (d?.price) map[p.ticker] = d;
        } catch {}
      }));
      setStocks(map);
      setLoading(false);
    });
  }, []);

  const scenario = SCENARIOS.find(s=>s.id===selected) || SCENARIOS[0];
  const customPct = parseFloat(customShock)/100 || 0;

  function computeImpact(pos) {
    const live = stocks[pos.ticker];
    const price = live?.price || pos.costBasis || 0;
    const value = price * pos.quantity || price * pos.shares || 0;
    const cls = classifyTicker(pos.ticker);
    let shock;
    if (selected === 'custom') {
      shock = customPct;
    } else {
      shock = scenario.shocks[cls] ?? scenario.shocks.general ?? 0;
    }
    return { ticker: pos.ticker, value, shock, impact: value * shock };
  }

  const rows = positions.map(computeImpact).filter(r=>r.value>0);
  const totalValue = rows.reduce((s,r)=>s+r.value, 0);
  const totalImpact = rows.reduce((s,r)=>s+r.impact, 0);
  const totalPct = totalValue > 0 ? totalImpact/totalValue*100 : 0;

  async function getAiNarrative() {
    setAiLoading(true); setAiNarrative('');
    try {
      const sc = selected==='custom' ? `Custom ${customShock}% shock across all positions` : `${scenario.name}: ${scenario.desc}`;
      const msg = `Briefly explain in 3-4 sentences what would happen to this portfolio under the scenario: "${sc}". Total portfolio impact: ${totalPct>=0?'+':''}${totalPct.toFixed(1)}% (${totalImpact>=0?'+':''}$${Math.abs(totalImpact).toFixed(0)}). Top positions: ${rows.slice(0,4).map(r=>`${r.ticker} ${r.shock>=0?'+':''}${(r.shock*100).toFixed(0)}%`).join(', ')}. Be direct, reference specific dynamics like rates, FX, sector rotation. No filler.`;
      const res = await fetch(`${API_URL}/assistant/chat`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ message: msg, conversationId:null }) });
      const data = await res.json();
      setAiNarrative(data.message||'');
    } catch {}
    setAiLoading(false);
  }

  return (
    <div className="page-root">
      <div className="page-header">
        <h1 className="page-title">Portfolio Stress Test</h1>
        <p className="page-sub">Model macro shocks against your current positions</p>
      </div>

      {/* Scenario picker */}
      <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(3,1fr)',gap:8,marginBottom:16}}>
        {SCENARIOS.map(sc=>(
          <button key={sc.id} onClick={()=>{setSelected(sc.id);setAiNarrative('');}}
            style={{padding:'12px 14px',borderRadius:10,border:`2px solid ${selected===sc.id?sc.color:'var(--bdr)'}`,background:selected===sc.id?`${sc.color}15`:'var(--surf)',cursor:'pointer',textAlign:'left',transition:'all 0.15s'}}>
            <div style={{fontSize:18,marginBottom:4}}>{sc.icon}</div>
            <div style={{fontWeight:700,fontSize:12,color:selected===sc.id?sc.color:'var(--fg)',marginBottom:2}}>{sc.name}</div>
            <div style={{fontSize:10,color:'var(--fg3)'}}>{sc.desc}</div>
          </button>
        ))}
        <button onClick={()=>{setSelected('custom');setAiNarrative('');}}
          style={{padding:'12px 14px',borderRadius:10,border:`2px solid ${selected==='custom'?'var(--fg)':'var(--bdr)'}`,background:selected==='custom'?'var(--surf2)':'var(--surf)',cursor:'pointer',textAlign:'left'}}>
          <div style={{fontSize:18,marginBottom:4}}>✏️</div>
          <div style={{fontWeight:700,fontSize:12,color:'var(--fg)',marginBottom:4}}>Custom Shock</div>
          <input type="number" value={customShock} onChange={e=>setCustomShock(e.target.value)} onClick={e=>e.stopPropagation()} placeholder="+15 or -20"
            style={{width:'100%',padding:'4px 8px',border:'1px solid var(--bdr)',borderRadius:6,fontSize:12,background:'var(--bg)',color:'var(--fg)'}}/>
        </button>
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:48,color:'var(--fg3)'}}>Loading portfolio…</div>
      ) : positions.length===0 ? (
        <div className="card" style={{textAlign:'center',padding:'48px 24px'}}>
          <div style={{fontSize:40,marginBottom:12}}>📊</div>
          <div style={{fontWeight:700,fontSize:16,marginBottom:6}}>No positions found</div>
          <div style={{color:'var(--fg3)',fontSize:13}}>Add positions in the Portfolio tab to run scenarios.</div>
        </div>
      ) : (
        <>
          {/* Summary impact card */}
          <div className="card" style={{marginBottom:12,padding:'18px 20px',borderLeft:`4px solid ${totalImpact>=0?'#22c55e':'#ef4444'}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:'var(--fg3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>
                  {selected==='custom'?`Custom ${customShock}% Shock`:scenario.name} — Portfolio Impact
                </div>
                <div style={{fontSize:28,fontWeight:800,fontFamily:'var(--font-mono)',color:totalImpact>=0?'#22c55e':'#ef4444'}}>
                  {totalImpact>=0?'+':''}${Math.abs(totalImpact).toFixed(0)}
                  <span style={{fontSize:16,marginLeft:8}}>{totalPct>=0?'+':''}{totalPct.toFixed(1)}%</span>
                </div>
                <div style={{fontSize:11,color:'var(--fg3)',marginTop:2}}>on ${totalValue.toFixed(0)} portfolio value</div>
              </div>
              <button onClick={getAiNarrative} disabled={aiLoading}
                style={{padding:'8px 14px',background:'var(--surf2)',color:'var(--fg)',border:'1px solid var(--bdr)',borderRadius:8,fontSize:12,fontWeight:600,cursor:aiLoading?'default':'pointer'}}>
                {aiLoading?'…':'✦ AI Explain'}
              </button>
            </div>
            {aiNarrative && (
              <div style={{marginTop:12,padding:'10px 14px',background:'var(--surf2)',borderRadius:8,fontSize:12,color:'var(--fg2)',lineHeight:1.7,borderLeft:'3px solid var(--red)'}}>
                {aiNarrative}
              </div>
            )}
          </div>

          {/* Position-by-position table */}
          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Class</th>
                  <th style={{textAlign:'right'}}>Value</th>
                  <th style={{textAlign:'right'}}>Shock</th>
                  <th style={{textAlign:'right'}}>P&L Impact</th>
                </tr>
              </thead>
              <tbody>
                {rows.sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact)).map(r=>(
                  <tr key={r.ticker}>
                    <td><span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:12}}>{r.ticker}</span></td>
                    <td><span style={{fontSize:10,padding:'2px 6px',background:'var(--surf2)',borderRadius:4,color:'var(--fg3)'}}>{classifyTicker(r.ticker)}</span></td>
                    <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:12}}>${r.value.toFixed(0)}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:12,color:r.shock>=0?'#22c55e':'#ef4444',fontWeight:700}}>
                      {r.shock>=0?'+':''}{(r.shock*100).toFixed(0)}%
                    </td>
                    <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:12,fontWeight:700,color:r.impact>=0?'#22c55e':'#ef4444'}}>
                      {r.impact>=0?'+':''}${Math.abs(r.impact).toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{fontSize:10,color:'var(--fg3)',marginTop:8,textAlign:'center',fontFamily:'var(--font-mono)'}}>
            Shock estimates based on historical beta by asset class. Not financial advice.
          </div>
        </>
      )}
    </div>
  );
}

// ─── MACRO DASHBOARD ─────────────────────────────────────────────────────────

function MacroPage() {
  const [indicators, setIndicators] = React.useState([]);
  const [regime,     setRegime]     = React.useState(null);
  const [loading,    setLoading]    = React.useState(true);
  const [regLoading, setRegLoading] = React.useState(false);
  const [chartSeries, setChartSeries] = React.useState(null); // { id, label, history }

  React.useEffect(() => {
    fetch(`${API_URL}/macro`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setIndicators(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function analyzeRegime() {
    setRegLoading(true);
    const payload = indicators.filter(i => i.value !== null).map(i => ({
      label: i.label, value: i.value?.toFixed(i.dec ?? 2), unit: i.unit
    }));
    fetch(`${API_URL}/macro/regime`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ indicators: payload })
    })
      .then(r => r.json())
      .then(d => { setRegime(d); setRegLoading(false); })
      .catch(() => setRegLoading(false));
  }

  function loadChart(series) {
    if (chartSeries?.id === series.id) { setChartSeries(null); return; }
    fetch(`${API_URL}/macro/${series.id}/history`)
      .then(r => r.json())
      .then(hist => setChartSeries({ ...series, history: hist }))
      .catch(() => {});
  }

  const yieldSeries = ['DGS2','DGS5','DGS10'];
  const yieldData   = indicators.filter(i => yieldSeries.includes(i.id));
  const otherData   = indicators.filter(i => !yieldSeries.includes(i.id));

  const regimeColors = { 'risk-on':'var(--green)', 'goldilocks':'var(--green)', 'risk-off':'var(--red-loss)', 'recession':'var(--red-loss)', 'stagflation':'#f59e0b', 'tightening':'#f59e0b', 'easing':'#60a5fa', 'recovery':'#60a5fa' };

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Macro Dashboard</h1>
          <p className="page-sub">FRED data · yield curve · AI regime classification</p>
        </div>
        <button onClick={analyzeRegime} disabled={regLoading || indicators.length === 0}
          style={{ padding:'8px 16px', background:'var(--red)', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', opacity: (regLoading||indicators.length===0)?0.6:1 }}>
          {regLoading ? 'Analyzing…' : '✦ Classify Regime'}
        </button>
      </div>

      {/* Regime Banner */}
      {regime && (
        <div className="card" style={{ marginBottom:14, borderLeft:`3px solid ${regimeColors[regime.regime]||'var(--red)'}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <span style={{ fontFamily:'var(--font-mono)', fontWeight:800, fontSize:13, color:regimeColors[regime.regime]||'var(--red)', textTransform:'uppercase', letterSpacing:'0.1em' }}>
              {regime.regime}
            </span>
            <span style={{ fontSize:11, color:'var(--fg3)' }}>macro regime</span>
          </div>
          <p style={{ fontSize:13, color:'var(--fg2)', lineHeight:1.6, margin:0 }}>{regime.summary}</p>
        </div>
      )}

      {/* Yield Curve */}
      <div className="card" style={{ marginBottom:14 }}>
        <div className="section-label" style={{ marginBottom:12 }}>Yield Curve</div>
        {loading ? (
          <div style={{ color:'var(--fg3)', fontSize:12, fontFamily:'var(--font-mono)' }}>Loading FRED data…</div>
        ) : (
          <div style={{ display:'flex', alignItems:'flex-end', gap:0, height:80 }}>
            {yieldData.map((s, i) => {
              const maxV = Math.max(...yieldData.map(d => d.value||0));
              const h = maxV > 0 ? Math.max(12, ((s.value||0)/maxV)*72) : 12;
              const inverted = yieldData.length >= 2 && (yieldData[yieldData.length-1]?.value||0) < (yieldData[0]?.value||0);
              return (
                <div key={s.id} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--fg3)' }}>{(s.value||0).toFixed(2)}%</span>
                  <div style={{ width:'60%', height:h, background: inverted?'var(--red-loss)':'var(--green)', borderRadius:'4px 4px 0 0', opacity:0.85 }} />
                  <span style={{ fontSize:9, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>{s.label.replace(' Treasury','')}</span>
                </div>
              );
            })}
          </div>
        )}
        {yieldData.length >= 2 && (() => {
          const spread = (yieldData[yieldData.length-1]?.value||0) - (yieldData[0]?.value||0);
          return (
            <div style={{ marginTop:10, fontSize:11, fontFamily:'var(--font-mono)', color: spread < 0 ? 'var(--red-loss)' : 'var(--green)' }}>
              10Y−2Y spread: {spread >= 0 ? '+' : ''}{spread.toFixed(2)}% {spread < 0 ? '⚠ inverted' : ''}
            </div>
          );
        })()}
      </div>

      {/* Macro Indicators Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10, marginBottom:14 }}>
        {loading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="card" style={{ height:80, opacity:0.3 }} />
          ))
        ) : otherData.map(s => {
          const up = s.change >= 0;
          return (
            <div key={s.id} className="card" style={{ cursor:'pointer', transition:'border-color 0.15s', borderColor: chartSeries?.id===s.id?'var(--red)':'var(--bdr)' }}
              onClick={() => loadChart(s)}>
              <div style={{ fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{s.label}</div>
              {s.value !== null ? (
                <>
                  <div style={{ fontSize:22, fontWeight:800, fontFamily:'var(--font-mono)', color:'var(--fg)' }}>
                    {s.unit==='$T' ? `$${(s.value/1000).toFixed(1)}T` : `${s.value?.toFixed(s.dec??2)}${s.unit}`}
                  </div>
                  <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color: up?'var(--green)':'var(--red-loss)', marginTop:4 }}>
                    {up?'+':''}{s.change?.toFixed(s.dec??2)} MoM
                  </div>
                </>
              ) : (
                <div style={{ fontSize:12, color:'var(--fg3)', lineHeight:1.4 }}>{s.error || 'No data'}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Inline chart for selected indicator */}
      {chartSeries && chartSeries.history?.length > 0 && (
        <div className="card" style={{ marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div className="section-label" style={{ marginBottom:0 }}>{chartSeries.label} — 24-month history</div>
            <button onClick={() => setChartSeries(null)} style={{ background:'none', border:'none', color:'var(--fg3)', cursor:'pointer', fontSize:16 }}>✕</button>
          </div>
          <AreaChart
            data={chartSeries.history.map(h => h.value)}
            labels={chartSeries.history.map(h => h.date)}
            height={140} showAxes={true}
          />
        </div>
      )}

      {!loading && indicators.length === 0 && (
        <div className="card" style={{ textAlign:'center', padding:40, color:'var(--fg3)', fontSize:13 }}>
          <div style={{ fontSize:24, marginBottom:8 }}>📊</div>
          <div style={{ fontWeight:700, marginBottom:4 }}>Add FRED_API_KEY to Render env vars</div>
          <div style={{ fontSize:12 }}>Free at <code>fred.stlouisfed.org/docs/api/api_key.html</code></div>
        </div>
      )}
    </div>
  );
}

// ─── WATCHLIST INTELLIGENCE ────────────────────────────────────────────────────

function WatchlistIntelPage() {
  const [items,       setItems]       = React.useState([]);
  const [loading,     setLoading]     = React.useState(true);
  const [expanded,    setExpanded]    = React.useState(null);
  const [editing,     setEditing]     = React.useState({}); // { symbol: { thesis, catalysts, conviction } }
  const [checking,    setChecking]    = React.useState({}); // { symbol: true }
  const [prices,      setPrices]      = React.useState({});

  React.useEffect(() => {
    fetch(`${API_URL}/watchlist`)
      .then(r => r.json())
      .then(data => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
        // Fetch live prices for all
        (Array.isArray(data) ? data : []).forEach(item => {
          fetch(`${API_URL}/stocks/live/${item.symbol}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => d && setPrices(p => ({ ...p, [item.symbol]: d })))
            .catch(() => {});
        });
      })
      .catch(() => setLoading(false));
  }, []);

  function saveIntelligence(symbol) {
    const e = editing[symbol] || {};
    fetch(`${API_URL}/watchlist/${symbol}/intelligence`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thesis: e.thesis, catalysts: e.catalysts, conviction: e.conviction })
    })
      .then(r => r.json())
      .then(saved => {
        setItems(p => p.map(i => i.symbol === symbol ? { ...i, ...saved } : i));
        setEditing(p => { const n = { ...p }; delete n[symbol]; return n; });
      }).catch(() => {});
  }

  function checkThesis(symbol) {
    setChecking(p => ({ ...p, [symbol]: true }));
    fetch(`${API_URL}/watchlist/${symbol}/thesis-check`, { method: 'POST' })
      .then(r => r.json())
      .then(result => {
        setItems(p => p.map(i => i.symbol === symbol ? { ...i, thesisStatus: result.status, thesisSummary: result.summary, lastThesisCheck: new Date().toISOString() } : i));
        setChecking(p => { const n = { ...p }; delete n[symbol]; return n; });
      }).catch(() => setChecking(p => { const n = { ...p }; delete n[symbol]; return n; }));
  }

  const statusColor = { valid:'var(--green)', weakening:'#f59e0b', invalidated:'var(--red-loss)', unchecked:'var(--fg3)' };

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Watchlist Intelligence</h1>
          <p className="page-sub">Thesis tracking · catalysts · AI validity checks</p>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ color:'var(--fg3)', fontSize:12, fontFamily:'var(--font-mono)' }}>Loading watchlist…</div>
      ) : items.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:40, color:'var(--fg3)' }}>
          <div style={{ fontSize:24, marginBottom:8 }}>👁</div>
          <div>Add tickers to your Watchlist first</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {items.map(item => {
            const p = prices[item.symbol];
            const up = (p?.changePercent||0) >= 0;
            const isExpanded = expanded === item.symbol;
            const ed = editing[item.symbol];
            const thesis = ed?.thesis !== undefined ? ed.thesis : (item.thesis || '');
            const conviction = ed?.conviction !== undefined ? ed.conviction : (item.conviction || 5);

            return (
              <div key={item.symbol} className="card" style={{ padding:0, overflow:'hidden' }}>
                {/* Header row */}
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', cursor:'pointer' }}
                  onClick={() => setExpanded(isExpanded ? null : item.symbol)}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontFamily:'var(--font-mono)', fontWeight:800, fontSize:14, color:'var(--red)' }}>{item.symbol}</span>
                      <span style={{ fontSize:11, color:'var(--fg3)' }}>{item.name || item.category}</span>
                      {item.thesisStatus && item.thesisStatus !== 'unchecked' && (
                        <span style={{ fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:4, background:`${statusColor[item.thesisStatus]}22`, color:statusColor[item.thesisStatus], textTransform:'uppercase', letterSpacing:'0.06em' }}>
                          {item.thesisStatus}
                        </span>
                      )}
                    </div>
                    {item.thesis && <div style={{ fontSize:11, color:'var(--fg3)', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:500 }}>{item.thesis}</div>}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:14 }}>{p ? `$${p.price?.toFixed(2)}` : '—'}</div>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color: up?'var(--green)':'var(--red-loss)' }}>
                      {p ? `${up?'+':''}${p.changePercent?.toFixed(2)}%` : ''}
                    </div>
                  </div>
                  <div style={{ width:16, color:'var(--fg3)', fontSize:10 }}>{isExpanded ? '▲' : '▼'}</div>
                </div>

                {/* Expanded intel panel */}
                {isExpanded && (
                  <div style={{ borderTop:'1px solid var(--bdr)', padding:'16px 18px', display:'flex', flexDirection:'column', gap:14 }}>
                    {/* Thesis editor */}
                    <div>
                      <div style={{ fontSize:11, color:'var(--fg3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Investment Thesis</div>
                      <textarea
                        value={thesis}
                        onChange={e => setEditing(p => ({ ...p, [item.symbol]: { ...(p[item.symbol]||{}), thesis: e.target.value } }))}
                        placeholder="Write your thesis here…"
                        style={{ width:'100%', minHeight:80, padding:'10px 12px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:8, fontSize:13, color:'var(--fg)', fontFamily:'inherit', resize:'vertical', boxSizing:'border-box' }}
                      />
                      {/* Thesis check result */}
                      {item.thesisSummary && (
                        <div style={{ marginTop:8, padding:'10px 12px', background:'var(--surf2)', borderRadius:8, fontSize:12, color:'var(--fg2)', borderLeft:`3px solid ${statusColor[item.thesisStatus]||'var(--fg3)'}` }}>
                          <span style={{ fontWeight:700, color:statusColor[item.thesisStatus], textTransform:'uppercase', fontSize:10 }}>{item.thesisStatus}</span>
                          {' — '}{item.thesisSummary}
                          {item.lastThesisCheck && <span style={{ color:'var(--fg3)', fontSize:10, marginLeft:8 }}>· checked {new Date(item.lastThesisCheck).toLocaleDateString()}</span>}
                        </div>
                      )}
                    </div>

                    {/* Conviction + Check button */}
                    <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, color:'var(--fg3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Conviction {conviction}/10</div>
                        <input type="range" min={1} max={10} value={conviction}
                          onChange={e => setEditing(p => ({ ...p, [item.symbol]: { ...(p[item.symbol]||{}), conviction: +e.target.value } }))}
                          style={{ width:'100%', accentColor:'var(--red)' }} />
                      </div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={() => saveIntelligence(item.symbol)}
                          style={{ padding:'8px 14px', background:'var(--red)', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                          Save
                        </button>
                        <button onClick={() => checkThesis(item.symbol)} disabled={!thesis || checking[item.symbol]}
                          style={{ padding:'8px 14px', background:'var(--surf2)', color:'var(--fg)', border:'1px solid var(--bdr)', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', opacity:(!thesis||checking[item.symbol])?0.5:1 }}>
                          {checking[item.symbol] ? 'Checking…' : '✦ Check Thesis'}
                        </button>
                      </div>
                    </div>

                    {/* Catalysts */}
                    <div>
                      <div style={{ fontSize:11, color:'var(--fg3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Catalysts</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        {(ed?.catalysts || item.catalysts || []).map((cat, i) => (
                          <div key={i} style={{ display:'flex', gap:8, alignItems:'center' }}>
                            <input type="checkbox" checked={cat.done||false}
                              onChange={() => {
                                const cats = [...(ed?.catalysts || item.catalysts || [])];
                                cats[i] = { ...cats[i], done: !cats[i].done };
                                setEditing(p => ({ ...p, [item.symbol]: { ...(p[item.symbol]||{}), catalysts: cats } }));
                              }} style={{ accentColor:'var(--green)', flexShrink:0 }} />
                            <span style={{ flex:1, fontSize:12, color: cat.done?'var(--fg3)':'var(--fg)', textDecoration: cat.done?'line-through':'none' }}>{cat.text}</span>
                            {cat.date && <span style={{ fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>{cat.date}</span>}
                          </div>
                        ))}
                        <button onClick={() => {
                          const text = prompt('Catalyst description?');
                          if (!text) return;
                          const date = prompt('Date (optional)?') || '';
                          const cats = [...(ed?.catalysts || item.catalysts || []), { text, date, done: false }];
                          setEditing(p => ({ ...p, [item.symbol]: { ...(p[item.symbol]||{}), catalysts: cats } }));
                        }} style={{ alignSelf:'flex-start', padding:'4px 10px', background:'none', border:'1px dashed var(--bdr)', borderRadius:6, fontSize:11, color:'var(--fg3)', cursor:'pointer' }}>
                          + Add catalyst
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 13F / INSIDER TRACKING ────────────────────────────────────────────────────

function InsiderPage() {
  const [tab,           setTab]          = React.useState('form4');
  // Form 4 by company
  const [form4Query,    setForm4Query]   = React.useState('');
  const [form4Days,     setForm4Days]    = React.useState(90);
  const [form4Data,     setForm4Data]    = React.useState(null);
  const [form4Loading,  setForm4Loading] = React.useState(false);
  const [expandedRow,   setExpandedRow]  = React.useState(null);
  const [sortCol,       setSortCol]      = React.useState('date');
  const [sortDir,       setSortDir]      = React.useState(-1);
  // 13F funds
  const [funds,         setFunds]        = React.useState([]);
  const [fundData,      setFundData]     = React.useState({});
  const [expandedFund,  setExpandedFund] = React.useState(null);
  // Track insiders
  const [tracked,       setTracked]      = React.useState([]);
  const [trackCik,      setTrackCik]     = React.useState('');
  const [trackName,     setTrackName]    = React.useState('');
  const [trackFilings,  setTrackFilings] = React.useState({});
  const [trackLoading,  setTrackLoading] = React.useState({});

  // Load funds + tracked on mount
  React.useEffect(() => {
    fetch(`${API_URL}/insider/funds`).then(r => r.json()).then(data => {
      setFunds(Array.isArray(data) ? data : []);
      (Array.isArray(data) ? data : []).forEach(fund => {
        fetch(`${API_URL}/insider/funds/${fund.cik}/latest`)
          .then(r => r.json())
          .then(d => setFundData(p => ({ ...p, [fund.cik]: d })))
          .catch(() => {});
      });
    }).catch(() => {});

    fetch(`${API_URL}/insider/tracked`).then(r => r.json())
      .then(data => setTracked(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Form 4 search
  function searchForm4() {
    const ticker = form4Query.trim().toUpperCase().replace(/[^A-Z0-9.]/g, '');
    if (!ticker) return;
    setForm4Loading(true); setForm4Data(null);
    fetch(`${API_URL}/insider/form4/${ticker}?days=${form4Days}`)
      .then(r => r.json())
      .then(d => { setForm4Data(d); setForm4Loading(false); })
      .catch(() => setForm4Loading(false));
  }

  // Tracked insider add
  async function addTracked() {
    const cik  = trackCik.trim().replace(/\D/g, '').padStart(10, '0');
    const name = trackName.trim();
    if (!cik || !name) return;
    const r = await fetch(`${API_URL}/insider/tracked`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cik, name }),
    });
    const doc = await r.json();
    setTracked(p => [...p.filter(t => t.cik !== doc.cik), doc]);
    setTrackCik(''); setTrackName('');
  }

  async function removeTracked(id) {
    await fetch(`${API_URL}/insider/tracked/${id}`, { method: 'DELETE' });
    setTracked(p => p.filter(t => t._id !== id));
  }

  function loadTrackedFilings(cik) {
    if (trackFilings[cik]) return;
    setTrackLoading(p => ({ ...p, [cik]: true }));
    fetch(`${API_URL}/insider/tracked/${cik}/filings?days=180`)
      .then(r => r.json())
      .then(d => {
        setTrackFilings(p => ({ ...p, [cik]: d }));
        setTrackLoading(p => ({ ...p, [cik]: false }));
      }).catch(() => setTrackLoading(p => ({ ...p, [cik]: false })));
  }

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d * -1);
    else { setSortCol(col); setSortDir(-1); }
  }

  const sortedFilings = React.useMemo(() => {
    if (!form4Data?.filings) return [];
    return [...form4Data.filings].sort((a, b) => {
      const va = a[sortCol] ?? '';
      const vb = b[sortCol] ?? '';
      return String(va) < String(vb) ? -sortDir : String(va) > String(vb) ? sortDir : 0;
    });
  }, [form4Data, sortCol, sortDir]);

  const colHdr = (label, col, align='left') => (
    <th onClick={() => toggleSort(col)}
      style={{ padding:'8px 12px', textAlign:align, fontSize:10, fontFamily:'var(--font-mono)',
        color: sortCol===col?'var(--red)':'var(--fg3)', textTransform:'uppercase',
        letterSpacing:'0.08em', cursor:'pointer', userSelect:'none', whiteSpace:'nowrap',
        borderBottom:'1px solid var(--bdr)' }}>
      {label}{sortCol===col?(sortDir>0?' ↑':' ↓'):''}
    </th>
  );

  function BuySellBadge({ f }) {
    if (f.isBuy)  return <span style={{ padding:'2px 8px', borderRadius:4, fontSize:10, fontFamily:'var(--font-mono)', fontWeight:800, background:'rgba(52,211,153,0.15)', color:'var(--green)' }}>BUY</span>;
    if (f.isSell) return <span style={{ padding:'2px 8px', borderRadius:4, fontSize:10, fontFamily:'var(--font-mono)', fontWeight:800, background:'rgba(239,68,68,0.12)', color:'var(--red)' }}>SELL</span>;
    return <span style={{ padding:'2px 8px', borderRadius:4, fontSize:10, fontFamily:'var(--font-mono)', fontWeight:700, background:'var(--surf)', color:'var(--fg3)' }}>MISC</span>;
  }

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">13F &amp; Insider Tracking</h1>
          <p className="page-sub">SEC EDGAR · Form 4 transactions · institutional holdings · tracked insiders</p>
        </div>
      </div>

      {/* Tab strip */}
      <div className="filter-strip" style={{ marginBottom:16 }}>
        {[['form4','Insider Form 4'],['funds','Institutional 13F'],['tracked','Track Insiders']].map(([id, label]) => (
          <button key={id} className={`filter-chip${tab===id?' active':''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* ── FORM 4 TAB ── */}
      {tab === 'form4' && (
        <div>
          <div className="card" style={{ marginBottom:14, padding:'14px 16px' }}>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <div style={{ position:'relative', flex:1, minWidth:180 }}>
                <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'var(--fg3)', fontFamily:'var(--font-mono)', pointerEvents:'none' }}>TICKER›</span>
                <input value={form4Query} onChange={e => setForm4Query(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && searchForm4()} placeholder="NVDA"
                  style={{ width:'100%', padding:'9px 12px 9px 64px', background:'var(--bg)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:14, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--fg)', boxSizing:'border-box' }} />
              </div>
              <div style={{ display:'flex', gap:4 }}>
                {[30,60,90].map(d => (
                  <button key={d} onClick={() => setForm4Days(d)}
                    style={{ padding:'8px 12px', fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, border:'1px solid', borderRadius:6, cursor:'pointer',
                      background: form4Days===d?'var(--red)':'transparent', borderColor: form4Days===d?'var(--red)':'var(--bdr)', color: form4Days===d?'#fff':'var(--fg3)' }}>
                    {d}D
                  </button>
                ))}
              </div>
              <button onClick={searchForm4} disabled={form4Loading}
                style={{ padding:'9px 20px', background:'var(--red)', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-mono)', letterSpacing:'0.06em', opacity:form4Loading?0.7:1 }}>
                {form4Loading ? 'LOADING…' : 'SEARCH'}
              </button>
            </div>
            <div style={{ marginTop:8, fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>
              Director &amp; officer buy/sell disclosures via SEC EDGAR submissions API · parses transaction shares, price, and type
            </div>
          </div>

          {form4Loading && (
            <div className="card" style={{ textAlign:'center', padding:'30px', color:'var(--fg3)', fontFamily:'var(--font-mono)', fontSize:12 }}>
              Fetching Form 4 XMLs from EDGAR… this takes ~5s
            </div>
          )}

          {form4Data && !form4Loading && (
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--bdr)', display:'flex', alignItems:'center', gap:12, background:'var(--surf)' }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--fg3)' }}>{sortedFilings.length} filings ·</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:800, color:'var(--red)' }}>{form4Data.ticker}</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--fg3)' }}>· last {form4Days}d</span>
                {/* Summary counts */}
                {sortedFilings.length > 0 && (() => {
                  const buys  = sortedFilings.filter(f => f.isBuy).length;
                  const sells = sortedFilings.filter(f => f.isSell).length;
                  return (
                    <span style={{ marginLeft:'auto', display:'flex', gap:8 }}>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--green)', fontWeight:700 }}>{buys} BUY</span>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--red)', fontWeight:700 }}>{sells} SELL</span>
                    </span>
                  );
                })()}
              </div>
              {sortedFilings.length === 0 ? (
                <div style={{ padding:30, textAlign:'center', color:'var(--fg3)', fontSize:13 }}>No insider transactions found in this period</div>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ background:'var(--surf)' }}>
                        {colHdr('INSIDER',   'filer')}
                        {colHdr('ROLE',      'role')}
                        {colHdr('FILED',     'date')}
                        {colHdr('DIRECTION', 'isBuy', 'center')}
                        {colHdr('SHARES',    'totalShares', 'right')}
                        {colHdr('AVG PRICE', 'avgPrice', 'right')}
                        <th style={{ padding:'8px 12px', textAlign:'right', fontSize:10, fontFamily:'var(--font-mono)', color:'var(--fg3)', textTransform:'uppercase', letterSpacing:'0.08em', borderBottom:'1px solid var(--bdr)' }}>EDGAR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFilings.map((f, i) => {
                        const isExp = expandedRow === i;
                        return (
                          <React.Fragment key={i}>
                            <tr style={{ borderBottom:'1px solid var(--bdr)', cursor:'pointer', transition:'background 0.1s' }}
                              onClick={() => setExpandedRow(isExp ? null : i)}
                              onMouseEnter={e => e.currentTarget.style.background='var(--surf)'}
                              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                              <td style={{ padding:'10px 12px', fontSize:13, fontWeight:700, color:'var(--fg)' }}>{f.filer || '—'}</td>
                              <td style={{ padding:'10px 12px', fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.role || '—'}</td>
                              <td style={{ padding:'10px 12px', fontSize:12, fontFamily:'var(--font-mono)', color:'var(--fg2)', whiteSpace:'nowrap' }}>{f.date || '—'}</td>
                              <td style={{ padding:'10px 12px', textAlign:'center' }}><BuySellBadge f={f} /></td>
                              <td style={{ padding:'10px 12px', textAlign:'right', fontSize:12, fontFamily:'var(--font-mono)', color: f.totalShares > 0 ? 'var(--green)' : f.totalShares < 0 ? 'var(--red)' : 'var(--fg3)', fontWeight:700 }}>
                                {f.totalShares ? (f.totalShares > 0 ? '+' : '') + f.totalShares.toLocaleString() : '—'}
                              </td>
                              <td style={{ padding:'10px 12px', textAlign:'right', fontSize:12, fontFamily:'var(--font-mono)', color:'var(--fg2)' }}>
                                {f.avgPrice > 0 ? `$${f.avgPrice.toFixed(2)}` : '—'}
                              </td>
                              <td style={{ padding:'10px 12px', textAlign:'right' }}>
                                {f.url ? <a href={f.url} target="_blank" rel="noopener" style={{ fontSize:11, color:'var(--red)', textDecoration:'none', fontFamily:'var(--font-mono)', fontWeight:700 }} onClick={e => e.stopPropagation()}>↗</a> : '—'}
                              </td>
                            </tr>
                            {isExp && f.transactions?.length > 0 && (
                              <tr style={{ background:'var(--surf)' }}>
                                <td colSpan={7} style={{ padding:'8px 16px 12px', borderBottom:'1px solid var(--bdr)' }}>
                                  <div style={{ fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.08em' }}>Transactions</div>
                                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                                    <thead>
                                      <tr>
                                        {['Security','Date','Shares','Price','Type'].map(h => (
                                          <th key={h} style={{ padding:'3px 8px', textAlign: h==='Shares'||h==='Price'?'right':'left', fontSize:9, fontFamily:'var(--font-mono)', color:'var(--fg3)', textTransform:'uppercase' }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {f.transactions.map((t, j) => (
                                        <tr key={j}>
                                          <td style={{ padding:'3px 8px', fontFamily:'var(--font-mono)', color:'var(--fg2)' }}>{t.security || 'Common Stock'}</td>
                                          <td style={{ padding:'3px 8px', fontFamily:'var(--font-mono)', color:'var(--fg3)' }}>{t.date || '—'}</td>
                                          <td style={{ padding:'3px 8px', textAlign:'right', fontFamily:'var(--font-mono)', color: t.type==='A'?'var(--green)':'var(--red)', fontWeight:700 }}>
                                            {t.type==='A'?'+':'-'}{t.shares?.toLocaleString()}
                                          </td>
                                          <td style={{ padding:'3px 8px', textAlign:'right', fontFamily:'var(--font-mono)', color:'var(--fg2)' }}>
                                            {t.price > 0 ? `$${t.price.toFixed(2)}` : '—'}
                                          </td>
                                          <td style={{ padding:'3px 8px' }}>
                                            <span style={{ fontSize:9, fontFamily:'var(--font-mono)', padding:'1px 5px', borderRadius:3,
                                              background: t.type==='A'?'rgba(52,211,153,0.15)':'rgba(239,68,68,0.1)',
                                              color: t.type==='A'?'var(--green)':'var(--red)', fontWeight:700 }}>
                                              {t.type==='A'?'ACQUIRE':'DISPOSE'}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!form4Data && !form4Loading && (
            <div className="card" style={{ textAlign:'center', padding:'40px 20px', color:'var(--fg3)' }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:28, marginBottom:10, color:'var(--bdr)' }}>SEC / EDGAR</div>
              <div style={{ fontSize:13, marginBottom:6 }}>Enter a ticker to query Form 4 insider transactions</div>
              <div style={{ fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>Fetches actual Form 4 XMLs — shows real names, buy/sell direction, shares &amp; price</div>
            </div>
          )}
        </div>
      )}

      {/* ── 13F TAB ── */}
      {tab === 'funds' && (
        <div>
          <div style={{ fontSize:11, color:'var(--fg3)', marginBottom:12, fontFamily:'var(--font-mono)', padding:'0 2px' }}>
            Notable institutional funds · quarterly 13F-HR filings · SEC EDGAR · Q1 published ~45 days after quarter-end
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {funds.map(fund => {
              const d        = fundData[fund.cik];
              const latest   = d?.recentFilings?.[0];
              const isExp    = expandedFund === fund.cik;
              const holdings = d?.holdings || [];
              const totalVal = holdings.reduce((s, h) => s + h.value, 0);
              return (
                <div key={fund.cik} className="card" style={{ padding:0, overflow:'hidden' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', cursor:'pointer' }}
                    onClick={() => setExpandedFund(isExp ? null : fund.cik)}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}>{fund.name}</div>
                      <div style={{ fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>
                        CIK {fund.cik}
                        {d?.holdingsCount ? ` · ${d.holdingsCount} positions` : ''}
                        {d?.filedAt ? ` · Filed ${d.filedAt}` : ''}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      {d?.edgarUrl ? (
                        <a href={d.edgarUrl} target="_blank" rel="noopener"
                          style={{ fontSize:11, color:'var(--red)', textDecoration:'none', fontFamily:'var(--font-mono)', fontWeight:700 }}
                          onClick={e => e.stopPropagation()}>EDGAR ↗</a>
                      ) : d === undefined ? (
                        <span style={{ fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>Loading…</span>
                      ) : (
                        <span style={{ fontSize:11, color:'var(--fg3)' }}>No 13F</span>
                      )}
                      <span style={{ color:'var(--fg3)', fontSize:12 }}>{isExp ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {isExp && holdings.length > 0 && (
                    <div style={{ borderTop:'1px solid var(--bdr)', overflowX:'auto' }}>
                      <div style={{ padding:'8px 16px', fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)', background:'var(--surf)' }}>
                        TOP {holdings.length} HOLDINGS · Total: ${(totalVal/1000).toFixed(0)}M (in thousands)
                      </div>
                      <table style={{ width:'100%', borderCollapse:'collapse' }}>
                        <thead>
                          <tr style={{ background:'var(--surf)' }}>
                            {['#','ISSUER','VALUE ($M)','SHARES','% OF PORT','CUSIP'].map(h => (
                              <th key={h} style={{ padding:'6px 12px', textAlign: ['VALUE ($M)','SHARES','% OF PORT'].includes(h)?'right':'left', fontSize:9, fontFamily:'var(--font-mono)', color:'var(--fg3)', textTransform:'uppercase', letterSpacing:'0.08em', borderBottom:'1px solid var(--bdr)', whiteSpace:'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {holdings.slice(0, 20).map((h, i) => {
                            const pct = totalVal > 0 ? (h.value / totalVal * 100) : 0;
                            return (
                              <tr key={i} style={{ borderBottom:'1px solid var(--bdr)' }}>
                                <td style={{ padding:'7px 12px', fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)', width:28 }}>{i+1}</td>
                                <td style={{ padding:'7px 12px', fontSize:12, fontWeight:600 }}>{h.issuer}</td>
                                <td style={{ padding:'7px 12px', textAlign:'right', fontSize:12, fontFamily:'var(--font-mono)', color:'var(--green)' }}>${(h.value/1000).toFixed(1)}M</td>
                                <td style={{ padding:'7px 12px', textAlign:'right', fontSize:11, fontFamily:'var(--font-mono)', color:'var(--fg2)' }}>{h.shares?.toLocaleString()}</td>
                                <td style={{ padding:'7px 12px', textAlign:'right', fontSize:11, fontFamily:'var(--font-mono)', color:'var(--fg3)' }}>{pct.toFixed(1)}%</td>
                                <td style={{ padding:'7px 12px', fontSize:10, fontFamily:'var(--font-mono)', color:'var(--fg3)' }}>{h.cusip}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {isExp && holdings.length === 0 && d !== undefined && (
                    <div style={{ padding:'14px 16px', borderTop:'1px solid var(--bdr)', fontSize:12, color:'var(--fg3)', textAlign:'center' }}>
                      {d?.holdingsCount === 0 ? 'No holdings parsed from this filing — ' : 'Holdings parsing failed — '}
                      <a href={d?.edgarUrl} target="_blank" rel="noopener" style={{ color:'var(--red)' }}>view directly on EDGAR ↗</a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TRACK INSIDERS TAB ── */}
      {tab === 'tracked' && (
        <div>
          {/* Add insider form */}
          <div className="card" style={{ marginBottom:14, padding:'14px 16px' }}>
            <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--fg3)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>Add Insider to Watch</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <input value={trackCik} onChange={e => setTrackCik(e.target.value)}
                placeholder="SEC CIK (e.g. 0001346985)"
                style={{ flex:1, minWidth:160, padding:'8px 12px', background:'var(--bg)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:13, fontFamily:'var(--font-mono)', color:'var(--fg)' }} />
              <input value={trackName} onChange={e => setTrackName(e.target.value)}
                placeholder="Name (e.g. Jensen Huang)"
                style={{ flex:2, minWidth:160, padding:'8px 12px', background:'var(--bg)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:13, color:'var(--fg)' }} />
              <button onClick={addTracked}
                style={{ padding:'8px 18px', background:'var(--red)', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                + Track
              </button>
            </div>
            <div style={{ marginTop:8, fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>
              Find a person's SEC CIK at <a href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=4&owner=include" target="_blank" rel="noopener" style={{ color:'var(--red)' }}>EDGAR Search ↗</a>
            </div>
          </div>

          {tracked.length === 0 && (
            <div className="card" style={{ textAlign:'center', padding:'40px 20px', color:'var(--fg3)' }}>
              <div style={{ fontSize:13, marginBottom:6 }}>No insiders tracked yet</div>
              <div style={{ fontSize:11, fontFamily:'var(--font-mono)' }}>Add a CIK + name above to track their Form 4 filings across all companies</div>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {tracked.map(person => {
              const filingData = trackFilings[person.cik];
              const loading    = trackLoading[person.cik];
              return (
                <div key={person._id} className="card" style={{ padding:0, overflow:'hidden' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14 }}>{person.name}</div>
                      <div style={{ fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>CIK {person.cik}</div>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => { loadTrackedFilings(person.cik); }}
                        style={{ padding:'6px 14px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, cursor:'pointer', color:'var(--fg2)' }}>
                        {loading ? 'Loading…' : filingData ? 'Refresh' : 'Load Filings'}
                      </button>
                      <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${person.cik}&type=4&dateb=&owner=include&count=20`}
                        target="_blank" rel="noopener"
                        style={{ padding:'6px 12px', fontSize:11, color:'var(--red)', textDecoration:'none', fontFamily:'var(--font-mono)', fontWeight:700, border:'1px solid var(--bdr)', borderRadius:6 }}>
                        EDGAR ↗
                      </a>
                      <button onClick={() => removeTracked(person._id)}
                        style={{ padding:'6px 10px', background:'none', border:'1px solid var(--bdr)', borderRadius:6, cursor:'pointer', color:'var(--fg3)', fontSize:14 }}>✕</button>
                    </div>
                  </div>

                  {filingData && (
                    <div style={{ borderTop:'1px solid var(--bdr)' }}>
                      {!filingData.filings?.length ? (
                        <div style={{ padding:'12px 16px', fontSize:12, color:'var(--fg3)', textAlign:'center' }}>No Form 4 filings in last 180 days</div>
                      ) : (
                        <table style={{ width:'100%', borderCollapse:'collapse' }}>
                          <thead>
                            <tr style={{ background:'var(--surf)' }}>
                              {['COMPANY','DATE','DIRECTION','SHARES','PRICE','FILING'].map(h => (
                                <th key={h} style={{ padding:'6px 12px', textAlign:['SHARES','PRICE'].includes(h)?'right':'left', fontSize:9, fontFamily:'var(--font-mono)', color:'var(--fg3)', textTransform:'uppercase', letterSpacing:'0.08em', borderBottom:'1px solid var(--bdr)', whiteSpace:'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filingData.filings.map((f, i) => (
                              <tr key={i} style={{ borderBottom:'1px solid var(--bdr)' }}>
                                <td style={{ padding:'8px 12px', fontSize:12, fontWeight:600 }}>{f.ticker || f.company || '—'}</td>
                                <td style={{ padding:'8px 12px', fontSize:11, fontFamily:'var(--font-mono)', color:'var(--fg3)' }}>{f.date}</td>
                                <td style={{ padding:'8px 12px' }}>
                                  {f.isBuy  && <span style={{ padding:'2px 7px', borderRadius:3, fontSize:10, fontFamily:'var(--font-mono)', fontWeight:800, background:'rgba(52,211,153,0.15)', color:'var(--green)' }}>BUY</span>}
                                  {f.isSell && <span style={{ padding:'2px 7px', borderRadius:3, fontSize:10, fontFamily:'var(--font-mono)', fontWeight:800, background:'rgba(239,68,68,0.12)', color:'var(--red)' }}>SELL</span>}
                                  {!f.isBuy && !f.isSell && <span style={{ fontSize:10, color:'var(--fg3)' }}>MISC</span>}
                                </td>
                                <td style={{ padding:'8px 12px', textAlign:'right', fontSize:11, fontFamily:'var(--font-mono)', color: f.totalShares > 0?'var(--green)':f.totalShares < 0?'var(--red)':'var(--fg3)', fontWeight:700 }}>
                                  {f.totalShares ? (f.totalShares > 0?'+':'') + f.totalShares.toLocaleString() : '—'}
                                </td>
                                <td style={{ padding:'8px 12px', textAlign:'right', fontSize:11, fontFamily:'var(--font-mono)', color:'var(--fg2)' }}>
                                  {f.avgPrice > 0 ? `$${f.avgPrice.toFixed(2)}` : '—'}
                                </td>
                                <td style={{ padding:'8px 12px' }}>
                                  <a href={f.url} target="_blank" rel="noopener" style={{ fontSize:10, color:'var(--red)', fontFamily:'var(--font-mono)', fontWeight:700 }}>↗</a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PORTFOLIO ATTRIBUTION ─────────────────────────────────────────────────────

function AttributionPage() {
  const [positions,  setPositions]  = React.useState([]);
  const [trades,     setTrades]     = React.useState([]);
  const [prices,     setPrices]     = React.useState({});
  const [loading,    setLoading]    = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/positions`).then(r => r.json()).catch(() => []),
      fetch(`${API_URL}/trades`).then(r => r.json()).catch(() => []),
    ]).then(([pos, tr]) => {
      setPositions(Array.isArray(pos) ? pos : []);
      setTrades(Array.isArray(tr) ? tr : []);
      setLoading(false);
      // Fetch live prices
      (Array.isArray(pos) ? pos : []).forEach(p => {
        fetch(`${API_URL}/stocks/live/${p.ticker}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => d && setPrices(prev => ({ ...prev, [p.ticker]: d })))
          .catch(() => {});
      });
    });
  }, []);

  // Sector classification (simple heuristic — extend as needed)
  function getSector(ticker) {
    const t = (ticker||'').toUpperCase();
    if (['NVDA','AMD','TSM','ASML','AMAT','LRCX','MU','INTC','AVGO','QCOM'].includes(t)) return 'Semis';
    if (['MSFT','GOOGL','AAPL','META','NFLX','CRM','SNOW','PLTR'].includes(t)) return 'Big Tech';
    if (['AMZN','SHOP','BABA','JD','MELI'].includes(t)) return 'E-Commerce';
    if (['JPM','BAC','GS','MS','WFC','C','MUFG','8306.T'].includes(t)) return 'Financials';
    if (['VOO','SPY','QQQ','IVV','VTI','EWJ'].includes(t)) return 'ETFs';
    if (t.endsWith('.T')) return 'Japan';
    if (['GLD','GC=F','SLV','USO','CL=F'].includes(t)) return 'Commodities';
    if (['CRCL','ONDS','MMS','QXO','VRT','TPL'].includes(t)) return 'Special Sits';
    return 'Other';
  }

  // Build attribution data
  const positionData = positions.map(p => {
    const live = prices[p.ticker];
    const currentPrice = live?.price || p.costBasis;
    const value  = p.shares * currentPrice;
    const cost   = p.shares * p.costBasis;
    const pnl    = value - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    const dayPnl = live ? (live.change||0) * p.shares : 0;
    return { ticker: p.ticker, shares: p.shares, costBasis: p.costBasis, currentPrice, value, cost, pnl, pnlPct, dayPnl, sector: getSector(p.ticker) };
  });

  const totalValue  = positionData.reduce((s, p) => s + p.value, 0);
  const totalCost   = positionData.reduce((s, p) => s + p.cost, 0);
  const totalPnl    = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const totalDayPnl = positionData.reduce((s, p) => s + p.dayPnl, 0);

  // Sector attribution
  const sectorMap = {};
  for (const p of positionData) {
    if (!sectorMap[p.sector]) sectorMap[p.sector] = { value:0, pnl:0, cost:0, tickers:[] };
    sectorMap[p.sector].value  += p.value;
    sectorMap[p.sector].pnl   += p.pnl;
    sectorMap[p.sector].cost  += p.cost;
    sectorMap[p.sector].tickers.push(p.ticker);
  }
  const sectors = Object.entries(sectorMap).map(([name, d]) => ({
    name, value: d.value, pnl: d.pnl, pnlPct: d.cost > 0 ? (d.pnl/d.cost)*100 : 0,
    weight: totalValue > 0 ? (d.value/totalValue)*100 : 0, tickers: d.tickers
  })).sort((a, b) => b.value - a.value);

  // Closed trades P&L by sector/timeframe
  const closedTrades = trades.filter(t => t.status === 'closed' && t.exitPrice);
  const byTimeframe = {};
  for (const t of closedTrades) {
    const tf = t.timeframe || 'position';
    const pnl = (t.action==='buy'||t.action==='cover' ? 1 : -1) * (t.exitPrice - t.price) * t.quantity;
    if (!byTimeframe[tf]) byTimeframe[tf] = { pnl:0, count:0, wins:0 };
    byTimeframe[tf].pnl   += pnl;
    byTimeframe[tf].count += 1;
    if (pnl > 0) byTimeframe[tf].wins += 1;
  }

  const sectorColors = ['#4a9eff','#4ade80','#f59e0b','#e879f9','#fb923c','#60a5fa','#34d399','#f87171'];

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Portfolio Attribution</h1>
          <p className="page-sub">P&amp;L breakdown by sector · position sizing · trade performance</p>
        </div>
      </div>

      {/* Summary bar */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10, marginBottom:16 }}>
        {[
          { label:'Total Value', value: `$${(totalValue/1000).toFixed(1)}k`, sub: `${totalPnlPct>=0?'+':''}${totalPnlPct.toFixed(1)}% vs cost` },
          { label:'Total P&L', value: `${totalPnl>=0?'+':''}$${Math.abs(totalPnl).toFixed(0)}`, sub: totalPnl>=0?'unrealized gain':'unrealized loss', color: totalPnl>=0?'var(--green)':'var(--red-loss)' },
          { label:"Today's P&L", value: `${totalDayPnl>=0?'+':''}$${Math.abs(totalDayPnl).toFixed(0)}`, sub:'day change', color: totalDayPnl>=0?'var(--green)':'var(--red-loss)' },
          { label:'Positions', value: positions.length, sub:`${sectors.length} sectors` },
          { label:'Closed Trades', value: closedTrades.length, sub:`${Object.keys(byTimeframe).length} timeframes` },
        ].map((s, i) => (
          <div key={i} className="card">
            <div style={{ fontSize:10, color:'var(--fg3)', textTransform:'uppercase', letterSpacing:'0.06em', fontFamily:'var(--font-mono)', marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:20, fontWeight:800, fontFamily:'var(--font-mono)', color: s.color||'var(--fg)' }}>{s.value}</div>
            <div style={{ fontSize:11, color:'var(--fg3)', marginTop:2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        {/* Sector allocation bar chart */}
        <div className="card">
          <div className="section-label" style={{ marginBottom:14 }}>Sector Allocation</div>
          {loading ? <div style={{ color:'var(--fg3)', fontSize:12 }}>Loading…</div> : sectors.length === 0 ? <div style={{ color:'var(--fg3)', fontSize:12 }}>No positions</div> : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {sectors.map((s, i) => (
                <div key={s.name}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:11, fontWeight:600 }}>{s.name}</span>
                    <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color: s.pnl>=0?'var(--green)':'var(--red-loss)' }}>
                      {s.pnl>=0?'+':''}${Math.abs(s.pnl).toFixed(0)} ({s.pnlPct>=0?'+':''}{ s.pnlPct.toFixed(1)}%)
                    </span>
                  </div>
                  <div style={{ height:6, background:'var(--surf2)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${s.weight}%`, background:sectorColors[i%sectorColors.length], borderRadius:3, transition:'width 0.4s' }} />
                  </div>
                  <div style={{ fontSize:9, color:'var(--fg3)', marginTop:2 }}>{s.weight.toFixed(1)}% · {s.tickers.join(', ')}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trade P&L by timeframe */}
        <div className="card">
          <div className="section-label" style={{ marginBottom:14 }}>Closed Trade P&amp;L by Timeframe</div>
          {closedTrades.length === 0 ? (
            <div style={{ color:'var(--fg3)', fontSize:12 }}>No closed trades yet — log trades in the Journal tab</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {Object.entries(byTimeframe).map(([tf, d]) => (
                <div key={tf} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:70, fontSize:11, fontFamily:'var(--font-mono)', color:'var(--fg3)', textTransform:'capitalize' }}>{tf}</div>
                  <div style={{ flex:1, height:8, background:'var(--surf2)', borderRadius:4, overflow:'hidden', position:'relative' }}>
                    <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1, background:'var(--bdr)' }} />
                    {d.pnl !== 0 && (
                      <div style={{
                        position:'absolute',
                        [d.pnl>0?'left':'right']: d.pnl>0 ? '50%' : '50%',
                        width: `${Math.min(50, Math.abs(d.pnl)/100)}%`,
                        top:0, bottom:0,
                        background: d.pnl>0 ? 'var(--green)' : 'var(--red-loss)',
                        borderRadius:4,
                      }} />
                    )}
                  </div>
                  <div style={{ width:80, textAlign:'right', fontSize:11, fontFamily:'var(--font-mono)', color: d.pnl>=0?'var(--green)':'var(--red-loss)', fontWeight:700 }}>
                    {d.pnl>=0?'+':''}${d.pnl.toFixed(0)}
                  </div>
                  <div style={{ width:50, fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>{d.wins}/{d.count}W</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Position-level P&L table */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--bdr)' }}>
          <div className="section-label" style={{ marginBottom:0 }}>Position P&amp;L Detail</div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Ticker</th><th>Sector</th><th style={{ textAlign:'right' }}>Shares</th>
              <th style={{ textAlign:'right' }}>Cost</th><th style={{ textAlign:'right' }}>Price</th>
              <th style={{ textAlign:'right' }}>Value</th><th style={{ textAlign:'right' }}>P&amp;L</th>
              <th style={{ textAlign:'right' }}>P&amp;L %</th><th style={{ textAlign:'right' }}>Weight</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding:20, textAlign:'center', color:'var(--fg3)' }}>Loading…</td></tr>
            ) : positionData.length === 0 ? (
              <tr><td colSpan={9} style={{ padding:20, textAlign:'center', color:'var(--fg3)' }}>No positions — add them in Portfolio tab</td></tr>
            ) : positionData.sort((a,b) => b.value-a.value).map(p => (
              <tr key={p.ticker}>
                <td><span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--red)', fontSize:12 }}>{p.ticker}</span></td>
                <td style={{ fontSize:11, color:'var(--fg3)' }}>{p.sector}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12 }}>{p.shares}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12 }}>${p.costBasis?.toFixed(2)}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12 }}>${p.currentPrice?.toFixed(2)}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12 }}>${p.value?.toFixed(0)}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:700, color: p.pnl>=0?'var(--green)':'var(--red-loss)' }}>
                  {p.pnl>=0?'+':''}${p.pnl?.toFixed(0)}
                </td>
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color: p.pnlPct>=0?'var(--green)':'var(--red-loss)' }}>
                  {p.pnlPct>=0?'+':''}{ p.pnlPct?.toFixed(1)}%
                </td>
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--fg3)' }}>
                  {totalValue>0 ? (p.value/totalValue*100).toFixed(1) : '0'}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── RESEARCH REPOSITORY ───────────────────────────────────────────────────────

function ResearchPage() {
  const [items,    setItems]    = React.useState([]);
  const [loading,  setLoading]  = React.useState(true);
  const [query,    setQuery]    = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [drafting, setDrafting] = React.useState(false);
  const [editing,  setEditing]  = React.useState(null);
  const [form,     setForm]     = React.useState({ title:'', content:'', type:'note', tags:'', tickers:'', conviction:5, source:'', pinned:false });

  const TYPES = ['all','thesis','memo','note','article','model','other'];
  const TYPE_COLORS = { thesis:'#4a9eff', memo:'#f59e0b', note:'var(--fg3)', article:'#4ade80', model:'#e879f9', other:'var(--fg3)' };

  function load() {
    const params = new URLSearchParams();
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (query.trim()) params.set('q', query.trim());
    fetch(`${API_URL}/research?${params}`)
      .then(r => r.json())
      .then(data => { setItems(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  React.useEffect(() => { load(); }, [typeFilter]);

  function save() {
    const payload = {
      title: form.title.trim(),
      content: form.content,
      type: form.type,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      tickers: form.tickers.split(',').map(t => t.trim()).filter(Boolean),
      conviction: form.conviction,
      source: form.source,
      pinned: form.pinned,
    };
    const url = editing ? `${API_URL}/research/${editing._id}` : `${API_URL}/research`;
    const method = editing ? 'PUT' : 'POST';
    fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(r => r.json())
      .then(() => { setDrafting(false); setEditing(null); setForm({ title:'', content:'', type:'note', tags:'', tickers:'', conviction:5, source:'', pinned:false }); load(); })
      .catch(() => {});
  }

  function deleteItem(id) {
    fetch(`${API_URL}/research/${id}`, { method: 'DELETE' })
      .then(() => setItems(p => p.filter(i => i._id !== id)))
      .catch(() => {});
  }

  function startEdit(item) {
    setEditing(item);
    setForm({ title: item.title, content: item.content||'', type: item.type||'note',
      tags: (item.tags||[]).join(', '), tickers: (item.tickers||[]).join(', '),
      conviction: item.conviction||5, source: item.source||'', pinned: item.pinned||false });
    setDrafting(true);
  }

  const displayed = items.filter(i =>
    !query.trim() ||
    i.title.toLowerCase().includes(query.toLowerCase()) ||
    (i.content||'').toLowerCase().includes(query.toLowerCase()) ||
    (i.tags||[]).some(t => t.includes(query.toLowerCase())) ||
    (i.tickers||[]).some(t => t.includes(query.toUpperCase()))
  );

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Research Repository</h1>
          <p className="page-sub">Theses · memos · notes · linked to tickers &amp; deals</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ title:'', content:'', type:'note', tags:'', tickers:'', conviction:5, source:'', pinned:false }); setDrafting(true); }}
          style={{ padding:'8px 16px', background:'var(--red)', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
          + New
        </button>
      </div>

      {/* Draft / Edit modal */}
      {drafting && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => e.target===e.currentTarget && setDrafting(false)}>
          <div style={{ background:'var(--bg)', border:'1px solid var(--bdr)', borderRadius:14, padding:24, width:'100%', maxWidth:640, maxHeight:'90vh', overflowY:'auto', display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:700, fontSize:15 }}>{editing ? 'Edit' : 'New'} Research Item</span>
              <button onClick={() => setDrafting(false)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--fg3)' }}>✕</button>
            </div>
            {[
              { label:'Title *', field:'title', placeholder:'e.g. NVDA AI cycle thesis' },
              { label:'Source / URL', field:'source', placeholder:'https://…' },
              { label:'Tickers (comma-separated)', field:'tickers', placeholder:'NVDA, AMD, TSM' },
              { label:'Tags (comma-separated)', field:'tags', placeholder:'ai, semis, long-term' },
            ].map(({ label, field, placeholder }) => (
              <div key={field}>
                <div style={{ fontSize:11, color:'var(--fg3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{label}</div>
                <input value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} placeholder={placeholder}
                  style={{ width:'100%', padding:'8px 12px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:8, fontSize:13, color:'var(--fg)', boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <div style={{ fontSize:11, color:'var(--fg3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Type</div>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  style={{ width:'100%', padding:'8px 12px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:8, fontSize:13, color:'var(--fg)' }}>
                  {TYPES.filter(t=>t!=='all').map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--fg3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Conviction {form.conviction}/10</div>
                <input type="range" min={1} max={10} value={form.conviction} onChange={e => setForm(p => ({ ...p, conviction: +e.target.value }))}
                  style={{ width:'100%', marginTop:6, accentColor:'var(--red)' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize:11, color:'var(--fg3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Content</div>
              <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="Write your thesis, memo, or notes here…"
                style={{ width:'100%', minHeight:160, padding:'10px 12px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:8, fontSize:13, color:'var(--fg)', fontFamily:'inherit', resize:'vertical', boxSizing:'border-box' }} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'space-between', alignItems:'center' }}>
              <label style={{ display:'flex', gap:6, alignItems:'center', fontSize:12, color:'var(--fg3)', cursor:'pointer' }}>
                <input type="checkbox" checked={form.pinned} onChange={e => setForm(p => ({ ...p, pinned: e.target.checked }))} style={{ accentColor:'var(--red)' }} />
                Pin to top
              </label>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setDrafting(false)} style={{ padding:'8px 16px', background:'none', border:'1px solid var(--bdr)', borderRadius:8, fontSize:12, cursor:'pointer', color:'var(--fg3)' }}>Cancel</button>
                <button onClick={save} disabled={!form.title.trim()}
                  style={{ padding:'8px 20px', background:'var(--red)', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', opacity:form.title.trim()?1:0.5 }}>
                  {editing ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters + search */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:'0 0 220px' }}>
          <svg style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', opacity:0.4 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className="search-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…" style={{ paddingLeft:30 }}
            onKeyDown={e => e.key === 'Enter' && load()} />
        </div>
        <div className="filter-strip">
          {TYPES.map(t => (
            <button key={t} className={`filter-chip${typeFilter===t?' active':''}`} onClick={() => setTypeFilter(t)}
              style={typeFilter===t && t!=='all' ? { borderColor: TYPE_COLORS[t], color: TYPE_COLORS[t], background:`${TYPE_COLORS[t]}22` } : {}}>
              {t==='all' ? 'All' : t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      {loading ? (
        <div className="card" style={{ color:'var(--fg3)', fontSize:12, fontFamily:'var(--font-mono)' }}>Loading…</div>
      ) : displayed.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:40, color:'var(--fg3)' }}>
          <div style={{ fontSize:28, marginBottom:8 }}>📂</div>
          <div style={{ fontWeight:700, marginBottom:4 }}>Research repository is empty</div>
          <div style={{ fontSize:12 }}>Click "+ New" to add a thesis, memo, or note</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {displayed.map(item => (
            <div key={item._id} className="card" style={{ borderLeft: item.pinned ? '3px solid var(--red)' : undefined }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                    <span style={{ fontWeight:700, fontSize:14 }}>{item.pinned ? '📌 ' : ''}{item.title}</span>
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:4, background:`${TYPE_COLORS[item.type]||'var(--fg3)'}22`, color:TYPE_COLORS[item.type]||'var(--fg3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{item.type}</span>
                    {item.conviction > 7 && <span style={{ fontSize:10, color:'var(--red)', fontFamily:'var(--font-mono)' }}>C{item.conviction}</span>}
                  </div>
                  {item.content && (
                    <p style={{ fontSize:12, color:'var(--fg2)', margin:'0 0 6px', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                      {item.content}
                    </p>
                  )}
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {(item.tickers||[]).map(t => (
                      <span key={t} style={{ fontSize:10, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--red)', background:'var(--red-dim)', padding:'1px 6px', borderRadius:4 }}>{t}</span>
                    ))}
                    {(item.tags||[]).map(t => (
                      <span key={t} style={{ fontSize:10, color:'var(--fg3)', background:'var(--surf2)', padding:'1px 6px', borderRadius:4 }}>{t}</span>
                    ))}
                  </div>
                  {item.source && (
                    <a href={item.source} target="_blank" rel="noopener" style={{ fontSize:10, color:'var(--fg3)', marginTop:4, display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {item.source}
                    </a>
                  )}
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button onClick={() => startEdit(item)} style={{ padding:'4px 8px', background:'none', border:'1px solid var(--bdr)', borderRadius:6, fontSize:11, cursor:'pointer', color:'var(--fg3)' }}>Edit</button>
                  <button onClick={() => deleteItem(item._id)} style={{ padding:'4px 8px', background:'none', border:'1px solid var(--bdr)', borderRadius:6, fontSize:11, cursor:'pointer', color:'var(--red-loss)' }}>✕</button>
                </div>
              </div>
              <div style={{ fontSize:10, color:'var(--fg3)', marginTop:8, fontFamily:'var(--font-mono)' }}>
                {new Date(item.updatedAt||item.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── BRIEFING PAGE ────────────────────────────────────────────────────────────

function BriefingPage() {
  const isMobile = useIsMobile();
  const [briefing,    setBriefing]    = React.useState(null);
  const [loading,     setLoading]     = React.useState(true);
  const [generating,  setGenerating]  = React.useState(false);
  const [error,       setError]       = React.useState(null);

  async function fetchBriefing() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/briefing/latest`);
      if (res.status === 404) { setBriefing(null); }
      else if (!res.ok) { setError('Could not load briefing'); }
      else {
        const data = await res.json();
        setBriefing(data.summary ? data : null);
      }
    } catch { setError('Could not load briefing'); }
    setLoading(false);
  }

  async function generateBriefing() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/briefing/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (data.summary) setBriefing(data);
      else setError(data.error || 'Generation failed');
    } catch { setError('Could not generate briefing'); }
    setGenerating(false);
  }

  React.useEffect(() => { fetchBriefing(); }, []);

  function renderBriefingContent(content) {
    if (!content) return null;
    return content.split('\n').map((line, i) => {
      if (line.startsWith('## ')) return (
        <h2 key={i} style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg)', margin: '22px 0 8px', borderBottom: '1px solid var(--bdr)', paddingBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
          {line.slice(3)}
        </h2>
      );
      if (line.startsWith('# ')) return (
        <h1 key={i} style={{ fontSize: 20, fontWeight: 800, color: 'var(--fg)', margin: '0 0 12px' }}>{line.slice(2)}</h1>
      );
      if (line.startsWith('**') && line.endsWith('**') && !line.slice(2,-2).includes('**')) return (
        <div key={i} style={{ fontWeight: 700, color: 'var(--fg)', marginTop: 8, marginBottom: 2 }}>{line.slice(2,-2)}</div>
      );
      if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) return (
        <div key={i} style={{ paddingLeft: 16, marginBottom: 4, color: 'var(--fg2)', fontSize: 13, lineHeight: 1.65 }}>
          · {line.slice(2)}
        </div>
      );
      if (line === '') return <div key={i} style={{ height: 5 }} />;
      const parts = line.split(/\*\*(.+?)\*\*/g);
      return (
        <div key={i} style={{ marginBottom: 3, color: 'var(--fg2)', fontSize: 13, lineHeight: 1.65 }}>
          {parts.map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: 'var(--fg)' }}>{p}</strong> : p)}
        </div>
      );
    });
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const isToday = briefing?.date && new Date(briefing.date).toDateString() === new Date().toDateString();
  const briefingDate = briefing?.date ? new Date(briefing.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : null;

  return (
    <div className="page-root">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="page-title">Morning Briefing</h1>
          <p className="page-sub">{today}</p>
        </div>
        <button onClick={generateBriefing} disabled={generating}
          style={{ padding: '8px 16px', background: generating ? 'var(--surf2)' : 'var(--red)', color: generating ? 'var(--fg3)' : 'white',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: generating ? 'default' : 'pointer', flexShrink: 0, transition: 'all 0.2s' }}>
          {generating ? '⟳ Generating…' : '⟳ Regenerate'}
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 72, color: 'var(--fg3)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✦</div>
          <div style={{ fontSize: 13 }}>Loading briefing…</div>
        </div>
      )}

      {!loading && error && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 13, color: 'var(--fg3)', marginBottom: 16 }}>{error}</div>
          <button onClick={generateBriefing} disabled={generating}
            style={{ padding: '10px 22px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {generating ? 'Generating…' : 'Generate Now'}
          </button>
        </div>
      )}

      {!loading && !error && !briefing && (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🌅</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>No briefing yet</div>
          <div style={{ color: 'var(--fg3)', fontSize: 13, marginBottom: 24, maxWidth: 420, margin: '0 auto 24px', lineHeight: 1.7 }}>
            Generate your AI morning briefing — it synthesizes your portfolio, upcoming meetings, active deals, and market context into a personalized daily digest.
          </div>
          <button onClick={generateBriefing} disabled={generating}
            style={{ padding: '11px 26px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {generating ? '⟳ Generating…' : '✦ Generate Briefing'}
          </button>
        </div>
      )}

      {!loading && !error && briefing && (
        <>
          {/* Stale warning */}
          {!isToday && briefingDate && (
            <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: 12, color: '#f59e0b', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠</span>
              <span>This briefing is from {briefingDate}. Hit Regenerate for a fresh one.</span>
            </div>
          )}

          {/* Briefing card */}
          <div className="card" style={{ padding: isMobile ? '16px 18px' : '28px 32px', lineHeight: 1.7 }}>
            {renderBriefingContent(briefing.summary)}
          </div>

          <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--fg3)', marginTop: 14, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            Generated {briefing.generatedAt ? new Date(briefing.generatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''} · Llama 3.3 (Groq) · Live data
          </div>
        </>
      )}
    </div>
  );
}

// ─── CATALYST CALENDAR ───────────────────────────────────────────────────────

function CalendarPage({ defaultTab }) {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);
  const [view,    setView]    = React.useState(defaultTab || 'grid'); // 'grid' | 'earnings' | 'ecocal'
  // Grid state
  const [year,    setYear]    = React.useState(now.getFullYear());
  const [month,   setMonth]   = React.useState(now.getMonth());
  const [events,  setEvents]  = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [filters, setFilters] = React.useState({ catalyst:true, earnings:true, ecocal:true, meetings:true });
  const [selected,setSelected]= React.useState(null);
  const [showAdd, setShowAdd] = React.useState(false);
  const [form,    setForm]    = React.useState({ ticker:'', title:'', type:'other', date:'', impact:'medium', notes:'' });
  const [saving,  setSaving]  = React.useState(false);
  // Earnings list state
  const [earnData,  setEarnData]  = React.useState([]);
  const [earnLoad,  setEarnLoad]  = React.useState(false);
  const [earnFetch, setEarnFetch] = React.useState(false);

  const MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const TYPE_OPTIONS = ['earnings','fda','lockup','analyst_day','spin_off','index_rebal','conference','product_launch','dividend','split','macro','other'];

  const TYPE_COLOR = {
    earnings:'#f59e0b', fda:'#ef4444', lockup:'#8b5cf6', analyst_day:'#3b82f6',
    spin_off:'#10b981', conference:'#06b6d4', product_launch:'#ec4899',
    dividend:'#84cc16', split:'#f97316', macro:'#6366f1', index_rebal:'#0ea5e9',
    ecocal:'#10b981', meeting:'#64748b', other:'var(--fg3)',
  };

  // ── Fetch grid events ──────────────────────────────────────────────────────
  function load() {
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/catalysts/month?year=${year}&month=${month}`).then(r => r.json()).catch(() => []),
      fetch(`${API_URL}/meetings`).then(r => r.json()).catch(() => []),
    ]).then(([cats, meets]) => {
      const meetEvents = (Array.isArray(meets) ? meets : []).map(m => ({
        _id: m._id, title: m.title || m.subject || 'Meeting', type: 'meeting',
        date: m.date || m.startTime, ticker: '', impact: 'medium', source: 'meeting',
      }));
      // Add hardcoded eco-cal events that fall in this month
      const ecoEvents = ECOCAL_2026
        .filter(e => {
          const d = new Date(e.date + 'T12:00:00Z');
          return d.getFullYear() === year && d.getMonth() === month;
        })
        .map(e => ({ _id: `eco-${e.date}-${e.name}`, title: e.name, type: 'ecocal', date: e.date, ticker: '', impact: e.priority, source: 'ecocal', desc: e.desc }));
      setEvents([...(Array.isArray(cats) ? cats : []), ...meetEvents, ...ecoEvents]);
      setLoading(false);
    });
  }
  React.useEffect(load, [year, month]);

  // ── Fetch earnings list (lazy) ─────────────────────────────────────────────
  React.useEffect(() => {
    if (view !== 'earnings' || earnFetch) return;
    setEarnFetch(true);
    setEarnLoad(true);
    fetch(`${API_URL}/earnings/calendar`)
      .then(r => r.ok ? r.json() : { earningsCalendar: [] })
      .then(d => { setEarnData(d.earningsCalendar || []); setEarnLoad(false); })
      .catch(() => setEarnLoad(false));
  }, [view]);

  function prevMonth() { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); }
  function nextMonth() { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); }

  async function addCatalyst(e) {
    e.preventDefault(); setSaving(true);
    await fetch(`${API_URL}/catalysts`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) }).catch(() => {});
    setSaving(false); setShowAdd(false);
    setForm({ ticker:'', title:'', type:'other', date:'', impact:'medium', notes:'' });
    load();
  }

  async function deleteEvent(id) {
    await fetch(`${API_URL}/catalysts/${id}`, { method:'DELETE' }).catch(() => {});
    load(); setSelected(null);
  }

  // Build calendar grid
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells       = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function eventsForDay(d) {
    if (!d) return [];
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    return events.filter(ev => {
      if (!ev.date) return false;
      const evDate = new Date(ev.date).toISOString().slice(0,10);
      if (evDate !== key) return false;
      if (ev.source === 'meeting'  || ev.type === 'meeting')  return filters.meetings;
      if (ev.source === 'earnings' || ev.type === 'earnings') return filters.earnings;
      if (ev.source === 'ecocal'   || ev.type === 'ecocal')   return filters.ecocal;
      return filters.catalyst;
    });
  }

  // Earnings list helpers
  const earnGrouped = {};
  for (const e of earnData) {
    if (!earnGrouped[e.date]) earnGrouped[e.date] = [];
    earnGrouped[e.date].push(e);
  }
  const earnDates = Object.keys(earnGrouped).sort();

  // Eco cal upcoming
  const ecoUpcoming = ECOCAL_2026.filter(e => e.date >= today).sort((a,b) => a.date.localeCompare(b.date));

  const tagStyle = tag => {
    const map = { fed:'#F59E0B', boj:'#EF4444', macro:'#8B5CF6', event:'#10B981' };
    return { background: (map[tag]||'#666') + '22', color: map[tag]||'#999', border: `1px solid ${(map[tag]||'#666')}44`, borderRadius:4, padding:'2px 7px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' };
  };
  const priBadge = p => {
    const c = p==='high'?'#EF4444':p==='medium'?'#F59E0B':'#6B7280';
    return { width:6, height:6, borderRadius:'50%', background:c, flexShrink:0 };
  };

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-sub">Catalyst events · earnings reports · economic calendar · meetings</p>
        </div>
        {view === 'grid' && (
          <button onClick={() => setShowAdd(true)}
            style={{ padding:'8px 16px', background:'var(--red)', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
            + Add Event
          </button>
        )}
      </div>

      {/* View tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:16, background:'var(--surf)', borderRadius:10, padding:4, width:'fit-content' }}>
        {[['grid','📅 Calendar'],['earnings','📊 Earnings'],['ecocal','🌐 Eco Calendar']].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            style={{ padding:'7px 18px', borderRadius:7, border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
              background: view===id ? 'var(--surf2)' : 'transparent',
              color: view===id ? 'var(--fg)' : 'var(--fg3)', transition:'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── CALENDAR GRID VIEW ── */}
      {view === 'grid' && (
        <>
          {/* Filter toggles + month nav */}
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
            {[['catalyst','Catalysts','#ef4444'],['earnings','Earnings','#f59e0b'],['ecocal','Eco Cal','#10b981'],['meetings','Meetings','#64748b']].map(([k,label,color]) => (
              <button key={k} onClick={() => setFilters(f => ({ ...f, [k]: !f[k] }))}
                style={{ padding:'5px 12px', borderRadius:20, fontSize:11, fontWeight:600, cursor:'pointer', transition:'all 0.15s',
                  background: filters[k] ? color : 'transparent', border: `1.5px solid ${filters[k] ? color : 'var(--bdr)'}`,
                  color: filters[k] ? '#fff' : 'var(--fg3)' }}>
                {label}
              </button>
            ))}
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
              <button onClick={prevMonth} style={{ padding:'6px 12px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:6, cursor:'pointer', color:'var(--fg)', fontSize:14 }}>‹</button>
              <span style={{ fontWeight:700, fontSize:14, minWidth:160, textAlign:'center' }}>{MONTH_NAMES[month]} {year}</span>
              <button onClick={nextMonth} style={{ padding:'6px 12px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:6, cursor:'pointer', color:'var(--fg)', fontSize:14 }}>›</button>
            </div>
          </div>

          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid var(--bdr)' }}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} style={{ padding:'8px 4px', textAlign:'center', fontSize:10, fontFamily:'var(--font-mono)', color:'var(--fg3)', fontWeight:700, letterSpacing:'0.05em' }}>{d}</div>
              ))}
            </div>
            {loading ? (
              <div style={{ padding:40, textAlign:'center', color:'var(--fg3)', fontSize:13 }}>Loading…</div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
                {cells.map((d, i) => {
                  const dayEvents = eventsForDay(d);
                  const isToday = d && now.getDate()===d && now.getMonth()===month && now.getFullYear()===year;
                  return (
                    <div key={i} onClick={() => d && setSelected({ day: d, events: dayEvents })}
                      style={{ minHeight:88, padding:'6px 8px', borderRight:(i+1)%7===0?'none':'1px solid var(--bdr)', borderBottom:'1px solid var(--bdr)',
                        background: isToday?'rgba(239,68,68,0.06)':'transparent', cursor: d?'pointer':'default',
                        opacity: d?1:0.15, transition:'background 0.1s' }}
                      onMouseEnter={e => d && (e.currentTarget.style.background = isToday?'rgba(239,68,68,0.1)':'var(--surf)')}
                      onMouseLeave={e => e.currentTarget.style.background = isToday?'rgba(239,68,68,0.06)':'transparent'}>
                      <div style={{ fontSize:11, fontWeight: isToday?800:400, color: isToday?'var(--red)':'var(--fg2)', marginBottom:4, fontFamily:'var(--font-mono)' }}>{d}</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                        {dayEvents.slice(0,3).map((ev,j) => (
                          <div key={j} style={{ fontSize:9, padding:'1px 4px', borderRadius:3, fontWeight:600, lineHeight:1.4,
                            background:`${TYPE_COLOR[ev.type]||'#64748b'}22`, color: TYPE_COLOR[ev.type]||'var(--fg3)',
                            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {ev.ticker?`${ev.ticker} `:''}
                            {(ev.title||'').slice(0,16)}
                          </div>
                        ))}
                        {dayEvents.length > 3 && <div style={{ fontSize:9, color:'var(--fg3)', paddingLeft:4 }}>+{dayEvents.length-3}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── EARNINGS LIST VIEW ── */}
      {view === 'earnings' && (
        <div>
          {earnLoad ? (
            <div className="card" style={{ textAlign:'center', padding:40, color:'var(--fg3)' }}>Loading earnings calendar…</div>
          ) : earnData.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:40 }}>
              <div style={{ fontSize:32, marginBottom:12 }}>📅</div>
              <div style={{ color:'var(--fg3)', fontSize:14 }}>No earnings data — requires Finnhub API key</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {earnDates.map(date => {
                const d      = new Date(date + 'T12:00:00Z');
                const isPast = date < today;
                return (
                  <div key={date}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--fg3)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:8, fontFamily:'var(--font-mono)' }}>
                      {d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
                      {date === today && <span style={{ marginLeft:8, color:'var(--red)', fontSize:10 }}>TODAY</span>}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {earnGrouped[date].map(e => (
                        <div key={e.symbol} className="card"
                          style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12, opacity:isPast?0.55:1 }}>
                          <div style={{ width:40, height:40, borderRadius:8, background:'var(--red-dim)', display:'flex', alignItems:'center', justifyContent:'center',
                            color:'var(--red)', fontWeight:800, fontSize:13, fontFamily:'var(--font-mono)', flexShrink:0 }}>
                            {e.symbol.slice(0,3)}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:700, fontSize:14, color:'var(--fg)' }}>{e.symbol}</div>
                            <div style={{ fontSize:12, color:'var(--fg3)', marginTop:2 }}>
                              {e.hour==='bmo'?'pre-market':e.hour==='amc'?'after-close':''}
                              {e.epsEstimate != null && ` · EPS est: $${e.epsEstimate}`}
                              {e.revenueEstimate != null && ` · Rev est: $${(e.revenueEstimate/1e9).toFixed(1)}B`}
                            </div>
                          </div>
                          <span style={{ fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)', background:'var(--surf)', padding:'4px 10px', borderRadius:5 }}>
                            {e.hour==='bmo'?'🌅 Pre':e.hour==='amc'?'🌆 Post':'📊'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ECO CALENDAR VIEW ── */}
      {view === 'ecocal' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {ecoUpcoming.length === 0 && <div className="card" style={{ textAlign:'center', padding:40, color:'var(--fg3)' }}>No upcoming events</div>}
          {ecoUpcoming.map((evt, i) => {
            const d        = new Date(evt.date + 'T12:00:00Z');
            const isToday  = evt.date === today;
            const daysAway = Math.round((new Date(evt.date) - new Date(today)) / 86400000);
            return (
              <div key={i} className="card" style={{ padding:'14px 18px', display:'flex', gap:14, alignItems:'center' }}>
                <div style={{ width:52, textAlign:'center', flexShrink:0 }}>
                  <div style={{ fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)', textTransform:'uppercase' }}>
                    {d.toLocaleDateString('en-US',{month:'short'})}
                  </div>
                  <div style={{ fontSize:22, fontWeight:800, color:isToday?'var(--red)':'var(--fg)', lineHeight:1.1 }}>{d.getUTCDate()}</div>
                  <div style={{ fontSize:9, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>
                    {isToday?'TODAY':daysAway<=7?`${daysAway}d`:''}
                  </div>
                </div>
                <div style={{ borderLeft:'2px solid var(--bdr)', paddingLeft:14, flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <div style={priBadge(evt.priority)} />
                    <span style={{ fontWeight:700, fontSize:14, color:'var(--fg)' }}>{evt.name}</span>
                    <span style={tagStyle(evt.tag)}>{evt.tag}</span>
                  </div>
                  <div style={{ fontSize:12, color:'var(--fg3)' }}>{evt.desc}</div>
                </div>
                <div>
                  <span style={{ borderRadius:4, background:evt.priority==='high'?'#EF444422':evt.priority==='medium'?'#F59E0B22':'#6B728022',
                    color:evt.priority==='high'?'#EF4444':evt.priority==='medium'?'#F59E0B':'#6B7280',
                    padding:'3px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                    {evt.priority}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Day detail bottom sheet */}
      {selected && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--bg)', borderRadius:'16px 16px 0 0', padding:20, width:'100%', maxWidth:600, maxHeight:'65vh', overflowY:'auto' }}>
            <div style={{ fontWeight:800, fontSize:16, marginBottom:12 }}>
              {MONTH_NAMES[month]} {selected.day}, {year}
              <span style={{ marginLeft:8, fontFamily:'var(--font-mono)', fontSize:11, color:'var(--fg3)', fontWeight:400 }}>
                {selected.events.length} event{selected.events.length!==1?'s':''}
              </span>
            </div>
            {selected.events.length === 0 ? (
              <div style={{ color:'var(--fg3)', fontSize:13 }}>No events this day</div>
            ) : selected.events.map((ev,i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 0', borderBottom:'1px solid var(--bdr)' }}>
                <div style={{ width:10, height:10, borderRadius:'50%', marginTop:3, flexShrink:0, background: TYPE_COLOR[ev.type]||'var(--fg3)' }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>
                    {ev.ticker ? <><strong style={{ color:'var(--red)' }}>{ev.ticker}</strong> · </> : null}{ev.title}
                  </div>
                  <div style={{ fontSize:11, color:'var(--fg3)', marginTop:2 }}>{ev.type?.replace(/_/g,' ')} · {ev.impact} impact</div>
                  {ev.desc && <div style={{ fontSize:11, color:'var(--fg2)', marginTop:4 }}>{ev.desc}</div>}
                  {ev.notes && <div style={{ fontSize:11, color:'var(--fg2)', marginTop:4 }}>{ev.notes}</div>}
                </div>
                {ev.source === 'catalyst' && (
                  <button onClick={() => deleteEvent(ev._id)} style={{ background:'none', border:'none', color:'var(--fg3)', cursor:'pointer', fontSize:18 }}>×</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add event modal */}
      {showAdd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={() => setShowAdd(false)}>
          <form onSubmit={addCatalyst} onClick={e => e.stopPropagation()}
            style={{ background:'var(--bg)', borderRadius:16, padding:24, width:'100%', maxWidth:440, display:'flex', flexDirection:'column', gap:12 }}>
            <h2 style={{ margin:0, fontSize:16, fontWeight:800 }}>Add Calendar Event</h2>
            {[['ticker','Ticker (optional)','text','NVDA'],['title','Title','text','FDA Decision'],['date','Date','date','']].map(([k,label,type,ph]) => (
              <div key={k}>
                <label style={{ fontSize:11, color:'var(--fg3)', display:'block', marginBottom:4 }}>{label}</label>
                <input value={form[k]} onChange={e => setForm(f => ({...f,[k]:e.target.value}))} type={type} placeholder={ph} required={k==='title'||k==='date'}
                  style={{ width:'100%', padding:'8px 10px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:13, color:'var(--fg)', boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label style={{ fontSize:11, color:'var(--fg3)', display:'block', marginBottom:4 }}>Type</label>
                <select value={form.type} onChange={e => setForm(f => ({...f,type:e.target.value}))}
                  style={{ width:'100%', padding:'8px 10px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:12, color:'var(--fg)' }}>
                  {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, color:'var(--fg3)', display:'block', marginBottom:4 }}>Impact</label>
                <select value={form.impact} onChange={e => setForm(f => ({...f,impact:e.target.value}))}
                  style={{ width:'100%', padding:'8px 10px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:12, color:'var(--fg)' }}>
                  {['high','medium','low'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--fg3)', display:'block', marginBottom:4 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({...f,notes:e.target.value}))} rows={2}
                style={{ width:'100%', padding:'8px 10px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:12, color:'var(--fg)', resize:'vertical', boxSizing:'border-box' }} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button type="button" onClick={() => setShowAdd(false)}
                style={{ flex:1, padding:'10px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:8, fontSize:13, cursor:'pointer', color:'var(--fg)' }}>Cancel</button>
              <button type="submit" disabled={saving}
                style={{ flex:1, padding:'10px', background:'var(--red)', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                {saving ? 'Saving…' : 'Add Event'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── CONGRESSIONAL TRADING TRACKER ────────────────────────────────────────────

function CongressPage() {
  const [trades,   setTrades]   = React.useState([]);
  const [loading,  setLoading]  = React.useState(true);
  const [error,    setError]    = React.useState('');
  const [ticker,   setTicker]   = React.useState('');
  const [chamber,  setChamber]  = React.useState('');
  const [days,     setDays]     = React.useState('90');
  const [typeF,    setTypeF]    = React.useState('all');  // all | buy | sell
  const [cached,   setCached]   = React.useState(null);

  function load(t, ch, d) {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ days: d || days });
    if (t || ticker) params.set('ticker', (t??ticker).toUpperCase());
    if (ch ?? chamber) params.set('chamber', ch ?? chamber);
    fetch(`${API_URL}/congressional?${params}`)
      .then(r => r.json())
      .then(d => {
        setTrades(Array.isArray(d.trades) ? d.trades : []);
        if (d.cached) setCached(new Date(d.cached));
        if (d.error) setError(d.error);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }
  React.useEffect(() => load(), []);

  const filtered = React.useMemo(() => {
    if (typeF === 'buy')  return trades.filter(t => t.isBuy);
    if (typeF === 'sell') return trades.filter(t => !t.isBuy);
    return trades;
  }, [trades, typeF]);

  const PARTY_COLOR = { D:'#3b82f6', R:'#ef4444', I:'#8b5cf6' };

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Congressional Trading</h1>
          <p className="page-sub">House &amp; Senate stock disclosures · STOCK Act filings</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card" style={{ marginBottom:14, padding:'12px 16px' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ position:'relative', minWidth:140 }}>
            <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)', pointerEvents:'none' }}>TICKER›</span>
            <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key==='Enter' && load(ticker, chamber, days)}
              placeholder="All" style={{ width:120, padding:'8px 10px 8px 58px', background:'var(--bg)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:13, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--fg)' }} />
          </div>
          <div style={{ display:'flex', gap:4 }}>
            {['30','60','90','180'].map(d => (
              <button key={d} onClick={() => { setDays(d); load(ticker, chamber, d); }}
                style={{ padding:'6px 10px', fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, border:'1px solid', borderRadius:6, cursor:'pointer',
                  background: days===d?'var(--red)':'transparent', borderColor: days===d?'var(--red)':'var(--bdr)', color: days===d?'#fff':'var(--fg3)' }}>
                {d}D
              </button>
            ))}
          </div>
          <div style={{ display:'flex', gap:4 }}>
            {[['all','All'],['buy','Buys'],['sell','Sells']].map(([v,l]) => (
              <button key={v} onClick={() => setTypeF(v)}
                style={{ padding:'6px 10px', fontSize:11, fontWeight:600, border:'1px solid', borderRadius:6, cursor:'pointer',
                  background: typeF===v?(v==='sell'?'rgba(239,68,68,0.15)':'rgba(34,197,94,0.15)'):'transparent',
                  borderColor: typeF===v?(v==='sell'?'#ef4444':'#22c55e'):'var(--bdr)',
                  color: typeF===v?(v==='sell'?'#ef4444':'#22c55e'):'var(--fg3)' }}>
                {l}
              </button>
            ))}
          </div>
          {[['','All Chambers'],['House','House'],['Senate','Senate']].map(([v,l]) => (
            <button key={v} onClick={() => { setChamber(v); load(ticker, v, days); }}
              style={{ padding:'6px 10px', fontSize:11, border:'1px solid', borderRadius:6, cursor:'pointer',
                background: chamber===v?'var(--surf)':'transparent', borderColor: chamber===v?'var(--fg2)':'var(--bdr)', color: chamber===v?'var(--fg)':'var(--fg3)' }}>
              {l}
            </button>
          ))}
          <button onClick={() => load(ticker, chamber, days)} style={{ marginLeft:'auto', padding:'7px 16px', background:'var(--red)', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-mono)' }}>
            {loading ? '…' : 'REFRESH'}
          </button>
        </div>
        {cached && <div style={{ marginTop:6, fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>Data cached · refreshed {cached.toLocaleTimeString()} · source: Quiverquant</div>}
      </div>

      {error && <div className="card" style={{ marginBottom:12, padding:'10px 14px', color:'#ef4444', fontSize:12 }}>{error}</div>}

      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--bdr)', display:'flex', gap:12, alignItems:'center' }}>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--fg3)' }}>{filtered.length} transactions</span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--green)' }}>
            {filtered.filter(t => t.isBuy).length} buys
          </span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--red-loss)' }}>
            {filtered.filter(t => !t.isBuy).length} sells
          </span>
        </div>
        {loading ? (
          <div style={{ padding:30, textAlign:'center', color:'var(--fg3)', fontSize:13 }}>Loading congressional disclosures…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:30, textAlign:'center', color:'var(--fg3)', fontSize:13 }}>No transactions found for these filters</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--surf)' }}>
                  {['MEMBER','PARTY','CHAMBER','TICKER','TYPE','AMOUNT','DATE'].map(h => (
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontFamily:'var(--font-mono)', color:'var(--fg3)', textTransform:'uppercase', letterSpacing:'0.08em', borderBottom:'1px solid var(--bdr)', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid var(--bdr)', cursor:'default' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--surf)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <td style={{ padding:'9px 12px', fontSize:12, fontWeight:600 }}>{t.name}</td>
                    <td style={{ padding:'9px 12px' }}>
                      <span style={{ fontSize:10, fontWeight:800, fontFamily:'var(--font-mono)', color: PARTY_COLOR[t.party?.[0]] || 'var(--fg3)', background:`${PARTY_COLOR[t.party?.[0]]||'#64748b'}22`, padding:'1px 6px', borderRadius:3 }}>{t.party}</span>
                    </td>
                    <td style={{ padding:'9px 12px', fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>{t.chamber}</td>
                    <td style={{ padding:'9px 12px', fontSize:13, fontWeight:800, fontFamily:'var(--font-mono)', color:'var(--fg)' }}>{t.ticker}</td>
                    <td style={{ padding:'9px 12px' }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:4, fontFamily:'var(--font-mono)',
                        background: t.isBuy?'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)',
                        color: t.isBuy?'var(--green)':'var(--red-loss)' }}>
                        {t.isBuy ? 'BUY' : 'SELL'}
                      </span>
                    </td>
                    <td style={{ padding:'9px 12px', fontSize:12, fontFamily:'var(--font-mono)', color:'var(--fg2)' }}>{t.amount}</td>
                    <td style={{ padding:'9px 12px', fontSize:11, fontFamily:'var(--font-mono)', color:'var(--fg3)', whiteSpace:'nowrap' }}>{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── OPTIONS FLOW MONITOR ─────────────────────────────────────────────────────

function OptionsPage() {
  const [ticker,  setTicker]  = React.useState('');
  const [data,    setData]    = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [tab,     setTab]     = React.useState('unusual');

  function search() {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setLoading(true); setData(null);
    fetch(`${API_URL}/options/${t}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  const pcColor = data?.putCallRatio == null ? 'var(--fg3)' :
    data.putCallRatio < 0.7 ? 'var(--green)' : data.putCallRatio > 1.2 ? 'var(--red-loss)' : '#f59e0b';

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Options Flow</h1>
          <p className="page-sub">Put/call ratio · unusual activity · options chain · Yahoo Finance</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom:14, padding:'12px 16px' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ position:'relative', flex:1 }}>
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)', pointerEvents:'none' }}>TICKER›</span>
            <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key==='Enter' && search()} placeholder="NVDA"
              style={{ width:'100%', padding:'9px 12px 9px 64px', background:'var(--bg)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:14, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--fg)' }} />
          </div>
          <button onClick={search} disabled={loading}
            style={{ padding:'9px 20px', background:'var(--red)', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-mono)', opacity:loading?0.7:1 }}>
            {loading ? 'LOADING…' : 'SEARCH'}
          </button>
        </div>
      </div>

      {data?.error && <div className="card" style={{ marginBottom:12, padding:'10px 14px', color:'#ef4444', fontSize:12 }}>{data.error}</div>}

      {data && !data.error && (
        <div>
          {/* Summary cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10, marginBottom:14 }}>
            {[
              { label:'PRICE', value: data.price ? `$${data.price.toFixed(2)}` : '—', color:'var(--fg)' },
              { label:'P/C RATIO', value: data.putCallRatio?.toFixed(3) ?? '—', color: pcColor },
              { label:'SENTIMENT', value: (data.sentiment||'').toUpperCase(), color: data.sentiment==='bullish'?'var(--green)':data.sentiment==='bearish'?'var(--red-loss)':'#f59e0b' },
              { label:'CALL VOL', value: (data.totalCallVol||0).toLocaleString(), color:'var(--green)' },
              { label:'PUT VOL', value: (data.totalPutVol||0).toLocaleString(), color:'var(--red-loss)' },
              { label:'NEXT EXPIRY', value: data.expiry || '—', color:'var(--fg2)' },
            ].map(s => (
              <div key={s.label} className="card">
                <div style={{ fontSize:9, color:'var(--fg3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{s.label}</div>
                <div style={{ fontSize:18, fontWeight:800, fontFamily:'var(--font-mono)', color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Tab strip */}
          <div className="filter-strip" style={{ marginBottom:12 }}>
            {[['unusual','⚡ Unusual Activity'],['calls','Calls'],['puts','Puts']].map(([id,label]) => (
              <button key={id} className={`filter-chip${tab===id?' active':''}`} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>

          {/* Tables */}
          {['unusual','calls','puts'].map(t => {
            if (tab !== t) return null;
            const rows = t==='unusual' ? data.unusual : t==='calls' ? data.calls : data.puts;
            return (
              <div key={t} className="card" style={{ padding:0, overflow:'hidden' }}>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ background:'var(--surf)' }}>
                        {(t==='unusual' ? ['SIDE','STRIKE','EXPIRY','VOLUME','OI','VOL/OI','IV','LAST'] : ['STRIKE','EXPIRY','VOLUME','OI','IV','BID','ASK','LAST','ITM']).map(h => (
                          <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:9, fontFamily:'var(--font-mono)', color:'var(--fg3)', textTransform:'uppercase', borderBottom:'1px solid var(--bdr)', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(rows || []).map((o, i) => (
                        <tr key={i} style={{ borderBottom:'1px solid var(--bdr)' }}
                          onMouseEnter={e => e.currentTarget.style.background='var(--surf)'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                          {t==='unusual' && (
                            <td style={{ padding:'8px 12px' }}>
                              <span style={{ fontSize:10, fontWeight:800, fontFamily:'var(--font-mono)', padding:'2px 6px', borderRadius:3,
                                background: o.side==='CALL'?'rgba(34,197,94,0.15)':'rgba(239,68,68,0.15)',
                                color: o.side==='CALL'?'var(--green)':'var(--red-loss)' }}>{o.side}</span>
                            </td>
                          )}
                          <td style={{ padding:'8px 12px', fontSize:12, fontFamily:'var(--font-mono)', fontWeight:700 }}>${o.strike}</td>
                          <td style={{ padding:'8px 12px', fontSize:11, fontFamily:'var(--font-mono)', color:'var(--fg3)' }}>{o.expiry}</td>
                          <td style={{ padding:'8px 12px', fontSize:12, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--fg)' }}>{(o.volume||0).toLocaleString()}</td>
                          <td style={{ padding:'8px 12px', fontSize:11, fontFamily:'var(--font-mono)', color:'var(--fg3)' }}>{(o.oi||0).toLocaleString()}</td>
                          {t==='unusual' && <td style={{ padding:'8px 12px', fontSize:11, fontFamily:'var(--font-mono)', color:'#f59e0b' }}>{o.oi>0?(o.volume/o.oi).toFixed(1)+'x':'new'}</td>}
                          <td style={{ padding:'8px 12px', fontSize:11, fontFamily:'var(--font-mono)', color:'var(--fg2)' }}>{o.iv!=null?`${o.iv}%`:'—'}</td>
                          {t!=='unusual' && <>
                            <td style={{ padding:'8px 12px', fontSize:11, fontFamily:'var(--font-mono)', color:'var(--fg3)' }}>${o.bid?.toFixed(2)}</td>
                            <td style={{ padding:'8px 12px', fontSize:11, fontFamily:'var(--font-mono)', color:'var(--fg3)' }}>${o.ask?.toFixed(2)}</td>
                          </>}
                          <td style={{ padding:'8px 12px', fontSize:12, fontFamily:'var(--font-mono)', color:'var(--green)' }}>${o.last?.toFixed(2)}</td>
                          {t!=='unusual' && <td style={{ padding:'8px 12px', fontSize:11, color: o.itm?'var(--green)':'var(--fg3)' }}>{o.itm?'✓':'—'}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!data && !loading && (
        <div className="card" style={{ textAlign:'center', padding:'40px 20px', color:'var(--fg3)' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:28, marginBottom:12, color:'var(--bdr)' }}>OPTIONS</div>
          <div style={{ fontSize:13, marginBottom:6 }}>Enter a ticker to see options flow</div>
          <div style={{ fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>P/C ratio · unusual activity (vol/OI &gt; 2x) · full chain</div>
        </div>
      )}
    </div>
  );
}

// ─── SHORT INTEREST DASHBOARD ─────────────────────────────────────────────────

function ShortPage() {
  const [ticker,  setTicker]  = React.useState('');
  const [data,    setData]    = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  function search() {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setLoading(true); setData(null);
    fetch(`${API_URL}/short/${t}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  const shortPct = data?.shortInterestPct ?? data?.finra?.shortPct ?? null;
  const squeeze  = shortPct != null && shortPct > 20;

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Short Interest</h1>
          <p className="page-sub">Short % of float · days to cover · FINRA daily volume · Finnhub metrics</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom:14, padding:'12px 16px' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ position:'relative', flex:1 }}>
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)', pointerEvents:'none' }}>TICKER›</span>
            <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key==='Enter' && search()} placeholder="GME"
              style={{ width:'100%', padding:'9px 12px 9px 64px', background:'var(--bg)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:14, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--fg)' }} />
          </div>
          <button onClick={search} disabled={loading}
            style={{ padding:'9px 20px', background:'var(--red)', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-mono)', opacity:loading?0.7:1 }}>
            {loading ? 'LOADING…' : 'SEARCH'}
          </button>
        </div>
      </div>

      {data && (
        <div>
          {squeeze && (
            <div className="card" style={{ marginBottom:12, borderLeft:'3px solid #f59e0b', padding:'10px 16px', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:16 }}>⚠</span>
              <span style={{ fontSize:13, color:'#f59e0b', fontWeight:700 }}>High Short Interest — Squeeze Watch</span>
              <span style={{ fontSize:12, color:'var(--fg3)' }}>{shortPct?.toFixed(1)}% of float short</span>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10, marginBottom:14 }}>
            {[
              { label:'SHORT % FLOAT', value: data.shortInterestPct != null ? `${data.shortInterestPct.toFixed(1)}%` : data.finra?.shortPct != null ? `${data.finra.shortPct}% (daily)` : '—', color: shortPct>20?'#f59e0b':shortPct>10?'#fb923c':'var(--fg)' },
              { label:'DAYS TO COVER', value: data.shortInterestRatio != null ? `${data.shortInterestRatio.toFixed(1)}d` : '—', color:'var(--fg)' },
              { label:'SHARES SHORT', value: data.shortInterest != null ? `${(data.shortInterest/1e6).toFixed(1)}M` : '—', color:'var(--fg2)' },
              { label:'FLOAT', value: data.shareFloat != null ? `${(data.shareFloat/1e6).toFixed(1)}M` : '—', color:'var(--fg3)' },
              { label:'BETA', value: data.beta != null ? data.beta.toFixed(2) : '—', color:'var(--fg2)' },
              { label:'P/E', value: data.peRatio != null ? data.peRatio.toFixed(1) : '—', color:'var(--fg2)' },
              { label:'52W HIGH', value: data.high52w != null ? `$${data.high52w.toFixed(2)}` : '—', color:'var(--green)' },
              { label:'52W LOW', value: data.low52w != null ? `$${data.low52w.toFixed(2)}` : '—', color:'var(--red-loss)' },
            ].map(s => (
              <div key={s.label} className="card">
                <div style={{ fontSize:9, color:'var(--fg3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>{s.label}</div>
                <div style={{ fontSize:20, fontWeight:800, fontFamily:'var(--font-mono)', color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Short interest bar */}
          {shortPct != null && (
            <div className="card" style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, color:'var(--fg3)', marginBottom:8, fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Short Interest Level</div>
              <div style={{ height:12, background:'var(--surf)', borderRadius:6, overflow:'hidden', marginBottom:6 }}>
                <div style={{ height:'100%', width:`${Math.min(100, shortPct * 2)}%`, borderRadius:6, transition:'width 0.5s',
                  background: shortPct>20?'#f59e0b':shortPct>10?'#fb923c':'var(--red)' }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, fontFamily:'var(--font-mono)', color:'var(--fg3)' }}>
                <span>0%</span><span style={{ color:'#fb923c' }}>10% elevated</span><span style={{ color:'#f59e0b' }}>20% squeeze watch</span><span>50%+</span>
              </div>
            </div>
          )}

          {data.finra && (
            <div className="card">
              <div style={{ fontSize:11, color:'var(--fg3)', marginBottom:8, fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.06em' }}>FINRA Daily Short Volume · {data.finra.date}</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                {[
                  { label:'Short Volume', value: (data.finra.shortVol||0).toLocaleString() },
                  { label:'Total Volume', value: (data.finra.totalVol||0).toLocaleString() },
                  { label:'Short %', value: data.finra.shortPct != null ? `${data.finra.shortPct}%` : '—' },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize:10, color:'var(--fg3)', marginBottom:2 }}>{s.label}</div>
                    <div style={{ fontSize:15, fontWeight:700, fontFamily:'var(--font-mono)' }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:8, fontSize:10, color:'var(--fg3)' }}>FINRA daily short sale volume — represents same-day short selling, not total short interest.</div>
            </div>
          )}
        </div>
      )}

      {!data && !loading && (
        <div className="card" style={{ textAlign:'center', padding:'40px 20px', color:'var(--fg3)' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:28, marginBottom:12, color:'var(--bdr)' }}>SHORT</div>
          <div style={{ fontSize:13, marginBottom:6 }}>Enter a ticker to see short interest data</div>
          <div style={{ fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>Float · days to cover · squeeze risk · FINRA daily volume</div>
        </div>
      )}
    </div>
  );
}

// ─── VALUATION WORKBENCH ──────────────────────────────────────────────────────

function ValuationPage() {
  const [ticker,        setTicker]        = React.useState('');
  const [loading,       setLoading]       = React.useState(false);
  const [inputs,        setInputs]        = React.useState({
    revenue: 1000, revenueGrowth: 15, ebitdaMargin: 20, capexPct: 5, daPct: 5,
    taxRate: 21, wacc: 10, terminalGrowth: 2.5, netDebt: 0, shares: 100,
  });
  const [dcf,           setDcf]           = React.useState(null);
  const [analystData,   setAnalystData]   = React.useState(null);
  const [currentPrice,  setCurrentPrice]  = React.useState(null);
  const [loadNote,      setLoadNote]      = React.useState('');

  function inp(k, v) { setInputs(p => ({ ...p, [k]: parseFloat(v)||0 })); }

  async function fetchFundamentals() {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setLoading(true); setLoadNote(''); setAnalystData(null); setCurrentPrice(null);
    try {
      const [fundRes, ptRes] = await Promise.all([
        fetch(`${API_URL}/stocks/fundamentals/${t}`).then(r=>r.json()).catch(()=>null),
        fetch(`${API_URL}/stocks/price-target/${t}`).then(r=>r.json()).catch(()=>null),
      ]);
      const m = fundRes?.metric || {};
      const q = fundRes?.quote  || {};
      const p = fundRes?.profile || {};
      // Auto-populate DCF inputs from Finnhub metrics
      const newInputs = { ...inputs };
      // Revenue (TTM, reported in millions)
      if (m.revenueTTM)            newInputs.revenue       = parseFloat((m.revenueTTM / 1e6).toFixed(0));
      else if (p.marketCapitalization && m['epsNormalizedAnnual'])
                                   newInputs.revenue       = inputs.revenue; // fallback: keep
      // Revenue growth — use 3yr CAGR or YoY
      if (m['revenueGrowth3Y'])    newInputs.revenueGrowth = parseFloat(m['revenueGrowth3Y'].toFixed(1));
      else if (m['revenueGrowthTTMYoy']) newInputs.revenueGrowth = parseFloat(m['revenueGrowthTTMYoy'].toFixed(1));
      // EBITDA margin
      if (m['ebitdaMarginTTM'])    newInputs.ebitdaMargin  = parseFloat(m['ebitdaMarginTTM'].toFixed(1));
      // CapEx (approx from capexTTM vs revenue)
      if (m['capitalExpenditureTTM'] && m.revenueTTM)
        newInputs.capexPct = parseFloat(Math.abs(m['capitalExpenditureTTM'] / m.revenueTTM * 100).toFixed(1));
      // Net debt
      if (m['netDebtAnnual'])      newInputs.netDebt       = parseFloat((m['netDebtAnnual'] / 1e6).toFixed(0));
      // Shares outstanding (in millions)
      if (p.shareOutstanding)      newInputs.shares        = parseFloat(p.shareOutstanding.toFixed(1));
      else if (m['totalSharesOutstanding']) newInputs.shares = parseFloat((m['totalSharesOutstanding'] / 1e6).toFixed(1));
      setInputs(newInputs);
      if (q.c) setCurrentPrice(q.c);
      if (ptRes && !ptRes.error)   setAnalystData(ptRes);
      // Build load note
      const populated = [];
      if (m.revenueTTM)            populated.push('Revenue');
      if (m['ebitdaMarginTTM'])    populated.push('EBITDA margin');
      if (m['revenueGrowth3Y'] || m['revenueGrowthTTMYoy']) populated.push('Rev growth');
      if (m['netDebtAnnual'] !== undefined) populated.push('Net debt');
      if (p.shareOutstanding)      populated.push('Shares');
      setLoadNote(populated.length > 0 ? `Auto-filled: ${populated.join(', ')}` : 'No Finnhub fundamentals found — using manual inputs');
    } catch(e) {
      setLoadNote('Error fetching fundamentals');
    }
    setLoading(false);
  }

  // DCF calculation
  React.useEffect(() => {
    const { revenue, revenueGrowth, ebitdaMargin, capexPct, daPct, taxRate, wacc, terminalGrowth, netDebt, shares } = inputs;
    const g = revenueGrowth / 100;
    const w = wacc / 100;
    const tg = terminalGrowth / 100;
    let pv = 0, rev = revenue;
    for (let yr = 1; yr <= 5; yr++) {
      rev *= (1 + g);
      const ebitda = rev * (ebitdaMargin / 100);
      const ebit   = ebitda - rev * (daPct / 100);
      const nopat  = ebit * (1 - taxRate / 100);
      const fcf    = nopat + rev * (daPct / 100) - rev * (capexPct / 100);
      pv += fcf / Math.pow(1 + w, yr);
    }
    const termFCF = rev * (ebitdaMargin / 100) * (1 - taxRate / 100) * (1 + tg);
    const tv = termFCF / (w - tg);
    const pvTV = tv / Math.pow(1 + w, 5);
    const ev = pv + pvTV;
    const equity = ev - netDebt;
    const priceTarget = shares > 0 ? equity / shares : 0;
    setDcf({ pv5yr: pv, pvTerminal: pvTV, ev, equity, priceTarget, tv });
  }, [inputs]);

  const sensRows   = [-2, -1, 0, 1, 2];
  const sensCols   = [-2, -1, 0, 1, 2];

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Valuation Workbench</h1>
          <p className="page-sub">DCF model · sensitivity analysis · live price target</p>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        {/* Left: inputs */}
        <div>
          <div className="card" style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>Auto-populate from ticker</div>
            <div style={{ display:'flex', gap:8 }}>
              <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
                onKeyDown={e => e.key==='Enter' && fetchFundamentals()}
                placeholder="NVDA" style={{ flex:1, padding:'8px 10px', background:'var(--bg)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:13, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--fg)' }} />
              <button onClick={fetchFundamentals} disabled={loading}
                style={{ padding:'8px 16px', background:'var(--red)', border:'none', borderRadius:6, fontSize:12, cursor:'pointer', color:'#fff', fontWeight:700, opacity:loading?0.7:1 }}>
                {loading ? '…' : 'LOAD'}
              </button>
            </div>
            {loadNote && (
              <div style={{ marginTop:8, fontSize:11, color: loadNote.startsWith('Auto') ? 'var(--green)' : 'var(--fg3)', fontFamily:'var(--font-mono)' }}>
                {loadNote.startsWith('Auto') ? '✓ ' : ''}{loadNote}
              </div>
            )}
            {currentPrice && (
              <div style={{ marginTop:4, fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>
                Current price: <strong style={{ color:'var(--fg)' }}>${currentPrice.toFixed(2)}</strong>
              </div>
            )}
          </div>

          <div className="card">
            <div style={{ fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>DCF Assumptions</div>
            {[
              ['revenue',      'Revenue LTM ($M)',       ''],
              ['revenueGrowth','Revenue Growth (%)',     '%'],
              ['ebitdaMargin', 'EBITDA Margin (%)',      '%'],
              ['capexPct',     'CapEx (% of Rev)',       '%'],
              ['daPct',        'D&A (% of Rev)',         '%'],
              ['taxRate',      'Tax Rate (%)',            '%'],
              ['wacc',         'WACC (%)',               '%'],
              ['terminalGrowth','Terminal Growth (%)',   '%'],
              ['netDebt',      'Net Debt ($M)',          '$M'],
              ['shares',       'Diluted Shares (M)',     'M'],
            ].map(([k, label, unit]) => (
              <div key={k} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <label style={{ flex:1, fontSize:12, color:'var(--fg2)' }}>{label}</label>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <input type="number" value={inputs[k]} onChange={e => inp(k, e.target.value)} step="0.5"
                    style={{ width:90, padding:'5px 8px', background:'var(--bg)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:12, fontFamily:'var(--font-mono)', color:'var(--fg)', textAlign:'right' }} />
                  <span style={{ fontSize:11, color:'var(--fg3)', width:20 }}>{unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: outputs */}
        <div>
          {dcf && (
            <>
              <div className="card" style={{ marginBottom:12 }}>
                <div style={{ display:'grid', gridTemplateColumns: analystData?.targetMean ? '1fr 1fr' : '1fr', gap:12, textAlign:'center' }}>
                  {/* DCF price target */}
                  <div>
                    <div style={{ fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>DCF Implied Target</div>
                    <div style={{ fontSize:40, fontWeight:900, fontFamily:'var(--font-mono)', color:'var(--green)', lineHeight:1 }}>
                      ${dcf.priceTarget > 0 ? dcf.priceTarget.toFixed(0) : '—'}
                    </div>
                    {currentPrice && dcf.priceTarget > 0 && (
                      <div style={{ fontSize:11, fontFamily:'var(--font-mono)', marginTop:4, color: dcf.priceTarget > currentPrice ? 'var(--green)' : 'var(--red-loss)', fontWeight:700 }}>
                        {((dcf.priceTarget - currentPrice)/currentPrice*100).toFixed(0)}% vs current ${currentPrice.toFixed(0)}
                      </div>
                    )}
                    <div style={{ fontSize:10, color:'var(--fg3)', marginTop:4 }}>{inputs.wacc}% WACC · {inputs.terminalGrowth}% TG</div>
                  </div>
                  {/* Analyst consensus target */}
                  {analystData?.targetMean && (
                    <div style={{ borderLeft:'1px solid var(--bdr)', paddingLeft:12 }}>
                      <div style={{ fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Analyst Consensus</div>
                      <div style={{ fontSize:40, fontWeight:900, fontFamily:'var(--font-mono)', color:'#f59e0b', lineHeight:1 }}>
                        ${analystData.targetMean.toFixed(0)}
                      </div>
                      {currentPrice && (
                        <div style={{ fontSize:11, fontFamily:'var(--font-mono)', marginTop:4, color: analystData.targetMean > currentPrice ? 'var(--green)' : 'var(--red-loss)', fontWeight:700 }}>
                          {((analystData.targetMean - currentPrice)/currentPrice*100).toFixed(0)}% upside
                        </div>
                      )}
                      <div style={{ fontSize:10, color:'var(--fg3)', marginTop:4 }}>
                        ${analystData.targetLow?.toFixed(0)} – ${analystData.targetHigh?.toFixed(0)} range
                      </div>
                    </div>
                  )}
                </div>
                {/* Analyst buy/sell/hold breakdown */}
                {analystData?.recommendation && (
                  <div style={{ marginTop:12, paddingTop:10, borderTop:'1px solid var(--bdr)' }}>
                    {(() => {
                      const r = analystData.recommendation;
                      const total = (r.strongBuy||0)+(r.buy||0)+(r.hold||0)+(r.sell||0)+(r.strongSell||0);
                      const bars = [
                        { label:'Strong Buy', count:r.strongBuy||0, color:'#22c55e' },
                        { label:'Buy',        count:r.buy||0,       color:'#86efac' },
                        { label:'Hold',       count:r.hold||0,      color:'#f59e0b' },
                        { label:'Sell',       count:r.sell||0,      color:'#f87171' },
                        { label:'Str Sell',   count:r.strongSell||0,color:'#ef4444' },
                      ];
                      return (
                        <div>
                          <div style={{ fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8 }}>
                            Analyst Ratings · {total} analysts · {analystData.lastUpdated}
                          </div>
                          <div style={{ display:'flex', gap:2, height:24, borderRadius:4, overflow:'hidden' }}>
                            {bars.filter(b=>b.count>0).map(b => (
                              <div key={b.label} title={`${b.label}: ${b.count}`} style={{ flex:b.count, background:b.color, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <span style={{ fontSize:9, color:'#fff', fontWeight:700, fontFamily:'var(--font-mono)' }}>{b.count}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ display:'flex', gap:10, marginTop:6, flexWrap:'wrap' }}>
                            {bars.filter(b=>b.count>0).map(b => (
                              <span key={b.label} style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--fg3)' }}>
                                <span style={{ color:b.color, fontWeight:700 }}>■</span> {b.label} {b.count}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="card" style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Bridge</div>
                {[
                  { label:'5-yr FCF PV',   value:`$${dcf.pv5yr.toFixed(0)}M` },
                  { label:'Terminal Value PV', value:`$${dcf.pvTerminal.toFixed(0)}M`, sub: `(${(dcf.pvTerminal/dcf.ev*100).toFixed(0)}% of EV)` },
                  { label:'Enterprise Value', value:`$${dcf.ev.toFixed(0)}M`, bold:true },
                  { label:'Less: Net Debt', value:`($${inputs.netDebt.toFixed(0)}M)` },
                  { label:'Equity Value',  value:`$${dcf.equity.toFixed(0)}M`, bold:true, color:'var(--green)' },
                ].map((r,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom: r.bold?'1px solid var(--bdr)':'none' }}>
                    <span style={{ flex:1, fontSize:12, color:'var(--fg2)', fontWeight: r.bold?700:400 }}>{r.label}</span>
                    {r.sub && <span style={{ fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>{r.sub}</span>}
                    <span style={{ fontSize:13, fontFamily:'var(--font-mono)', fontWeight: r.bold?800:600, color: r.color||'var(--fg)' }}>{r.value}</span>
                  </div>
                ))}
              </div>

              {/* Sensitivity table */}
              <div className="card">
                <div style={{ fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
                  Sensitivity: WACC (rows) vs Terminal Growth (cols) → Price Target
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'var(--font-mono)' }}>
                    <thead>
                      <tr>
                        <th style={{ padding:'4px 8px', fontSize:9, color:'var(--fg3)', textAlign:'center' }}>WACC\TG</th>
                        {sensCols.map(c => (
                          <th key={c} style={{ padding:'4px 8px', fontSize:9, color: c===0?'var(--fg)':'var(--fg3)', textAlign:'center' }}>
                            {(inputs.terminalGrowth + c * 0.5).toFixed(1)}%
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sensRows.map(r => {
                        const waccAdj = inputs.wacc + r * 0.5;
                        return (
                          <tr key={r}>
                            <td style={{ padding:'4px 8px', fontSize:9, color: r===0?'var(--fg)':'var(--fg3)', textAlign:'center', fontWeight: r===0?700:400 }}>
                              {waccAdj.toFixed(1)}%
                            </td>
                            {sensCols.map(c => {
                              const tgAdj = inputs.terminalGrowth + c * 0.5;
                              const w2 = waccAdj/100, tg2 = tgAdj/100;
                              if (w2 <= tg2) return <td key={c} style={{ padding:'4px 8px', fontSize:10, textAlign:'center', color:'var(--fg3)' }}>—</td>;
                              let pv2=0, rev2=inputs.revenue;
                              const g2=inputs.revenueGrowth/100;
                              for(let yr=1;yr<=5;yr++){rev2*=(1+g2);const fcf=(rev2*(inputs.ebitdaMargin/100))*(1-inputs.taxRate/100)+rev2*(inputs.daPct/100)-rev2*(inputs.capexPct/100);pv2+=fcf/Math.pow(1+w2,yr);}
                              const tv2=rev2*(inputs.ebitdaMargin/100)*(1-inputs.taxRate/100)*(1+tg2)/(w2-tg2);
                              const pt2=(pv2+tv2/Math.pow(1+w2,5)-inputs.netDebt)/(inputs.shares||1);
                              const isBase = r===0 && c===0;
                              return (
                                <td key={c} style={{ padding:'4px 8px', fontSize:10, textAlign:'center', fontWeight: isBase?800:400,
                                  background: isBase?'rgba(239,68,68,0.15)':'transparent',
                                  color: pt2>dcf.priceTarget*1.1?'var(--green)':pt2<dcf.priceTarget*0.9?'var(--red-loss)':'var(--fg)' }}>
                                  ${pt2.toFixed(0)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── LP RELATIONS TRACKER ─────────────────────────────────────────────────────

function LPPage() {
  const [lps,      setLps]      = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [showForm, setShowForm] = React.useState(false);
  const [showTx,   setShowTx]   = React.useState(null); // 'call' | 'dist'
  const [form,     setForm]     = React.useState({ name:'', type:'family_office', fund:'', commitment:0, vintage:new Date().getFullYear(), contact:'', email:'', notes:'' });
  const [txForm,   setTxForm]   = React.useState({ date: new Date().toISOString().slice(0,10), amount:0, notes:'' });
  const [saving,   setSaving]   = React.useState(false);

  function load() {
    fetch(`${API_URL}/lps`).then(r => r.json()).then(d => setLps(Array.isArray(d)?d:[])).catch(() => {});
  }
  React.useEffect(load, []);

  async function saveLP(e) {
    e.preventDefault(); setSaving(true);
    await fetch(`${API_URL}/lps`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) }).catch(() => {});
    setSaving(false); setShowForm(false); load();
  }

  async function saveTx(e) {
    e.preventDefault(); setSaving(true);
    const endpoint = showTx === 'call' ? 'capitalcall' : 'distribution';
    await fetch(`${API_URL}/lps/${selected._id}/${endpoint}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(txForm) }).catch(() => {});
    setSaving(false); setShowTx(null); load();
    const updated = await fetch(`${API_URL}/lps`).then(r=>r.json()).catch(()=>[]);
    const upd = updated.find(l => l._id === selected._id);
    if (upd) setSelected(upd);
  }

  async function deleteLp(id) {
    if (!confirm('Delete this LP?')) return;
    await fetch(`${API_URL}/lps/${id}`, { method:'DELETE' }).catch(() => {});
    setSelected(null); load();
  }

  const totalCommitment = lps.reduce((s, l) => s + (l.commitment||0), 0);
  const totalCalled     = lps.reduce((s, l) => s + (l.called||0), 0);
  const totalDistrib    = lps.reduce((s, l) => s + (l.distributed||0), 0);
  const TYPE_BADGE = { pension:'#3b82f6', endowment:'#8b5cf6', family_office:'#10b981', fof:'#06b6d4', sovereign_wealth:'#f59e0b', insurance:'#64748b', corporate:'#f97316', hnwi:'#ec4899', other:'#6b7280' };

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">LP Relations</h1>
          <p className="page-sub">Capital accounts · calls · distributions · IRR / MOIC</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ padding:'8px 16px', background:'var(--red)', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
          + Add LP
        </button>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
        {[
          { label:'TOTAL COMMITMENT', value:`$${(totalCommitment/1000).toFixed(1)}M` },
          { label:'TOTAL CALLED',     value:`$${(totalCalled/1000).toFixed(1)}M`, sub:`${totalCommitment>0?(totalCalled/totalCommitment*100).toFixed(0):0}%` },
          { label:'TOTAL DISTRIBUTED',value:`$${(totalDistrib/1000).toFixed(1)}M`, color:'var(--green)' },
        ].map(s => (
          <div key={s.label} className="card">
            <div style={{ fontSize:9, color:'var(--fg3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:800, fontFamily:'var(--font-mono)', color:s.color||'var(--fg)' }}>{s.value}</div>
            {s.sub && <div style={{ fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>{s.sub} called</div>}
          </div>
        ))}
      </div>

      {/* LP list */}
      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap:14 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {lps.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:30, color:'var(--fg3)' }}>No LPs yet — add your first limited partner</div>
          ) : lps.map(lp => {
            const moic = lp.called > 0 ? ((lp.distributed + lp.nav) / lp.called) : null;
            return (
              <div key={lp._id} className="card" style={{ cursor:'pointer', borderColor: selected?._id===lp._id?'var(--red)':'var(--bdr)' }}
                onClick={() => setSelected(lp)}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <span style={{ fontWeight:700, fontSize:14 }}>{lp.name}</span>
                      <span style={{ fontSize:9, fontFamily:'var(--font-mono)', padding:'1px 6px', borderRadius:3, background:`${TYPE_BADGE[lp.type]||'#6b7280'}22`, color:TYPE_BADGE[lp.type]||'var(--fg3)', fontWeight:700 }}>
                        {(lp.type||'').replace('_',' ').toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>
                      {lp.fund || 'No fund'} · Vintage {lp.vintage || '—'}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:13, fontWeight:700, fontFamily:'var(--font-mono)' }}>${((lp.commitment||0)/1000).toFixed(1)}M</div>
                    <div style={{ fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>
                      {moic != null ? `${moic.toFixed(2)}x MOIC` : 'N/A'}
                      {lp.irr != null ? ` · ${lp.irr.toFixed(1)}% IRR` : ''}
                    </div>
                  </div>
                </div>
                {/* Called / distributed bar */}
                {lp.commitment > 0 && (
                  <div style={{ marginTop:8 }}>
                    <div style={{ height:4, background:'var(--surf)', borderRadius:2, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${Math.min(100, lp.called/lp.commitment*100)}%`, background:'var(--red)', borderRadius:2 }} />
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:3, fontSize:9, fontFamily:'var(--font-mono)', color:'var(--fg3)' }}>
                      <span>Called ${((lp.called||0)/1000).toFixed(1)}M</span>
                      <span>Distributed ${((lp.distributed||0)/1000).toFixed(1)}M</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="card">
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
              <h3 style={{ margin:0, fontSize:15, flex:1 }}>{selected.name}</h3>
              <button onClick={() => { setShowTx('call'); setTxForm({ date: new Date().toISOString().slice(0,10), amount:0, notes:'' }); }}
                style={{ padding:'5px 10px', background:'var(--red)', color:'#fff', border:'none', borderRadius:6, fontSize:11, cursor:'pointer', fontWeight:600 }}>+ Call</button>
              <button onClick={() => { setShowTx('dist'); setTxForm({ date: new Date().toISOString().slice(0,10), amount:0, notes:'' }); }}
                style={{ padding:'5px 10px', background:'rgba(34,197,94,0.15)', color:'var(--green)', border:'1px solid var(--green)', borderRadius:6, fontSize:11, cursor:'pointer', fontWeight:600 }}>+ Dist</button>
              <button onClick={() => deleteLp(selected._id)}
                style={{ padding:'5px 8px', background:'none', border:'1px solid var(--bdr)', borderRadius:6, fontSize:11, cursor:'pointer', color:'var(--fg3)' }}>Delete</button>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--fg3)' }}>×</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
              {[
                ['Commitment', `$${((selected.commitment||0)/1000).toFixed(1)}M`],
                ['Called',     `$${((selected.called||0)/1000).toFixed(1)}M`],
                ['Distributed',`$${((selected.distributed||0)/1000).toFixed(1)}M`],
                ['NAV',        `$${((selected.nav||0)/1000).toFixed(1)}M`],
                ['IRR',        selected.irr != null ? `${selected.irr.toFixed(1)}%` : '—'],
                ['MOIC',       selected.called > 0 ? `${((selected.distributed+selected.nav)/selected.called).toFixed(2)}x` : '—'],
              ].map(([k,v]) => (
                <div key={k}>
                  <div style={{ fontSize:10, color:'var(--fg3)', marginBottom:2 }}>{k}</div>
                  <div style={{ fontSize:15, fontWeight:700, fontFamily:'var(--font-mono)' }}>{v}</div>
                </div>
              ))}
            </div>
            {selected.contact && <div style={{ fontSize:12, color:'var(--fg2)', marginBottom:4 }}>Contact: {selected.contact}</div>}
            {selected.email && <div style={{ fontSize:12, color:'var(--fg2)', marginBottom:8 }}><a href={`mailto:${selected.email}`} style={{ color:'var(--red)' }}>{selected.email}</a></div>}
            {selected.notes && <div style={{ fontSize:12, color:'var(--fg3)', lineHeight:1.5 }}>{selected.notes}</div>}

            {/* Capital call history */}
            {selected.capitalCalls?.length > 0 && (
              <div style={{ marginTop:14 }}>
                <div style={{ fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', marginBottom:6 }}>Capital Calls</div>
                {selected.capitalCalls.slice(-5).reverse().map((c, i) => (
                  <div key={i} style={{ display:'flex', gap:8, fontSize:12, padding:'4px 0', borderBottom:'1px solid var(--bdr)' }}>
                    <span style={{ color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>{c.date?.slice?.(0,10)||'—'}</span>
                    <span style={{ flex:1 }}>{c.notes||'Capital call'}</span>
                    <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--red-loss)' }}>${((c.amount||0)/1000).toFixed(2)}M</span>
                  </div>
                ))}
              </div>
            )}
            {selected.distributions?.length > 0 && (
              <div style={{ marginTop:14 }}>
                <div style={{ fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', marginBottom:6 }}>Distributions</div>
                {selected.distributions.slice(-5).reverse().map((d, i) => (
                  <div key={i} style={{ display:'flex', gap:8, fontSize:12, padding:'4px 0', borderBottom:'1px solid var(--bdr)' }}>
                    <span style={{ color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>{d.date?.slice?.(0,10)||'—'}</span>
                    <span style={{ flex:1 }}>{d.notes||'Distribution'}</span>
                    <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--green)' }}>${((d.amount||0)/1000).toFixed(2)}M</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add LP modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={() => setShowForm(false)}>
          <form onSubmit={saveLP} onClick={e => e.stopPropagation()}
            style={{ background:'var(--bg)', borderRadius:16, padding:24, width:'100%', maxWidth:440, display:'flex', flexDirection:'column', gap:10 }}>
            <h2 style={{ margin:0, fontSize:16, fontWeight:800 }}>Add Limited Partner</h2>
            {[['name','Name','Acme Pension Fund'],['fund','Fund','Fund III'],['contact','Contact Name',''],['email','Email','']].map(([k,l,ph]) => (
              <div key={k}>
                <label style={{ fontSize:11, color:'var(--fg3)', display:'block', marginBottom:3 }}>{l}</label>
                <input value={form[k]} onChange={e => setForm(f=>({...f,[k]:e.target.value}))} placeholder={ph} required={k==='name'}
                  style={{ width:'100%', padding:'8px 10px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:13, color:'var(--fg)', boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {[['commitment','Commitment ($k)'],['vintage','Vintage Year']].map(([k,l]) => (
                <div key={k}>
                  <label style={{ fontSize:11, color:'var(--fg3)', display:'block', marginBottom:3 }}>{l}</label>
                  <input type="number" value={form[k]} onChange={e => setForm(f=>({...f,[k]:e.target.value}))}
                    style={{ width:'100%', padding:'8px 10px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:12, color:'var(--fg)', boxSizing:'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize:11, color:'var(--fg3)', display:'block', marginBottom:3 }}>Type</label>
                <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}
                  style={{ width:'100%', padding:'8px 10px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:11, color:'var(--fg)' }}>
                  {['pension','endowment','family_office','fof','sovereign_wealth','insurance','corporate','hnwi','other'].map(t => (
                    <option key={t} value={t}>{t.replace('_',' ')}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:6 }}>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ flex:1, padding:'10px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:8, fontSize:13, cursor:'pointer', color:'var(--fg)' }}>Cancel</button>
              <button type="submit" disabled={saving}
                style={{ flex:1, padding:'10px', background:'var(--red)', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                {saving ? 'Saving…' : 'Add LP'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Capital call / distribution modal */}
      {showTx && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={() => setShowTx(null)}>
          <form onSubmit={saveTx} onClick={e => e.stopPropagation()}
            style={{ background:'var(--bg)', borderRadius:16, padding:24, width:'100%', maxWidth:360, display:'flex', flexDirection:'column', gap:10 }}>
            <h2 style={{ margin:0, fontSize:15, fontWeight:800 }}>{showTx==='call' ? 'Capital Call' : 'Distribution'} — {selected?.name}</h2>
            <div>
              <label style={{ fontSize:11, color:'var(--fg3)', display:'block', marginBottom:3 }}>Date</label>
              <input type="date" value={txForm.date} onChange={e => setTxForm(f=>({...f,date:e.target.value}))} required
                style={{ width:'100%', padding:'8px 10px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:13, color:'var(--fg)', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--fg3)', display:'block', marginBottom:3 }}>Amount ($k)</label>
              <input type="number" value={txForm.amount} onChange={e => setTxForm(f=>({...f,amount:parseFloat(e.target.value)||0}))} required
                style={{ width:'100%', padding:'8px 10px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:13, color:'var(--fg)', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--fg3)', display:'block', marginBottom:3 }}>Notes</label>
              <input value={txForm.notes} onChange={e => setTxForm(f=>({...f,notes:e.target.value}))}
                style={{ width:'100%', padding:'8px 10px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:13, color:'var(--fg)', boxSizing:'border-box' }} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button type="button" onClick={() => setShowTx(null)}
                style={{ flex:1, padding:'10px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:8, fontSize:13, cursor:'pointer', color:'var(--fg)' }}>Cancel</button>
              <button type="submit" disabled={saving}
                style={{ flex:1, padding:'10px', background: showTx==='call'?'var(--red)':'var(--green)', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                {saving ? 'Saving…' : 'Log'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── DUE DILIGENCE WORKSPACE ──────────────────────────────────────────────────

function DiligencePage() {
  const [dds,      setDds]      = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [showNew,  setShowNew]  = React.useState(false);
  const [form,     setForm]     = React.useState({ dealName:'', ticker:'', lead:'', notes:'' });
  const [aiSum,    setAiSum]    = React.useState('');
  const [aiLoad,   setAiLoad]   = React.useState(false);
  const [saving,   setSaving]   = React.useState(false);
  const [expandedSection, setExpandedSection] = React.useState(null);

  function load() {
    fetch(`${API_URL}/diligence`).then(r=>r.json()).then(d=>setDds(Array.isArray(d)?d:[])).catch(()=>{});
  }
  React.useEffect(load, []);

  async function createDD(e) {
    e.preventDefault(); setSaving(true);
    const dd = await fetch(`${API_URL}/diligence`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) }).then(r=>r.json()).catch(()=>null);
    setSaving(false); setShowNew(false);
    if (dd?._id) { setSelected(dd); load(); }
  }

  async function toggleItem(sectionTitle, itemId, checked) {
    if (!selected) return;
    const updated = await fetch(`${API_URL}/diligence/${selected._id}/item`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ sectionTitle, itemId, checked }),
    }).then(r=>r.json()).catch(()=>null);
    if (updated?._id) { setSelected(updated); load(); }
  }

  async function runAISummary() {
    setAiLoad(true);
    const d = await fetch(`${API_URL}/diligence/${selected._id}/ai-summary`, { method:'POST' }).then(r=>r.json()).catch(()=>({}));
    setAiSum(d.summary || ''); setAiLoad(false);
    if (d.summary) { const u = await fetch(`${API_URL}/diligence`).then(r=>r.json()).catch(()=>[]); setDds(u); }
  }

  async function deleteDD(id) {
    if (!confirm('Delete this DD workspace?')) return;
    await fetch(`${API_URL}/diligence/${id}`, { method:'DELETE' }).catch(()=>{});
    setSelected(null); load();
  }

  const PRIORITY_COLOR = { critical:'#ef4444', high:'#f59e0b', medium:'#3b82f6', low:'var(--fg3)' };
  const STATUS_COLOR   = { active:'var(--green)', paused:'#f59e0b', approved:'#3b82f6', passed:'var(--fg3)', completed:'var(--green)' };

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Due Diligence</h1>
          <p className="page-sub">Structured DD checklists · AI summary · deal workspace</p>
        </div>
        <button onClick={() => setShowNew(true)}
          style={{ padding:'8px 16px', background:'var(--red)', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>
          + New DD
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selected ? '280px 1fr' : '1fr', gap:14 }}>
        {/* List */}
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {dds.length === 0 ? (
            <div className="card" style={{ textAlign:'center', padding:30, color:'var(--fg3)' }}>
              <div style={{ fontSize:24, marginBottom:8 }}>📋</div>
              <div>No DD workspaces yet</div>
            </div>
          ) : dds.map(dd => (
            <div key={dd._id} className="card" style={{ cursor:'pointer', padding:'10px 14px', borderColor: selected?._id===dd._id?'var(--red)':'var(--bdr)' }}
              onClick={() => { setSelected(dd); setAiSum(dd.aiSummary||''); setExpandedSection(null); }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                <span style={{ fontWeight:700, fontSize:13, flex:1 }}>{dd.dealName}</span>
                {dd.ticker && <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--red)', fontWeight:800 }}>{dd.ticker}</span>}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ flex:1, height:4, background:'var(--surf)', borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${dd.score||0}%`, background: dd.score>70?'var(--green)':dd.score>40?'#f59e0b':'var(--red)', borderRadius:2 }} />
                </div>
                <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--fg3)', minWidth:32 }}>{dd.score||0}%</span>
              </div>
              <div style={{ fontSize:10, color:'var(--fg3)', marginTop:4 }}>
                {dd.lead && `Lead: ${dd.lead} · `}
                <span style={{ color: STATUS_COLOR[dd.status]||'var(--fg3)' }}>{dd.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Checklist detail */}
        {selected && (
          <div>
            {/* Header */}
            <div className="card" style={{ marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <h3 style={{ margin:0, fontSize:15, flex:1 }}>{selected.dealName}{selected.ticker ? ` — ${selected.ticker}` : ''}</h3>
                <button onClick={runAISummary} disabled={aiLoad}
                  style={{ padding:'5px 12px', background:'var(--red)', color:'#fff', border:'none', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                  {aiLoad ? '✦ Analyzing…' : '✦ AI Summary'}
                </button>
                <button onClick={() => deleteDD(selected._id)}
                  style={{ padding:'5px 8px', background:'none', border:'1px solid var(--bdr)', borderRadius:6, fontSize:11, cursor:'pointer', color:'var(--fg3)' }}>Delete</button>
                <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--fg3)' }}>×</button>
              </div>
              {/* Progress bar */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: aiSum?8:0 }}>
                <div style={{ flex:1, height:6, background:'var(--surf)', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${selected.score||0}%`, background: selected.score>70?'var(--green)':selected.score>40?'#f59e0b':'var(--red)', borderRadius:3, transition:'width 0.3s' }} />
                </div>
                <span style={{ fontSize:12, fontFamily:'var(--font-mono)', fontWeight:700, minWidth:35 }}>{selected.score||0}%</span>
              </div>
              {aiSum && (
                <div style={{ padding:'10px 12px', background:'var(--surf)', borderRadius:8, fontSize:12, color:'var(--fg2)', lineHeight:1.6, borderLeft:'2px solid var(--red)' }}>
                  <strong style={{ color:'var(--red)', fontSize:10, fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.06em' }}>✦ AI Assessment · </strong>
                  {aiSum}
                </div>
              )}
            </div>

            {/* Sections */}
            {(selected.sections||[]).map((section, si) => {
              const done    = section.items.filter(i => i.checked).length;
              const flagged = section.items.filter(i => i.flagged).length;
              const isOpen  = expandedSection === section.title || expandedSection === null;
              return (
                <div key={si} className="card" style={{ marginBottom:8, padding:0, overflow:'hidden' }}>
                  <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:8, cursor:'pointer', background:'var(--surf)' }}
                    onClick={() => setExpandedSection(isOpen && expandedSection===section.title ? null : section.title)}>
                    <span style={{ fontWeight:700, fontSize:13, flex:1 }}>{section.title}</span>
                    {flagged > 0 && <span style={{ fontSize:10, color:'#ef4444', fontFamily:'var(--font-mono)' }}>⚑ {flagged}</span>}
                    <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--fg3)' }}>{done}/{section.items.length}</span>
                    <div style={{ width:50, height:4, background:'var(--bdr)', borderRadius:2, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${section.items.length>0?done/section.items.length*100:0}%`, background: done===section.items.length?'var(--green)':'var(--red)', borderRadius:2 }} />
                    </div>
                    <span style={{ color:'var(--fg3)', fontSize:11 }}>{isOpen && expandedSection===section.title ? '▲' : '▼'}</span>
                  </div>
                  {(isOpen || expandedSection === null) && (
                    <div style={{ padding:'8px 0' }}>
                      {section.items.map((item, ii) => (
                        <div key={ii} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'7px 14px',
                          background: item.flagged ? 'rgba(239,68,68,0.04)' : 'transparent',
                          borderBottom: ii<section.items.length-1?'1px solid var(--bdr)':'none' }}>
                          <input type="checkbox" checked={item.checked} onChange={e => toggleItem(section.title, item.id, e.target.checked)}
                            style={{ marginTop:2, accentColor:'var(--red)', cursor:'pointer' }} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12, color: item.checked?'var(--fg3)':'var(--fg)', textDecoration: item.checked?'line-through':'none' }}>{item.label}</div>
                            {item.notes && <div style={{ fontSize:11, color:'var(--fg3)', marginTop:2 }}>{item.notes}</div>}
                          </div>
                          <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, fontFamily:'var(--font-mono)', fontWeight:700,
                            background:`${PRIORITY_COLOR[item.priority]||'var(--fg3)'}22`,
                            color: PRIORITY_COLOR[item.priority]||'var(--fg3)' }}>
                            {item.priority}
                          </span>
                          {item.flagged && <span style={{ color:'#ef4444', fontSize:12 }}>⚑</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New DD modal */}
      {showNew && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={() => setShowNew(false)}>
          <form onSubmit={createDD} onClick={e => e.stopPropagation()}
            style={{ background:'var(--bg)', borderRadius:16, padding:24, width:'100%', maxWidth:400, display:'flex', flexDirection:'column', gap:10 }}>
            <h2 style={{ margin:0, fontSize:16, fontWeight:800 }}>New DD Workspace</h2>
            {[['dealName','Deal Name','Acme Corp','required'],['ticker','Ticker (optional)','ACME',''],['lead','Lead Analyst','','']].map(([k,l,ph,req]) => (
              <div key={k}>
                <label style={{ fontSize:11, color:'var(--fg3)', display:'block', marginBottom:3 }}>{l}</label>
                <input value={form[k]} onChange={e => setForm(f=>({...f,[k]:e.target.value}))} placeholder={ph} required={req==='required'}
                  style={{ width:'100%', padding:'8px 10px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:13, color:'var(--fg)', boxSizing:'border-box' }} />
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:6 }}>
              <button type="button" onClick={() => setShowNew(false)}
                style={{ flex:1, padding:'10px', background:'var(--surf)', border:'1px solid var(--bdr)', borderRadius:8, fontSize:13, cursor:'pointer', color:'var(--fg)' }}>Cancel</button>
              <button type="submit" disabled={saving}
                style={{ flex:1, padding:'10px', background:'var(--red)', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                {saving ? 'Creating…' : 'Create Workspace'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── CONVICTION SCORE DASHBOARD ───────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// OPPORTUNITY BOARD — ranked screener across all watchlist tickers
// ─────────────────────────────────────────────────────────────────────────────
function OpportunityBoard() {
  const [scores,     setScores]     = React.useState([]);
  const [loading,    setLoading]    = React.useState(true);
  const [running,    setRunning]    = React.useState(false);
  const [runStatus,  setRunStatus]  = React.useState('');
  const [lastRunAt,  setLastRunAt]  = React.useState(null);
  const [filter,     setFilter]     = React.useState('all');   // all|long|short|options|macro|neutral
  const [minScore,   setMinScore]   = React.useState(0);
  const [selected,   setSelected]   = React.useState(null);
  const [runProgress,setRunProgress]= React.useState(null);    // { done, total }

  React.useEffect(() => { loadScores(); }, []);

  async function loadScores() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/scores`).then(r => r.json());
      setScores(Array.isArray(res.scores) ? res.scores : []);
      if (res.lastRunAt) setLastRunAt(new Date(res.lastRunAt));
      setRunning(res.running || false);
    } catch (_) {}
    setLoading(false);
  }

  async function triggerRun() {
    setRunning(true);
    setRunStatus('Connecting…');
    setRunProgress({ done: 0, total: '?' });

    // Use fetch + SSE manual streaming (EventSource doesn't support POST)
    try {
      const resp = await fetch(`${API_URL}/scores/run`, { method: 'POST' });
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === 'progress') {
              setRunProgress({ done: ev.done, total: ev.total });
              setRunStatus(`Scoring ${ev.symbol}… (${ev.done}/${ev.total})`);
            } else if (ev.type === 'complete') {
              setRunStatus(`Done — ${ev.scored} scored`);
              setLastRunAt(new Date(ev.lastRunAt));
            } else if (ev.type === 'error') {
              setRunStatus(`Error: ${ev.message}`);
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      setRunStatus(`Error: ${e.message}`);
    }

    setRunning(false);
    setRunProgress(null);
    await loadScores();
  }

  const STRATEGY_COLORS = {
    long:    { bg: '#0a84ff22', text: '#0A84FF' },
    short:   { bg: '#ff3b3022', text: '#FF3B30' },
    options: { bg: '#ffd60a22', text: '#9a7f00' },
    macro:   { bg: '#30d15822', text: '#1a8a40' },
    neutral: { bg: 'var(--bg)', text: 'var(--fg3)' },
  };

  const SCORE_COLOR = (s) => s >= 70 ? 'var(--green)' : s >= 45 ? '#f59e0b' : 'var(--red-loss)';

  const filtered = scores
    .filter(s => filter === 'all' || s.strategy === filter)
    .filter(s => s.score >= minScore);

  const signalDotColor = (direction) =>
    direction === 'bullish' ? '#30D158' : direction === 'bearish' ? '#FF3B30' : '#6b7280';

  const fmtPrice = (p) => p == null ? '—' : p >= 1000 ? `$${(p/1000).toFixed(1)}k` : `$${p.toFixed(2)}`;
  const fmtChg   = (c) => c == null ? '' : `${c > 0 ? '+' : ''}${c.toFixed(2)}%`;

  const strategyTabs = [
    { key: 'all',     label: 'All' },
    { key: 'long',    label: 'Long' },
    { key: 'short',   label: 'Short' },
    { key: 'options', label: 'Options' },
    { key: 'macro',   label: 'Macro' },
    { key: 'neutral', label: 'Neutral' },
  ];

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Opportunity Board</h1>
          <p className="page-sub">All watchlist tickers scored · ranked by conviction · filter by strategy</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {lastRunAt && (
            <span style={{ fontSize:11, color:'var(--fg3)' }}>
              Last run {lastRunAt.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
            </span>
          )}
          <button onClick={triggerRun} disabled={running}
            style={{ padding:'8px 18px', background:'var(--red)', color:'#fff', border:'none', borderRadius:6,
              fontSize:12, fontWeight:700, cursor:running?'not-allowed':'pointer', fontFamily:'var(--font-mono)',
              letterSpacing:'0.06em', opacity:running?0.7:1 }}>
            {running ? '⏳ RUNNING…' : '▶ RUN SCORES'}
          </button>
        </div>
      </div>

      {/* Run progress bar */}
      {running && runProgress && (
        <div className="card" style={{ marginBottom:10, padding:'10px 14px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontSize:11, color:'var(--fg2)' }}>{runStatus}</span>
            <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--fg3)' }}>
              {runProgress.done}/{runProgress.total}
            </span>
          </div>
          <div style={{ height:3, background:'var(--bg)', borderRadius:2, overflow:'hidden' }}>
            <div style={{ height:'100%', background:'var(--red)', borderRadius:2, transition:'width 0.3s',
              width: runProgress.total && runProgress.total !== '?' ? `${(runProgress.done/runProgress.total)*100}%` : '40%' }} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom:10, padding:'10px 14px', display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
        <span style={{ fontSize:11, color:'var(--fg3)', marginRight:4 }}>Strategy:</span>
        {strategyTabs.map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            style={{ padding:'4px 10px', borderRadius:20, fontSize:11, cursor:'pointer', fontWeight:500,
              border: filter===tab.key ? '1.5px solid var(--red)' : '1px solid var(--bdr)',
              background: filter===tab.key ? '#ff3b3018' : 'transparent',
              color: filter===tab.key ? 'var(--red)' : 'var(--fg2)' }}>
            {tab.label}
            {tab.key !== 'all' && (
              <span style={{ marginLeft:4, fontSize:10, opacity:0.7 }}>
                {scores.filter(s => s.strategy === tab.key).length}
              </span>
            )}
          </button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:11, color:'var(--fg3)' }}>Min score:</span>
          <input type="range" min={0} max={80} step={5} value={minScore}
            onChange={e => setMinScore(+e.target.value)}
            style={{ width:80, accentColor:'var(--red)' }} />
          <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:'var(--fg2)', minWidth:24 }}>{minScore}</span>
        </div>
        <button onClick={loadScores} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--bdr)', background:'transparent', color:'var(--fg3)', fontSize:11, cursor:'pointer' }}>↺ Refresh</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 340px' : '1fr', gap:10 }}>
        {/* Main board */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {/* Table header */}
          <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 90px 70px 80px 68px',
            padding:'8px 14px', borderBottom:'1px solid var(--bdr)', background:'var(--bg)' }}>
            {['Ticker','Score','Strategy','Signals','Price','Change'].map(h => (
              <span key={h} style={{ fontSize:10, fontWeight:700, color:'var(--fg3)', letterSpacing:'0.06em', textTransform:'uppercase' }}>{h}</span>
            ))}
          </div>

          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:'var(--fg3)', fontSize:13 }}>Loading scores…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding:40, textAlign:'center' }}>
              <div style={{ fontSize:13, color:'var(--fg3)', marginBottom:8 }}>
                {scores.length === 0 ? 'No scores yet — click RUN SCORES to analyze your watchlist' : 'No tickers match current filters'}
              </div>
              {scores.length === 0 && (
                <button onClick={triggerRun} disabled={running}
                  style={{ padding:'8px 20px', background:'var(--red)', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  ▶ Run Now
                </button>
              )}
            </div>
          ) : (
            filtered.map(s => {
              const sc = STRATEGY_COLORS[s.strategy] || STRATEGY_COLORS.neutral;
              const isSelected = selected?.symbol === s.symbol;
              const activeSignals = (s.signals || []).filter(sig => !sig.noData);
              return (
                <div key={s.symbol} onClick={() => setSelected(isSelected ? null : s)}
                  style={{ display:'grid', gridTemplateColumns:'90px 1fr 90px 70px 80px 68px',
                    padding:'9px 14px', borderBottom:'1px solid var(--bdr)',
                    cursor:'pointer', background: isSelected ? '#ff3b3010' : 'transparent',
                    transition:'background 0.1s' }}>
                  {/* Ticker */}
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, color:'var(--fg)', display:'flex', alignItems:'center' }}>
                    {s.symbol}
                  </div>
                  {/* Score bar */}
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ flex:1, height:4, background:'var(--bdr)', borderRadius:2, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${s.score}%`, background:SCORE_COLOR(s.score), borderRadius:2, transition:'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize:12, fontWeight:700, fontFamily:'var(--font-mono)', color:SCORE_COLOR(s.score), minWidth:26, textAlign:'right' }}>
                      {s.score}
                    </span>
                  </div>
                  {/* Strategy badge */}
                  <div>
                    <span style={{ fontSize:10, padding:'2px 7px', borderRadius:10, background:sc.bg, color:sc.text, fontWeight:600, textTransform:'capitalize' }}>
                      {s.strategy}
                    </span>
                  </div>
                  {/* Signal dots */}
                  <div style={{ display:'flex', gap:3, alignItems:'center', flexWrap:'wrap' }}>
                    {activeSignals.slice(0,6).map((sig,i) => (
                      <span key={i} title={sig.label}
                        style={{ width:7, height:7, borderRadius:'50%', background:signalDotColor(sig.direction), display:'inline-block', flexShrink:0 }} />
                    ))}
                    {activeSignals.length > 6 && <span style={{ fontSize:9, color:'var(--fg3)' }}>+{activeSignals.length-6}</span>}
                  </div>
                  {/* Price */}
                  <div style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'var(--fg2)' }}>
                    {fmtPrice(s.currentPrice)}
                  </div>
                  {/* Change */}
                  <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color: s.changePercent>0?'var(--green)':s.changePercent<0?'var(--red-loss)':'var(--fg3)', textAlign:'right' }}>
                    {fmtChg(s.changePercent)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="card" style={{ padding:0, overflow:'hidden', alignSelf:'flex-start', position:'sticky', top:0 }}>
            {/* Panel header */}
            <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--bdr)', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:18, fontWeight:800, fontFamily:'var(--font-mono)', color:'var(--fg)' }}>{selected.symbol}</div>
                <div style={{ fontSize:11, color:'var(--fg3)', marginTop:1 }}>{selected.name}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:28, fontWeight:900, fontFamily:'var(--font-mono)', color:SCORE_COLOR(selected.score), lineHeight:1 }}>{selected.score}</div>
                <div style={{ fontSize:10, color:'var(--fg3)', marginTop:1 }}>{selected.rating}</div>
              </div>
            </div>

            {/* Price + strategy row */}
            <div style={{ padding:'8px 14px', borderBottom:'1px solid var(--bdr)', display:'flex', gap:12, alignItems:'center' }}>
              <span style={{ fontSize:14, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--fg)' }}>{fmtPrice(selected.currentPrice)}</span>
              {selected.changePercent != null && (
                <span style={{ fontSize:12, fontFamily:'var(--font-mono)', color:selected.changePercent>0?'var(--green)':'var(--red-loss)' }}>
                  {fmtChg(selected.changePercent)}
                </span>
              )}
              <span style={{ marginLeft:'auto', fontSize:10, padding:'3px 8px', borderRadius:10,
                background: (STRATEGY_COLORS[selected.strategy]||STRATEGY_COLORS.neutral).bg,
                color: (STRATEGY_COLORS[selected.strategy]||STRATEGY_COLORS.neutral).text,
                fontWeight:600, textTransform:'capitalize' }}>
                {selected.strategy}
              </span>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'var(--fg3)', cursor:'pointer', fontSize:14 }}>✕</button>
            </div>

            {/* Score bar */}
            <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--bdr)' }}>
              <div style={{ height:6, background:'var(--bg)', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${selected.score}%`, background:SCORE_COLOR(selected.score), borderRadius:3, transition:'width 0.4s' }} />
              </div>
            </div>

            {/* Signals breakdown */}
            <div style={{ padding:'8px 0', maxHeight:420, overflowY:'auto' }}>
              {(selected.signals || []).map((sig, i) => (
                <div key={i} style={{ padding:'8px 14px', borderBottom:'1px solid var(--bdr)', opacity:sig.noData?0.45:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:'var(--fg2)' }}>{sig.label}</span>
                    <span style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700,
                      color: sig.noData?'var(--fg3)':sig.delta>0?'var(--green)':sig.delta<0?'var(--red-loss)':'#f59e0b' }}>
                      {sig.noData ? 'N/A' : `${sig.delta>0?'+':''}${sig.delta}pts`}
                    </span>
                  </div>
                  <div style={{ fontSize:10, color:'var(--fg3)' }}>{sig.value}</div>
                  {!sig.noData && (
                    <div style={{ marginTop:4, height:2, background:'var(--bdr)', borderRadius:1 }}>
                      <div style={{ height:'100%', width:`${Math.min(100,Math.abs(sig.delta)/15*100)}%`,
                        background: sig.delta>0?'var(--green)':sig.delta<0?'var(--red-loss)':'#f59e0b',
                        borderRadius:1 }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Link to full conviction */}
            <div style={{ padding:'10px 14px', borderTop:'1px solid var(--bdr)' }}>
              <button onClick={() => {
                  window.__toriiNav && window.__toriiNav('conviction');
                  setTimeout(() => {
                    window.__toriiSetConviction && window.__toriiSetConviction(selected.symbol);
                  }, 100);
                }}
                style={{ width:'100%', padding:'8px', background:'var(--bg)', border:'1px solid var(--bdr)', borderRadius:6,
                  color:'var(--fg2)', fontSize:12, cursor:'pointer', fontWeight:600 }}>
                Open Full Analysis →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConvictionPage() {
  const [ticker,     setTicker]     = React.useState('');
  const [loading,    setLoading]    = React.useState(false);
  const [signals,    setSignals]    = React.useState([]);
  const [score,      setScore]      = React.useState(null);
  const [aiResult,   setAiResult]   = React.useState(null);
  const [headlines,  setHeadlines]  = React.useState([]);
  const [showNews,   setShowNews]   = React.useState(false);
  const [stockInfo,  setStockInfo]  = React.useState(null);
  const [watchlist,  setWatchlist]  = React.useState([]);

  React.useEffect(() => {
    fetch(`${API_URL}/watchlist`).then(r=>r.json()).then(d=>setWatchlist(Array.isArray(d)?d:[])).catch(()=>{});
    // Expose global setter so OpportunityBoard can pre-fill ticker
    window.__toriiSetConviction = (sym) => { setTicker(sym.toUpperCase()); };
    return () => { delete window.__toriiSetConviction; };
  }, []);

  async function analyze() {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setLoading(true); setSignals([]); setScore(null); setAiResult(null); setHeadlines([]); setStockInfo(null);

    const gathered = [];
    const results = await Promise.allSettled([
      // 1. Watchlist / thesis
      fetch(`${API_URL}/watchlist/${t}`).then(r=>r.json()).catch(()=>null),
      // 2. Short interest (legacy endpoint, optional)
      fetch(`${API_URL}/short/${t}`).then(r=>r.json()).catch(()=>null),
      // 3. Congressional trades
      fetch(`${API_URL}/congressional?ticker=${t}&days=90`).then(r=>r.json()).catch(()=>null),
      // 4. Options flow (Yahoo options chain → P/C ratio + unusual activity)
      fetch(`${API_URL}/options/${t}`).then(r=>r.json()).catch(()=>null),
      // 5. Insider Form 4 — buy vs sell breakdown
      fetch(`${API_URL}/insider/form4/${t}`).then(r=>r.json()).catch(()=>null),
      // 6. Catalysts upcoming
      fetch(`${API_URL}/catalysts?ticker=${t}&from=${new Date().toISOString().slice(0,10)}`).then(r=>r.json()).catch(()=>[]),
      // 7. Analyst price target (Finnhub — optional, used when key is set)
      fetch(`${API_URL}/stocks/price-target/${t}`).then(r=>r.json()).catch(()=>null),
      // 8. Fundamentals — Finnhub metric+quote+profile
      fetch(`${API_URL}/stocks/fundamentals/${t}`).then(r=>r.json()).catch(()=>null),
      // 9. Yahoo Finance quoteSummary — analyst targets + short + 52w + earnings + institutional + P/E
      fetch(`${API_URL}/stocks/yahoo-summary/${t}`).then(r=>r.json()).catch(()=>null),
      // 10. Price momentum — actual 1mo/3mo returns from Yahoo chart
      fetch(`${API_URL}/stocks/momentum/${t}`).then(r=>r.json()).catch(()=>null),
      // 11. News sentiment — keyword scoring on real headlines
      fetch(`${API_URL}/stocks/news-sentiment/${t}`).then(r=>r.json()).catch(()=>null),
      // 12. Alpha Vantage AI news sentiment — real NLP scores per article (free key)
      fetch(`${API_URL}/stocks/av-news/${t}`).then(r=>r.json()).catch(()=>null),
      // 13. Alpha Vantage EPS surprise history — beat/miss/avg surprise %
      fetch(`${API_URL}/stocks/earnings-surprise/${t}`).then(r=>r.json()).catch(()=>null),
      // 14. Social sentiment — StockTwits bullish/bearish tagged messages
      fetch(`${API_URL}/stocks/social/${t}`).then(r=>r.json()).catch(()=>null),
      // 15. Technical analysis — RSI, MAs, Bollinger from Yahoo 1y chart
      fetch(`${API_URL}/stocks/technicals/${t}`).then(r=>r.json()).catch(()=>null),
    ]);

    const [wl, shi, cong, opts, ins, cats, pt, fund, yf, mom, newsSent, avNews, epsSurprise, social, tech] =
      results.map(r => r.status==='fulfilled' ? r.value : null);
    const quote  = fund?.quote  || null;
    const metric = fund?.metric || null;

    // Store stock info for the header display
    setStockInfo({ name: yf?.name || t, currentPrice: quote?.c || yf?.currentPrice, changePercent: yf?.changePercent });

    let total = 50; // base

    // Thesis status
    if (wl && !wl.error) {
      const ts = wl.thesisStatus;
      const delta = ts==='valid'?+15 : ts==='weakening'?-10 : ts==='invalidated'?-25 : 0;
      total += delta;
      if (ts) gathered.push({ label:'Investment Thesis', value: ts.charAt(0).toUpperCase()+ts.slice(1), direction: ts==='valid'?'bullish':ts==='invalidated'?'bearish':'neutral', delta, source:'watchlist' });
      if (wl.conviction) {
        const cd = (wl.conviction - 5) * 2;
        total += cd;
        gathered.push({ label:'Conviction Rating', value: `${wl.conviction}/10`, direction: wl.conviction>=7?'bullish':wl.conviction<=3?'bearish':'neutral', delta: cd, source:'watchlist' });
      }
    }

    // Analyst Price Target — Finnhub first, Yahoo Finance fallback (works for small caps)
    const currentPrice = quote?.c || yf?.currentPrice;
    const targetMean   = pt?.targetMean || yf?.targetMean;
    const targetSource = pt?.targetMean ? 'Finnhub' : 'Yahoo Finance';
    if (targetMean && currentPrice && (yf?.numAnalysts > 0 || pt?.targetMean)) {
      const upside = ((targetMean - currentPrice) / currentPrice) * 100;
      const analystWeight = (yf?.numAnalysts || 0) >= 10 ? 1.0 : (yf?.numAnalysts || 0) >= 5 ? 0.75 : 0.5;
      const rawDelta = upside > 30 ? +15 : upside > 15 ? +10 : upside > 5 ? +5 : upside < -15 ? -12 : upside < -5 ? -6 : 0;
      const delta = Math.round(rawDelta * analystWeight);
      total += delta;
      const rec = pt?.recommendation;
      const recLabel = rec ? ` · ${rec.strongBuy}SB/${rec.buy}B/${rec.hold}H/${rec.sell}S`
        : yf?.recKey ? ` · consensus: ${yf.recKey}` : '';
      const nAnalysts = yf?.numAnalysts > 0 ? ` · ${yf.numAnalysts} analysts` : '';
      gathered.push({ label:'Analyst Consensus',
        value: `$${targetMean.toFixed(2)} target · ${upside>0?'+':''}${upside.toFixed(0)}% upside${nAnalysts}${recLabel}`,
        direction: delta>0?'bullish':delta<0?'bearish':'neutral', delta, source: targetSource });
    } else if (yf?.recKey) {
      const recMap = { 'strong_buy':+8, 'buy':+5, 'hold':0, 'sell':-5, 'underperform':-8, 'strong_sell':-10 };
      const delta = recMap[yf.recKey] ?? 0;
      total += delta;
      gathered.push({ label:'Analyst Consensus',
        value: `Consensus: ${yf.recKey}${yf.numAnalysts > 0 ? ` · ${yf.numAnalysts} analysts` : ''}`,
        direction: delta>0?'bullish':delta<0?'bearish':'neutral', delta, source: 'Yahoo Finance' });
    } else if (yf?.recentUpgrades > 0 || yf?.recentDowngrades > 0 || yf?.analystBuy > 0) {
      const netUpgrade = (yf.recentUpgrades || 0) - (yf.recentDowngrades || 0);
      const delta = netUpgrade > 0 ? +6 : netUpgrade < 0 ? -6 : yf.analystBuy > 0 ? +4 : 0;
      total += delta;
      const parts = [];
      if (yf.analystBuy > 0) parts.push(`${yf.analystBuy} buy / ${yf.analystHold || 0} hold / ${yf.analystSell || 0} sell`);
      if (yf.recentUpgrades > 0) parts.push(`${yf.recentUpgrades} upgrade${yf.recentUpgrades > 1 ? 's' : ''} (30d)`);
      if (yf.recentDowngrades > 0) parts.push(`${yf.recentDowngrades} downgrade${yf.recentDowngrades > 1 ? 's' : ''} (30d)`);
      gathered.push({ label:'Analyst Consensus',
        value: parts.join(' · '),
        direction: delta > 0 ? 'bullish' : delta < 0 ? 'bearish' : 'neutral',
        delta, source: 'Yahoo Finance' });
    } else {
      gathered.push({ label:'Analyst Consensus', value: 'No analyst coverage', direction: 'neutral', delta: 0, source:'Yahoo Finance', noData: true });
    }

    // Price Momentum — actual returns first (Jegadeesh & Titman 1993), 52w fallback
    if (mom && !mom.error && mom.ret3mo != null) {
      const { ret1mo, ret3mo } = mom;
      let delta = ret3mo > 30 ? +12 : ret3mo > 15 ? +8 : ret3mo > 5 ? +4 : ret3mo > -5 ? 0 : ret3mo > -15 ? -4 : ret3mo > -30 ? -8 : -12;
      if (ret1mo > 0 && delta > 0) delta = Math.min(delta + 2, 14);
      if (ret1mo < 0 && delta < 0) delta = Math.max(delta - 2, -14);
      total += delta;
      const high52 = metric?.['52WeekHigh'] || yf?.high52;
      const liveP  = quote?.c || yf?.currentPrice;
      const rangeNote = (high52 && liveP) ? ` · ${(((liveP-high52)/high52)*100).toFixed(0)}% from 52w high` : '';
      gathered.push({ label:'Price Momentum',
        value: `${ret1mo>0?'+':''}${ret1mo.toFixed(1)}% (1mo) · ${ret3mo>0?'+':''}${ret3mo.toFixed(1)}% (3mo)${rangeNote}`,
        direction: delta>=4?'bullish':delta<=-4?'bearish':'neutral', delta, source:'Yahoo Finance' });
    } else {
      const high52 = metric?.['52WeekHigh'] || yf?.high52;
      const low52  = metric?.['52WeekLow']  || yf?.low52;
      const livePrice = quote?.c || yf?.currentPrice;
      if (livePrice && high52 && low52) {
        const pctFromHigh = ((livePrice - high52) / high52) * 100;
        const range = high52 - low52;
        const posInRange = range > 0 ? ((livePrice - low52) / range) * 100 : 50;
        const delta = pctFromHigh > -8 ? +8 : pctFromHigh > -20 ? +4 : pctFromHigh > -35 ? 0 : pctFromHigh > -50 ? -5 : -10;
        total += delta;
        gathered.push({ label:'Price Momentum',
          value: `${pctFromHigh.toFixed(1)}% from 52w high · ${posInRange.toFixed(0)}% of range`,
          direction: delta>=4?'bullish':delta<=-5?'bearish':'neutral', delta, source:'Yahoo Finance' });
      } else {
        gathered.push({ label:'Price Momentum', value: 'No price data', direction: 'neutral', delta: 0, source:'Yahoo Finance', noData: true });
      }
    }

    // News Sentiment — keyword scoring on real headlines (no AI key needed)
    if (newsSent && !newsSent.error && newsSent.total >= 3) {
      const { bull, bear, total: nTotal, label: sentLabel, source: sentSrc } = newsSent;
      const netSentiment = bull - bear;
      const sentimentPct = nTotal > 0 ? (netSentiment / nTotal) * 100 : 0;
      const delta = sentimentPct > 40 ? +8 : sentimentPct > 20 ? +5 : sentimentPct > 0 ? +2
        : sentimentPct < -40 ? -8 : sentimentPct < -20 ? -5 : sentimentPct < 0 ? -2 : 0;
      total += delta;
      gathered.push({ label:'News Sentiment',
        value: `${sentLabel} · ${bull} bullish / ${bear} bearish / ${nTotal-bull-bear} neutral (${nTotal} articles)`,
        direction: delta>0?'bullish':delta<0?'bearish':'neutral', delta, source: sentSrc || 'Yahoo News' });
    } else {
      gathered.push({ label:'News Sentiment', value: 'No news found', direction: 'neutral', delta: 0, source:'Yahoo News', noData: true });
    }

    // Short interest — Yahoo Finance primary (already in yf), legacy endpoint fallback
    const shortPct = yf?.shortPct ?? (shi && !shi.error ? (shi.shortInterestPct ?? shi.finra?.shortPct ?? null) : null);
    if (shortPct != null) {
      const delta = shortPct > 25 ? -12 : shortPct > 15 ? -8 : shortPct > 8 ? -4 : shortPct > 4 ? -1 : shortPct < 2 ? +4 : +2;
      total += delta;
      const dtc = yf?.shortRatio ? ` · ${yf.shortRatio.toFixed(1)}d to cover` : '';
      gathered.push({ label:'Short Interest',
        value: `${shortPct.toFixed(1)}% of float shorted${dtc}`,
        direction: shortPct>15?'bearish':shortPct>8?'neutral':'bullish', delta, source:'Yahoo Finance' });
    } else {
      gathered.push({ label:'Short Interest', value: 'No short data available', direction: 'neutral', delta: 0, source:'Yahoo Finance', noData: true });
    }

    // Congressional trading — absence of trades is NEUTRAL, not missing data
    if (cong && Array.isArray(cong.trades) && cong.trades.length > 0) {
      const buys  = cong.trades.filter(tx => tx.isBuy).length;
      const sells = cong.trades.filter(tx => !tx.isBuy).length;
      const delta = buys > sells + 1 ? +8 : buys > sells ? +4 : buys < sells - 1 ? -8 : buys < sells ? -4 : 0;
      total += delta;
      gathered.push({ label:'Congressional Trading', value: `${buys} buys / ${sells} sells (90d)`, direction: buys>sells?'bullish':buys<sells?'bearish':'neutral', delta, source:'STOCK Act' });
    } else {
      // No trades = neutral (0pts) — not missing data, just no congressional interest
      gathered.push({ label:'Congressional Trading', value: 'No congressional trades in 90d · neutral signal', direction: 'neutral', delta: 0, source:'STOCK Act' });
    }

    // Options flow — yahoo-finance2 options chain (P/C ratio + unusual activity)
    const pcRatio = opts?.putCallRatio ?? null;
    if (pcRatio != null && opts?.totalContracts > 0) {
      const delta = pcRatio < 0.5 ? +10 : pcRatio < 0.7 ? +6 : pcRatio < 0.9 ? +3 : pcRatio < 1.1 ? 0 : pcRatio < 1.3 ? -4 : pcRatio < 1.6 ? -7 : -10;
      total += delta;
      const unusualNote = opts.unusual?.length > 0 ? ` · ${opts.unusual.length} unusual` : '';
      const callPut = opts.totalCallVol && opts.totalPutVol ? ` · ${(opts.totalCallVol/1000).toFixed(0)}K calls / ${(opts.totalPutVol/1000).toFixed(0)}K puts` : '';
      gathered.push({ label:'Options Flow',
        value: `P/C ratio ${pcRatio.toFixed(2)} (${opts.sentiment || (pcRatio<0.8?'bullish':pcRatio>1.2?'bearish':'neutral')})${callPut}${unusualNote}`,
        direction: delta>=4?'bullish':delta<=-4?'bearish':'neutral', delta, source:'Yahoo Finance' });
    } else {
      // Not optionable or no activity — show as neutral not N/A
      gathered.push({ label:'Options Flow', value: 'No options listed · not applicable for this security', direction: 'neutral', delta: 0, source:'Yahoo Finance' });
    }

    // Insider Form 4 — SEC EDGAR primary, Yahoo Finance fallback
    const yfInsiderBuys  = yf?.insiderBuys  || 0;
    const yfInsiderSells = yf?.insiderSells || 0;
    if (ins && !ins.error && ins.filings?.length > 0) {
      const buys  = ins.filings.filter(f => f.isBuy).length;
      const sells = ins.filings.filter(f => f.isSell).length;
      const net   = buys - sells;
      const delta = net >= 3 ? +12 : net > 0 ? +6 : net <= -3 ? -12 : net < 0 ? -6 : +2;
      total += delta;
      const dir = delta > 0 ? 'bullish' : delta < 0 ? 'bearish' : 'neutral';
      gathered.push({ label:'Insider Transactions', value: `${buys} buys / ${sells} sells · ${ins.filings.length} Form 4s (90d)`, direction: dir, delta, source:'SEC EDGAR' });
    } else if (yfInsiderBuys + yfInsiderSells > 0) {
      // Yahoo Finance insiderTransactions module (from quoteSummary)
      const net   = yfInsiderBuys - yfInsiderSells;
      const delta = net > 2 ? +8 : net > 0 ? +4 : net < -2 ? -8 : net < 0 ? -4 : 0;
      total += delta;
      gathered.push({ label:'Insider Transactions',
        value: `${yfInsiderBuys} buys / ${yfInsiderSells} sells (recent filings)`,
        direction: net > 0 ? 'bullish' : net < 0 ? 'bearish' : 'neutral', delta, source:'Yahoo Finance' });
    } else {
      // No insider activity = neutral (directors not buying/selling = no signal)
      gathered.push({ label:'Insider Transactions', value: 'No insider transactions in 90d · neutral', direction: 'neutral', delta: 0, source:'SEC EDGAR' });
    }

    // Upcoming catalysts — MongoDB events + Yahoo earnings date (extended to 90d window)
    const hasMongoCats = Array.isArray(cats) && cats.length > 0;
    const hasEarnings  = yf?.daysToEarnings != null && yf.daysToEarnings >= 0 && yf.daysToEarnings <= 90;
    if (hasMongoCats || hasEarnings) {
      const high  = hasMongoCats ? cats.filter(c => c.impact === 'high').length : 0;
      let catDelta = high >= 2 ? +8 : high === 1 ? +4 : hasMongoCats ? +2 : 0;
      const catParts = [];
      if (hasEarnings) {
        catParts.push(`Earnings in ${yf.daysToEarnings}d`);
        catDelta += yf.daysToEarnings <= 7 ? +5 : yf.daysToEarnings <= 14 ? +3 : yf.daysToEarnings <= 30 ? +2 : +1;
      }
      if (hasMongoCats) catParts.push(`${cats.length} event${cats.length>1?'s':''}${high>0?` (${high} high-impact)`:''}`);
      total += catDelta;
      gathered.push({ label:'Upcoming Catalysts', value: catParts.join(' · '), direction: catDelta>=3?'bullish':'neutral', delta: catDelta, source:'Yahoo Finance + Calendar' });
    } else {
      // No near-term catalyst = neutral (not missing data)
      gathered.push({ label:'Upcoming Catalysts', value: 'No earnings catalyst in next 90d · neutral', direction: 'neutral', delta: 0, source:'Yahoo Finance' });
    }

    // Technical Setup — RSI + Moving Averages (from 1y chart data)
    if (tech && !tech.error) {
      const { rsi, aboveMa50, aboveMa200, bollingerPosition, bollingerInterpret, ret1mo, ret3mo } = tech;
      const techParts = [];
      let delta = 0;
      if (rsi != null) {
        if (rsi < 30) { delta += +6; techParts.push(`RSI ${rsi} (oversold)`); }
        else if (rsi > 70) { delta += -4; techParts.push(`RSI ${rsi} (overbought)`); }
        else if (rsi >= 50) { delta += +3; techParts.push(`RSI ${rsi} (bullish trend)`); }
        else techParts.push(`RSI ${rsi}`);
      }
      if (aboveMa200 != null && aboveMa50 != null) {
        if (aboveMa200 && aboveMa50)  { delta += +3; techParts.push('above MA50 & MA200'); }
        else if (!aboveMa200 && !aboveMa50) { delta += -3; techParts.push('below MA50 & MA200'); }
        else techParts.push(aboveMa50 ? 'above MA50' : 'below MA50');
      }
      if (bollingerPosition != null) techParts.push(`BB ${bollingerPosition.toFixed(0)}% (${bollingerInterpret})`);
      total += delta;
      gathered.push({ label:'Technical Setup',
        value: techParts.join(' · ') || 'Neutral technical picture',
        direction: delta >= 3 ? 'bullish' : delta <= -3 ? 'bearish' : 'neutral', delta, source:'Yahoo Finance' });
    } else if (mom && !mom.error) {
      // Fallback: use momentum data if technicals endpoint failed
      const { rsi, aboveMa50, aboveMa200 } = mom;
      if (rsi != null || aboveMa50 != null) {
        const techParts = [];
        let delta = 0;
        if (rsi) {
          if (rsi < 30) { delta += +6; techParts.push(`RSI ${rsi} (oversold)`); }
          else if (rsi > 70) { delta += -4; techParts.push(`RSI ${rsi} (overbought)`); }
          else if (rsi >= 50) { delta += +3; techParts.push(`RSI ${rsi}`); }
        }
        if (aboveMa200 != null) { delta += aboveMa200 ? +2 : -2; techParts.push(aboveMa200 ? 'above MA200' : 'below MA200'); }
        total += delta;
        gathered.push({ label:'Technical Setup', value: techParts.join(' · ') || 'No clear signal',
          direction: delta >= 3 ? 'bullish' : delta <= -3 ? 'bearish' : 'neutral', delta, source:'Yahoo Finance' });
      }
    } else {
      gathered.push({ label:'Technical Setup', value: 'No price data for analysis', direction:'neutral', delta:0, source:'Yahoo Finance', noData:true });
    }

    // Fundamental Quality — Revenue Growth + Profitability (from Yahoo summary)
    const hasGrowth  = yf?.revenueGrowth != null;
    const hasMargins = yf?.grossMargins != null || yf?.operatingMargins != null;
    if (hasGrowth || hasMargins || yf?.returnOnEquity != null) {
      const { revenueGrowth: rg, grossMargins: gm, operatingMargins: om, returnOnEquity: roe } = yf || {};
      let delta = 0;
      const fundParts = [];
      if (rg != null) {
        if (rg > 25) { delta += +5; fundParts.push(`Rev +${rg.toFixed(0)}% YoY`); }
        else if (rg > 10) { delta += +3; fundParts.push(`Rev +${rg.toFixed(0)}% YoY`); }
        else if (rg > 0)  { delta += +1; fundParts.push(`Rev +${rg.toFixed(0)}% YoY`); }
        else if (rg < -10){ delta += -4; fundParts.push(`Rev ${rg.toFixed(0)}% YoY`); }
        else              { delta += -1; fundParts.push(`Rev ${rg.toFixed(0)}% YoY`); }
      }
      if (gm != null) {
        if (gm > 60) { delta += +3; fundParts.push(`GM ${gm.toFixed(0)}%`); }
        else if (gm > 40) { delta += +2; fundParts.push(`GM ${gm.toFixed(0)}%`); }
        else if (gm > 20) { delta += +1; fundParts.push(`GM ${gm.toFixed(0)}%`); }
        else if (gm < 0)  { delta += -3; fundParts.push(`GM ${gm.toFixed(0)}%`); }
      }
      if (om != null && om < 0) { delta += -2; fundParts.push(`OpM ${om.toFixed(0)}% (loss)`); }
      else if (om != null && om > 25) { delta += +2; fundParts.push(`OpM ${om.toFixed(0)}%`); }
      if (roe != null && roe > 30) delta += +2;
      else if (roe != null && roe < 0) delta += -2;
      total += delta;
      gathered.push({ label:'Fundamental Quality', value: fundParts.join(' · ') || `ROE ${roe?.toFixed(0)}%`,
        direction: delta >= 3 ? 'bullish' : delta <= -3 ? 'bearish' : 'neutral', delta, source:'Yahoo Finance' });
    } else {
      gathered.push({ label:'Fundamental Quality', value:'No fundamental data available', direction:'neutral', delta:0, source:'Yahoo Finance', noData:true });
    }

    // Valuation — P/E, forward P/E, PEG ratio
    if (yf?.peRatio != null && yf.peRatio > 0) {
      const { peRatio: pe, fwdPE, revenueGrowth: rg } = yf;
      let delta = 0;
      const valParts = [];
      if (pe > 0 && rg > 5) {
        const peg = pe / rg;
        if (peg < 0.75) { delta += +5; valParts.push(`PEG ${peg.toFixed(2)} (attractive)`); }
        else if (peg < 1.5) { delta += +2; valParts.push(`PEG ${peg.toFixed(2)}`); }
        else if (peg > 4)   { delta += -4; valParts.push(`PEG ${peg.toFixed(2)} (stretched)`); }
        else valParts.push(`PEG ${peg.toFixed(2)}`);
      }
      if (pe < 10)      { delta += +3; valParts.push(`P/E ${pe.toFixed(1)} (value)`); }
      else if (pe < 20) { delta += +1; valParts.push(`P/E ${pe.toFixed(1)}`); }
      else if (pe < 40) { valParts.push(`P/E ${pe.toFixed(1)}`); }
      else if (pe > 80) { delta += -3; valParts.push(`P/E ${pe.toFixed(1)} (expensive)`); }
      else              { delta += -1; valParts.push(`P/E ${pe.toFixed(1)}`); }
      if (fwdPE != null && fwdPE > 0) {
        if (fwdPE < pe * 0.85) { delta += +2; valParts.push(`Fwd P/E ${fwdPE.toFixed(1)} ↓`); }
        else valParts.push(`Fwd P/E ${fwdPE.toFixed(1)}`);
      }
      total += delta;
      gathered.push({ label:'Valuation', value: valParts.join(' · '),
        direction: delta >= 3 ? 'bullish' : delta <= -3 ? 'bearish' : 'neutral', delta, source:'Yahoo Finance' });
    } else if (yf?.peRatio != null && yf.peRatio <= 0) {
      // Loss-making company — negative P/E is bearish, but check for path to profitability
      const valParts = ['Loss-making (negative P/E)'];
      let delta = -5;
      if (yf.fwdPE != null && yf.fwdPE > 0 && yf.fwdPE < 30) {
        delta += 3; // Expected to turn profitable soon
        valParts.push(`Fwd P/E ${yf.fwdPE.toFixed(1)} (path to profit)`);
      } else if (yf.fwdPE != null && yf.fwdPE > 0) {
        valParts.push(`Fwd P/E ${yf.fwdPE.toFixed(1)}`);
      }
      if (yf.revenueGrowth != null && yf.revenueGrowth > 30) {
        delta += 2; // High-growth loss-maker → less bearish
        valParts.push(`Rev +${yf.revenueGrowth.toFixed(0)}% (growth premium)`);
      }
      total += delta;
      gathered.push({ label:'Valuation', value: valParts.join(' · '),
        direction: delta >= -2 ? 'neutral' : 'bearish', delta, source:'Yahoo Finance' });
    } else if (yf?.fwdPE != null && yf.fwdPE > 0) {
      // No trailing P/E but has forward P/E (pre-revenue or non-standard)
      const fpe = yf.fwdPE;
      const delta = fpe < 15 ? +3 : fpe < 25 ? +1 : fpe > 50 ? -2 : 0;
      total += delta;
      gathered.push({ label:'Valuation', value: `Fwd P/E ${fpe.toFixed(1)} · no trailing P/E`,
        direction: delta > 0 ? 'bullish' : delta < 0 ? 'bearish' : 'neutral', delta, source:'Yahoo Finance' });
    } else {
      gathered.push({ label:'Valuation', value: 'No valuation data available', direction:'neutral', delta:0, source:'Yahoo Finance' });
    }

    // Social Sentiment — StockTwits tagged messages (Da et al. 2011, Chen et al. 2014)
    if (social && !social.error && social.tagged >= 3) {
      const { bull: sBull, bear: sBear, bullPct, watcherCount } = social;
      const delta = bullPct > 75 ? +5 : bullPct > 60 ? +3 : bullPct < 35 ? -5 : bullPct < 45 ? -3 : 0;
      total += delta;
      const watcherNote = watcherCount ? ` · ${(watcherCount/1000).toFixed(1)}k watchers` : '';
      gathered.push({ label:'Social Sentiment',
        value: `${bullPct.toFixed(0)}% bullish · ${sBull} bull / ${sBear} bear${watcherNote}`,
        direction: delta > 0 ? 'bullish' : delta < 0 ? 'bearish' : 'neutral', delta, source:'StockTwits' });
    } else {
      gathered.push({ label:'Social Sentiment', value:'No StockTwits data / insufficient tagged messages', direction:'neutral', delta:0, source:'StockTwits', noData:true });
    }

    // EPS Surprise — Yahoo Finance primary (via epsHistory from quoteSummary), AV route secondary
    if (epsSurprise && !epsSurprise.error && epsSurprise.total >= 2) {
      const { beats, total: epsTotal, avgSurprisePct, mostRecentBeat, mostRecentSurprisePct } = epsSurprise;
      const beatPct = beats / epsTotal;
      let delta = 0;
      if (beatPct >= 0.75 && avgSurprisePct > 5)  delta = +8;
      else if (beatPct >= 0.5 && avgSurprisePct > 0) delta = +4;
      else if (beatPct < 0.25)                     delta = -6;
      else if (avgSurprisePct < -5)                delta = -4;
      if (mostRecentBeat && mostRecentSurprisePct > 10)  delta = Math.min(delta + 3, 10);
      if (!mostRecentBeat && mostRecentSurprisePct < -10) delta = Math.max(delta - 3, -8);
      total += delta;
      const recentStr = mostRecentSurprisePct != null
        ? `· most recent: ${mostRecentBeat ? '✓ beat' : '✗ miss'} (${mostRecentSurprisePct > 0 ? '+' : ''}${mostRecentSurprisePct.toFixed(1)}%)` : '';
      gathered.push({ label:'EPS Surprise',
        value: `${beats}/${epsTotal} beats (last 4Q) · avg ${avgSurprisePct > 0 ? '+' : ''}${avgSurprisePct.toFixed(1)}% ${recentStr}`,
        direction: delta > 0 ? 'bullish' : delta < 0 ? 'bearish' : 'neutral', delta, source:'Alpha Vantage' });
    } else if (yf?.epsHistory?.length >= 2) {
      // Fallback: Yahoo Finance epsHistory from quoteSummary (surprise is a decimal, e.g. 0.05 = 5%)
      const yfHist = yf.epsHistory.filter(q => q.surprise != null);
      if (yfHist.length >= 2) {
        const beats = yfHist.filter(q => q.surprise > 0).length;
        const avgSurprisePct = (yfHist.reduce((s, q) => s + q.surprise, 0) / yfHist.length) * 100;
        const beatPct = beats / yfHist.length;
        const lastQ = yfHist[yfHist.length - 1];
        const mostRecentBeat = lastQ.surprise > 0;
        const mostRecentSurprisePct = lastQ.surprise * 100;
        let delta = 0;
        if (beatPct >= 0.75 && avgSurprisePct > 5)  delta = +8;
        else if (beatPct >= 0.5 && avgSurprisePct > 0) delta = +4;
        else if (beatPct < 0.25)                     delta = -6;
        else if (avgSurprisePct < -5)                delta = -4;
        if (mostRecentBeat && mostRecentSurprisePct > 10)  delta = Math.min(delta + 3, 10);
        if (!mostRecentBeat && mostRecentSurprisePct < -10) delta = Math.max(delta - 3, -8);
        total += delta;
        const recentStr = `· most recent: ${mostRecentBeat ? '✓ beat' : '✗ miss'} (${mostRecentSurprisePct > 0 ? '+' : ''}${mostRecentSurprisePct.toFixed(1)}%)`;
        gathered.push({ label:'EPS Surprise',
          value: `${beats}/${yfHist.length} beats · avg ${avgSurprisePct > 0 ? '+' : ''}${avgSurprisePct.toFixed(1)}% ${recentStr}`,
          direction: delta > 0 ? 'bullish' : delta < 0 ? 'bearish' : 'neutral', delta, source:'Yahoo Finance' });
      } else {
        gathered.push({ label:'EPS Surprise', value: 'Earnings loaded · no estimate comparison available', direction:'neutral', delta:0, source:'Yahoo Finance' });
      }
    } else {
      gathered.push({ label:'EPS Surprise', value: 'No earnings history with estimates available', direction:'neutral', delta:0, source:'Yahoo Finance' });
    }

    // Institutional Ownership — Yahoo Finance (smart money validation signal)
    if (yf?.instPctHeld != null) {
      const inst    = yf.instPctHeld;
      const insider = yf.insiderPctHeld;
      let delta = inst > 80 ? +4 : inst > 60 ? +3 : inst > 40 ? +2 : inst < 10 ? -2 : 0;
      if (insider && insider > 15) delta += 2;
      total += delta;
      const insiderNote = insider != null ? ` · ${insider.toFixed(1)}% insider owned` : '';
      const topHolders  = yf.instOwners?.length > 0 ? ` · top: ${yf.instOwners[0].name}` : '';
      gathered.push({ label:'Institutional Ownership',
        value: `${inst.toFixed(1)}% institutional${insiderNote}${topHolders}`,
        direction: delta > 0 ? 'bullish' : delta < 0 ? 'bearish' : 'neutral', delta, source:'Yahoo Finance' });
    } else {
      gathered.push({ label:'Institutional Ownership', value:'No institutional data available', direction:'neutral', delta:0, source:'Yahoo Finance', noData:true });
    }

    // Alpha Vantage AI News Sentiment — NLP-scored articles (upgraded from keyword matching)
    // Falls back to keyword newsSent if AV not available or rate-limited
    const useAvNews = avNews && !avNews.error && avNews.total >= 3;
    const sentObj   = useAvNews ? avNews : null;
    if (useAvNews) {
      const { bull: avBull, bear: avBear, neutral: avNeutral, total: avTotal, avgScore, label: avLabel } = avNews;
      const sentimentPct = avTotal > 0 ? ((avBull - avBear) / avTotal) * 100 : 0;
      const delta = avBull - avBear > 2 ? (sentimentPct > 40 ? +8 : +5) : avBear - avBull > 2 ? (sentimentPct < -40 ? -8 : -5) : 0;
      total += delta;
      gathered.push({ label:'News Sentiment (AI)',
        value: `${avLabel} · ${avBull} positive / ${avBear} negative / ${avNeutral} neutral articles (avg score ${avgScore > 0 ? '+' : ''}${avgScore.toFixed(2)})`,
        direction: delta > 0 ? 'bullish' : delta < 0 ? 'bearish' : 'neutral', delta, source:'Alpha Vantage AI' });
      // Store headlines for the news panel
      if (avNews.headlines?.length) setHeadlines(avNews.headlines.map(h => typeof h === 'string' ? { title:h } : h));
    } else if (newsSent && !newsSent.error && newsSent.total >= 3) {
      const { bull, bear, total: nTotal, label: sentLabel, source: sentSrc } = newsSent;
      const netSentiment = bull - bear;
      const sentimentPct = nTotal > 0 ? (netSentiment / nTotal) * 100 : 0;
      const delta = sentimentPct > 40 ? +8 : sentimentPct > 20 ? +5 : sentimentPct > 0 ? +2
        : sentimentPct < -40 ? -8 : sentimentPct < -20 ? -5 : sentimentPct < 0 ? -2 : 0;
      total += delta;
      gathered.push({ label:'News Sentiment',
        value: `${sentLabel} · ${bull} bullish / ${bear} bearish / ${nTotal-bull-bear} neutral (${nTotal} articles)`,
        direction: delta>0?'bullish':delta<0?'bearish':'neutral', delta, source: sentSrc || 'Yahoo News' });
      if (newsSent.headlines?.length) setHeadlines(newsSent.headlines.map(h => typeof h === 'string' ? { title:h } : h));
    } else {
      gathered.push({ label:'News Sentiment', value: 'No recent news found', direction: 'neutral', delta: 0, source:'Yahoo News', noData: true });
    }

    total = Math.min(100, Math.max(0, Math.round(total)));
    setSignals(gathered);
    setScore(total);
    setLoading(false);

    // Auto-generate narrative (no button needed — fires automatically)
    const narBody = { ticker: t, score: total, rating: total>=80?'STRONG BUY':total>=65?'BUY':total>=45?'NEUTRAL':total>=30?'SELL':'STRONG SELL', signals: gathered };
    fetch(`${API_URL}/scores/narrative`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(narBody) })
      .then(r=>r.json()).then(nar => { if (nar?.narrative) setAiResult(nar); }).catch(()=>{});
  }

  const SCORE_COLOR = score == null ? 'var(--fg3)' : score >= 70 ? 'var(--green)' : score >= 40 ? '#f59e0b' : 'var(--red-loss)';
  const RATING      = score == null ? '—' : score >= 80 ? 'STRONG BUY' : score >= 65 ? 'BUY' : score >= 45 ? 'NEUTRAL' : score >= 30 ? 'SELL' : 'STRONG SELL';
  const DIR_COLOR   = { bullish:'var(--green)', bearish:'var(--red-loss)', neutral:'#f59e0b' };

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Conviction Score</h1>
          <p className="page-sub">13-signal AI analysis · news · earnings · momentum · short · options · insider · congress · institutional</p>
        </div>
      </div>

      {/* Search + watchlist quick-picks */}
      <div className="card" style={{ marginBottom:14, padding:'12px 16px' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
          <div style={{ position:'relative', flex:1 }}>
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)', pointerEvents:'none' }}>TICKER›</span>
            <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key==='Enter' && analyze()} placeholder="NVDA"
              style={{ width:'100%', padding:'9px 12px 9px 64px', background:'var(--bg)', border:'1px solid var(--bdr)', borderRadius:6, fontSize:14, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--fg)' }} />
          </div>
          <button onClick={analyze} disabled={loading}
            style={{ padding:'9px 24px', background:'var(--red)', color:'#fff', border:'none', borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-mono)', letterSpacing:'0.06em', opacity:loading?0.7:1 }}>
            {loading ? 'ANALYZING…' : 'ANALYZE'}
          </button>
        </div>
        {watchlist.length > 0 && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {watchlist.slice(0,12).map(w => (
              <button key={w.symbol} onClick={() => { setTicker(w.symbol); }}
                style={{ padding:'3px 8px', fontSize:10, fontFamily:'var(--font-mono)', fontWeight:700, border:'1px solid var(--bdr)', borderRadius:4, cursor:'pointer', background:'transparent', color:'var(--fg3)' }}>
                {w.symbol}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="card" style={{ textAlign:'center', padding:30, color:'var(--fg3)' }}>
          <div style={{ fontSize:13, marginBottom:8 }}>Fetching all signals for <strong>{ticker}</strong>…</div>
          <div style={{ fontSize:11, fontFamily:'var(--font-mono)' }}>thesis · sentiment · short interest · congressional · options · insider · catalysts</div>
        </div>
      )}

      {score !== null && !loading && (
        <div>
          {/* Score hero */}
          <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:14, marginBottom:14 }}>
            <div className="card" style={{ textAlign:'center', minWidth:210, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4 }}>
              <div style={{ fontSize:64, fontWeight:900, fontFamily:'var(--font-mono)', color: SCORE_COLOR, lineHeight:1 }}>{score}</div>
              <div style={{ fontSize:10, color:'var(--fg3)', fontFamily:'var(--font-mono)' }}>/ 100</div>
              <div style={{ fontSize:13, fontWeight:800, letterSpacing:'0.1em', color: SCORE_COLOR }}>{RATING}</div>
              <div style={{ width:'80%', height:5, background:'var(--surf)', borderRadius:3, overflow:'hidden', margin:'6px 0' }}>
                <div style={{ height:'100%', width:`${score}%`, background: SCORE_COLOR, borderRadius:3, transition:'width 0.6s' }} />
              </div>
              <div style={{ fontSize:12, fontFamily:'var(--font-mono)', color:'var(--fg)', fontWeight:800 }}>{stockInfo?.name || ticker}</div>
              {stockInfo?.currentPrice && (
                <div style={{ fontSize:11, color:'var(--fg3)' }}>
                  ${stockInfo.currentPrice.toFixed(2)}
                  {stockInfo.changePercent != null && (
                    <span style={{ marginLeft:6, color: stockInfo.changePercent >= 0 ? 'var(--green)' : 'var(--red-loss)', fontWeight:700 }}>
                      {stockInfo.changePercent >= 0 ? '+' : ''}{stockInfo.changePercent.toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
              <div style={{ marginTop:6, fontSize:10, color:'var(--fg3)' }}>
                {signals.filter(s=>!s.noData).length}/{signals.length} signals active
              </div>
              {/* Mini signal bar */}
              <div style={{ display:'flex', gap:3, marginTop:4 }}>
                {signals.map((s,i) => (
                  <div key={i} style={{ width:8, height:8, borderRadius:2, background: s.noData ? 'var(--bdr)' : DIR_COLOR[s.direction]||'var(--fg3)', opacity: s.noData ? 0.3 : 1 }} title={s.label} />
                ))}
              </div>
            </div>

            <div className="card" style={{ overflow:'hidden' }}>
              <div style={{ fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
                Signal Breakdown · {signals.filter(s=>s.direction==='bullish'&&!s.noData).length} bullish · {signals.filter(s=>s.direction==='bearish'&&!s.noData).length} bearish
              </div>
              {signals.map((sig, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom: i<signals.length-1?'1px solid var(--bdr)':'none', opacity: sig.noData ? 0.4 : 1 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background: sig.noData ? 'var(--bdr)' : DIR_COLOR[sig.direction]||'var(--fg3)' }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, fontWeight:700 }}>{sig.label}</div>
                    <div style={{ fontSize:10, color:'var(--fg3)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {sig.value}
                      <span style={{ marginLeft:6, fontFamily:'var(--font-mono)', fontSize:9, opacity:0.6 }}>{sig.source}</span>
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    {!sig.noData && (
                      <div style={{ fontSize:10, fontWeight:700, color: DIR_COLOR[sig.direction]||'var(--fg3)' }}>
                        {sig.direction.toUpperCase()}
                      </div>
                    )}
                    <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color: sig.delta>0?'var(--green)':sig.delta<0?'var(--red-loss)':'var(--fg3)' }}>
                      {sig.noData ? 'N/A' : `${sig.delta>0?'+':''}${sig.delta}pts`}
                    </div>
                  </div>
                </div>
              ))}
              {signals.length === 0 && (
                <div style={{ color:'var(--fg3)', fontSize:12, textAlign:'center', padding:16 }}>No signals — click ANALYZE above</div>
              )}
            </div>
          </div>

          {/* Auto-generated Investment Narrative */}
          {aiResult?.narrative && (
            <div className="card" style={{ marginBottom:14, borderLeft:'3px solid var(--red)', padding:'14px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <span style={{ fontSize:10, color:'var(--red)', fontFamily:'var(--font-mono)', fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em' }}>✦ Investment Thesis</span>
                <div style={{ display:'flex', gap:6 }}>
                  {aiResult.bullCount > 0 && <span style={{ fontSize:9, padding:'2px 6px', borderRadius:3, background:'rgba(34,197,94,0.12)', color:'var(--green)', fontFamily:'var(--font-mono)', fontWeight:700 }}>{aiResult.bullCount} BULL</span>}
                  {aiResult.bearCount > 0 && <span style={{ fontSize:9, padding:'2px 6px', borderRadius:3, background:'rgba(239,68,68,0.12)', color:'var(--red-loss)', fontFamily:'var(--font-mono)', fontWeight:700 }}>{aiResult.bearCount} BEAR</span>}
                </div>
              </div>
              <p style={{ margin:0, fontSize:13, color:'var(--fg)', lineHeight:1.75, fontWeight:400 }}>{aiResult.narrative}</p>
            </div>
          )}

          {/* News Headlines Panel */}
          {headlines.length > 0 && (
            <div className="card" style={{ marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: showNews ? 10 : 0, cursor:'pointer' }} onClick={() => setShowNews(!showNews)}>
                <span style={{ fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.06em', flex:1 }}>Recent Headlines ({headlines.length})</span>
                <span style={{ fontSize:11, color:'var(--fg3)' }}>{showNews ? '▲' : '▼'}</span>
              </div>
              {showNews && headlines.map((h, i) => (
                <div key={i} style={{ padding:'7px 0', borderTop:'1px solid var(--bdr)', display:'flex', alignItems:'flex-start', gap:8 }}>
                  {h.score != null && (
                    <div style={{ width:6, height:6, borderRadius:'50%', flexShrink:0, marginTop:4,
                      background: h.score > 0.15 ? 'var(--green)' : h.score < -0.15 ? 'var(--red-loss)' : 'var(--fg3)' }} />
                  )}
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, color:'var(--fg2)', lineHeight:1.4 }}>{h.title || h}</div>
                    {h.source && <div style={{ fontSize:10, color:'var(--fg3)', marginTop:2 }}>{h.source} {h.label ? `· ${h.label}` : ''}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {score === null && !loading && (
        <div className="card" style={{ textAlign:'center', padding:'48px 20px', color:'var(--fg3)' }}>
          <div style={{ fontSize:64, fontWeight:900, fontFamily:'var(--font-mono)', color:'var(--bdr)', marginBottom:12 }}>∑</div>
          <div style={{ fontSize:14, marginBottom:8, color:'var(--fg2)' }}>Enter a ticker to compute conviction score</div>
          <div style={{ fontSize:11, fontFamily:'var(--font-mono)', lineHeight:2, color:'var(--fg3)' }}>
            13 signals · thesis · news (AI) · EPS surprise · momentum<br/>
            short interest · options flow · insider · congressional · institutional<br/>
            analyst consensus · upcoming catalysts · auto narrative
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BacktestPage ─────────────────────────────────────────────────────────────
// Shows how well each score bucket predicted subsequent returns.
// Data accumulates over time as ScoreSnapshot records mature.
function BacktestPage() {
  const [data,    setData]    = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error,   setError]   = React.useState(null);
  const [period,  setPeriod]  = React.useState('30d');

  async function load() {
    setLoading(true); setError(null);
    const r = await fetch(`${API_URL}/scores/backtest`).catch(() => null);
    if (!r?.ok) { setError('Failed to load backtest data'); setLoading(false); return; }
    const d = await r.json();
    setData(d);
    setLoading(false);
  }

  React.useEffect(() => { load(); }, []);

  const RATING_COLORS = {
    'Strong Buy (80-100)': 'var(--green)',
    'Buy (65-79)':         '#86efac',
    'Neutral (45-64)':     '#f59e0b',
    'Sell (30-44)':        '#f87171',
    'Strong Sell (0-29)': 'var(--red-loss)',
  };
  const PERIOD_FIELD = { '30d': 'avgRet30d', '90d': 'avgRet90d', '180d': 'avgRet180d' };
  const WINRATE_FIELD = { '30d': 'winRate30d', '90d': 'winRate90d', '180d': 'winRate180d' };
  const N_FIELD = { '30d': 'n30', '90d': 'n90', '180d': 'n180' };

  const buckets = data?.bucketStats || [];
  const maxAbsRet = Math.max(...buckets.map(b => Math.abs(b[PERIOD_FIELD[period]] || 0)), 10);

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Algorithm Backtest</h1>
          <p className="page-sub">Score bucket → forward return · signal accuracy · algorithm v4 · {data?.totalSnapshots || 0} total snapshots</p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ padding:'8px 16px', background:'var(--red)', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-mono)' }}>
          {loading ? 'LOADING…' : '↻ REFRESH'}
        </button>
      </div>

      {error && <div className="card" style={{ color:'var(--red-loss)', fontSize:13 }}>{error}</div>}

      {!data && !loading && !error && (
        <div className="card" style={{ textAlign:'center', padding:'48px 20px', color:'var(--fg3)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📊</div>
          <div style={{ fontSize:14, color:'var(--fg2)', marginBottom:8 }}>No backtest data yet</div>
          <div style={{ fontSize:11, fontFamily:'var(--font-mono)', lineHeight:1.8 }}>
            Run SCORES on the Opportunity Board to start capturing snapshots.<br/>
            Return here after 7+ days to see how score predictions performed.
          </div>
        </div>
      )}

      {data && (
        <div>
          {/* Summary stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:16 }}>
            {[
              { label:'Total Snapshots', val: data.totalSnapshots },
              { label:'With 30d Return', val: data.totalWithRet30 },
              { label:'With 90d Return', val: data.totalWithRet90 },
              { label:'With 180d Return', val: data.totalWithRet180 },
            ].map((s, i) => (
              <div key={i} className="card" style={{ textAlign:'center' }}>
                <div style={{ fontSize:24, fontWeight:900, fontFamily:'var(--font-mono)', color:'var(--fg)' }}>{s.val}</div>
                <div style={{ fontSize:10, color:'var(--fg3)', marginTop:4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Period selector */}
          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            {['30d','90d','180d'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ padding:'6px 14px', fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700,
                  background: period===p ? 'var(--red)' : 'transparent',
                  color: period===p ? '#fff' : 'var(--fg3)',
                  border:'1px solid var(--bdr)', borderRadius:4, cursor:'pointer' }}>
                {p} FORWARD
              </button>
            ))}
          </div>

          {/* Score bucket chart */}
          <div className="card" style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:14 }}>
              Average Forward Return by Score Bucket ({period})
            </div>
            {buckets.map((b, i) => {
              const ret   = b[PERIOD_FIELD[period]];
              const wr    = b[WINRATE_FIELD[period]];
              const n     = b[N_FIELD[period]];
              const color = RATING_COLORS[b.label] || 'var(--fg3)';
              const barW  = ret != null ? Math.abs(ret) / maxAbsRet * 100 : 0;
              return (
                <div key={i} style={{ marginBottom:14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:5 }}>
                    <div style={{ width:10, height:10, borderRadius:2, background:color, flexShrink:0 }} />
                    <div style={{ flex:1, fontSize:12, fontWeight:700 }}>{b.label}</div>
                    <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color: ret == null ? 'var(--fg3)' : ret >= 0 ? 'var(--green)' : 'var(--red-loss)', fontWeight:700 }}>
                      {ret == null ? `${b.count} snaps, no data yet` : `${ret >= 0 ? '+' : ''}${ret.toFixed(1)}% avg · ${wr?.toFixed(0)}% win rate · n=${n}`}
                    </div>
                  </div>
                  {ret != null && (
                    <div style={{ height:10, background:'var(--surf)', borderRadius:4, overflow:'hidden', display:'flex', alignItems:'center' }}>
                      {ret >= 0
                        ? <div style={{ height:'100%', width:`${barW}%`, background:color, marginLeft:'50%', transform:'translateX(-100%)', borderRadius:4 }} />
                        : <div style={{ height:'100%', width:`${barW}%`, background:color, marginLeft:`${50-barW}%`, borderRadius:4 }} />
                      }
                    </div>
                  )}
                </div>
              );
            })}
            {buckets.every(b => b[N_FIELD[period]] === 0) && (
              <div style={{ color:'var(--fg3)', fontSize:12, textAlign:'center', padding:'20px 0' }}>
                No {period} return data yet. Run SCORES daily and check back after {period === '30d' ? '30' : period === '90d' ? '90' : '180'} days.
              </div>
            )}
          </div>

          {/* Signal accuracy table */}
          {data.signalAccuracy?.length > 0 && (
            <div className="card">
              <div style={{ fontSize:11, color:'var(--fg3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>
                Signal-Level Accuracy (30d forward return, bullish prediction)
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto', gap:'8px 16px', alignItems:'center' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--fg3)' }}>SIGNAL</div>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--fg3)', textAlign:'right' }}>SAMPLES</div>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--fg3)', textAlign:'right' }}>WIN RATE</div>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--fg3)', textAlign:'right' }}>AVG RET</div>
                {data.signalAccuracy.slice(0, 15).map((s, i) => (
                  <React.Fragment key={i}>
                    <div style={{ fontSize:11 }}>{s.label}</div>
                    <div style={{ fontSize:11, fontFamily:'var(--font-mono)', textAlign:'right', color:'var(--fg3)' }}>{s.bullSamples}</div>
                    <div style={{ fontSize:11, fontFamily:'var(--font-mono)', textAlign:'right',
                      color: s.bullWinRate == null ? 'var(--fg3)' : s.bullWinRate > 55 ? 'var(--green)' : s.bullWinRate < 45 ? 'var(--red-loss)' : 'var(--fg)' }}>
                      {s.bullWinRate != null ? `${s.bullWinRate.toFixed(0)}%` : '—'}
                    </div>
                    <div style={{ fontSize:11, fontFamily:'var(--font-mono)', textAlign:'right',
                      color: s.avgBullRet30d == null ? 'var(--fg3)' : s.avgBullRet30d > 0 ? 'var(--green)' : 'var(--red-loss)' }}>
                      {s.avgBullRet30d != null ? `${s.avgBullRet30d > 0 ? '+' : ''}${s.avgBullRet30d.toFixed(1)}%` : '—'}
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <div style={{ marginTop:12, fontSize:10, color:'var(--fg3)', lineHeight:1.6 }}>
                Win rate: % of times a bullish signal led to positive 30d return. Min 3 samples shown. Grow the dataset by running SCORES daily.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  PortfolioPage, JapanPage, NewsPage, VoicesPage, StockPage, WatchlistPage, AlertsPanel,
  EarningsPage, ToolsPage, AnalyticsPage, PushSettingsPage, NetworkingPage,
  AssistantPage, NotesPage, DealsPage, MeetingsPage, BriefingPage,
  JournalPage, SentimentPage, ScenarioPage,
  MacroPage, WatchlistIntelPage, InsiderPage, AttributionPage, ResearchPage,
  CalendarPage, CongressPage, OptionsPage, ShortPage, ValuationPage, LPPage, DiligencePage, ConvictionPage,
  OpportunityBoard, BacktestPage,
});
