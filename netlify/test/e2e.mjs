import { chromium } from 'playwright';
const B = 'http://localhost:8901';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1000, height: 1100 } });
const p = await ctx.newPage();
const fehler = [];
p.on('pageerror', e => fehler.push('PAGEERROR: ' + e.message));
p.on('console', m => { if (m.type() === 'error') fehler.push('CONSOLE: ' + m.text()); });

let n = 0, schlecht = 0;
const knopf = (t) => p.locator('button', { hasText: t }).first();
const pruefe = (name, ok, extra = '') => { n++; if (!ok) schlecht++; console.log(`${ok?'OK  ':'FEHL'}  ${name}${ok?'':'  '+extra}`); };

await p.goto(B); await p.waitForTimeout(600);
pruefe('Erstlauf: Banner "Verbindung einrichten"', (await p.locator('.hinweis').first().innerText()).includes('Verbindung einrichten'));

// Einstellungen ausfuellen
await knopf('Zu den Einstellungen').click(); await p.waitForTimeout(300);
pruefe('Einstellungen erreicht', await p.locator('h1').innerText() === 'Einstellungen');
await p.fill('#e-url', `${B}/exec`);
await p.fill('#e-token', 'falschertoken');
await knopf('Speichern und prüfen').click(); await p.waitForTimeout(600);
pruefe('falscher Token wird abgewiesen', (await p.locator('.hinweis.schlecht').first().innerText()).includes('Zugang verweigert'));

await p.fill('#e-token', 'testtoken123');
await knopf('Speichern und prüfen').click(); await p.waitForTimeout(800);
pruefe('richtiger Token: Verbindung steht', (await p.locator('.hinweis.gut').first().innerText()).includes('69 Kürzel'));

// Startseite
await p.goto(B + '#/'); await p.waitForTimeout(500);
pruefe('3 Klassenknoepfe', await p.locator('.klassenknopf').count() === 3);
pruefe('Erstlauf-Zuordnungsbanner', (await p.locator('.hinweis').first().innerText()).includes('Zuordnungsdatei laden'));
pruefe('Klassenknopf zeigt 23 Kinder', (await p.locator('.klassenknopf').first().innerText()).includes('23 Kinder'));

// Ebene 2
await p.locator('.klassenknopf').first().click(); await p.waitForTimeout(400);
pruefe('URL enthaelt Klasse', p.url().includes('#/klasse/3L'));
pruefe('Pfadleiste Start > 3L', (await p.locator('.pfad').innerText()).replace(/\s+/g,' ').includes('Start › 3L'));
pruefe('3 Werkzeugeinstiege', await p.locator('.werkzeug').count() === 3);
pruefe('Klassenliste 23 Zeilen', await p.locator('table.liste tbody tr').count() === 23);
const ersteZeile = await p.locator('table.liste tbody tr').first().innerText();
pruefe('Liste beginnt bei Nr. 1', ersteZeile.trim().startsWith('1'), ersteZeile);
pruefe('ohne Zuordnung erscheint Kuerzel', (await p.locator('table.liste tbody tr .nurkuerzel').count()) === 23);

// Sortierung: listennummer aufsteigend, NICHT Kuerzel
const nummern = await p.locator('table.liste tbody tr td.nummer').allInnerTexts();
pruefe('nach listennummer sortiert', JSON.stringify(nummern.map(Number)) === JSON.stringify([...Array(23)].map((_,i)=>i+1)));
const kuerzel = await p.locator('table.liste tbody tr td.kuerzel').allInnerTexts();
const nurK = kuerzel.filter(k=>/^3L-/.test(k)).map(k=>Number(k.split('-')[1]));
pruefe('Kuerzel NICHT aufsteigend (Mischung intakt)', JSON.stringify(nurK) !== JSON.stringify([...nurK].sort((a,b)=>a-b)));

// Werkzeug-Unteransicht
await p.locator('.werkzeug').nth(1).click(); await p.waitForTimeout(400);
pruefe('URL Werkzeug boards', p.url().includes('/boards'));
pruefe('Pfad zeigt Kontrollboards', (await p.locator('.pfad').innerText()).includes('Kontrollboards'));

// Klassenwechsel ohne Umweg ueber Start
await p.selectOption('#klassenwechsel', '3OB'); await p.waitForTimeout(400);
pruefe('Klasse gewechselt, Werkzeug erhalten', p.url().includes('#/klasse/3OB/boards'));

// Zurueck-Knopf
await p.goBack(); await p.waitForTimeout(400);
pruefe('Zurueck-Knopf funktioniert', p.url().includes('3L'));

