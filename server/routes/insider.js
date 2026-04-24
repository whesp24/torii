import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();
const EDGAR_UA = { 'User-Agent': 'Torii Investment Platform whesp24@gmail.com' };

// Simple in-process cache: { key → { data, ts } }
const CACHE = new Map();
function fromCache(key, ttlMs) {
  const c = CACHE.get(key);
  return c && Date.now() - c.ts < ttlMs ? c.data : null;
}
function toCache(key, data) { CACHE.set(key, { data, ts: Date.now() }); }

// ─── TrackedInsider schema (stored in MongoDB) ────────────────────────────────
const trackedSchema = new mongoose.Schema({
  cik:   { type: String, required: true, unique: true },
  name:  { type: String, required: true },
  notes: { type: String, default: '' },
}, { timestamps: true });
const TrackedInsider = mongoose.models.TrackedInsider
  || mongoose.model('TrackedInsider', trackedSchema);

const NOTABLE_FUNDS = [
  { name: 'Druckenmiller / Duquesne',  cik: '0001536411' },
  { name: 'Ackman / Pershing Square',  cik: '0001336528' },
  { name: 'Tepper / Appaloosa',        cik: '0001418814' },
  { name: 'Burry / Scion',             cik: '0001649339' },
  { name: 'Einhorn / Greenlight',      cik: '0001079114' },
  { name: 'Loeb / Third Point',        cik: '0001040273' },
  { name: 'Peltz / Trian',             cik: '0001418819' },
  { name: 'Icahn',                     cik: '0000921669' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function titleCase(s) {
  if (!s) return s;
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

/** Extract first XML tag value — namespace-agnostic (strips ns1:, ns2:, etc.) */
function xmlTag(xml, tag) {
  // Try both bare and any namespace prefix
  const patterns = [
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'),
    new RegExp(`<[a-z0-9_]+:${tag}[^>]*>([\\s\\S]*?)<\\/[a-z0-9_]+:${tag}>`, 'i'),
  ];
  for (const re of patterns) {
    const m = xml.match(re);
    if (m) {
      let val = m[1];
      // Strip CDATA wrapper
      const cdata = val.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
      if (cdata) val = cdata[1];
      // Strip any remaining tags
      return val.replace(/<[^>]+>/g, '').trim();
    }
  }
  return '';
}

/** Extract all occurrences of an XML block — namespace-agnostic */
function xmlAll(xml, tag) {
  // Try bare tag first, then any namespace prefix
  const patterns = [
    new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'gi'),
    new RegExp(`<[a-z0-9_]+:${tag}[\\s\\S]*?<\\/[a-z0-9_]+:${tag}>`, 'gi'),
  ];
  for (const re of patterns) {
    const m = xml.match(re);
    if (m && m.length) return m;
  }
  return [];
}

/** Strip ALL namespace prefixes from XML string for simpler parsing */
function stripNs(xml) {
  return xml
    .replace(/<([a-z0-9_]+):([a-zA-Z])/g, '<$2')
    .replace(/<\/([a-z0-9_]+):([a-zA-Z])/g, '</$2');
}

/** Resolve ticker → company CIK via SEC tickers JSON */
async function tickerToCIK(ticker) {
  const cacheKey = `cik:${ticker}`;
  const cached = fromCache(cacheKey, 24 * 60 * 60 * 1000); // 24h
  if (cached) return cached;

  const r = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: EDGAR_UA });
  if (!r.ok) throw new Error('SEC tickers lookup failed');
  const map = await r.json();
  for (const key in map) {
    if (map[key].ticker?.toUpperCase() === ticker) {
      const cik = String(map[key].cik_str).padStart(10, '0');
      toCache(cacheKey, cik);
      return cik;
    }
  }
  throw new Error(`CIK not found for ${ticker}`);
}

