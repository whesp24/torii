// ─── TORII SHELL: App, Sidebar, Topbar, Notifications, Tasks, CmdPalette ──────

const NAV = [
  { id:'overview',  label:'Markets',   icon:'markets'   },
  { id:'portfolio', label:'Portfolio', icon:'portfolio' },
  { id:'japan',     label:'Japan',     icon:'japan'     },
  { id:'news',      label:'News',      icon:'news'      },
  { id:'voices',    label:'Voices',    icon:'voices'    },
  { id:'network',   label:'Network',   icon:'network'   },
  { id:'projects',  label:'Projects',  icon:'projects'  },
];

// ─── Icons ────────────────────────────────────────────────────────────────────

function NavIcon({ id, active }) {
  const c = active ? 'var(--red)' : 'var(--fg3)';
  const s = { width:18, height:18 };
  if (id==='markets')   return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>;
  if (id==='portfolio') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>;
  if (id==='japan')     return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M5 6V4h14v2"/><path d="M8 6v12"/><path d="M16 6v12"/><path d="M3 18h18"/></svg>;
  if (id==='news')      return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>;
  if (id==='voices')    return <svg {...s} viewBox="0 0 24 24" fill={active?'var(--red)':'var(--fg3)'} stroke="none"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
  if (id==='network')   return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2.5"/><circle cx="4.5" cy="19" r="2"/><circle cx="19.5" cy="19" r="2"/><path d="M12 7.5v4l-5.5 5M12 11.5l5.5 5"/></svg>;
  if (id==='projects')  return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="11" rx="1.5"/><path d="M14 18h7M14 21h4"/></svg>;
  return null;
}

function BellIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
}

function ToriiLogo({ size=22 }) {
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} fill="none">
      <rect x="3" y="6" width="22" height="2.5" rx="1.25" fill="var(--red)" />
      <rect x="5" y="8.5" width="18" height="1.5" rx="0.75" fill="var(--red)" opacity="0.5" />
      <rect x="7.5" y="10" width="2" height="13" rx="1" fill="var(--red)" />
      <rect x="18.5" y="10" width="2" height="13" rx="1" fill="var(--red)" />
      <rect x="7.5" y="2" width="2" height="7" rx="1" fill="var(--red)" />
      <rect x="18.5" y="2" width="2" height="7" rx="1" fill="var(--red)" />
    </svg>
  );
}

// ─── Clock ────────────────────────────────────────────────────────────────────

function Clock() {
  const [t, setT] = React.useState(new Date());
  React.useEffect(() => { const id = setInterval(() => setT(new Date()), 30000); return () => clearInterval(id); }, []);
  const jst = t.toLocaleTimeString('en-US', { timeZone:'Asia/Tokyo', hour:'2-digit', minute:'2-digit', hour12:false });
  const et  = t.toLocaleTimeString('en-US', { timeZone:'America/New_York', hour:'2-digit', minute:'2-digit', hour12:false });
  return (
    <div className="clock">
      <div className="clock-main">{jst} <span className="clock-tz">JST</span></div>
      <div className="clock-sub">{et} ET</div>
    </div>
  );
}

// ─── Market Sessions ──────────────────────────────────────────────────────────

function Sessions() {
  const now = new Date();
  const jstH = new Date(now.toLocaleString('en-US',{timeZone:'Asia/Tokyo'})).getHours();
  const nyH  = new Date(now.toLocaleString('en-US',{timeZone:'America/New_York'})).getHours();
  const lonH = new Date(now.toLocaleString('en-US',{timeZone:'Europe/London'})).getHours();
  const sessions = [
    { label:'TYO', open: jstH >= 9 && jstH < 15 },
    { label:'LON', open: lonH >= 8 && lonH < 16 },
    { label:'NYC', open: nyH  >= 9 && nyH  < 16 },
  ];
  return (
    <div className="sessions">
      {sessions.map(s => (
        <span key={s.label} className={`session ${s.open?'open':'closed'}`}>
          <span className="session-dot" />{s.label}
        </span>
      ))}
    </div>
  );
}

// ─── Notification Panel ───────────────────────────────────────────────────────

