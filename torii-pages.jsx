// ─── TORII SUB-PAGES: Portfolio, Japan, News, Voices, Stock ──────────────────

// ─── PORTFOLIO PAGE ───────────────────────────────────────────────────────────

function PortfolioPage({ onNav }) {
  const holdings = MOCK.portfolio;
  const total    = holdings.reduce((s,h) => s + h.value, 0);
  const dayChg   = holdings.reduce((s,h) => s + (h.change * h.shares), 0);
  const dayPct   = total > 0 ? (dayChg / (total - dayChg)) * 100 : 0;
  const [sort, setSort] = React.useState('value');

  const sorted = [...holdings].sort((a,b) => {
    if (sort === 'value')  return b.value - a.value;
    if (sort === 'pct')    return Math.abs(b.pct) - Math.abs(a.pct);
    if (sort === 'ticker') return a.ticker.localeCompare(b.ticker);
    return 0;
  });

  // Allocation data
  const allocs = holdings.map(h => ({ ticker: h.ticker, pct: (h.value / total) * 100, value: h.value, color: h.pct >= 0 ? 'var(--green)' : 'var(--red-loss)' }))
    .sort((a,b) => b.pct - a.pct);

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Portfolio</h1>
          <p className="page-sub">Holdings · performance · analytics</p>
        </div>
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
            const top = [...holdings].sort((a,b) => Math.abs(b.pct)-Math.abs(a.pct))[0];
            return <>
              <span className="stat-value">{top.ticker}</span>
              <span className="stat-change" style={{color:top.pct>=0?'var(--green)':'var(--red-loss)'}}>
                {top.pct>=0?'+':''}{top.pct.toFixed(2)}%
              </span>
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
                <th style={{width:80}}>7D</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(h => {
                const up = h.pct >= 0;
                const color = up ? 'var(--green)' : 'var(--red-loss)';
                const spark = MOCK.sparklines[h.ticker] || [];
                return (
                  <tr key={h.id} onClick={() => onNav(`stock-${h.ticker}`)} style={{cursor:'pointer'}}>
                    <td><span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:12,color:'var(--fg)'}}>{h.ticker}</span></td>
                    <td><span style={{fontSize:11,color:'var(--fg2)'}}>{h.name}</span></td>
                    <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--fg3)'}}>{h.shares}</td>
                    <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:12,color:'var(--fg)'}}>${h.price.toFixed(2)}</td>
                    <td style={{textAlign:'right'}}>
                      <span style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,color}}>
                        {up?'+':''}{h.pct.toFixed(2)}%
                      </span>
                    </td>
                    <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600,color:'var(--fg)'}}>
                      ${h.value.toLocaleString('en-US',{maximumFractionDigits:0})}
                    </td>
                    <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:10,color:'var(--fg3)'}}>
                      {((h.value/total)*100).toFixed(1)}%
                    </td>
                    <td style={{padding:'8px 12px 8px 4px'}}>
                      <Sparkline data={spark} width={72} height={24} color={color} />
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
            {[{label:'Best today', h: [...holdings].sort((a,b)=>b.pct-a.pct)[0], up:true},
              {label:'Worst today', h: [...holdings].sort((a,b)=>a.pct-b.pct)[0], up:false}].map(({label,h,up})=>(
              <div key={label} style={{marginBottom:12}}>
                <div style={{fontSize:9,fontFamily:'var(--font-mono)',color:'var(--fg3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>{label}</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:13,color:'var(--fg)'}}>{h.ticker}</span>
                  <span style={{fontFamily:'var(--font-mono)',fontWeight:600,fontSize:12,color:up?'var(--green)':'var(--red-loss)'}}>
                    {h.pct>=0?'+':''}{h.pct.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
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

  const cats = ['all','japan','macro','market'];
  const imps = ['all','high','medium','low'];

  let articles = MOCK.news;
  if (cat !== 'all') articles = articles.filter(a => a.category === cat);
  if (imp !== 'all') articles = articles.filter(a => a.importance === imp);
  if (query.trim()) {
    const ql = query.toLowerCase();
    articles = articles.filter(a => a.title.toLowerCase().includes(ql) || a.summary.toLowerCase().includes(ql));
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
        {articles.length === 0 && (
          <div style={{padding:'40px',textAlign:'center',color:'var(--fg3)',fontFamily:'var(--font-mono)',fontSize:12}}>No articles match</div>
        )}
        {articles.map(a => (
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
  const tweets = selected === 'all'
    ? MOCK.tweets
    : MOCK.tweets.filter(t => t.handle === selected);

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
        {tweets.map(t => <TweetCard key={t.id} tweet={t} />)}
        {tweets.length === 0 && (
          <div style={{padding:'40px',textAlign:'center',color:'var(--fg3)',fontFamily:'var(--font-mono)',fontSize:12}}>No tweets found</div>
        )}
      </div>
    </div>
  );
}

// ─── STOCK DETAIL PAGE ────────────────────────────────────────────────────────

function StockPage({ ticker, onBack }) {
  const h = MOCK.portfolio.find(h => h.ticker === ticker);
  const spark = MOCK.sparklines[ticker] || [];
  if (!h) return <div className="page-root"><div className="page-header"><h1 className="page-title">Not found</h1></div></div>;

  const up = h.pct >= 0;
  const color = up ? 'var(--green)' : 'var(--red-loss)';
  const posValue = h.value;
  const dayPnL = h.change * h.shares;

  const newsItems = MOCK.news.slice(0,3);

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
              {up?'+':''}{h.pct.toFixed(2)}% today
            </span>
          </div>
        </div>
        <a href={`https://finance.yahoo.com/quote/${ticker}`} target="_blank" rel="noopener" className="btn-ghost" style={{padding:'8px 16px',fontSize:12}}>
          Yahoo Finance ↗
        </a>
      </div>

      {/* 7-day chart */}
      <div className="card" style={{marginBottom:14}}>
        <div className="section-label">7-Day Price</div>
        <AreaChart data={spark} height={120} showDates={false} />
      </div>

      {/* Position stats */}
      <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:14}}>
        {[
          {label:'Position Value', val:`$${posValue.toLocaleString('en-US',{maximumFractionDigits:0})}`, sub:`${h.shares} shares`},
          {label:'Day P&L', val:`${dayPnL>=0?'+':''}$${Math.abs(dayPnL).toFixed(2)}`, sub:`${h.pct.toFixed(2)}%`, color},
          {label:'Avg Cost', val:`$${h.prevClose.toFixed(2)}`, sub:'prior close'},
          {label:'Portfolio %', val:`${((h.value/MOCK.portfolio.reduce((s,x)=>s+x.value,0))*100).toFixed(1)}%`, sub:'allocation'},
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

Object.assign(window, { PortfolioPage, JapanPage, NewsPage, VoicesPage, StockPage });