// ─── Parse a Form 4 XML for insider + transaction data ───────────────────────
function parseForm4Xml(xml) {
  const clean = stripNs(xml);

  const ownerName = xmlTag(clean, 'rptOwnerName');
  const ownerCik  = xmlTag(clean, 'rptOwnerCik');
  const isDirector    = xmlTag(clean, 'isDirector') === '1';
  const isOfficer     = xmlTag(clean, 'isOfficer')  === '1';
  const isTenPct      = xmlTag(clean, 'isTenPercentOwner') === '1';
  const officerTitle  = xmlTag(clean, 'officerTitle');

  const role = officerTitle || (isOfficer ? 'Officer' : isDirector ? 'Director' : isTenPct ? '10% Owner' : 'Insider');

  // Parse non-derivative transactions (open market buys/sells)
  const nonDerivBlocks = xmlAll(clean, 'nonDerivativeTransaction');
  const derivBlocks    = xmlAll(clean, 'derivativeTransaction');

  function parseTxnBlock(t) {
    const security = xmlTag(t, 'securityTitle');
    const date     = xmlTag(t, 'transactionDate');
    const shares   = parseFloat(xmlTag(t, 'transactionShares') || '0');
    const price    = parseFloat(xmlTag(t, 'transactionPricePerShare') || '0');
    const code     = xmlTag(t, 'transactionAcquiredDisposedCode');  // A or D
    const txnCode  = xmlTag(t, 'transactionCode');                  // P=open-mkt-buy, S=sale, etc.
    return { security, date, shares, price, type: code, txnCode };
  }

  const transactions = [
    ...nonDerivBlocks.map(parseTxnBlock),
    ...derivBlocks.map(parseTxnBlock),
  ].filter(t => t.shares > 0 || t.price > 0);

  const buys  = transactions.filter(t => t.type === 'A');
  const sells = transactions.filter(t => t.type === 'D');
  const isBuy = buys.length > 0 && sells.length === 0;
  const isSell = sells.length > 0 && buys.length === 0;
  const totalShares = transactions.reduce((s, t) => s + (t.type === 'A' ? t.shares : -t.shares), 0);
  const avgPrice = transactions.length > 0
    ? transactions.reduce((s, t) => s + t.price, 0) / transactions.length : 0;

  return { ownerName, ownerCik, role, transactions, isBuy, isSell, totalShares, avgPrice };
}

