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

// Checkliste fuer ein zugeordnetes Kind anlegen und einen Zustand setzen —
// das ist der Aufruf, der ausschliesslich das Kuerzel enthalten darf.
await p.goto(B + '#/checklisten/3L'); await p.waitForTimeout(500);
await knopf('Neue Checkliste').click(); await p.waitForTimeout(200);
await p.fill('input[aria-label="Titel"]', 'Materialien');
await knopf('Anlegen').click(); await p.waitForTimeout(700);
p.once('dialog', (d) => d.accept('Heft'));
await p.click('button[aria-label="Spalte hinzufügen"]'); await p.waitForTimeout(700);
await p.locator('td.board-zelle button.zellzustand').first().click();
await p.waitForTimeout(1300); // Debounce abwarten, damit der Aufruf im Verkehr steht.

// Note fuer ein zugeordnetes Kind erfassen — auch dieser Aufruf darf nur
// das Kuerzel enthalten.
await p.goto(B + '#/noten/3L'); await p.waitForTimeout(600);
await p.locator('.werkzeug', { hasText: 'Test 1' }).first().click(); await p.waitForTimeout(400);
await p.fill('input[aria-label="Thema des Tests"]', 'Wortarten');
await p.locator('input[aria-label="Thema des Tests"]').blur(); await p.waitForTimeout(500);
await p.locator('input.notenfeld').first().fill('96');
await p.waitForTimeout(1400); // Debounce abwarten.

// Durch alle Ansichten laufen, damit jeder Serveraufruf erfasst wird.
for (const pfad of ['#/', '#/klasse/3L', '#/noten', '#/noten/3L', '#/checklisten', '#/checklisten/3L',
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

// Und: wurde der Board-Zustand wirklich gesendet (mit Kuerzel, ohne Namen)?
const boardAufruf = verkehr.find(v => v.rumpf.includes('boardWerte'));
console.log(`${boardAufruf ? 'OK  ' : 'FEHL'}  Board-Zustand wird uebertragen`);
if (!boardAufruf) schlecht++;
const kuerzelDrin = boardAufruf && boardAufruf.rumpf.includes('3L-01');
console.log(`${kuerzelDrin ? 'OK  ' : 'FEHL'}  … und enthält das Kürzel, nicht den Namen`);
if (!kuerzelDrin) schlecht++;

// Und: wurde die Note wirklich gesendet (mit Kuerzel, ohne Namen)?
const notenAufruf = verkehr.find(v => v.rumpf.includes('"aktion":"erhebungen"'));
console.log(`${notenAufruf ? 'OK  ' : 'FEHL'}  Note wird uebertragen`);
if (!notenAufruf) schlecht++;
const noteKuerzel = notenAufruf && notenAufruf.rumpf.includes('3L-01');
console.log(`${noteKuerzel ? 'OK  ' : 'FEHL'}  … und enthält das Kürzel, nicht den Namen`);
if (!noteKuerzel) schlecht++;

console.log(schlecht === 0 ? '\nKEIN NAME HAT DAS GERAET VERLASSEN' : `\n${schlecht} PROBLEM(E)`);
await b.close();
process.exit(schlecht === 0 ? 0 : 1);
