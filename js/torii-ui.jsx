// ─── TORII SHARED UI COMPONENTS ──────────────────────────────────────────────
// Utilities, charts, and small reusable components

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtPrice(n, dec) {
  if (n == null || isNaN(n)) return '—';
  const d = dec != null ? dec : (n >= 1000 ? 0 : n >= 100 ? 2 : 2);
  if (n >= 10000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtPct(n) {
  if (n == null) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function pctColor(n, invert = false) {
  if (n == null) return 'var(--fg3)';
  const pos = invert ? n < 0 : n >= 0;
  return pos ? 'var(--green)' : 'var(--red-loss)';
}

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function simpleMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, height = 28, width = 72, color = '#22C55E' }) {
  if (!data || data.length < 2) return <div style={{ height, width }} />;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const toX = i => (i / (data.length - 1)) * width;
  const toY = v => height - 2 - ((v - min) / range) * (height - 6);
  const pts = data.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`);
  const line = `M ${pts.join(' L ')}`;
  const area = `M ${toX(0).toFixed(1)},${height} L ${pts.join(' L ')} L ${toX(data.length-1).toFixed(1)},${height} Z`;
  const gid = `sp_${Math.random().toString(36).substr(2,6)}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display:'block', flexShrink:0 }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Area Chart ──────────────────────────────────────────────────────────────

// Format a timestamp label based on how wide the date range is
function fmtChartLabel(isoStr, rangeHours) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d)) return '';
  if (rangeHours <= 30) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  if (rangeHours <= 8 * 24) {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  if (rangeHours <= 95 * 24) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function fmtYLabel(v, data) {
  if (v == null) return '';
  const max = Math.max(...data);
  if (max >= 10000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (max >= 100)   return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function AreaChart({ data, labels, height = 160, color, showDates = true, showAxes = true }) {
  if (!data || data.length < 2) {
    return <div className="skeleton" style={{ height, borderRadius: 8 }} />;
  }

  const isUp = data[data.length - 1] >= data[0];
  const usedColor = color || (isUp ? '#22C55E' : '#FF6B6B');

  const minRaw = Math.min(...data);
  const maxRaw = Math.max(...data);
  const pad = (maxRaw - minRaw) * 0.05 || maxRaw * 0.01;
  const min = minRaw - pad;
  const max = maxRaw + pad;
  const range = max - min || 1;

  // Chart SVG dimensions
  const W = 700;
  const H = height - (showDates && labels?.length ? 22 : 4);

  const toX = i => (i / (data.length - 1)) * W;
  const toY = v => H - 2 - ((v - min) / range) * (H - 4);

  const pts = data.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`);
  const line = `M ${pts.join(' L ')}`;
  const area = `M 0,${H} L ${pts.join(' L ')} L ${W},${H} Z`;

  // Y-axis: 4 horizontal guide lines + price labels
  const yLevels = [0, 0.33, 0.67, 1].map(f => min + range * f);

  // X-axis: up to 5 evenly spaced labels
  const n = data.length;
  const numXLabels = Math.min(5, n);
  const xIdxs = Array.from({ length: numXLabels }, (_, k) =>
    Math.round(k * (n - 1) / (numXLabels - 1))
  );

  // Detect range span for label formatting
  let rangeHours = 720; // default 1 month
  if (labels && labels.length >= 2) {
    const t0 = new Date(labels[0]), t1 = new Date(labels[labels.length - 1]);
    if (!isNaN(t0) && !isNaN(t1)) rangeHours = (t1 - t0) / 3600000;
  }

  const gid = `acg_${Math.abs(Math.round(data[0] * 100))}`;

  return (
    <div style={{ width: '100%', userSelect: 'none', position: 'relative' }}>
      {/* Y-axis price labels (overlaid on left side) */}
      {showAxes && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: showDates && labels?.length ? 22 : 4,
          width: 56, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          pointerEvents: 'none', paddingBottom: 2,
        }}>
          {[...yLevels].reverse().map((v, i) => (
            <span key={i} style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg3)',
              letterSpacing: '0.03em', lineHeight: 1,
            }}>
              {fmtYLabel(v, data)}
            </span>
          ))}
        </div>
      )}

      {/* Chart area (left-padded when axes shown) */}
      <div style={{ marginLeft: showAxes ? 58 : 0 }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
          style={{ width: '100%', height: H, display: 'block' }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={usedColor} stopOpacity="0.3" />
              <stop offset="85%" stopColor={usedColor} stopOpacity="0.04" />
              <stop offset="100%" stopColor={usedColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Horizontal guide lines */}
          {showAxes && yLevels.map((v, i) => (
            <line key={i}
              x1="0" y1={toY(v).toFixed(1)} x2={W} y2={toY(v).toFixed(1)}
              stroke="var(--bdr)" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.5"
            />
          ))}
          <path d={area} fill={`url(#${gid})`} />
          <path d={line} stroke={usedColor} strokeWidth="2" fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
          {/* Last price dot */}
          <circle cx={toX(data.length - 1).toFixed(1)} cy={toY(data[data.length - 1]).toFixed(1)}
            r="3" fill={usedColor} />
        </svg>

        {/* X-axis date labels */}
        {showDates && labels && labels.length >= 2 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
            {xIdxs.map(i => (
              <span key={i} style={{
                fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg3)',
                letterSpacing: '0.03em',
              }}>
                {fmtChartLabel(labels[i], rangeHours)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, price, pct, dec, invert, tag, accent }) {
  const color = pctColor(pct, invert);
  const isUp = invert ? (pct||0) < 0 : (pct||0) >= 0;
  return (
    <div className={`stat-card ${accent ? 'accent' : ''}`}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
        <span className="stat-label">{label}</span>
        {tag && <span className="tag">{tag}</span>}
      </div>
      {price != null
        ? <div className="stat-value">{fmtPrice(price, dec)}</div>
        : <div className="skeleton" style={{ height:22, width:'60%', marginBottom:4 }} />}
      {pct != null
        ? <div className="stat-change" style={{ color }}>
            {isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
          </div>
        : <div className="skeleton" style={{ height:12, width:'40%' }} />}
    </div>
  );
}

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source, category }) {
  const cls = category === 'japan' ? 'sb-japan' : category === 'market' ? 'sb-market' : category === 'macro' ? 'sb-macro' : '';
  return <span className={`source-badge ${cls}`}>{source}</span>;
}

// ─── Importance indicator ─────────────────────────────────────────────────────

function ImpBadge({ importance }) {
  if (!importance || importance === 'low') return null;
  return (
    <span className={`imp-badge ${importance}`}>
      {importance === 'high' ? 'HIGH' : 'MED'}
    </span>
  );
}

// ─── Tweet Card ───────────────────────────────────────────────────────────────

function TweetCard({ tweet, compact }) {
  return (
    <div className={`tweet-card ${compact ? 'compact' : ''}`}>
      <div className="tweet-head">
        <div className="tweet-avatar" style={{ background: tweet.color }}>
          {tweet.initials}
        </div>
        <div className="tweet-meta">
          <span className="tweet-name">{tweet.name}</span>
          <span className="tweet-handle">@{tweet.handle}</span>
        </div>
        <span className="tweet-time">{tweet.time}</span>
      </div>
      <p className="tweet-body">{tweet.text}</p>
      <div className="tweet-actions">
        <span>💬 {tweet.replies}</span>
        <span>↗ {tweet.retweets}</span>
        <span>♡ {tweet.likes}</span>
        <a href={`https://x.com/${tweet.handle}`} target="_blank" rel="noopener" className="tweet-link">
          View on X ↗
        </a>
      </div>
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children, action, onAction }) {
  return (
    <div className="section-label-row">
      <span className="section-label">{children}</span>
      {action && <button className="section-action" onClick={onAction}>{action}</button>}
    </div>
  );
}

// ─── Skeleton block ───────────────────────────────────────────────────────────

function Skel({ w, h, r }) {
  return <div className="skeleton" style={{ width: w||'100%', height: h||12, borderRadius: r||6 }} />;
}

// ─── Export ───────────────────────────────────────────────────────────────────
Object.assign(window, {
  fmtPrice, fmtPct, pctColor, timeAgo, simpleMarkdown,
  Sparkline, AreaChart, StatCard, SourceBadge, ImpBadge, TweetCard, SectionLabel, Skel,
});
