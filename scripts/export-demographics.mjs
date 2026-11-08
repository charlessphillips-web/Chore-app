// Exports every user's sign-up answers to a CSV you can open in Excel /
// Google Sheets, plus a quick summary in the terminal.
//
// Setup (once):
//   1. Firebase console -> Project settings -> Service accounts ->
//      "Generate new private key". Save it as scripts/service-account.json
//      (it's git-ignored — never share or commit it).
//   2. cd scripts && npm install
// Run:
//   cd scripts && npm run export-demographics
import { readFileSync, writeFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const keyPath = new URL('./service-account.json', import.meta.url);
initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) });
const db = getFirestore();

const snap = await db.collection('users').get();
const rows = snap.docs.map((d) => {
  const u = d.data();
  return {
    userId: d.id,
    username: u.username ?? '',
    age: u.age ?? '',
    gender: u.gender ?? '',
    isStudent: u.isStudent ?? '',
    university: u.university ?? '',
    inHouse: u.houseId ? 'yes' : 'no',
    signedUp: u.createdAt?.toDate?.().toISOString() ?? '',
  };
});

const cols = Object.keys(rows[0] ?? { userId: '' });
const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
const out = `demographics-${new Date().toISOString().slice(0, 10)}.csv`;
writeFileSync(out, csv);

const tally = (key) =>
  Object.entries(rows.reduce((acc, r) => ((acc[r[key] || '—'] = (acc[r[key] || '—'] ?? 0) + 1), acc), {}))
    .sort((a, b) => b[1] - a[1]);
const ages = rows.map((r) => Number(r.age)).filter(Boolean);

console.log(`\n${rows.length} users -> ${out}\n`);
console.log('Students:', tally('isStudent'));
console.log('Gender:', tally('gender'));
console.log('Top universities:', tally('university').slice(0, 10));
if (ages.length) console.log(`Age: avg ${(ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1)}, range ${Math.min(...ages)}–${Math.max(...ages)}`);
