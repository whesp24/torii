import nodemailer from 'nodemailer';
import Stock from '../models/Stock.js';

function getTransporter() {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const user = process.env.EMAIL_FROM;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: 587,
    secure: false,
    auth: { user, pass },
  });
}

export async function sendDailyDigest() {
  const to = process.env.EMAIL_TO;
  if (!to) { console.log('EMAIL_TO not set — skipping daily digest'); return; }

  const transporter = getTransporter();
  if (!transporter) { console.log('Email creds not set — skipping daily digest'); return; }

  // Gather portfolio data
  const WATCH = ['NVDA','GOOGL','AAPL','MSFT','AMD','NFLX','META','AMZN','TSLA','VOO','VRT'];
  const stocks = await Stock.find({ symbol: { $in: WATCH } }).lean();

  const gainers = stocks.filter(s => s.changePercent > 0).sort((a,b) => b.changePercent - a.changePercent).slice(0,3);
  const losers  = stocks.filter(s => s.changePercent < 0).sort((a,b) => a.changePercent - b.changePercent).slice(0,3);
  const movers  = stocks.filter(s => Math.abs(s.changePercent) >= 2);

  const fmt = n => n != null ? n.toFixed(2) : 'N/A';
  const pct = n => n != null ? `${n>=0?'+':''}${n.toFixed(2)}%` : '—';

  const stockRows = stocks.map(s =>
    `<tr><td style="padding:6px 12px;font-weight:700;color:#E0001E">${s.symbol}</td>
     <td style="padding:6px 12px">$${fmt(s.price)}</td>
     <td style="padding:6px 12px;color:${(s.changePercent||0)>=0?'#22c55e':'#ef4444'}">${pct(s.changePercent)}</td></tr>`
  ).join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>Torii Daily Digest</title></head>
<body style="margin:0;padding:0;background:#0D0D0D;font-family:'SF Pro Text',system-ui,sans-serif;color:#E2E2E2">
  <div style="max-width:600px;margin:40px auto;background:#161616;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a">
    <!-- Header -->
    <div style="background:#E0001E;padding:24px 32px;display:flex;align-items:center;gap:12px">
      <div style="font-size:22px;font-weight:800;color:white;letter-spacing:0.08em">⛩ TORII</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-left:auto">${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
    </div>

    <!-- Summary -->
    <div style="padding:28px 32px;border-bottom:1px solid #2a2a2a">
      <h2 style="margin:0 0 16px;font-size:18px;color:#fff">Daily Market Digest</h2>
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        ${gainers.length ? `<div style="background:#0f2218;border:1px solid #22c55e33;border-radius:10px;padding:14px 18px;flex:1;min-width:140px">
          <div style="font-size:10px;color:#22c55e;font-weight:700;letter-spacing:0.1em;margin-bottom:8px">TOP GAINERS</div>
          ${gainers.map(s=>`<div style="font-size:13px;margin-bottom:4px"><span style="font-weight:700;color:#fff">${s.symbol}</span> <span style="color:#22c55e">${pct(s.changePercent)}</span></div>`).join('')}
        </div>` : ''}
        ${losers.length ? `<div style="background:#1f0f0f;border:1px solid #ef444433;border-radius:10px;padding:14px 18px;flex:1;min-width:140px">
          <div style="font-size:10px;color:#ef4444;font-weight:700;letter-spacing:0.1em;margin-bottom:8px">BIGGEST DROPS</div>
          ${losers.map(s=>`<div style="font-size:13px;margin-bottom:4px"><span style="font-weight:700;color:#fff">${s.symbol}</span> <span style="color:#ef4444">${pct(s.changePercent)}</span></div>`).join('')}
        </div>` : ''}
      </div>
      ${movers.length ? `<div style="margin-top:16px;padding:12px 16px;background:#1a1a1a;border-radius:8px;font-size:12px;color:#a0a0a0">
        <strong style="color:#fff">Notable moves (≥2%):</strong> ${movers.map(s=>`${s.symbol} ${pct(s.changePercent)}`).join(', ')}
      </div>` : ''}
    </div>

    <!-- Stock table -->
    <div style="padding:28px 32px">
      <h3 style="margin:0 0 14px;font-size:14px;color:#a0a0a0;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">Watchlist Prices</h3>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:1px solid #2a2a2a">
            <th style="padding:6px 12px;text-align:left;font-size:11px;color:#666;font-weight:600;text-transform:uppercase">Symbol</th>
            <th style="padding:6px 12px;text-align:left;font-size:11px;color:#666;font-weight:600;text-transform:uppercase">Price</th>
            <th style="padding:6px 12px;text-align:left;font-size:11px;color:#666;font-weight:600;text-transform:uppercase">Change</th>
          </tr>
        </thead>
        <tbody>
          ${stockRows}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #2a2a2a;text-align:center;font-size:11px;color:#555">
      Torii Japan Market Hub · Data sourced from public APIs · Not financial advice
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"Torii Market Hub" <${process.env.EMAIL_FROM}>`,
      to,
      subject: `Torii Daily Digest — ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'})}`,
      html,
    });
    console.log('✓ Daily digest email sent to', to);
  } catch (err) {
    console.error('Email send error:', err.message);
  }
}
