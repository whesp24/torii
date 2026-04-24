import express from 'express';
const router = express.Router();

// Simple in-memory cache (24h for patent/contract data, 1h for GitHub)
const cache = new Map();
function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < ttlMs) return Promise.resolve(hit.data);
  return fn().then(data => { cache.set(key, { data, ts: Date.now() }); return data; });
}

// ── USASpending.gov — Government Contracts ────────────────────────────────────
router.get('/contracts', async (req, res) => {
  const { company, ticker } = req.query;
  const keyword = company || ticker || '';
  if (!keyword) return res.status(400).json({ error: 'company or ticker required' });

  try {
    const data = await cached(`contracts:${keyword}`, 24 * 60 * 60 * 1000, async () => {
      const body = {
        filters: {
          keywords: [keyword],
          award_type_codes: ['A','B','C','D'],
          time_period: [{ start_date: '2023-01-01', end_date: new Date().toISOString().slice(0,10) }],
        },
        fields: ['Award ID','Recipient Name','Award Amount','Start Date','End Date','Description','Awarding Agency Name'],
        page: 1, limit: 10, sort: 'Award Amount', order: 'desc',
      };
      const r = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw new Error(`USASpending error: ${r.status}`);
      const json = await r.json();
      return (json.results || []).map(a => ({
        id:        a['Award ID'],
        recipient: a['Recipient Name'],
        amount:    a['Award Amount'],
        start:     a['Start Date'],
        end:       a['End Date'],
        agency:    a['Awarding Agency Name'],
        desc:      (a['Description'] || '').slice(0, 200),
      }));
    });
    res.json({ source: 'USASpending.gov', keyword, contracts: data });
  } catch (err) {
    console.error('Alt data contracts error:', err.message);
    res.json({ source: 'USASpending.gov', keyword, contracts: [], error: err.message });
  }
});

// ── PatentsView — Patent Filings ──────────────────────────────────────────────
router.get('/patents', async (req, res) => {
  const { company, ticker } = req.query;
  const keyword = company || ticker || '';
  if (!keyword) return res.status(400).json({ error: 'company or ticker required' });

  try {
    const data = await cached(`patents:${keyword}`, 24 * 60 * 60 * 1000, async () => {
      const params = new URLSearchParams({
        q: JSON.stringify({ _text_any: { patent_abstract: keyword } }),
        f: JSON.stringify(['patent_id','patent_title','patent_date','patent_abstract','assignee_organization']),
        o: JSON.stringify({ per_page: 8, sort: [{ patent_date: 'desc' }] }),
      });
      const r = await fetch(`https://patentsview.org/api/patents/query?${params}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw new Error(`PatentsView error: ${r.status}`);
      const json = await r.json();
      return (json.patents || []).map(p => ({
        id:       p.patent_id,
        title:    p.patent_title,
        date:     p.patent_date,
        abstract: (p.patent_abstract || '').slice(0, 300),
        assignee: p.assignee_organization,
      }));
    });
    res.json({ source: 'PatentsView / USPTO', keyword, patents: data });
  } catch (err) {
    console.error('Alt data patents error:', err.message);
    res.json({ source: 'PatentsView / USPTO', keyword, patents: [], error: err.message });
  }
});

// ── GitHub — Developer Activity ───────────────────────────────────────────────
router.get('/github', async (req, res) => {
  const { org } = req.query;
  if (!org) return res.status(400).json({ error: 'org required' });

  try {
    const data = await cached(`github:${org}`, 60 * 60 * 1000, async () => {
      // Fetch top repos by recent push
      const reposR = await fetch(
        `https://api.github.com/orgs/${encodeURIComponent(org)}/repos?sort=pushed&per_page=8&type=public`,
        { headers: { 'User-Agent': 'Torii-Research/1.0' }, signal: AbortSignal.timeout(6000) }
      );
      if (!reposR.ok) throw new Error(`GitHub orgs error: ${reposR.status}`);
      const repos = await reposR.json();
      if (!Array.isArray(repos)) throw new Error('GitHub returned non-array');

      // Get recent commits across top 3 repos
      const commitCounts = await Promise.allSettled(
        repos.slice(0, 3).map(async repo => {
          const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const r = await fetch(
            `https://api.github.com/repos/${org}/${repo.name}/commits?since=${since}&per_page=1`,
            { headers: { 'User-Agent': 'Torii-Research/1.0' }, signal: AbortSignal.timeout(4000) }
          );
          // GitHub returns Link header with total — approximate from last page
          const link = r.headers?.get?.('Link') || '';
          const match = link.match(/page=(\d+)>; rel="last"/);
          return { repo: repo.name, commits30d: match ? parseInt(match[1]) : '?' };
        })
      );

      return {
        org,
        repos: repos.map(r => ({
          name:        r.name,
          description: (r.description || '').slice(0, 120),
          stars:       r.stargazers_count,
          forks:       r.forks_count,
          language:    r.language,
          pushedAt:    r.pushed_at,
          openIssues:  r.open_issues_count,
        })),
        commitActivity: commitCounts
          .filter(c => c.status === 'fulfilled')
          .map(c => c.value),
        totalStars: repos.reduce((s, r) => s + (r.stargazers_count || 0), 0),
        topLanguages: [...new Set(repos.map(r => r.language).filter(Boolean))].slice(0, 5),
      };
    });
    res.json({ source: 'GitHub', ...data });
  } catch (err) {
    console.error('Alt data github error:', err.message);
    res.json({ source: 'GitHub', org, repos: [], error: err.message });
  }
});

