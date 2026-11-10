// Copies the university list from src/lib/universities.ts into firestore.rules
// (between the UNIVERSITIES markers). Run after editing the list:
//   node scripts/sync-universities.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/lib/universities.ts', import.meta.url), 'utf8');
const list = [...src.matchAll(/^  \[(['"])(.+?)\1/gm)].map((m) => m[2].replace(/\\'/g, "'"));
const extra = [...src.matchAll(/export const (?:NOT_LISTED_UK|OUTSIDE_UK) = '(.+?)';/g)].map((m) => m[1]);
const names = [...list, ...extra];
const rulesPath = new URL('../firestore.rules', import.meta.url);
const rules = readFileSync(rulesPath, 'utf8');
const body = names.map((n) => `        ${JSON.stringify(n)},`).join('\n').replace(/,$/, '');
const out = rules.replace(/(\/\/ UNIVERSITIES-START\n)[\s\S]*?( *\/\/ UNIVERSITIES-END)/, `$1${body}\n$2`);
if (out === rules && !rules.includes('UNIVERSITIES-START')) throw new Error('markers not found in firestore.rules');
writeFileSync(rulesPath, out);
console.log(`${names.length} universities written to firestore.rules`);
