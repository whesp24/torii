// ─── TORII SHELL: App, Sidebar, Topbar, Notifications, Tasks, CmdPalette ──────

const SHELL_API = 'https://torii-backend.onrender.com/api';

const NAV = [
  { id:'overview',   label:'Markets',   icon:'markets'   },
  { id:'briefing',   label:'Briefing',  icon:'briefing'  },
  { id:'portfolio',  label:'Portfolio', icon:'portfolio' },
  { id:'japan',      label:'Japan',     icon:'japan'     },
  { id:'news',       label:'News',      icon:'news'      },
  { id:'voices',     label:'Voices',    icon:'voices'    },
  { id:'network',    label:'Network',   icon:'network'   },
  { id:'watchlist',  label:'Watchlist', icon:'watchlist' },
  { id:'alerts',     label:'Alerts',    icon:'alerts'    },
  { id:'earnings',   label:'Earnings',  icon:'earnings'  },
  { id:'ecocal',     label:'Calendar',  icon:'calendar'  },
  { id:'tools',      label:'Tools',     icon:'tools'     },
  { id:'analytics',  label:'Analytics', icon:'analytics' },
  { id:'push',       label:'Notify',    icon:'push'      },
  { id:'assistant',  label:'AI',        icon:'assistant' },
  { id:'notes',      label:'Notes',     icon:'notes'     },
  { id:'deals',      label:'Deals',     icon:'deals'     },
  { id:'meetings',   label:'Meetings',  icon:'meetings'  },
  { id:'journal',    label:'Journal',   icon:'journal'   },
  { id:'sentiment',  label:'Sentiment', icon:'sentiment' },
  { id:'scenario',   label:'Scenario',  icon:'scenario'  },
  { id:'macro',      label:'Macro',     icon:'macro'     },
  { id:'watchintel', label:'WL Intel',  icon:'watchintel'},
  { id:'insider',    label:'Insider',   icon:'insider'   },
  { id:'attribution',label:'Attribution',icon:'attribution'},
  { id:'research',   label:'Research',  icon:'research'  },
];

// Bottom nav items (mobile — first 4 + More)
const MOBILE_NAV = ['overview','portfolio','japan','news'];
const MORE_NAV   = ['briefing','voices','network','watchlist','alerts','earnings','ecocal','tools','analytics','push','assistant','notes','deals','meetings','journal','sentiment','scenario','macro','watchintel','insider','attribution','research'];

// ─── Icons ────────────────────────────────────────────────────────────────────