// ── Job Signal — Indeed RSS ────────────────────────────────────────────────────
router.get('/jobs', async (req, res) => {
  const { company } = req.query;
  if (!company) return res.status(400).json({ error: 'company required' });

  try {
    const data = await cached(`jobs:${company}`, 4 * 60 * 60 * 1000, async () => {
      // Indeed RSS (public, no key needed)
      const url = `https://www.indeed.com/rss?q=${encodeURIComponent('"' + company + '"')}&l=&sort=date&fromage=30`;
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ToriiBot/1.0)' },
        signal: AbortSignal.timeout(6000),
      });
      const xml = await r.text();

      // Parse RSS items
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 10).map(m => {
        const block = m[1];
        const title    = (block.match(/<title>(.*?)<\/title>/)     || [])[1] || '';
        const link     = (block.match(/<link>(.*?)<\/link>/)       || [])[1] || '';
        const pubDate  = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
        const desc     = (block.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';
        // Strip HTML from description
        const clean = desc.replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&#\d+;/g,'').trim().slice(0,200);
        return { title: title.replace(/<[^>]+>/g,''), link, pubDate, summary: clean };
      });

      return { company, count: items.length, jobs: items };
    });
    res.json({ source: 'Indeed RSS', ...data });
  } catch (err) {
    console.error('Alt data jobs error:', err.message);
    // Return empty gracefully — RSS may be blocked
    res.json({ source: 'Indeed RSS', company, count: 0, jobs: [], note: 'Job feed unavailable — RSS may be rate limited' });
  }
});

// ── Price history batch (for correlation matrix) ───────────────────────────────
router.get('/history/:ticker', async (req, res) => {
  const sym = req.params.ticker.toUpperCase();
  try {
    const data = await cached(`history:${sym}`, 6 * 60 * 60 * 1000, async () => {
      const { chart } = await import('../lib/yahooClient.js');
      const now   = Math.floor(Date.now() / 1000);
      const start = now - 90 * 24 * 60 * 60;
      const result = await chart(sym, { period1: start, period2: now, interval: '1d' });
      const quotes = result?.quotes || result?.indicators?.quote?.[0] || [];
      const timestamps = result?.timestamp || [];
      if (!timestamps.length) return [];
      return timestamps.map((t, i) => ({
        date:  new Date(t * 1000).toISOString().slice(0,10),
        close: quotes[i]?.close ?? quotes.close?.[i] ?? null,
      })).filter(p => p.close !== null);
    });
    res.json({ ticker: sym, prices: data });
  } catch (err) {
    console.error(`History error for ${sym}:`, err.message);
    res.json({ ticker: sym, prices: [], error: err.message });
  }
});

export default router;
