import { chromium } from 'playwright';
const B = 'http://localhost:8901';
// Auffaellige Namen, die im Verkehr niemals auftauchen duerfen.
const NAMEN = ['Zwiebelhuber','Quastenflosser','Immergruen','Ampferstiel','Nebelkrach'];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext();
const p = await ctx.newPage();
const verkehr = [];
p.on('request', r => {
  if (!r.url().includes('/exec')) return;
  verkehr.push({ methode: r.method(), url: r.url(), rumpf: r.postData() || '' });
});
p.on('pageerror', e => console.log('PAGEERROR:', e.message));

await p.addInitScript(() => {
  localStorage.setItem('kz.verbindung', JSON.stringify({ url: 'http://localhost:8901/exec', token: 'testtoken123' }));
});

const csv = '﻿schluessel;nachname;vorname;geschlecht;version\r\n' +
  `KLASSE-3L;${NAMEN[0]};Anna;;2026-08-17T10:00:00Z\r\n` +
  `3L-01;${NAMEN[1]};Ben;m;2026-08-17T10:00:00Z\r\n` +
  `3L-11;${NAMEN[2]};Carla;w;2026-08-17T10:00:00Z\r\n` +
  `3M-05;${NAMEN[3]};Dora;w;2026-08-17T10:00:00Z\r\n` +
  `3OB-11;${NAMEN[4]};Emil;m;2026-08-17T10:00:00Z\r\n`;

await p.goto(B + '#/zuordnung'); await p.waitForTimeout(700);
const knopf = (t) => p.locator('button', { hasText: t }).first();
const [ch] = await Promise.all([ p.waitForEvent('filechooser'), knopf('Zuordnungsdatei laden').click() ]);
await ch.setFiles({ name: 'zuordnung.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
await p.waitForTimeout(700);

// Namen aendern und speichern — das ist der Aufruf, der zum Server geht.
await p.goto(B + '#/zuordnung'); await p.waitForTimeout(700);
const felder = p.locator('table.liste tbody tr input');
await felder.nth(0).fill('Sonderzeichenschmied');
await felder.nth(1).fill('Testvorname');
await felder.nth(2).fill('w');
await knopf('Speichern').click();
await p.waitForTimeout(900);

// Durch alle Ansichten laufen, damit jeder Serveraufruf erfasst wird.
for (const pfad of ['#/', '#/klasse/3L', '#/klasse/3L/noten', '#/klasse/3L/boards',
                    '#/klasse/3M', '#/klasse/3OB/einheiten', '#/einstellungen']) {
  await p.goto(B + pfad); await p.waitForTimeout(350);
}
await knopf('Daten neu laden').click(); await p.waitForTimeout(700);

console.log(`Serveraufrufe erfasst: ${verkehr.length}`);
verkehr.forEach(v => console.log(`  ${v.methode} ${v.url.replace(B,'')}${v.rumpf ? '  Rumpf: ' + v.rumpf : ''}`));

const alles = JSON.stringify(verkehr);
let schlecht = 0;
[...NAMEN, 'Sonderzeichenschmied', 'Testvorname', 'Anna', 'Ben', 'Carla', 'Dora', 'Emil'].forEach(n => {
  const drin = alles.includes(n);
  if (drin) schlecht++;
  console.log(`${drin ? 'LECK' : 'OK  '}  "${n}" ${drin ? 'IM VERKEHR GEFUNDEN' : 'kommt nicht vor'}`);
});

// Gegenprobe: Der Test wuerde ein Leck auch finden.
const kontrolle = JSON.stringify([{ rumpf: 'nachname=Zwiebelhuber' }]).includes('Zwiebelhuber');
console.log(`${kontrolle ? 'OK  ' : 'FEHL'}  Gegenprobe: Suche erkennt ein eingebautes Leck`);
if (!kontrolle) schlecht++;

// Und: geht der Zeitstempel wirklich raus?
const stempel = verkehr.some(v => v.rumpf.includes('zuordnung_version'));
console.log(`${stempel ? 'OK  ' : 'FEHL'}  Zeitstempel wird uebertragen (ohne Namen)`);
if (!stempel) schlecht++;

console.log(schlecht === 0 ? '\nKEIN NAME HAT DAS GERAET VERLASSEN' : `\n${schlecht} PROBLEM(E)`);
await b.close();
process.exit(schlecht === 0 ? 0 : 1);
