// Exports bug reports to a CSV (open in Excel / Google Sheets) and saves any
// screenshots as JPG files next to it.
//
// Setup: same as export-demographics.mjs (scripts/service-account.json).
// Run:   cd scripts && npm run export-bug-reports
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const keyPath = new URL('./service-account.json', import.meta.url);
initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) });
const db = getFirestore();

const snap = await db.collection('bugReports').orderBy('createdAt', 'desc').get();
const date = new Date().toISOString().slice(0, 10);
const shotsDir = `bug-reports-${date}-screenshots`;
let shots = 0;

const rows = snap.docs.map((d) => {
  const r = d.data();
  let screenshotFile = '';
  if (r.screenshot) {
    mkdirSync(shotsDir, { recursive: true });
    screenshotFile = `${shotsDir}/${d.id}.jpg`;
    writeFileSync(screenshotFile, Buffer.from(r.screenshot, 'base64'));
    shots++;
  }
  return {
    reportId: d.id,
    sent: r.createdAt?.toDate?.().toISOString() ?? '',
    username: r.username ?? '',
    message: r.message ?? '',
    phone: [r.device?.model, r.device?.os, r.device?.osVersion].filter(Boolean).join(' '),
    appVersion: r.device?.appVersion ?? '',
    screenshot: screenshotFile,
    userId: r.userId ?? '',
    houseId: r.houseId ?? '',
  };
});

const cols = Object.keys(rows[0] ?? { reportId: '' });
const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
const out = `bug-reports-${date}.csv`;
writeFileSync(out, csv);
console.log(`\n${rows.length} bug reports -> ${out}` + (shots ? ` (+ ${shots} screenshots in ${shotsDir}/)` : ''));
for (const r of rows.slice(0, 5)) console.log(`- ${r.sent.slice(0, 10)} ${r.username}: ${r.message.slice(0, 80)}`);
