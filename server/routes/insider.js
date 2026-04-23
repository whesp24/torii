import express from 'express';

const router = express.Router();
const EDGAR_UA = { 'User-Agent': 'Torii Investment Platform whesp24@gmail.com' };

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

// --- helpers -----------------------------------------------------------------

function today()      { return new Date().toISOString().slice(0, 10); }
function nDaysAgo(n)  { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }

/** Tidy capitalize "HUANG JEN-HSUN" → "Jen-Hsun Huang" */
function titleCase(s) {
  if (!s) return s;
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

/** Extract first XML tag value */
function xmlTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
}

/** Extract all occurrences of an XML block */
function xmlAll(xml, tag) {
  const re = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'gi');
  return (xml.match(re) || []);
}

// --- GET /api/insider/form4/:ticker ------------------------------------------
// Uses EDGAR Atom feed (CIK=TICKER, type=4, owner=include) which reliably
// returns filer names in <title> entries.
router.get('/form4/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();

    // EDGAR Atom feed: owner=include means show Form 4s where ticker is the issuer
    const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=&CIK=${ticker}&type=4&dateb=&owner=include&count=40&search_text=&output=atom`;
    const r = await fetch(url, { headers: EDGAR_UA });
    if (!r.ok) throw new Error(`EDGAR ${r.status}`);
    const xml = await r.text();

    // Parse <entry> blocks
    const entryBlocks = xmlAll(xml, 'entry');

    const filings = entryBlocks.slice(0, 25).map(entry => {
      const title      = xmlTag(entry, 'title');      // "4 - HUANG JEN-HSUN (0001346985) (Reporting)"
      const dateFiled  = xmlTag(entry, 'date-filed');
      const period     = xmlTag(entry, 'period-of-report');
      const href       = xmlTag(entry, 'filing-href') || xmlTag(entry, 'link');
      const accession  = xmlTag(entry, 'accession-number');
      const formType   = xmlTag(entry, 'filing-type') || '4';

      // Extract filer name from title: "4 - NAME (CIK) (Reporting)"
      const filerMatch = title.match(/^4[^-]*-\s*(.+?)\s*\(\d+\)/i);
      const rawName    = filerMatch ? filerMatch[1] : title;
      const filerName  = titleCase(rawName) || 'Unknown';

      return { filer: filerName, date: dateFiled, period, formType, accession, url: href };
    });

    // Try to extract total count from feed (not always present)
    const totalMatch = xml.match(/<opensearch:totalResults>(\d+)<\/opensearch:totalResults>/);
    const count = totalMatch ? parseInt(totalMatch[1]) : filings.length;

    res.json({ ticker, filings, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/insider/funds --------------------------------------------------
router.get('/funds', async (req, res) => {
  res.json(NOTABLE_FUNDS);
});

// --- GET /api/insider/funds/:cik/latest -------------------------------------
// Returns most recent 13F filing metadata + top holdings parsed from infotable XML
router.get('/funds/:cik/latest', async (req, res) => {
  try {
    const cik = req.params.cik.padStart(10, '0');

    // 1. Get submissions list
    const subR = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: EDGAR_UA,
    });
    if (!subR.ok) throw new Error(`EDGAR submissions ${subR.status}`);
    const data = await subR.json();

    const filings  = data.filings?.recent || {};
    const forms    = filings.form          || [];
    const dates    = filings.filingDate    || [];
    const accNums  = filings.accessionNumber || [];
    const docs     = filings.primaryDocument || [];

    // Find most recent 13F-HR
    const idx = forms.findIndex(f => f === '13F-HR');
    if (idx === -1) {
      return res.json({ name: data.name, cik, filedAt: null, holdings: [], recentFilings: [] });
    }

    const filedAt  = dates[idx];
    const accRaw   = accNums[idx];                         // "0001234567-24-000001"
    const accClean = accRaw.replace(/-/g, '');             // "0001234567240000001"
    const cikNum   = cik.replace(/^0+/, '');

    // Build recent filings list (last 4 13F-HR)
    const recentFilings = forms.map((f, i) => ({ form: f, date: dates[i], acc: accNums[i] }))
      .filter(e => e.form === '13F-HR')
      .slice(0, 4)
      .map(e => ({
        form: e.form,
        date: e.date,
        url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR&dateb=&owner=include&count=5`,
      }));

    // 2. Fetch the filing index to find the infotable document
    const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accClean}/${accRaw}-index.json`;
    let holdings = [];
    try {
      const idxR = await fetch(indexUrl, { headers: EDGAR_UA });
      if (idxR.ok) {
        const idxData = await idxR.json();
        // Find infotable XML file
        const infoDoc = (idxData.directory?.item || []).find(
          d => d.name?.toLowerCase().includes('infotable') || d.name?.toLowerCase().endsWith('.xml')
        );
        if (infoDoc) {
          const infoUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accClean}/${infoDoc.name}`;
          const infoR = await fetch(infoUrl, { headers: EDGAR_UA });
          if (infoR.ok) {
            const infoXml = await infoR.text();
            holdings = parse13FHoldings(infoXml);
          }
        }
      }
    } catch (_) { /* holdings stays empty */ }

    res.json({
      name: data.name,
      cik,
      filedAt,
      accessionNumber: accRaw,
      edgarUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR&dateb=&owner=include&count=5`,
      recentFilings,
      holdings,
      holdingsCount: holdings.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/insider/13f/:cik — (legacy, kept for compat) -------------------
router.get('/13f/:cik', async (req, res) => {
  const cik = req.params.cik.replace(/^0+/, '').padStart(10, '0');
  try {
    const r = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: EDGAR_UA });
    if (!r.ok) throw new Error(`EDGAR ${r.status}`);
    const data = await r.json();
    const filings = data.filings?.recent || {};
    const idx = (filings.form || []).findIndex(f => f === '13F-HR');
    if (idx === -1) return res.json({ holdings: [], filedAt: null, name: data.name });
    const accNum = (filings.accessionNumber?.[idx] || '').replace(/-/g, '');
    res.json({
      name: data.name,
      cik,
      filedAt: filings.filingDate?.[idx] || '',
      edgarUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR&dateb=&owner=include&count=5`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- parse13FHoldings --------------------------------------------------------
// Parses an infotable XML and returns top 30 holdings sorted by value desc
function parse13FHoldings(xml) {
  const tables = xmlAll(xml, 'infoTable');
  if (!tables.length) {
    // Some filings use ns1: prefix
    const ns = xmlAll(xml, 'ns1:infoTable');
    if (ns.length) return parseInfoTables(ns);
    return [];
  }
  return parseInfoTables(tables);
}

function parseInfoTables(tables) {
  return tables
    .map(t => {
      const issuer  = xmlTag(t, 'nameOfIssuer')  || xmlTag(t, 'ns1:nameOfIssuer');
      const cusip   = xmlTag(t, 'cusip')          || xmlTag(t, 'ns1:cusip');
      const valStr  = xmlTag(t, 'value')          || xmlTag(t, 'ns1:value');
      const shrStr  = xmlTag(t, 'sshPrnamt')      || xmlTag(t, 'ns1:sshPrnamt');
      const shrType = xmlTag(t, 'sshPrnamtType')  || xmlTag(t, 'ns1:sshPrnamtType');
      const value   = parseFloat(valStr) || 0;   // in thousands
      const shares  = parseFloat(shrStr) || 0;
      return { issuer: titleCase(issuer), cusip, value, shares, shrType };
    })
    .filter(h => h.issuer && h.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 30);
}

export default router;