function NotifPanel({ notifs, onMarkRead, onClose }) {
  return (
    <div className="notif-panel" onClick={e => e.stopPropagation()}>
      <div className="notif-panel-head">
        <span className="notif-panel-title">Notifications</span>
        <button className="notif-mark-read" onClick={onMarkRead}>Mark all read</button>
      </div>
      <div className="notif-list">
        {notifs.length === 0 && (
          <div style={{ padding:'20px', textAlign:'center', color:'var(--fg3)', fontSize:12, fontFamily:'var(--font-mono)' }}>
            All caught up ✓
          </div>
        )}
        {notifs.map(n => (
          <div key={n.id} className={`notif-item ${n.read?'read':''}`}>
            <span className="notif-icon">{n.icon}</span>
            <div className="notif-body-wrap">
              <div className="notif-title">{n.title}</div>
              <div className="notif-sub">{n.body}</div>
              <div className="notif-time">{n.time}</div>
            </div>
            {!n.read && <span className="notif-unread-dot" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

function Topbar({ theme, onTheme, notifCount, notifOpen, onNotif }) {
  const allQ = [...MOCK.japan, ...MOCK.macro];
  const chips = allQ.map(q => {
    const up = q.invert ? q.pct < 0 : q.pct >= 0;
    const priceStr = fmtPrice(q.price, q.dec);
    const pctStr = `${q.pct >= 0 ? '+' : ''}${q.pct.toFixed(2)}%`;
    return { label: q.label, price: priceStr, pct: pctStr, up };
  });

  return (
    <header className="topbar">
      <div className="topbar-logo">
        <ToriiLogo size={20} />
        <span className="topbar-brand">TORII</span>
      </div>

      {/* Animated ticker tape */}
      <div className="ticker-track">
        <div className="ticker-inner">
          {[...chips, ...chips].map((c, i) => (
            <span key={i} className="t-chip">
              <span className="t-sym">{c.label}</span>
              <span className="t-price">{c.price}</span>
              <span className={`t-pct ${c.up ? 'up' : 'dn'}`}>{c.pct}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Right controls */}
      <div className="topbar-right">
        <Sessions />
        <button className="topbar-btn notif-btn" onClick={onNotif} title="Notifications">
          <BellIcon />
          {notifCount > 0 && <span className="notif-badge">{notifCount}</span>}
        </button>
        <button className="theme-toggle" onClick={onTheme} title="Toggle theme">
          <span>{theme === 'ember' ? '☀︎' : '⛩'}</span>
          <span className="theme-label">{theme === 'ember' ? 'LIQUID' : 'EMBER'}</span>
        </button>
        <Clock />
      </div>
    </header>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ page, onNav, tasks, onAddTask, onToggleTask, collapsed, onCollapse }) {
  const [taskInput, setTaskInput] = React.useState('');
  const [tasksOpen, setTasksOpen] = React.useState(true);
  const todoCount = tasks.filter(t => !t.done).length;

  function handleAdd(e) {
    e.preventDefault();
    if (taskInput.trim()) { onAddTask(taskInput.trim()); setTaskInput(''); }
  }

  return (
    <aside className={`sidebar${collapsed?' collapsed':''}`}>
      {/* Logo / collapse */}
      <div className="sidebar-logo-row">
        {!collapsed && (
          <>
            <ToriiLogo size={20} />
            <span className="sidebar-brand">TORII</span>
          </>
        )}
        <button className="collapse-btn" onClick={onCollapse} title={collapsed?'Expand':'Collapse'}>
          {collapsed
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          }
        </button>
      </div>

      {/* Nav */}
      <div className="sidebar-section">
        {!collapsed && <div className="sidebar-section-label">VIEWS</div>}
        {NAV.map(({ id, label, icon }) => (
          <button key={id} className={`nav-item${page===id?' active':''}`} onClick={() => onNav(id)}>
            <span className="nav-icon"><NavIcon id={icon} active={page===id} /></span>
            {!collapsed && <span className="nav-label">{label}</span>}
          </button>
        ))}
      </div>

      <div className="sidebar-div" />

      {/* Holdings */}
      <div className="sidebar-section sidebar-scroll-section">
        {!collapsed && <div className="sidebar-section-label">HOLDINGS</div>}
        <div className="holdings-scroller">
          {MOCK.portfolio.map(h => {
            const up = h.pct >= 0;
            const color = up ? 'var(--green)' : 'var(--red-loss)';
            return (
              <button key={h.id} className={`nav-item holding-row${page===`stock-${h.ticker}`?' active':''}`}
                onClick={() => onNav(`stock-${h.ticker}`)}>
                <div className="holding-left">
                  <span className="holding-ticker">{h.ticker}</span>
                  {!collapsed && <span className="holding-shares">{h.shares}sh</span>}
                </div>
                {!collapsed && (
                  <div className="holding-right" style={{ color }}>
                    <span className="holding-price">${h.price.toFixed(2)}</span>
                    <span className="holding-pct">{up?'+':''}{h.pct.toFixed(2)}%</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tasks */}
      {!collapsed && (
        <>
          <div className="sidebar-div" />
          <div className="sidebar-tasks">
            <button className="tasks-header" onClick={() => setTasksOpen(o => !o)}>
              <div className="sidebar-section-label" style={{margin:0}}>TASKS</div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                {todoCount > 0 && <span className="task-badge">{todoCount}</span>}
                <span className="tasks-caret">{tasksOpen ? '▴' : '▾'}</span>
              </div>
            </button>
            {tasksOpen && (
              <div className="tasks-list">
                {tasks.map(t => (
                  <div key={t.id} className={`task-item${t.done?' done':''}`}>
                    <button className={`task-check${t.done?' checked':''}`} onClick={() => onToggleTask(t.id)}>
                      {t.done && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="2,6 5,9 10,3"/></svg>}
                    </button>
                    <span className={`task-text${t.priority==='high'?' task-urgent':''}`}>{t.text}</span>
                    {t.auto && <span className="task-auto-tag">auto</span>}
                  </div>
                ))}
                <form onSubmit={handleAdd} className="task-add-form">
                  <input
                    className="task-input"
                    value={taskInput}
                    onChange={e => setTaskInput(e.target.value)}
                    placeholder="+ Add task…"
                  />
                </form>
              </div>
            )}
          </div>
        </>
      )}

      {/* Footer */}
      {!collapsed && (
        <div className="sidebar-footer">
          Yahoo Finance · NHK · Reuters
        </div>
      )}
    </aside>
  );
}

// ─── Command Palette ──────────────────────────────────────────────────────────

const CMD_ITEMS = [
  ...NAV.map(n => ({ type:'page', label:`Go to ${n.label}`, id: n.id, hint: n.id })),
  { type:'action', label:'Refresh Briefing',   hint:'briefing' },
  { type:'action', label:'Clear all tasks',    hint:'tasks'    },
  { type:'action', label:'Toggle theme',       hint:'theme'    },
  { type:'action', label:'Mark notifs read',   hint:'notifs'   },
  ...MOCK.portfolio.map(h => ({ type:'stock', label:`${h.ticker} — ${h.name}`, id:`stock-${h.ticker}`, hint:h.ticker })),
];

function CmdPalette({ onNav, onClose, onAction }) {
  const [q, setQ] = React.useState('');
  const inp = React.useRef(null);
  React.useEffect(() => { inp.current?.focus(); }, []);
  const filtered = q.trim()
    ? CMD_ITEMS.filter(i => i.label.toLowerCase().includes(q.toLowerCase()) || i.hint.toLowerCase().includes(q.toLowerCase()))
    : CMD_ITEMS.slice(0, 8);

  function handleSelect(item) {
    if (item.type === 'page' || item.type === 'stock') onNav(item.id);
    else onAction(item.hint);
    onClose();
  }

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-box" onClick={e => e.stopPropagation()}>
        <div className="cmd-input-row">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--fg3)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input ref={inp} className="cmd-input" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search pages, holdings, actions…"
            onKeyDown={e => e.key === 'Escape' && onClose()} />
          <span className="cmd-esc">ESC</span>
        </div>
        <div className="cmd-results">
          {filtered.length === 0 && <div className="cmd-empty">No results for "{q}"</div>}
          {filtered.map((item, i) => (
            <button key={i} className="cmd-item" onClick={() => handleSelect(item)}>
              <span className={`cmd-type cmd-type-${item.type}`}>{item.type}</span>
              <span className="cmd-label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function loadPortfolio() {
  try {
    const saved = localStorage.getItem('torii-portfolio');
    return saved ? JSON.parse(saved) : MOCK.portfolio;
  } catch { return MOCK.portfolio; }
}
function savePortfolio(p) {
  try { localStorage.setItem('torii-portfolio', JSON.stringify(p)); } catch {}
}

function App() {
  const [page,      setPage]     = React.useState(() => localStorage.getItem('tpage')  || 'overview');
  const [theme,     setTheme]    = React.useState(() => localStorage.getItem('ttheme') || 'ember');
  const [notifs,    setNotifs]   = React.useState(MOCK.notifications);
  const [tasks,     setTasks]    = React.useState(MOCK.tasks);
  const [notifOpen, setNOpen]    = React.useState(false);
  const [cmdOpen,   setCmdOpen]  = React.useState(false);
  const [collapsed, setCollapse] = React.useState(false);
  const [tweaksOpen, setTweaks]  = React.useState(false);
  const [portfolio, setPortfolioState] = React.useState(loadPortfolio);

  function setPortfolio(p) {
    const next = typeof p === 'function' ? p(portfolio) : p;
    setPortfolioState(next);
    savePortfolio(next);
  }

  // Apply theme to <html>
  React.useEffect(() => {
    document.documentElement.className = theme === 'liquid' ? 'liquid' : '';
    localStorage.setItem('ttheme', theme);
  }, [theme]);

  React.useEffect(() => { localStorage.setItem('tpage', page); }, [page]);

  // ⌘K shortcut
  React.useEffect(() => {
    function handler(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o); }
      if (e.key === 'Escape') { setNOpen(false); setCmdOpen(false); }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close notif on outside click
  React.useEffect(() => {
    if (!notifOpen) return;
    const h = () => setNOpen(false);
    setTimeout(() => document.addEventListener('click', h), 50);
    return () => document.removeEventListener('click', h);
  }, [notifOpen]);

  function addTask(text) {
    setTasks(p => [...p, { id: Date.now(), text, done:false, auto:false, priority:'low' }]);
  }
  function toggleTask(id) {
    setTasks(p => p.map(t => t.id===id ? {...t,done:!t.done} : t));
  }
  function handleCmdAction(hint) {
    if (hint==='theme') setTheme(t => t==='ember'?'liquid':'ember');
    if (hint==='notifs') setNotifs(p => p.map(n => ({...n,read:true})));
    if (hint==='tasks') setTasks(p => p.map(t => ({...t,done:true})));
  }

  const unread = notifs.filter(n => !n.read).length;

  // Tweaks host protocol
  React.useEffect(() => {
    window.addEventListener('message', e => {
      if (e.data?.type === '__activate_edit_mode')   setTweaks(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaks(false);
    });
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
  }, []);

  // Apply tweaks from TWEAK_DEFAULTS
  React.useEffect(() => {
    const td = window.TWEAK_DEFAULTS || {};
    if (td.theme && td.theme !== theme) setTheme(td.theme);
    const root = document.documentElement;
    const ac = td.accent || 'red';
    root.style.setProperty('--red', ac==='blue'?'#0A84FF':ac==='amber'?'#F59E0B':'#E0001E');
    root.style.setProperty('--red-dim', ac==='blue'?'rgba(10,132,255,0.15)':ac==='amber'?'rgba(245,158,11,0.15)':'rgba(224,0,30,0.15)');
    root.style.setProperty('--font-density', td.density==='compact' ? 'compact' : 'comfortable');
    const density = td.density === 'compact';
    root.style.setProperty('--card-pad',    density ? '13px 15px' : '18px 20px');
    root.style.setProperty('--card-radius', density ? '10px' : '14px');
  }, []);

  return (
    <div className="app-shell">
      <Topbar
        theme={theme}
        onTheme={() => setTheme(t => t==='ember'?'liquid':'ember')}
        notifCount={unread}
        notifOpen={notifOpen}
        onNotif={e => { e.stopPropagation(); setNOpen(o => !o); }}
      />

      {notifOpen && (
        <NotifPanel
          notifs={notifs}
          onMarkRead={() => setNotifs(p => p.map(n => ({...n,read:true})))}
          onClose={() => setNOpen(false)}
        />
      )}

      {cmdOpen && (
        <CmdPalette
          onNav={p => { setPage(p); setCmdOpen(false); }}
          onClose={() => setCmdOpen(false)}
          onAction={handleCmdAction}
        />
      )}

      <Sidebar
        page={page} onNav={setPage}
        tasks={tasks} onAddTask={addTask} onToggleTask={toggleTask}
        collapsed={collapsed} onCollapse={() => setCollapse(o => !o)}
      />

      <main className="main-scroll">
        {page==='overview'  && <OverviewPage  onNav={setPage} />}
        {page==='portfolio' && <PortfolioPage onNav={setPage} />}
        {page==='japan'     && <JapanPage />}
        {page==='news'      && <NewsPage />}
        {page==='voices'    && <VoicesPage />}
        {page==='network'   && <NetworkingPage />}
        {page==='projects'  && <ProjectsPage />}
        {page.startsWith('stock-') && <StockPage ticker={page.replace('stock-','')} onBack={() => setPage('portfolio')} />}
      </main>

      {/* ⌘K hint */}
      <button className="cmd-hint" onClick={() => setCmdOpen(true)} title="Command palette (⌘K)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <span>⌘K</span>
      </button>

      {/* Tweaks panel */}
      {tweaksOpen && <TweaksPanel theme={theme} onTheme={setTheme} onClose={() => setTweaks(false)} />}
    </div>
  );
}

// ─── Tweaks Panel ─────────────────────────────────────────────────────────────

function TweaksPanel({ theme, onTheme, onClose }) {
  const td = window.TWEAK_DEFAULTS || {};
  const [accent, setAccent] = React.useState(td.accent || 'red');
  const [density, setDensity] = React.useState(td.density || 'comfortable');

  function applyAccent(a) {
    setAccent(a);
    const root = document.documentElement;
    root.style.setProperty('--red', a==='blue'?'#0A84FF':a==='amber'?'#F59E0B':'#E0001E');
    root.style.setProperty('--red-dim', a==='blue'?'rgba(10,132,255,0.15)':a==='amber'?'rgba(245,158,11,0.15)':'rgba(224,0,30,0.15)');
    window.parent.postMessage({ type:'__edit_mode_set_keys', edits:{ accent:a } }, '*');
  }
  function applyDensity(d) {
    setDensity(d);
    document.documentElement.style.setProperty('--card-pad', d==='compact'?'13px 15px':'18px 20px');
    document.documentElement.style.setProperty('--card-radius', d==='compact'?'10px':'14px');
    window.parent.postMessage({ type:'__edit_mode_set_keys', edits:{ density:d } }, '*');
  }

  return (
    <div className="tweaks-panel">
      <div className="tweaks-head">
        <span>Tweaks</span>
        <button onClick={onClose} className="tweaks-close">✕</button>
      </div>
      <div className="tweaks-row">
        <span className="tweaks-label">Theme</span>
        <div className="tweaks-opts">
          {['ember','liquid'].map(t => (
            <button key={t} className={`tweak-btn ${theme===t?'active':''}`} onClick={() => { onTheme(t); window.parent.postMessage({type:'__edit_mode_set_keys',edits:{theme:t}},'*'); }}>
              {t === 'ember' ? '⛩ Ember' : '☀︎ Liquid'}
            </button>
          ))}
        </div>
      </div>
      <div className="tweaks-row">
        <span className="tweaks-label">Accent</span>
        <div className="tweaks-opts">
          {[['red','#E0001E'],['blue','#0A84FF'],['amber','#F59E0B']].map(([k,v]) => (
            <button key={k} className={`tweak-color ${accent===k?'active':''}`}
              style={{'--tc': v}} onClick={() => applyAccent(k)}>
              <span className="tweak-swatch" style={{ background: v }} />
              {k.charAt(0).toUpperCase()+k.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="tweaks-row">
        <span className="tweaks-label">Density</span>
        <div className="tweaks-opts">
          {['comfortable','compact'].map(d => (
            <button key={d} className={`tweak-btn ${density===d?'active':''}`} onClick={() => applyDensity(d)}>
              {d.charAt(0).toUpperCase()+d.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { App, Sidebar, Topbar, ToriiLogo });
