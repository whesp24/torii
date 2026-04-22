// ─── TORII MOCK DATA ─────────────────────────────────────────────────────────

window.MOCK = {

  japan: [
    { symbol: "^N225",    label: "NKY",   price: 59349,  pct:  0.89, change:  525,   dec: 0 },
    { symbol: "USDJPY=X", label: "¥/$",   price: 159.59, pct:  0.53, change:  0.84,  dec: 2 },
    { symbol: "EWJ",      label: "EWJ",   price: 87.16,  pct: -2.43, change: -2.17,  dec: 2 },
    { symbol: "^TOPX",    label: "TOPX",  price: 2681,   pct:  0.71, change:  18.9,  dec: 0 },
    { symbol: "MUFG",     label: "MUFG",  price: 17.52,  pct: -3.88, change: -0.71,  dec: 2 },
    { symbol: "TM",       label: "TM",    price: 184.30, pct: -1.22, change: -2.27,  dec: 2 },
    { symbol: "NTDOY",    label: "NTDOY", price: 15.84,  pct:  1.02, change:  0.16,  dec: 2 },
    { symbol: "SNE",      label: "SONY",  price: 86.42,  pct: -0.88, change: -0.77,  dec: 2 },
  ],

  macro: [
    { symbol: "^GSPC",   label: "SPX",  price: 7064,   pct: -0.64, change: -45.6,  dec: 0 },
    { symbol: "^VIX",    label: "VIX",  price: 20.46,  pct:  8.43, change:  1.59,  dec: 2, invert: true },
    { symbol: "GC=F",    label: "GOLD", price: 4696,   pct: -2.75, change: -132.8, dec: 0 },
    { symbol: "BTC-USD", label: "BTC",  price: 75142,  pct: -0.94, change: -712,   dec: 0 },
    { symbol: "CL=F",    label: "OIL",  price: 92.07,  pct:  9.32, change:  7.85,  dec: 2 },
    { symbol: "^TNX",    label: "10Y",  price: 4.29,   pct:  0.99, change:  0.042, dec: 2 },
    { symbol: "^DJI",    label: "DJIA", price: 39852,  pct: -0.41, change: -164,   dec: 0 },
  ],

  portfolio: [
    { id:1, ticker:"ONDS",  name:"Ondas Holdings",      shares:100, price:10.87,  pct: 1.30, change: 0.14,  value:1087,  prevClose:10.73 },
    { id:2, ticker:"MMS",   name:"MAXIMUS Inc",          shares:14,  price:67.93,  pct:-1.03, change:-0.71,  value:951,   prevClose:68.64 },
    { id:3, ticker:"MUFG",  name:"Mitsubishi UFJ Fin",   shares:60,  price:17.52,  pct:-3.88, change:-0.71,  value:1051,  prevClose:18.23 },
    { id:4, ticker:"QXO",   name:"QXO Inc",              shares:31,  price:22.48,  pct:-7.18, change:-1.74,  value:697,   prevClose:24.22 },
    { id:5, ticker:"TPL",   name:"Texas Pacific Land",   shares:2,   price:437.83, pct: 0.68, change: 2.95,  value:876,   prevClose:434.88 },
    { id:6, ticker:"CRCL",  name:"Circle Internet",      shares:16,  price:96.00,  pct:-9.74, change:-10.36, value:1536,  prevClose:106.36 },
    { id:7, ticker:"VOO",   name:"Vanguard S&P 500 ETF", shares:2,   price:647.30, pct:-0.65, change:-4.23,  value:1295,  prevClose:651.53 },
    { id:8, ticker:"VRT",   name:"Vertiv Holdings",      shares:2,   price:312.36, pct:-0.65, change:-2.04,  value:625,   prevClose:314.40 },
    { id:9, ticker:"NVDA",  name:"NVIDIA Corp",          shares:3,   price:199.88, pct:-1.08, change:-2.18,  value:600,   prevClose:202.06 },
  ],

  nikkeiChart: {
    prices: [57180,57420,57890,57650,58100,58340,58120,58560,58790,58940,
             59100,58870,59200,59380,58950,59100,59430,59560,59180,59420,59349],
    dates:  ["Mar 22","Mar 24","Mar 26","Mar 28","Apr 1","Apr 3","Apr 5",
             "Apr 7","Apr 9","Apr 11","Apr 13","Apr 15","Apr 17","Apr 19",
             "Apr 21","Apr 23","Apr 25","Apr 27","Apr 29","May 1","May 3"]
  },

  // Sparkline data per holding (10 days)
  sparklines: {
    ONDS:  [10.40,10.55,10.48,10.62,10.71,10.58,10.69,10.75,10.73,10.87],
    MMS:   [69.20,68.90,69.10,68.70,68.40,68.80,68.64,68.20,68.64,67.93],
    MUFG:  [18.90,18.70,18.60,18.40,18.50,18.30,18.10,18.23,18.00,17.52],
    QXO:   [25.10,24.80,24.50,24.90,25.20,24.70,24.22,23.80,23.40,22.48],
    TPL:   [430,432,429,435,431,434,433,436,434.88,437.83],
    CRCL:  [112,110,108,107,109,106,106.36,104,100,96.00],
    VOO:   [658,655,653,651,654,652,651.53,650,649,647.30],
    VRT:   [320,318,316,315,318,316,314.40,313,312,312.36],
    NVDA:  [208,206,205,204,203,202,202.06,201,200,199.88],
  },

  news: [
    { id:1, importance:"high",   source:"Reuters",   category:"japan",
      title:"Bank of Japan signals policy tolerance as yen slides past 159 again",
      summary:"BOJ Governor Ueda said the central bank will maintain its current stance...",
      url:"#", publishedAt: new Date(Date.now()-3600000).toISOString() },
    { id:2, importance:"high",   source:"Nikkei",    category:"japan",
      title:"Nikkei 225 hits 2025 high as yen weakness turbocharges export stocks",
      summary:"Japanese equities extended gains to fresh yearly highs...",
      url:"#", publishedAt: new Date(Date.now()-7200000).toISOString() },
    { id:3, importance:"high",   source:"Bloomberg", category:"macro",
      title:"Oil surges 9% on OPEC+ surprise output cut announcement",
      summary:"Crude futures posted their largest single-day gain in months...",
      url:"#", publishedAt: new Date(Date.now()-9000000).toISOString() },
    { id:4, importance:"medium", source:"Bloomberg", category:"macro",
      title:"Fed's Powell warns of tariff-driven inflation risk at IMF conference",
      summary:"Federal Reserve Chair Jerome Powell cautioned markets that elevated tariffs...",
      url:"#", publishedAt: new Date(Date.now()-10800000).toISOString() },
    { id:5, importance:"medium", source:"WSJ",       category:"market",
      title:"NVIDIA faces antitrust review for AI chip bundling practices",
      summary:"US regulators are scrutinizing the company's sales of H100 and Blackwell chips...",
      url:"#", publishedAt: new Date(Date.now()-14400000).toISOString() },
    { id:6, importance:"medium", source:"Nikkei",    category:"japan",
      title:"Toyota reports record Q4 profit, raises FY guidance on yen tailwind",
      summary:"The automaker's earnings significantly exceeded analyst expectations...",
      url:"#", publishedAt: new Date(Date.now()-18000000).toISOString() },
    { id:7, importance:"medium", source:"FT",        category:"macro",
      title:"VIX jumps to 20 — options market pricing in elevated volatility through May",
      summary:"The CBOE Volatility Index reached its highest level since February...",
      url:"#", publishedAt: new Date(Date.now()-21600000).toISOString() },
    { id:8, importance:"low",    source:"Reuters",   category:"market",
      title:"Bitcoin retreats from $76K peak amid broader risk-off sentiment",
      summary:"Crypto markets pulled back slightly as equities faced modest selling...",
      url:"#", publishedAt: new Date(Date.now()-25200000).toISOString() },
    { id:9, importance:"low",    source:"FT",        category:"japan",
      title:"Asian markets mixed; China PMI disappoinment weighs on region",
      summary:"Regional equity markets showed divergent performance Monday morning...",
      url:"#", publishedAt: new Date(Date.now()-28800000).toISOString() },
    { id:10, importance:"low",   source:"Bloomberg", category:"market",
      title:"Gold retreats from record high as dollar rebounds on strong data",
      summary:"Bullion gave back some of its recent gains as the US dollar strengthened...",
      url:"#", publishedAt: new Date(Date.now()-32400000).toISOString() },
  ],

  tweets: [
    { id:"1", handle:"KevinLMak",       name:"Kevin Mak",        initials:"KM", color:"#3B82F6",
      text:"USD/JPY breaking through 159.5 resistance. The 160 level is the key watch — BOJ intervention threshold has historically sat here. If we breach and hold, expect significant JPY volatility and forced unwinds.",
      time:"2h ago", likes:234, retweets:45, replies:23 },
    { id:"2", handle:"ContrarianCurse", name:"SuspendedCap",     initials:"SC", color:"#8B5CF6",
      text:"The sentiment vs. positioning divergence in Japan equities is as wide as I've seen. Retail positioning is max bullish while institutional flows are tepid. Classic distribution pattern. Be careful chasing.",
      time:"4h ago", likes:189, retweets:62, replies:31 },
    { id:"3", handle:"dsundheim",       name:"D. Sundheim",      initials:"DS", color:"#10B981",
      text:"Long Japan, short US tech into this data cycle. Relative valuation for Japanese industrials has never been stronger vs US peers. Yen weakness becoming a genuine tailwind, not just a narrative.",
      time:"5h ago", likes:445, retweets:128, replies:44 },
    { id:"4", handle:"jeff_weinstein",  name:"Jeff Weinstein",   initials:"JW", color:"#F59E0B",
      text:"The AI infrastructure buildout is bifurcating. Picks-and-shovels (NVDA, VRT, etc.) under valuation compression while hyperscalers hold. Being selective here is everything — don't own the basket.",
      time:"8h ago", likes:567, retweets:145, replies:67 },
    { id:"5", handle:"HannoLustig",     name:"Hanno Lustig",     initials:"HL", color:"#EF4444",
      text:"Carry trade unwind risk in USD/JPY is asymmetric right now. 10Y JGB yield normalization + BOJ rate path = explosive combo for JPY. Position sizing matters enormously. Don't be the last one out.",
      time:"10h ago", likes:298, retweets:94, replies:38 },
    { id:"6", handle:"patrick_oshag",   name:"Patrick O'Shag",   initials:"PO", color:"#EC4899",
      text:"Japan value thesis intact: 40%+ of TSE Prime trading below book, dividend yields outpacing US counterparts. Western institutional rotation is still early innings. Corporate governance reforms are real.",
      time:"12h ago", likes:723, retweets:218, replies:56 },
    { id:"7", handle:"KevinLMak",       name:"Kevin Mak",        initials:"KM", color:"#3B82F6",
      text:"TOPIX bank sub-index breaking out cleanly here. MUFG, SMBC all strong on normalized rate expectations. BOJ policy normalization is the catalyst the Japanese financials sector has been waiting for.",
      time:"1d ago", likes:312, retweets:89, replies:27 },
    { id:"8", handle:"ContrarianCurse", name:"SuspendedCap",     initials:"SC", color:"#8B5CF6",
      text:"VIX at 20 is not yet panic territory but elevated enough to warrant watching. Options market pricing more downside than spot implies. Interesting divergence — usually resolves via spot catching down.",
      time:"1d ago", likes:156, retweets:41, replies:19 },
  ],

  tasks: [
    { id:1, text:"Review NVDA position — earnings in 3 days",          done:false, auto:true,  priority:"high"   },
    { id:2, text:"USD/JPY approaching 160 — monitor BOJ intervention",  done:false, auto:true,  priority:"high"   },
    { id:3, text:"Nikkei 52W high territory — reassess Japan exposure",  done:false, auto:true,  priority:"medium" },
    { id:4, text:"Read latest BOJ policy meeting notes",                done:false, auto:false, priority:"low"    },
  ],

  notifications: [
    { id:1, type:"alert",  read:false, title:"VIX up +8.43%",       body:"Volatility spike — consider hedging open positions",     time:"10m ago", icon:"⚡" },
    { id:2, type:"alert",  read:false, title:"CRCL −9.74%",         body:"Large intraday move in your portfolio holding",          time:"1h ago",  icon:"⚠" },
    { id:3, type:"news",   read:false, title:"BOJ Policy Signal",    body:"Bank of Japan signals continued accommodation...",       time:"2h ago",  icon:"📰" },
    { id:4, type:"market", read:true,  title:"Tokyo Session Open",   body:"Nikkei opened +0.89% at 59,349",                        time:"6h ago",  icon:"🕘" },
    { id:5, type:"market", read:true,  title:"Briefing Ready",       body:"Your daily market briefing has been generated",          time:"7h ago",  icon:"✦"  },
  ],

  briefing: `**Market Briefing — Tuesday, April 21**

**Japan Market**
Nikkei 225 is at **59,349**, up **0.89%** today. USD/JPY is trading at **159.59**, continuing its weakening trend against the dollar. Yen weakness is acting as a material tailwind for Japanese exporters — Toyota, Sony, and TOPIX financials leading. BOJ reiterated patience on rate normalization, keeping yen under structural pressure near the 160 threshold.

**Macro Environment**
S&P 500 futures under modest pressure as VIX elevated at **20.46**, signaling heightened hedging demand. Oil surging **+9.32%** on OPEC+ surprise cut. Gold retreating from recent highs. Fed Chair Powell flagged tariff-related inflation risks at the IMF conference — markets reading this as "higher for longer."

**Portfolio Watch**
Your portfolio is down **2.76%** today, primarily driven by **CRCL (-9.74%)** and **QXO (-7.18%)**. Both moves appear to be sector-driven rather than company-specific. NVDA continues its compression despite strong fundamentals. **TPL (+0.68%)** and **ONDS (+1.30%)** are your positive movers.

**Key Risk to Watch**
USD/JPY approaching **160** — historically the BOJ intervention threshold. A forced JPY rebound could hit your MUFG position and unwind some of the Nikkei strength. Monitor closely.`,

  japanDetail: [
    { group:"Index", label:"Nikkei 225",    symbol:"^N225",    price:59349, pct: 0.89, open:58950, high:59450, low:58900, vol:"2.1B" },
    { group:"Index", label:"TOPIX",         symbol:"^TOPX",    price:2681,  pct: 0.71, open:2665,  high:2685,  low:2662,  vol:"1.8B" },
    { group:"FX",    label:"USD / JPY",     symbol:"USDJPY=X", price:159.59,pct: 0.53, open:158.75,high:159.72,low:158.60,vol:"—"    },
    { group:"FX",    label:"EUR / JPY",     symbol:"EURJPY=X", price:172.40,pct: 0.31, open:171.87,high:172.55,low:171.70,vol:"—"    },
    { group:"ETF",   label:"EWJ",           symbol:"EWJ",      price:87.16, pct:-2.43, open:89.40, high:89.55, low:86.90, vol:"8.4M" },
    { group:"ETF",   label:"DXJ (hedged)",  symbol:"DXJ",      price:104.20,pct: 1.12, open:103.05,high:104.40,low:103.00,vol:"1.2M" },
    { group:"Stock", label:"Toyota Motor",  symbol:"TM",       price:184.30,pct:-1.22, open:186.60,high:186.80,low:184.00,vol:"420K" },
    { group:"Stock", label:"Mitsubishi UFJ",symbol:"MUFG",     price:17.52, pct:-3.88, open:18.23, high:18.30, low:17.40, vol:"3.1M" },
    { group:"Stock", label:"Nintendo",      symbol:"NTDOY",    price:15.84, pct: 1.02, open:15.68, high:15.90, low:15.62, vol:"890K" },
    { group:"Stock", label:"Sony Group",    symbol:"SNE",      price:86.42, pct:-0.88, open:87.19, high:87.40, low:86.20, vol:"1.5M" },
  ],
};
