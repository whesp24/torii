// ─── NETWORKING PAGE ─────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { id: 'not-contacted', label: 'Not Contacted', color: 'var(--fg3)'      },
  { id: 'reached-out',   label: 'Reached Out',   color: 'var(--amber)'    },
  { id: 'replied',       label: 'Replied',        color: 'var(--blue)'     },
  { id: 'meeting',       label: 'Meeting Set',    color: '#A855F7'         },
  { id: 'connected',     label: 'Connected',      color: 'var(--green)'    },
];

const INDUSTRIES = ['Finance','Banking','VC/PE','Technology','Consulting','Hedge Fund','Asset Mgmt','Japan-Focused'];
const ROLES      = ['Analyst','Associate','Portfolio Manager','Director','Partner','VP','MD','Founder'];
const LOCATIONS  = ['Tokyo','New York','San Francisco','London','Singapore','Hong Kong','Any'];

const LOCATION_URNS = {
  'Tokyo':         '104173657',
  'New York':      '102571732',
  'San Francisco': '102277331',
  'London':        '90009496',
  'Singapore':     '102454443',
  'Hong Kong':     '103291313',
};

function buildLinkedInURL(filters) {
  const terms = [];
  if (filters.keywords)   terms.push(filters.keywords);
  if (filters.title)      terms.push(filters.title);
  if (filters.company)    terms.push(filters.company);
  if (filters.industries.length) terms.push(filters.industries.join(' OR '));
  const params = new URLSearchParams();
  if (terms.length) params.set('keywords', terms.join(' '));
  if (filters.location && filters.location !== 'Any' && LOCATION_URNS[filters.location]) {
    params.set('geoUrn', `["${LOCATION_URNS[filters.location]}"]`);
  }
  params.set('origin', 'FACETED_SEARCH');
  return `https://www.linkedin.com/search/results/people/?${params.toString()}`;
}

function loadContacts() {
  try { return JSON.parse(localStorage.getItem('torii-contacts') || '[]'); } catch { return []; }
}
function saveContacts(c) {
  try { localStorage.setItem('torii-contacts', JSON.stringify(c)); } catch {}
}

// ─── Contact Card ─────────────────────────────────────────────────────────────

