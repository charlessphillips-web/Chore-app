// Exports bug reports and suggestions to a CSV (open in Excel / Google
// Sheets) and saves any screenshots as JPG files next to it.
//
// Setup: same as export-demographics.mjs (scripts/service-account.json).
// Run:   cd scripts && npm run export-feedback
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const keyPath = new URL('./service-account.json', import.meta.url);
initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) });
const db = getFirestore();

const snap = await db.collection('feedback').orderBy('createdAt', 'desc').get();
const date = new Date().toISOString().slice(0, 10);
const shotsDir = `feedback-${date}-screenshots`;
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
    type: r.type === 'suggestion' ? 'Suggestion' : 'Bug',
    sent: r.createdAt?.toDate?.().toISOString() ?? '',
    username: r.username ?? '',
    message: r.message ?? '',
    phone: [r.device?.model, r.device?.os, r.device?.osVersion].filter(Boolean).join(' '),
    appVersion: r.device?.appVersion ?? '',
    screenshot: screenshotFile,
    userId: r.userId ?? '',
    id: d.id,
    houseId: r.houseId ?? '',
  };
});

const cols = Object.keys(rows[0] ?? { type: '' });
const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
const out = `feedback-${date}.csv`;
writeFileSync(out, csv);
console.log(`\n${rows.filter((r) => r.type === 'Bug').length} bug reports, ${rows.filter((r) => r.type === 'Suggestion').length} suggestions -> ${out}` + (shots ? ` (+ ${shots} screenshots in ${shotsDir}/)` : ''));
for (const r of rows.slice(0, 8)) console.log(`- [${r.type}] ${r.sent.slice(0, 10)} ${r.username}: ${r.message.slice(0, 80)}`);