function NavIcon({ id, active }) {
  const c = active ? 'var(--red)' : 'var(--fg3)';
  const s = { width:18, height:18 };
  if (id==='markets')   return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>;
  if (id==='briefing')  return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
  if (id==='portfolio') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>;
  if (id==='japan')     return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M5 6V4h14v2"/><path d="M8 6v12"/><path d="M16 6v12"/><path d="M3 18h18"/></svg>;
  if (id==='news')      return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>;
  if (id==='voices')    return <svg {...s} viewBox="0 0 24 24" fill={active?'var(--red)':'var(--fg3)'} stroke="none"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
  if (id==='network')   return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2.5"/><circle cx="4.5" cy="19" r="2"/><circle cx="19.5" cy="19" r="2"/><path d="M12 7.5v4l-5.5 5M12 11.5l5.5 5"/></svg>;
  if (id==='watchlist') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
  if (id==='alerts')    return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="12" y1="2" x2="12" y2="4"/></svg>;
  if (id==='earnings')  return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="5"/><line x1="8" y1="2" x2="8" y2="5"/><line x1="2" y1="10" x2="22" y2="10"/><polyline points="8 14 10 16 16 12"/></svg>;
  if (id==='calendar')  return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="5"/><line x1="8" y1="2" x2="8" y2="5"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M7 14h1m4 0h1m4 0h1M7 18h1m4 0h1"/></svg>;
  if (id==='tools')     return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>;
  if (id==='analytics') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="2" y="13" width="4" height="8" rx="1"/></svg>;
  if (id==='push')      return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
  if (id==='assistant') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h8M8 14h5"/></svg>;
  if (id==='notes')     return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>;
  if (id==='deals')     return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
  if (id==='meetings')  return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="5"/><line x1="8" y1="2" x2="8" y2="5"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M12 14v4m-2-2h4"/></svg>;
  if (id==='journal')   return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="10" y1="7" x2="16" y2="7"/><line x1="10" y1="11" x2="16" y2="11"/><line x1="10" y1="15" x2="14" y2="15"/></svg>;
  if (id==='sentiment') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>;
  if (id==='scenario')    return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
  if (id==='macro')       return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20"/><path d="M6 20V10"/><path d="M10 20V4"/><path d="M14 20V14"/><path d="M18 20V8"/></svg>;
  if (id==='watchintel')  return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/><circle cx="12" cy="12" r="3"/></svg>;
  if (id==='insider')     return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (id==='attribution') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>;
  if (id==='research')    return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
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
  const [liveChips, setLiveChips] = React.useState([]);

  React.useEffect(() => {
    // Fetch live KPIs then refresh every 5 minutes
    const load = () => fetch(`${SHELL_API}/kpis`)
      .then(r => r.ok ? r.json() : [])
      .then(kpis => {
        if (kpis && kpis.length > 0) {
          setLiveChips(kpis.map(k => ({
            label: k.label || k.symbol,
            price: fmtPrice(k.price, k.price > 100 ? 0 : 2),
            pct: `${(k.changePercent||0) >= 0 ? '+' : ''}${(k.changePercent||0).toFixed(2)}%`,
            up: (k.changePercent||0) >= 0
          })));
        }
      }).catch(() => {});
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // Fall back to mock while loading
  const allQ = [...MOCK.japan, ...MOCK.macro];
  const mockChips = allQ.map(q => {
    const up = q.invert ? q.pct < 0 : q.pct >= 0;
    return { label: q.label, price: fmtPrice(q.price, q.dec), pct: `${q.pct >= 0 ? '+' : ''}${q.pct.toFixed(2)}%`, up };
  });
  const chips = liveChips.length > 0 ? liveChips : mockChips;

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

// ─── Floating Tasks Widget ────────────────────────────────────────────────────

function FloatingTasks({ tasks, onAddTask, onToggleTask }) {
  const [open,      setOpen]      = React.useState(false);
  const [taskInput, setTaskInput] = React.useState('');
  const todoCount = tasks.filter(t => !t.done).length;

  const tagColors = {
    fed:'#F59E0B', boj:'#EF4444', macro:'#8B5CF6',
    earnings:'#3B82F6', alert:'#FF6B6B', routine:'var(--fg3)',
  };

  function handleAdd(e) {
    e.preventDefault();
    if (taskInput.trim()) { onAddTask(taskInput.trim()); setTaskInput(''); }
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      zIndex: 200,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
    }}>
      {/* Expanded panel */}
      {open && (
        <div style={{
          width: 300, maxHeight: 420,
          background: 'var(--bg)', border: '1px solid var(--bdr)', borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--bdr)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Tasks</span>
              {todoCount > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, background: 'var(--red)', color: 'white', borderRadius: 10, padding: '1px 6px', fontFamily: 'var(--font-mono)' }}>{todoCount}</span>
              )}
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg3)', fontSize: 16, lineHeight: 1 }}>✕</button>
          </div>
          {/* Task list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
            {tasks.length === 0 && (
              <div style={{ padding: '8px 6px', color: 'var(--fg3)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>Loading events…</div>
            )}
            {tasks.map(t => {
              const tagColor = t.tag ? (tagColors[t.tag] || 'var(--fg3)') : null;
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px', borderRadius: 7,
                  opacity: t.done ? 0.45 : 1, transition: 'opacity 0.2s' }}>
                  <button onClick={() => onToggleTask(t.id)} style={{
                    width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${t.done ? 'var(--green)' : 'var(--bdr)'}`,
                    background: t.done ? 'var(--green)' : 'transparent', flexShrink: 0, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {t.done && <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="2,6 5,9 10,3"/></svg>}
                  </button>
                  <span style={{ flex: 1, fontSize: 12, color: t.priority === 'high' ? 'var(--red)' : 'var(--fg2)',
                    textDecoration: t.done ? 'line-through' : 'none', lineHeight: 1.4 }}>{t.text}</span>
                  {t.tag && tagColor && (
                    <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700, color: tagColor,
                      border: `1px solid ${tagColor}`, borderRadius: 3, padding: '1px 4px', flexShrink: 0,
                      textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.85 }}>{t.tag}</span>
                  )}
                </div>
              );
            })}
          </div>
          {/* Add task */}
          <form onSubmit={handleAdd} style={{ padding: '8px 10px', borderTop: '1px solid var(--bdr)', display: 'flex', gap: 6 }}>
            <input value={taskInput} onChange={e => setTaskInput(e.target.value)} placeholder="+ Add task…"
              style={{ flex: 1, padding: '6px 10px', background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 7,
                fontSize: 12, color: 'var(--fg)', outline: 'none', fontFamily: 'inherit' }} />
            <button type="submit" style={{ padding: '6px 10px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+</button>
          </form>
        </div>
      )}

      {/* Toggle pill */}
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 16px', background: 'var(--bg)', border: '1px solid var(--bdr)', borderRadius: 24,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)', cursor: 'pointer', color: 'var(--fg)',
        fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
        textTransform: 'uppercase', transition: 'all 0.15s',
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        Tasks
        {todoCount > 0 && (
          <span style={{ fontSize: 10, fontWeight: 800, background: 'var(--red)', color: 'white', borderRadius: 10, padding: '1px 6px', marginLeft: 2 }}>{todoCount}</span>
        )}
      </button>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ page, onNav, collapsed, onCollapse }) {
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
      <div className="sidebar-section nav-section">
        {!collapsed && <div className="sidebar-section-label">VIEWS</div>}
        {NAV.map(({ id, label, icon }) => (
          <button key={id} className={`nav-item${page===id?' active':''}`} onClick={() => onNav(id)}>
            <span className="nav-icon"><NavIcon id={icon} active={page===id} /></span>
            {!collapsed && <span className="nav-label">{label}</span>}
          </button>
        ))}
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="sidebar-footer">Yahoo Finance · NHK · Reuters</div>
      )}
    </aside>
  );
}