function ContactCard({ contact, onStageChange, onDelete, onNote }) {
  const stage = PIPELINE_STAGES.find(s => s.id === contact.stage) || PIPELINE_STAGES[0];
  const [showNote, setShowNote] = React.useState(false);
  const [noteVal, setNoteVal] = React.useState(contact.note || '');
  const initials = contact.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="contact-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div className="contact-avatar">{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg)', lineHeight: 1.3 }}>{contact.name}</div>
          <div style={{ fontSize: 11, color: 'var(--fg2)', marginTop: 1 }}>{contact.title}</div>
          <div style={{ fontSize: 10, color: 'var(--fg3)', fontFamily: 'var(--font-mono)' }}>{contact.company}</div>
        </div>
      </div>

      {contact.location && (
        <div style={{ fontSize: 10, color: 'var(--fg3)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
          📍 {contact.location}
        </div>
      )}

      {contact.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {contact.tags.map(t => (
            <span key={t} style={{
              fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 600,
              padding: '1px 5px', borderRadius: 3,
              background: 'var(--surf2)', color: 'var(--fg3)', border: '1px solid var(--bdr)',
            }}>{t}</span>
          ))}
        </div>
      )}

      {/* Stage selector */}
      <select
        value={contact.stage}
        onChange={e => onStageChange(contact.id, e.target.value)}
        style={{
          width: '100%', marginBottom: 8,
          background: 'var(--surf2)', border: '1px solid var(--bdr)',
          color: stage.color, borderRadius: 6,
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
          padding: '4px 8px', cursor: 'pointer', outline: 'none',
        }}
      >
        {PIPELINE_STAGES.map(s => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>

      {/* Note */}
      {showNote ? (
        <div>
          <textarea
            value={noteVal}
            onChange={e => setNoteVal(e.target.value)}
            placeholder="Add a note…"
            style={{
              width: '100%', minHeight: 56, resize: 'vertical',
              background: 'var(--surf2)', border: '1px solid var(--bdr)',
              borderRadius: 6, padding: '6px 8px',
              font: 'inherit', fontSize: 11, color: 'var(--fg2)',
              outline: 'none', marginBottom: 4,
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-ghost" style={{ padding: '3px 10px', fontSize: 10 }}
              onClick={() => { onNote(contact.id, noteVal); setShowNote(false); }}>Save</button>
            <button className="btn-ghost" style={{ padding: '3px 10px', fontSize: 10 }}
              onClick={() => setShowNote(false)}>Cancel</button>
          </div>
        </div>
      ) : contact.note ? (
        <div onClick={() => setShowNote(true)} style={{
          fontSize: 11, color: 'var(--fg3)', lineHeight: 1.4, cursor: 'pointer',
          padding: '5px 7px', background: 'var(--surf2)', borderRadius: 6,
          border: '1px solid var(--bdr)', marginBottom: 4,
        }}>{contact.note}</div>
      ) : null}

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        {contact.linkedInUrl && (
          <a href={contact.linkedInUrl} target="_blank" rel="noopener"
            className="btn-ghost" style={{ padding: '3px 10px', fontSize: 10, flex: 1, textAlign: 'center' }}>
            LinkedIn ↗
          </a>
        )}
        <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 10 }}
          onClick={() => setShowNote(true)} title="Add note">
          ✎
        </button>
        <button className="btn-ghost" style={{ padding: '3px 8px', fontSize: 10, color: 'var(--red-loss)' }}
          onClick={() => onDelete(contact.id)} title="Remove">
          ×
        </button>
      </div>
    </div>
  );
}

// ─── Add Contact Modal ────────────────────────────────────────────────────────

function AddContactModal({ onAdd, onClose }) {
  const [form, setForm] = React.useState({
    name: '', title: '', company: '', location: '', linkedInUrl: '', tags: '', note: '',
  });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onAdd({
      id: Date.now(),
      name: form.name.trim(),
      title: form.title.trim(),
      company: form.company.trim(),
      location: form.location.trim(),
      linkedInUrl: form.linkedInUrl.trim(),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      note: form.note.trim(),
      stage: 'not-contacted',
      addedAt: new Date().toISOString(),
    });
    onClose();
  }

  const fields = [
    { key: 'name',        label: 'Full Name *',    ph: 'Hiroshi Tanaka'          },
    { key: 'title',       label: 'Title',           ph: 'VP, Japan Equities'      },
    { key: 'company',     label: 'Company',         ph: 'Goldman Sachs Japan'     },
    { key: 'location',    label: 'Location',        ph: 'Tokyo'                   },
    { key: 'linkedInUrl', label: 'LinkedIn URL',    ph: 'https://linkedin.com/in/…' },
    { key: 'tags',        label: 'Tags (comma-sep)',ph: 'Japan, Finance, Equities' },
    { key: 'note',        label: 'Note',            ph: 'Met at Nikkei conference' },
  ];

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-box" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
        <div className="cmd-input-row" style={{ borderBottom: '1px solid var(--bdr)', padding: '14px 18px' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)' }}>Add Contact</span>
          <button className="tweaks-close" onClick={onClose} style={{ marginLeft: 'auto' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fields.map(({ key, label, ph }) => (
            <div key={key}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg3)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
              {key === 'note'
                ? <textarea value={form[key]} onChange={set(key)} placeholder={ph} style={{
                    width: '100%', minHeight: 56, resize: 'vertical',
                    background: 'var(--surf2)', border: '1px solid var(--bdr)',
                    borderRadius: 6, padding: '6px 10px', font: 'inherit', fontSize: 12,
                    color: 'var(--fg)', outline: 'none',
                  }} />
                : <input className="search-input" value={form[key]} onChange={set(key)} placeholder={ph} />
              }
            </div>
          ))}
          <button type="submit" style={{
            marginTop: 4, padding: '8px 16px', borderRadius: 'var(--r-pill)',
            background: 'var(--red)', color: '#fff', border: 'none',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.04em', cursor: 'pointer',
          }}>Add to Pipeline</button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Networking Page ─────────────────────────────────────────────────────

function NetworkingPage() {
  const [contacts, setContacts] = React.useState(loadContacts);
  const [view, setView] = React.useState('pipeline'); // 'pipeline' | 'list'
  const [showAdd, setShowAdd] = React.useState(false);
  const [filterStage, setFilterStage] = React.useState('all');

  // LinkedIn filter state
  const [liFilters, setLiFilters] = React.useState({
    keywords: '', title: '', company: '',
    location: 'Any',
    industries: [],
  });

  React.useEffect(() => { saveContacts(contacts); }, [contacts]);

  function addContact(c) { setContacts(p => [...p, c]); }
  function deleteContact(id) { setContacts(p => p.filter(c => c.id !== id)); }
  function changeStage(id, stage) { setContacts(p => p.map(c => c.id === id ? { ...c, stage } : c)); }
  function updateNote(id, note) { setContacts(p => p.map(c => c.id === id ? { ...c, note } : c)); }

  const toggleIndustry = ind => setLiFilters(f => ({
    ...f,
    industries: f.industries.includes(ind) ? f.industries.filter(i => i !== ind) : [...f.industries, ind],
  }));

  const filteredContacts = filterStage === 'all'
    ? contacts
    : contacts.filter(c => c.stage === filterStage);

  const stageCounts = PIPELINE_STAGES.reduce((acc, s) => ({
    ...acc, [s.id]: contacts.filter(c => c.stage === s.id).length,
  }), {});

  return (
    <div className="page-root">
      <div className="page-header">
        <div>
          <h1 className="page-title">Networking</h1>
          <p className="page-sub">LinkedIn discovery · contact pipeline · outreach tracker</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={() => setView(v => v === 'pipeline' ? 'list' : 'pipeline')} style={{ fontSize: 11 }}>
            {view === 'pipeline' ? '☰ List' : '⊞ Pipeline'}
          </button>
          <button onClick={() => setShowAdd(true)} style={{
            padding: '7px 16px', borderRadius: 'var(--r-pill)',
            background: 'var(--red)', color: '#fff', border: 'none',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}>+ Add Contact</button>
        </div>
      </div>

      {/* LinkedIn finder */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Find on LinkedIn</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            {[
              { key: 'keywords', ph: 'Keywords…',  label: 'Keywords' },
              { key: 'title',    ph: 'Job title…', label: 'Title'    },
              { key: 'company',  ph: 'Company…',   label: 'Company'  },
            ].map(({ key, ph, label }) => (
              <div key={key}>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg3)', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
                <input className="search-input" placeholder={ph}
                  value={liFilters[key]}
                  onChange={e => setLiFilters(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg3)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Location</div>
              <select value={liFilters.location}
                onChange={e => setLiFilters(f => ({ ...f, location: e.target.value }))}
                className="search-input" style={{ cursor: 'pointer' }}>
                {LOCATIONS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg3)', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Industry</div>
            <div className="filter-strip">
              {INDUSTRIES.map(ind => (
                <button key={ind} className={`filter-chip ${liFilters.industries.includes(ind) ? 'active' : ''}`}
                  onClick={() => toggleIndustry(ind)}>{ind}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href={buildLinkedInURL(liFilters)} target="_blank" rel="noopener"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 'var(--r-pill)',
                background: '#0077B5', color: '#fff',
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.04em', textDecoration: 'none',
              }}>
              Search LinkedIn ↗
            </a>
            <span style={{ fontSize: 10, color: 'var(--fg3)', fontFamily: 'var(--font-mono)' }}>
              Opens LinkedIn in a new tab with your filters applied
            </span>
          </div>
        </div>
      </div>

      {/* Pipeline summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 16 }}>
        {PIPELINE_STAGES.map(s => (
          <div key={s.id} onClick={() => setFilterStage(filterStage === s.id ? 'all' : s.id)}
            className="stat-card" style={{
              cursor: 'pointer', borderColor: filterStage === s.id ? s.color : undefined,
              borderLeftColor: s.color, borderLeftWidth: 3,
            }}>
            <span className="stat-label">{s.label}</span>
            <span className="stat-value" style={{ color: s.color }}>{stageCounts[s.id] || 0}</span>
          </div>
        ))}
      </div>

      {contacts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>No contacts yet.</div>
          <div style={{ fontSize: 11, marginTop: 4, color: 'var(--fg3)' }}>Use LinkedIn search above or add manually.</div>
        </div>
      ) : view === 'pipeline' ? (
        /* Pipeline / Kanban view */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, alignItems: 'start' }}>
          {PIPELINE_STAGES.map(s => {
            const stageContacts = contacts.filter(c => c.stage === s.id);
            return (
              <div key={s.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg3)' }}>{s.label}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg3)' }}>
                    {stageContacts.length}
                  </span>
                </div>
                {stageContacts.map(c => (
                  <ContactCard key={c.id} contact={c}
                    onStageChange={changeStage} onDelete={deleteContact} onNote={updateNote} />
                ))}
                {stageContacts.length === 0 && (
                  <div style={{ border: '1px dashed var(--bdr)', borderRadius: 10, padding: '16px 12px',
                    textAlign: 'center', color: 'var(--fg3)', fontSize: 11 }}>Empty</div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th><th>Title</th><th>Company</th>
                <th>Location</th><th>Stage</th><th>Note</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map(c => {
                const stage = PIPELINE_STAGES.find(s => s.id === c.stage);
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td style={{ color: 'var(--fg2)' }}>{c.title}</td>
                    <td style={{ color: 'var(--fg2)' }}>{c.company}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg3)' }}>{c.location}</td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: stage?.color }}>
                        {stage?.label}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--fg3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.note}
                    </td>
                    <td>
                      {c.linkedInUrl && (
                        <a href={c.linkedInUrl} target="_blank" rel="noopener"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--red)' }}>↗</a>
                      )}
                      <button onClick={() => deleteContact(c.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--fg3)', cursor: 'pointer', fontSize: 14, padding: '0 6px' }}>×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddContactModal onAdd={addContact} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

Object.assign(window, { NetworkingPage });
