// ─── PROJECTS PAGE ───────────────────────────────────────────────────────────

const PROJECT_STATUSES = [
  { id: 'active',    label: 'Active',    color: 'var(--green)'  },
  { id: 'paused',    label: 'Paused',    color: 'var(--amber)'  },
  { id: 'completed', label: 'Completed', color: 'var(--blue)'   },
  { id: 'archived',  label: 'Archived',  color: 'var(--fg3)'    },
];

const PROJECT_CATEGORIES = ['Research','Investment Thesis','Networking','Operations','Personal','Market Analysis'];

function loadProjects() {
  try { return JSON.parse(localStorage.getItem('torii-projects') || 'null') || DEFAULT_PROJECTS; } catch { return DEFAULT_PROJECTS; }
}
function saveProjects(p) {
  try { localStorage.setItem('torii-projects', JSON.stringify(p)); } catch {}
}

const DEFAULT_PROJECTS = [
  {
    id: 1,
    name: 'Japan Market Entry Research',
    description: 'Explore investment opportunities in the Japanese financial sector post-BOJ normalization.',
    status: 'active',
    category: 'Research',
    contactIds: [],
    milestones: [
      { id: 1, text: 'Research BOJ policy trajectory and implications',      done: true  },
      { id: 2, text: 'Map key institutional players in Tokyo equity market',   done: true  },
      { id: 3, text: 'Identify 10 potential networking contacts',              done: false },
      { id: 4, text: 'Set up 3 introductory calls via LinkedIn',              done: false },
      { id: 5, text: 'Draft initial investment thesis document',              done: false },
    ],
    notes: 'Focus on financials and exporters. USD/JPY trajectory is key catalyst.',
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 2,
    name: 'Portfolio Rebalancing Q2',
    description: 'Reassess allocations after CRCL drawdown and Nikkei run-up. Consider trimming Japan ETF exposure.',
    status: 'active',
    category: 'Investment Thesis',
    contactIds: [],
    milestones: [
      { id: 1, text: 'Review all positions vs cost basis',                    done: true  },
      { id: 2, text: 'Run Monte Carlo on portfolio with new CRCL weight',     done: false },
      { id: 3, text: 'Research CRCL fundamentals — thesis still intact?',     done: false },
      { id: 4, text: 'Decide on QXO position — cut or hold',                 done: false },
    ],
    notes: '',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

// ─── Milestone Checklist ──────────────────────────────────────────────────────

function MilestoneList({ milestones, onToggle, onAdd, onDelete }) {
  const [input, setInput] = React.useState('');
  const done = milestones.filter(m => m.done).length;
  const pct  = milestones.length ? Math.round((done / milestones.length) * 100) : 0;

  function handleAdd(e) {
    e.preventDefault();
    if (input.trim()) { onAdd(input.trim()); setInput(''); }
  }

  return (
    <div>
      {/* Progress bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg3)', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Progress · {done}/{milestones.length}
        </span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
          color: pct === 100 ? 'var(--green)' : 'var(--fg2)' }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: 'var(--bdr)', borderRadius: 4, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{
          height: 4, width: `${pct}%`, borderRadius: 4,
          background: pct === 100 ? 'var(--green)' : 'var(--red)',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Milestone items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {milestones.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 2px',
            borderRadius: 6, transition: 'background 0.1s' }}
            className="task-item">
            <button className={`task-check${m.done ? ' checked' : ''}`} onClick={() => onToggle(m.id)}
              style={{ marginTop: 1 }}>
              {m.done && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="2,6 5,9 10,3"/>
                </svg>
              )}
            </button>
            <span style={{
              fontSize: 12, color: m.done ? 'var(--fg3)' : 'var(--fg2)',
              textDecoration: m.done ? 'line-through' : 'none',
              flex: 1, lineHeight: 1.4,
            }}>{m.text}</span>
            <button onClick={() => onDelete(m.id)}
              style={{ background: 'none', border: 'none', color: 'var(--fg3)', cursor: 'pointer',
                fontSize: 14, lineHeight: 1, padding: '0 2px', opacity: 0.5, flexShrink: 0 }}>×</button>
          </div>
        ))}
      </div>

      {/* Add milestone */}
      <form onSubmit={handleAdd} style={{ marginTop: 8 }}>
        <input className="task-input" value={input} onChange={e => setInput(e.target.value)}
          placeholder="+ Add milestone…"
          style={{ width: '100%', background: 'var(--surf2)', border: '1px solid var(--bdr)',
            borderRadius: 6, padding: '5px 10px', fontSize: 12 }} />
      </form>
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ project, contacts, onUpdate, onDelete }) {
  const [expanded, setExpanded] = React.useState(true);
  const [editingNote, setEditingNote] = React.useState(false);
  const [noteVal, setNoteVal]   = React.useState(project.notes || '');
  const status = PROJECT_STATUSES.find(s => s.id === project.status) || PROJECT_STATUSES[0];
  const done = project.milestones.filter(m => m.done).length;
  const pct  = project.milestones.length ? Math.round((done / project.milestones.length) * 100) : 0;
  const linkedContacts = contacts.filter(c => project.contactIds.includes(c.id));

  function toggleMilestone(mid) {
    onUpdate({ ...project, milestones: project.milestones.map(m => m.id === mid ? { ...m, done: !m.done } : m) });
  }
  function addMilestone(text) {
    onUpdate({ ...project, milestones: [...project.milestones, { id: Date.now(), text, done: false }] });
  }
  function deleteMilestone(mid) {
    onUpdate({ ...project, milestones: project.milestones.filter(m => m.id !== mid) });
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: expanded ? 16 : 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <h3 style={{ fontFamily: 'var(--font-d)', fontSize: 16, fontWeight: 700, color: 'var(--fg)',
              letterSpacing: '-0.01em' }}>{project.name}</h3>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
              padding: '2px 7px', borderRadius: 4, letterSpacing: '0.08em',
              background: `${status.color}18`, color: status.color,
              border: `1px solid ${status.color}33` }}>{status.label.toUpperCase()}</span>
            <span className="tag">{project.category}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--fg3)', lineHeight: 1.5 }}>{project.description}</p>

          {/* Mini progress bar */}
          {!expanded && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 3, background: 'var(--bdr)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: 3, width: `${pct}%`, borderRadius: 2,
                  background: pct === 100 ? 'var(--green)' : 'var(--red)', transition: 'width 0.4s' }} />
              </div>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg3)', flexShrink: 0 }}>
                {done}/{project.milestones.length}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <select value={project.status}
            onChange={e => onUpdate({ ...project, status: e.target.value })}
            style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 6,
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg2)',
              padding: '4px 8px', cursor: 'pointer', outline: 'none' }}>
            {PROJECT_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}
            onClick={() => setExpanded(e => !e)}>
            {expanded ? '▴' : '▾'}
          </button>
          <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11, color: 'var(--red-loss)' }}
            onClick={() => { if (confirm('Delete this project?')) onDelete(project.id); }}>×</button>
        </div>
      </div>

      {expanded && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
          {/* Milestones */}
          <div>
            <MilestoneList
              milestones={project.milestones}
              onToggle={toggleMilestone}
              onAdd={addMilestone}
              onDelete={deleteMilestone}
            />
          </div>

          {/* Right panel: notes + linked contacts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Notes */}
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg3)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Notes</div>
              {editingNote ? (
                <div>
                  <textarea value={noteVal} onChange={e => setNoteVal(e.target.value)}
                    placeholder="Project notes…"
                    style={{ width: '100%', minHeight: 80, resize: 'vertical',
                      background: 'var(--surf2)', border: '1px solid var(--bdr)',
                      borderRadius: 6, padding: '7px 10px', font: 'inherit',
                      fontSize: 12, color: 'var(--fg2)', outline: 'none', marginBottom: 6 }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-ghost" style={{ padding: '3px 10px', fontSize: 10 }}
                      onClick={() => { onUpdate({ ...project, notes: noteVal }); setEditingNote(false); }}>Save</button>
                    <button className="btn-ghost" style={{ padding: '3px 10px', fontSize: 10 }}
                      onClick={() => setEditingNote(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div onClick={() => setEditingNote(true)} style={{
                  minHeight: 48, padding: '7px 10px', borderRadius: 6,
                  background: 'var(--surf2)', border: '1px solid var(--bdr)',
                  fontSize: 12, color: project.notes ? 'var(--fg2)' : 'var(--fg3)',
                  lineHeight: 1.5, cursor: 'text', fontStyle: project.notes ? 'normal' : 'italic',
                }}>{project.notes || 'Click to add notes…'}</div>
              )}
            </div>

            {/* Linked contacts */}
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg3)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Linked Contacts</div>
              {linkedContacts.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--fg3)', fontStyle: 'italic' }}>
                  No contacts linked. Add via the Networking tab.
                </div>
              ) : linkedContacts.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--red-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--red)', flexShrink: 0 }}>
                    {c.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg)' }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{c.company}</div>
                  </div>
                  <button onClick={() => onUpdate({ ...project, contactIds: project.contactIds.filter(id => id !== c.id) })}
                    style={{ background: 'none', border: 'none', color: 'var(--fg3)', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              ))}

              {/* Link contact dropdown */}
              <LinkContactDropdown
                contacts={contacts}
                linked={project.contactIds}
                onLink={id => onUpdate({ ...project, contactIds: [...project.contactIds, id] })}
              />
            </div>

            {/* Meta */}
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg3)' }}>
              Created {new Date(project.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LinkContactDropdown({ contacts, linked, onLink }) {
  const [open, setOpen] = React.useState(false);
  const available = contacts.filter(c => !linked.includes(c.id));
  if (available.length === 0) return null;
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn-ghost" style={{ fontSize: 10, padding: '4px 10px', width: '100%' }}
        onClick={() => setOpen(o => !o)}>+ Link Contact</button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: 4,
          background: 'var(--surf)', border: '1px solid var(--bdr2)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxHeight: 160, overflowY: 'auto' }}>
          {available.map(c => (
            <button key={c.id} onClick={() => { onLink(c.id); setOpen(false); }}
              style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none',
                textAlign: 'left', cursor: 'pointer', fontSize: 12, color: 'var(--fg2)', transition: 'background 0.1s' }}
              onMouseEnter={e => e.target.style.background = 'var(--surf2)'}
              onMouseLeave={e => e.target.style.background = 'none'}>
              <strong style={{ color: 'var(--fg)' }}>{c.name}</strong>
              <span style={{ color: 'var(--fg3)', fontFamily: 'var(--font-mono)', fontSize: 10, marginLeft: 6 }}>
                {c.company}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── New Project Modal ────────────────────────────────────────────────────────

function NewProjectModal({ onAdd, onClose }) {
  const [form, setForm] = React.useState({ name: '', description: '', category: 'Research', status: 'active' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onAdd({
      id: Date.now(),
      name: form.name.trim(),
      description: form.description.trim(),
      status: form.status,
      category: form.category,
      contactIds: [],
      milestones: [],
      notes: '',
      createdAt: new Date().toISOString(),
    });
    onClose();
  }

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-box" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--bdr)' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>New Project</span>
          <button className="tweaks-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { k: 'name',        label: 'Project Name *',  ph: 'Japan Market Entry Research', type: 'input'    },
            { k: 'description', label: 'Description',      ph: 'What is this project about?', type: 'textarea' },
          ].map(({ k, label, ph, type }) => (
            <div key={k}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg3)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
              {type === 'textarea'
                ? <textarea value={form[k]} onChange={set(k)} placeholder={ph} style={{
                    width: '100%', minHeight: 72, resize: 'vertical',
                    background: 'var(--surf2)', border: '1px solid var(--bdr)',
                    borderRadius: 6, padding: '7px 10px', font: 'inherit', fontSize: 12,
                    color: 'var(--fg)', outline: 'none',
                  }} />
                : <input className="search-input" value={form[k]} onChange={set(k)} placeholder={ph} />
              }
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg3)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Category</div>
              <select value={form.category} onChange={set('category')} className="search-input" style={{ cursor: 'pointer' }}>
                {PROJECT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg3)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Status</div>
              <select value={form.status} onChange={set('status')} className="search-input" style={{ cursor: 'pointer' }}>
                {PROJECT_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" style={{
            marginTop: 4, padding: '8px 16px', borderRadius: 'var(--r-pill)',
            background: 'var(--red)', color: '#fff', border: 'none',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}>Create Project</button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Projects Page ───────────────────────────────────────────────────────

function ProjectsPage() {
  const [projects, setProjects] = React.useState(loadProjects);
  const [showNew,  setShowNew]  = React.useState(false);
  const [filterStatus, setFilter] = React.useState('all');

  // Load contacts to allow linking
  const [contacts] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('torii-contacts') || '[]'); } catch { return []; }
  });

  React.useEffect(() => { saveProjects(projects); }, [projects]);

  function addProject(p) { setProjects(prev => [p, ...prev]); }
  function updateProject(p) { setProjects(prev => prev.map(x => x.id === p.id ? p : x)); }
  function deleteProject(id) { setProjects(prev => prev.filter(x => x.id !== id)); }

  const filtered = filterStatus === 'all'
    ? projects
    : projects.filter(p => p.status === filterStatus);

  const counts = PROJECT_STATUSES.reduce((acc, s) => ({
    ...acc, [s.id]: projects.filter(p => p.status === s.id).length,
  }), {});

  const totalMilestones = projects.reduce((s, p) => s + p.milestones.length, 0);
  const doneMilestones  = projects.reduce((s, p) => s + p.milestones.filter(m => m.done).length, 0);

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-sub">Initiative tracker · milestones · linked contacts</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{
          padding: '7px 16px', borderRadius: 'var(--r-pill)',
          background: 'var(--red)', color: '#fff', border: 'none',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}>+ New Project</button>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
        <div className="stat-card">
          <span className="stat-label">Total</span>
          <span className="stat-value">{projects.length}</span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg3)' }}>projects</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Milestones</span>
          <span className="stat-value">{doneMilestones}<span style={{ fontSize: 14, color: 'var(--fg3)' }}>/{totalMilestones}</span></span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg3)' }}>
            {totalMilestones > 0 ? Math.round((doneMilestones/totalMilestones)*100) : 0}% complete
          </span>
        </div>
        {PROJECT_STATUSES.slice(0, 3).map(s => (
          <div key={s.id} className="stat-card" style={{ cursor: 'pointer' }}
            onClick={() => setFilter(filterStatus === s.id ? 'all' : s.id)}>
            <span className="stat-label">{s.label}</span>
            <span className="stat-value" style={{ color: s.color }}>{counts[s.id] || 0}</span>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div className="filter-strip" style={{ marginBottom: 16 }}>
        <button className={`filter-chip ${filterStatus === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          All Projects
        </button>
        {PROJECT_STATUSES.map(s => (
          <button key={s.id} className={`filter-chip ${filterStatus === s.id ? 'active' : ''}`}
            onClick={() => setFilter(filterStatus === s.id ? 'all' : s.id)}>
            {s.label} {counts[s.id] > 0 ? `(${counts[s.id]})` : ''}
          </button>
        ))}
      </div>

      {/* Project list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏗</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>No projects yet.</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>Click "+ New Project" to start tracking an initiative.</div>
        </div>
      ) : (
        filtered.map(p => (
          <ProjectCard key={p.id} project={p} contacts={contacts}
            onUpdate={updateProject} onDelete={deleteProject} />
        ))
      )}

      {showNew && <NewProjectModal onAdd={addProject} onClose={() => setShowNew(false)} />}
    </div>
  );
}

Object.assign(window, { ProjectsPage });