// ─── GET /api/insider/form4/:ticker ──────────────────────────────────────────
// Resolves ticker → CIK → submissions JSON → fetches Form 4 XMLs for real names
router.get('/form4/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const days   = parseInt(req.query.days || '90');
    const cacheKey = `form4:${ticker}:${days}`;
    const cached = fromCache(cacheKey, 30 * 60 * 1000); // 30 min cache
    if (cached) return res.json(cached);

    // 1. Resolve ticker → CIK
    const cik    = await tickerToCIK(ticker);
    const cikNum = cik.replace(/^0+/, '');

    // 2. Get submissions JSON
    const subR = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: EDGAR_UA });
    if (!subR.ok) throw new Error(`EDGAR submissions ${subR.status}`);
    const sub = await subR.json();

    const recent = sub.filings?.recent || {};
    const forms  = recent.form          || [];
    const dates  = recent.filingDate    || [];
    const accs   = recent.accessionNumber || [];
    const docs   = recent.primaryDocument  || [];

    // Filter to Form 4 / 4/A within the day window
    const cutoff = new Date(Date.now() - days * 86400000);
    const form4s = [];
    for (let i = 0; i < forms.length; i++) {
      if ((forms[i] === '4' || forms[i] === '4/A') && new Date(dates[i]) >= cutoff) {
        form4s.push({ date: dates[i], acc: accs[i], doc: docs[i] || '', formType: forms[i] });
        if (form4s.length >= 25) break;
      }
    }

    // 3. Fetch each Form 4 XML in parallel to get insider names + transactions
    const parsed = await Promise.allSettled(form4s.map(async f => {
      const accClean = f.acc.replace(/-/g, '');
      // Primary document might be .xml or .htm — try XML first
      let xmlDoc = f.doc;
      if (!xmlDoc.endsWith('.xml')) {
        // Fall back to fetching the filing index to find the XML
        try {
          const idxR = await fetch(
            `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accClean}/${f.acc}-index.json`,
            { headers: EDGAR_UA }
          );
          if (idxR.ok) {
            const idx = await idxR.json();
            const xmlItem = (idx.directory?.item || []).find(d =>
              d.name?.endsWith('.xml') && !d.name?.toLowerCase().includes('label') &&
              !d.name?.toLowerCase().includes('pre') && !d.name?.toLowerCase().includes('cal')
            );
            if (xmlItem) xmlDoc = xmlItem.name;
          }
        } catch (_) {}
      }

      const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accClean}/${xmlDoc}`;
      const xmlR = await fetch(xmlUrl, { headers: EDGAR_UA });
      if (!xmlR.ok) throw new Error(`XML ${xmlR.status}`);
      const xml = await xmlR.text();

      const info = parseForm4Xml(xml);
      return {
        filer:       info.ownerName ? titleCase(info.ownerName) : 'Insider',
        ownerCik:    info.ownerCik,
        role:        info.role,
        date:        f.date,
        formType:    f.formType,
        accession:   f.acc,
        url:         `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accClean}/${xmlDoc}`,
        transactions: info.transactions,
        isBuy:       info.isBuy,
        isSell:      info.isSell,
        totalShares: info.totalShares,
        avgPrice:    info.avgPrice,
      };
    }));

    const filings = parsed
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
      .filter(f => f.filer !== 'Insider' || f.date); // drop completely empty ones

    const result = { ticker, filings, count: filings.length, cik };
    toCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/insider/funds ───────────────────────────────────────────────────
router.get('/funds', async (req, res) => {
  res.json(NOTABLE_FUNDS);
});

// ─── GET /api/insider/funds/:cik/latest ──────────────────────────────────────
router.get('/funds/:cik/latest', async (req, res) => {
  try {
    const cik    = req.params.cik.padStart(10, '0');
    const cikNum = cik.replace(/^0+/, '');

    const cacheKey = `13f:${cik}`;
    const cached = fromCache(cacheKey, 60 * 60 * 1000); // 1h
    if (cached) return res.json(cached);

    // 1. Get submissions
    const subR = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: EDGAR_UA });
    if (!subR.ok) throw new Error(`EDGAR submissions ${subR.status}`);
    const data = await subR.json();

    const filings   = data.filings?.recent || {};
    const forms     = filings.form            || [];
    const dates     = filings.filingDate      || [];
    const accNums   = filings.accessionNumber || [];

    const idx13F = forms.findIndex(f => f === '13F-HR');
    if (idx13F === -1) {
      return res.json({ name: data.name, cik, filedAt: null, holdings: [], recentFilings: [] });
    }

    const filedAt  = dates[idx13F];
    const accRaw   = accNums[idx13F];
    const accClean = accRaw.replace(/-/g, '');

    const recentFilings = forms
      .map((f, i) => ({ form: f, date: dates[i], acc: accNums[i] }))
      .filter(e => e.form === '13F-HR')
      .slice(0, 4)
      .map(e => ({
        form: e.form,
        date: e.date,
        url:  `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR&dateb=&owner=include&count=5`,
      }));

    // 2. Fetch filing index JSON to find the infotable XML
    let holdings = [];
    try {
      const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accClean}/${accRaw}-index.json`;
      const idxR = await fetch(indexUrl, { headers: EDGAR_UA });
      if (idxR.ok) {
        const idxData = await idxR.json();
        const items = idxData.directory?.item || [];

        // Find infotable XML — try several naming patterns
        const infoDoc = items.find(d => {
          const n = (d.name || '').toLowerCase();
          return n.includes('infotable') || n.includes('information_table') ||
                 n.includes('form13f') || (n.endsWith('.xml') && !n.includes('primary') &&
                 !n.includes('label') && !n.includes('pre.xml') && !n.includes('cal.xml'));
        }) || items.find(d => (d.name || '').toLowerCase().endsWith('.xml'));

        if (infoDoc) {
          const infoUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accClean}/${infoDoc.name}`;
          const infoR = await fetch(infoUrl, { headers: EDGAR_UA });
          if (infoR.ok) {
            const infoXml = await infoR.text();
            holdings = parse13FHoldings(infoXml);
          }
        }
      }
    } catch (_) { /* holdings stays empty — EDGAR link still works */ }

    const result = {
      name: data.name,
      cik,
      filedAt,
      accessionNumber: accRaw,
      edgarUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR&dateb=&owner=include&count=5`,
      recentFilings,
      holdings,
      holdingsCount: holdings.length,
    };
    toCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── parse13FHoldings ────────────────────────────────────────────────────────
function parse13FHoldings(xml) {
  // Strip all namespace prefixes for uniform parsing
  const clean = stripNs(xml);
  const tables = xmlAll(clean, 'infoTable');
  if (!tables.length) return [];
  return tables
    .map(t => {
      const issuer  = xmlTag(t, 'nameOfIssuer');
      const cusip   = xmlTag(t, 'cusip');
      const valStr  = xmlTag(t, 'value');
      const shrStr  = xmlTag(t, 'sshPrnamt');
      const shrType = xmlTag(t, 'sshPrnamtType');
      const value   = parseFloat(valStr) || 0;
      const shares  = parseFloat(shrStr) || 0;
      return { issuer: titleCase(issuer), cusip, value, shares, shrType };
    })
    .filter(h => h.issuer && h.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 30);
}

// ─── Tracked Insiders CRUD ────────────────────────────────────────────────────

// GET /api/insider/tracked
router.get('/tracked', async (req, res) => {
  try {
    res.json(await TrackedInsider.find().sort({ name: 1 }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/insider/tracked  { cik, name, notes? }
router.post('/tracked', async (req, res) => {
  try {
    const { cik, name, notes } = req.body;
    if (!cik || !name) return res.status(400).json({ error: 'cik and name required' });
    const padded = String(cik).padStart(10, '0');
    const doc = await TrackedInsider.findOneAndUpdate(
      { cik: padded },
      { cik: padded, name, notes: notes || '' },
      { upsert: true, new: true }
    );
    res.status(201).json(doc);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/insider/tracked/:id
router.delete('/tracked/:id', async (req, res) => {
  try {
    await TrackedInsider.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/insider/tracked/:cik/filings — Form 4s filed BY a specific insider
router.get('/tracked/:cik/filings', async (req, res) => {
  try {
    const cik    = req.params.cik.padStart(10, '0');
    const cikNum = cik.replace(/^0+/, '');
    const days   = parseInt(req.query.days || '90');
    const cacheKey = `tracked-filings:${cik}:${days}`;
    const cached = fromCache(cacheKey, 30 * 60 * 1000);
    if (cached) return res.json(cached);

    const subR = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: EDGAR_UA });
    if (!subR.ok) throw new Error(`EDGAR ${subR.status}`);
    const sub = await subR.json();

    const recent = sub.filings?.recent || {};
    const forms  = recent.form              || [];
    const dates  = recent.filingDate        || [];
    const accs   = recent.accessionNumber   || [];
    const docs   = recent.primaryDocument   || [];

    const cutoff = new Date(Date.now() - days * 86400000);
    const form4s = [];
    for (let i = 0; i < forms.length; i++) {
      if ((forms[i] === '4' || forms[i] === '4/A') && new Date(dates[i]) >= cutoff) {
        form4s.push({ date: dates[i], acc: accs[i], doc: docs[i] || '', formType: forms[i] });
        if (form4s.length >= 20) break;
      }
    }

    const parsed = await Promise.allSettled(form4s.slice(0, 10).map(async f => {
      const accClean = f.acc.replace(/-/g, '');
      const xmlDoc   = f.doc.endsWith('.xml') ? f.doc : f.doc.replace(/\.(htm|html)$/i, '.xml');
      const xmlUrl   = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accClean}/${xmlDoc}`;
      const xmlR     = await fetch(xmlUrl, { headers: EDGAR_UA });
      if (!xmlR.ok) throw new Error(`${xmlR.status}`);
      const xml  = await xmlR.text();
      const info = parseForm4Xml(xml);
      // For filer-level search, issuerName is in ownerRelationship
      const issuerName = xmlTag(stripNs(xml), 'issuerName');
      const issuerTicker = xmlTag(stripNs(xml), 'issuerTradingSymbol');
      return {
        ticker:      issuerTicker || issuerName,
        company:     titleCase(issuerName),
        date:        f.date,
        formType:    f.formType,
        accession:   f.acc,
        url:         `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accClean}/${xmlDoc}`,
        isBuy:       info.isBuy,
        isSell:      info.isSell,
        totalShares: info.totalShares,
        avgPrice:    info.avgPrice,
        role:        info.role,
      };
    }));

    const filings = parsed.filter(r => r.status === 'fulfilled').map(r => r.value);
    const result  = { cik, name: sub.name, filings };
    toCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/insider/search?q=name — search EDGAR for a person by name
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    const url = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(q)}%22&forms=4&dateRange=custom&startdt=${new Date(Date.now()-365*86400000).toISOString().slice(0,10)}&enddt=${new Date().toISOString().slice(0,10)}`;
    const r = await fetch(url, { headers: EDGAR_UA });
    if (!r.ok) throw new Error(`EFTS ${r.status}`);
    const data = await r.json();

    // Deduplicate by filer CIK
    const seen = new Set();
    const results = [];
    for (const hit of (data.hits?.hits || [])) {
      const src = hit._source || {};
      const cik = src.file_num || src.entity_id || '';
      if (!seen.has(cik)) {
        seen.add(cik);
        results.push({
          name:     src.display_names?.[0] || src.entity_name || '',
          cik:      src.period_of_report   || '',
          fileCik:  src.file_num           || '',
        });
      }
      if (results.length >= 10) break;
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Legacy compat ────────────────────────────────────────────────────────────
router.get('/13f/:cik', async (req, res) => {
  res.redirect(`/api/insider/funds/${req.params.cik}/latest`);
});

export default router;