// Zuordnung laden
const csv = '﻿schluessel;nachname;vorname;geschlecht;version\r\n' +
  'KLASSE-3L;Beispiel;Anna;;2026-08-17T10:00:00Z\r\n' +
  '3L-01;Alpha;Ben;m;2026-08-17T10:00:00Z\r\n' +
  '3L-11;Beta;Carla;w;2026-08-17T10:00:00Z\r\n' +
  'UNGUELTIG;Gamma;Dora;;2026-08-17T10:00:00Z\r\n';
await p.goto(B + '#/zuordnung'); await p.waitForTimeout(500);
pruefe('Editor zeigt Klassen', await p.locator('.karte h2').count() >= 3);
const [chooser] = await Promise.all([ p.waitForEvent('filechooser'), knopf('Zuordnungsdatei laden').click() ]);
await chooser.setFiles({ name: 'zuordnung.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
await p.waitForTimeout(700);
const meldung = await p.locator('.hinweis').first().innerText();
pruefe('3 Eintraege uebernommen, 1 uebersprungen', meldung.includes('3 Einträge') && meldung.includes('1 Zeile'), meldung.replace(/\n/g,' | '));

// Namen erscheinen jetzt
await p.goto(B + '#/klasse/3L'); await p.waitForTimeout(500);
const zeilen = await p.locator('table.liste tbody tr').allInnerTexts();
pruefe('3L-01 zeigt "Ben Alpha"', zeilen.some(z => z.includes('Ben Alpha')));
pruefe('Klassenlehrkraft im Kopf', (await p.locator('.feldhilfe').first().innerText()).includes('Anna Beispiel'));
pruefe('unzugeordnete bleiben Kuerzel', await p.locator('table.liste tbody tr .nurkuerzel').count() === 21);

// Namen verbergen
await p.locator('.schalter input').check(); await p.waitForTimeout(400);
const verborgen = await p.locator('table.liste tbody tr').allInnerTexts();
pruefe('verbergen: kein Klarname mehr', !verborgen.some(z => z.includes('Ben Alpha')));
pruefe('verbergen: Lehrkraft weg', !(await p.locator('.feldhilfe').first().innerText()).includes('Anna Beispiel'));

// Bleibt der Schalter ueber ein Neuladen erhalten?
await p.reload(); await p.waitForTimeout(700);
pruefe('verbergen ueberdauert Neuladen', await p.locator('.schalter input').isChecked());
await p.locator('.schalter input').uncheck(); await p.waitForTimeout(300);

// Abgleich-Banner: 21 fehlende Kuerzel in 3L + alle anderen Klassen
await p.goto(B + '#/'); await p.waitForTimeout(600);
const banner = await p.locator('.hinweis').allInnerTexts();
pruefe('Abgleich meldet fehlende Zuordnungen', banner.some(t => t.includes('Zuordnung weicht ab') && t.includes('ohne Zuordnung')));

// Banner schliessen und Persistenz pruefen
await knopf('Schließen').click(); await p.waitForTimeout(400);
await p.reload(); await p.waitForTimeout(700);
const nachher = await p.locator('.hinweis').allInnerTexts();
pruefe('geschlossenes Banner bleibt geschlossen', !nachher.some(t => t.includes('Zuordnung weicht ab')));

// Export
await p.goto(B + '#/zuordnung'); await p.waitForTimeout(500);
const [dl] = await Promise.all([ p.waitForEvent('download'), knopf('Als Datei sichern').click() ]);
pruefe('Download heisst zuordnung.csv', dl.suggestedFilename() === 'zuordnung.csv');
const strom = await dl.createReadStream();
let raus = ''; for await (const c of strom) raus += c;
pruefe('Export hat BOM', raus.charCodeAt(0) === 0xFEFF);
pruefe('Export enthaelt Kopfzeile', raus.includes('schluessel;nachname;vorname;geschlecht;version'));
pruefe('Export enthaelt Klassenzeile zuerst', raus.split('\r\n')[1].startsWith('KLASSE-3L'));
pruefe('Export enthaelt 3L-01', raus.includes('3L-01;Alpha;Ben;m;'));

// Unbekannte Route
await p.goto(B + '#/quatsch/tief'); await p.waitForTimeout(500);
pruefe('unbekannte Route landet auf Start', p.url().endsWith('#/'));

console.log('\nJS-Fehler:', fehler.length ? fehler : 'keine');
if (fehler.length) schlecht += fehler.length;
console.log(schlecht === 0 ? `\nALLE ${n} TESTS BESTANDEN` : `\n${schlecht} von ${n} FEHLGESCHLAGEN`);
await p.screenshot({ path: 'schritt2.png', fullPage: true });
await b.close();
process.exit(schlecht === 0 ? 0 : 1);