function SidebarHoldings({ page, onNav, collapsed }) {
  const [holdings, setHoldings] = React.useState([]);

  React.useEffect(() => {
    // Fetch from backend so sidebar stays in sync across devices
    fetch(`${SHELL_API}/positions`)
      .then(r => r.ok ? r.json() : [])
      .then(positions => {
        if (!positions.length) { setHoldings([]); return; }
        Promise.all(positions.slice(0, 8).map(p =>
          fetch(`${SHELL_API}/stocks/live/${p.ticker}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
            .then(d => ({ ticker: p.ticker, shares: p.shares, price: d?.price || 0, pct: d?.changePercent || 0 }))
        )).then(setHoldings);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="sidebar-section sidebar-scroll-section">
      {!collapsed && <div className="sidebar-section-label">HOLDINGS</div>}
      <div className="holdings-scroller">
        {holdings.length === 0 && !collapsed && (
          <div style={{padding:'8px 12px',fontSize:10,color:'var(--fg3)',fontFamily:'var(--font-mono)'}}>
            Add positions in Portfolio tab
          </div>
        )}
        {holdings.map(h => {
          const up = h.pct >= 0;
          const color = up ? 'var(--green)' : 'var(--red-loss)';
          return (
            <button key={h.ticker} className={`nav-item holding-row${page===`stock-${h.ticker}`?' active':''}`}
              onClick={() => onNav(`stock-${h.ticker}`)}>
              <div className="holding-left">
                <span className="holding-ticker">{h.ticker}</span>
                {!collapsed && <span className="holding-shares">{h.shares}sh</span>}
              </div>
              {!collapsed && (
                <div className="holding-right" style={{ color }}>
                  <span className="holding-price">${(h.price||0).toFixed(2)}</span>
                  <span className="holding-pct">{up?'+':''}{(h.pct||0).toFixed(2)}%</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
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

// ─── Mobile Ticker Strip ─────────────────────────────────────────────────────

function MobileTicker() {
  const [chips, setChips] = React.useState([]);
  React.useEffect(() => {
    fetch(`${SHELL_API}/kpis`).then(r => r.ok ? r.json() : []).then(kpis => {
      if (kpis?.length) setChips(kpis.map(k => ({
        label: k.label || k.symbol,
        price: fmtPrice(k.price, k.price > 100 ? 0 : 2),
        pct: `${(k.changePercent||0) >= 0 ? '+' : ''}${(k.changePercent||0).toFixed(2)}%`,
        up: (k.changePercent||0) >= 0,
      })));
    }).catch(() => {});
  }, []);
  if (chips.length === 0) return null;
  return (
    <div className="mobile-ticker">
      {chips.map((c, i) => (
        <div key={i} className="mobile-ticker-chip">
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg3)', fontWeight: 700, letterSpacing: '0.06em' }}>{c.label}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>{c.price}</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: c.up ? 'var(--green)' : 'var(--red-loss)' }}>{c.pct}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Mobile Nav + More Sheet ──────────────────────────────────────────────────

function MobileNavIcon({ id, active }) {
  const c = active ? 'var(--red)' : 'var(--fg3)';
  const s = { width: 22, height: 22 };
  if (id==='overview')  return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>;
  if (id==='portfolio') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>;
  if (id==='japan')     return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M5 6V4h14v2"/><path d="M8 6v12"/><path d="M16 6v12"/><path d="M3 18h18"/></svg>;
  if (id==='news')      return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>;
  if (id==='more')      return <svg {...s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>;
  return <NavIcon id={id} active={active} />;
}

function MoreSheet({ page, onNav, onClose }) {
  const items = MORE_NAV.map(id => NAV.find(n => n.id === id)).filter(Boolean);
  return (
    <>
      <div className="more-sheet-overlay" onClick={onClose} />
      <div className="more-sheet">
        <div className="more-sheet-handle" />
        <div className="more-sheet-grid">
          {items.map(({ id, label, icon }) => (
            <button key={id} className={`more-sheet-item${page===id?' active':''}`}
              onClick={() => { onNav(id); onClose(); }}>
              <NavIcon id={icon} active={page===id} />
              <span className="more-sheet-item-label">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function MobileNav({ page, onNav }) {
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreActive = MORE_NAV.includes(page);

  return (
    <nav className="mobile-nav">
      <div className="mobile-nav-inner">
        {MOBILE_NAV.map(id => {
          const item = NAV.find(n => n.id === id);
          return (
            <button key={id} className={`mobile-nav-btn${page===id?' active':''}`}
              onClick={() => onNav(id)}>
              <MobileNavIcon id={id} active={page===id} />
              <span className="mobile-nav-label">{item?.label}</span>
            </button>
          );
        })}
        <button className={`mobile-nav-btn${moreActive?' active':''}`}
          onClick={() => setMoreOpen(o => !o)}>
          <MobileNavIcon id="more" active={moreActive} />
          <span className="mobile-nav-label">More</span>
        </button>
      </div>
      {moreOpen && <MoreSheet page={page} onNav={onNav} onClose={() => setMoreOpen(false)} />}
    </nav>
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
  const [tasks,     setTasks]    = React.useState([]);
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

  // Fetch smart tasks from API on load (and when Render wakes)
  React.useEffect(() => {
    function loadSmartTasks() {
      fetch(`${SHELL_API}/tasks/smart`)
        .then(r => r.ok ? r.json() : [])
        .then(smart => {
          if (!Array.isArray(smart) || smart.length === 0) return;
          // Map smart tasks to sidebar format, preserve any user-added manual tasks
          setTasks(prev => {
            const manualIds = new Set(smart.map(t => t.id));
            const manual = prev.filter(t => !t.auto && !manualIds.has(t.id));
            return [...smart, ...manual];
          });
        })
        .catch(() => {});
    }
    loadSmartTasks();
    window.addEventListener('render-awake', loadSmartTasks);
    return () => window.removeEventListener('render-awake', loadSmartTasks);
  }, []);

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
    const newTask = { id: `manual-${Date.now()}`, text, done: false, auto: false, priority: 'low' };
    setTasks(p => [...p, newTask]);
    // Also save to backend
    fetch(`${SHELL_API}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: text, priority: 'low', category: 'manual' })
    }).catch(() => {});
  }
  function toggleTask(id) {
    setTasks(p => p.map(t => t.id === id ? { ...t, done: !t.done } : t));
    // Persist to backend if it's a DB task (MongoDB _id is 24 chars hex)
    if (/^[a-f0-9]{24}$/.test(String(id))) {
      fetch(`${SHELL_API}/tasks/${id}/toggle`, { method: 'PATCH' }).catch(() => {});
    }
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
        collapsed={collapsed} onCollapse={() => setCollapse(o => !o)}
      />

      <FloatingTasks tasks={tasks} onAddTask={addTask} onToggleTask={toggleTask} />

      {/* Mobile ticker strip — shown below topbar on phones */}
      <MobileTicker />

      <main className="main-scroll">
        {page==='overview'   && <OverviewPage  onNav={setPage} />}
        {page==='briefing'   && <BriefingPage />}
        {page==='portfolio'  && <PortfolioPage onNav={setPage} />}
        {page==='japan'      && <JapanPage onNav={setPage} />}
        {page==='news'       && <NewsPage />}
        {page==='voices'     && <VoicesPage />}
        {page==='network'    && <NetworkingPage />}
        {page==='watchlist'  && <WatchlistPage />}
        {page==='alerts'     && <AlertsPanel />}
        {page==='earnings'   && <EarningsPage defaultTab="earnings" />}
        {page==='ecocal'     && <EarningsPage defaultTab="ecocal" />}
        {page==='tools'      && <ToolsPage />}
        {page==='analytics'  && <AnalyticsPage />}
        {page==='push'       && <PushSettingsPage />}
        {page==='assistant'  && <AssistantPage />}
        {page==='notes'      && <NotesPage />}
        {page==='deals'      && <DealsPage />}
        {page==='meetings'   && <MeetingsPage />}
        {page==='journal'     && <JournalPage />}
        {page==='sentiment'   && <SentimentPage />}
        {page==='scenario'    && <ScenarioPage />}
        {page==='macro'       && <MacroPage />}
        {page==='watchintel'  && <WatchlistIntelPage />}
        {page==='insider'     && <InsiderPage />}
        {page==='attribution' && <AttributionPage />}
        {page==='research'    && <ResearchPage />}
        {page.startsWith('stock-') && <StockPage ticker={page.replace('stock-','')} onBack={() => setPage('portfolio')} />}
      </main>

      <MobileNav page={page} onNav={setPage} />

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
