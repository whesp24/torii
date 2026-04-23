import express from 'express';

const router = express.Router();

const EDGAR_HEADERS = {
  'User-Agent': 'Torii Investment Platform whesp24@gmail.com',
  'Accept-Encoding': 'gzip, deflate',
  'Host': 'efts.sec.gov',
};

// Notable hedge fund CIKs for 13F tracking
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

// GET /api/insider/form4/:ticker — recent Form 4 insider transactions
router.get('/form4/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const url = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(ticker)}%22&forms=4&dateRange=custom&startdt=${nDaysAgo(90)}&enddt=${today()}&hits.hits._source=period_of_report,entity_name,file_date,form_type&hits.hits.total=true`;

    const r = await fetch(url, { headers: EDGAR_HEADERS });
    if (!r.ok) throw new Error(`EDGAR ${r.status}`);
    const data = await r.json();

    const hits = data.hits?.hits || [];
    const filings = hits.slice(0, 20).map(h => ({
      filer:    h._source?.entity_name || 'Unknown',
      date:     h._source?.file_date || '',
      period:   h._source?.period_of_report || '',
      formType: h._source?.form_type || '4',
      url:      `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(h._source?.entity_name || '')}&type=4&dateb=&owner=include&count=5`,
    }));

    res.json({ ticker, filings, count: data.hits?.total?.value || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/insider/13f/:cik — latest 13F holdings for a fund
router.get('/13f/:cik', async (req, res) => {
  try {
    const cik = req.params.cik.replace(/^0+/, '').padStart(10, '0');
    const submUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const r = await fetch(submUrl, {
      headers: { 'User-Agent': 'Torii Investment Platform whesp24@gmail.com' }
    });
    if (!r.ok) throw new Error(`EDGAR submissions ${r.status}`);
    const data = await r.json();

    // Find most recent 13F filing
    const filings = data.filings?.recent;
    if (!filings) return res.json({ holdings: [], filedAt: null });

    const idx = (filings.form || []).findIndex(f => f === '13F-HR');
    if (idx === -1) return res.json({ holdings: [], filedAt: null, name: data.name });

    const accNum = (filings.accessionNumber?.[idx] || '').replace(/-/g, '');
    const filedAt = filings.filingDate?.[idx] || '';
    const docUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/000${accNum}/`;

    res.json({
      name: data.name,
      cik,
      filedAt,
      accessionNumber: filings.accessionNumber?.[idx],
      edgarUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR&dateb=&owner=include&count=5`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/insider/funds — list of tracked funds
router.get('/funds', async (req, res) => {
  res.json(NOTABLE_FUNDS);
});

// GET /api/insider/funds/:cik/latest — latest 13F summary for a specific fund
router.get('/funds/:cik/latest', async (req, res) => {
  try {
    const cik = req.params.cik.padStart(10, '0');
    const r = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: { 'User-Agent': 'Torii Investment Platform whesp24@gmail.com' }
    });
    if (!r.ok) throw new Error(`EDGAR ${r.status}`);
    const data = await r.json();

    const filings = data.filings?.recent || {};
    const forms   = filings.form || [];
    const dates   = filings.filingDate || [];
    const accNums = filings.accessionNumber || [];

    const entries = forms.map((f, i) => ({ form: f, date: dates[i], acc: accNums[i] }))
      .filter(e => e.form === '13F-HR')
      .slice(0, 4);

    res.json({
      name: data.name,
      cik,
      entityType: data.entityType,
      stateOfIncorporation: data.stateOfIncorporation,
      recentFilings: entries.map(e => ({
        form: e.form,
        date: e.date,
        url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR&dateb=&owner=include&count=5`,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function today() { return new Date().toISOString().slice(0, 10); }
function nDaysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }

export default router;
