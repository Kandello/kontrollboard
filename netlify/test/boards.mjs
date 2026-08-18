/**
 * Prueft die Kontrollboards: Anlegen, Spalten, vier Zustaende, gebuendeltes
 * verzoegertes Speichern, Zuruecksetzen, Archiv.
 *
 *   node mock.js &     (mit leerem Board-Bestand starten)
 *   node boards.mjs
 */

import { chromium } from 'playwright';

const B = 'http://localhost:8901';
const TOKEN = 'testtoken123';

let n = 0, schlecht = 0;
function pruefe(name, ist, soll) {
  n++;
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) schlecht++;
  console.log(`${ok ? 'OK  ' : 'FEHL'}  ${name}` +
    (ok ? '' : `\n        ist:  ${JSON.stringify(ist)}\n        soll: ${JSON.stringify(soll)}`));
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
const p = await ctx.newPage();
const fehler = [];
p.on('pageerror', (e) => fehler.push('PAGEERROR: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') fehler.push('CONSOLE: ' + m.text()); });

const boardWerteAufrufe = [];
p.on('request', (r) => {
  if (!r.url().includes('/exec') || r.method() !== 'POST') return;
  let b = {};
  try { b = JSON.parse(r.postData() || '{}'); } catch (e) {}
  if (b.aktion === 'boardWerte') boardWerteAufrufe.push(b.aenderungen);
});

const knopf = (t) => p.locator('button', { hasText: t }).first();

await p.goto(B + '/');
await p.evaluate(({ url, token }) => localStorage.setItem('kz.verbindung', JSON.stringify({ url, token })),
  { url: B + '/exec', token: TOKEN });
// Ein reiner Hash-Wechsel laedt die Module nicht neu — server.js wuerde die
// gerade gesetzte Verbindung nie einlesen. Erst ein echtes Neuladen liest sie ein.
await p.reload();
await p.goto(B + '#/klasse/3L/boards');
await p.waitForTimeout(600);

console.log('=== Leerer Zustand ===');
pruefe('Hinweis auf fehlendes Board', (await p.locator('.hinweis', { hasText: 'Noch kein Board' }).innerText()).includes('Noch kein Board'), true);
pruefe('keine JS-Fehler bisher', fehler.length, 0);

console.log('\n=== Board anlegen ===');
{
  await knopf('Neues Board').click(); await p.waitForTimeout(200);
  await p.fill('input[aria-label="Titel"]', 'Materialien September');
  await p.fill('input[aria-label="Untertitel"]', 'Erster Monat');
  await p.fill('input[aria-label="Labels"]', 'Material, September');
  await knopf('Anlegen').click(); await p.waitForTimeout(700);

  pruefe('Titel erscheint', await p.locator('h3.board-titel').innerText(), 'Materialien September');
  pruefe('Untertitel erscheint', (await p.locator('.board-untertitel').innerText()), 'Erster Monat');
  const labels = await p.locator('.marke').allInnerTexts();
  pruefe('beide Labels als Chips', labels, ['Material', 'September']);
  pruefe('Board in der Auswahl', await p.locator('select[aria-label="Board auswählen"] option').count(), 1);
}

console.log('\n=== Zweites Board mit übernommenen Spalten ===');
{
  p.once('dialog', (d) => d.accept('Heft'));
  await p.click('button[aria-label="Spalte hinzufügen"]'); await p.waitForTimeout(700);
  p.once('dialog', (d) => d.accept('Stifte'));
  await p.click('button[aria-label="Spalte hinzufügen"]'); await p.waitForTimeout(700);
  pruefe('zwei Spalten am ersten Board', await p.locator('.board-kopf-name').count(), 2);

  await knopf('Neues Board').click(); await p.waitForTimeout(200);
  await p.fill('input[aria-label="Titel"]', 'Materialien September (3M)');
  await p.selectOption('select[aria-label="Spalten übernehmen von"]', { label: 'Materialien September (3L)' });
  await knopf('Anlegen').click(); await p.waitForTimeout(700);

  pruefe('zwei Boards in der Auswahl', await p.locator('select[aria-label="Board auswählen"] option').count(), 2);
  pruefe('übernommene Spalten identisch benannt', await p.locator('.board-kopf-name').allInnerTexts(), ['Heft', 'Stifte']);

  // Zurueck zum ersten Board fuer die weiteren Tests.
  await p.selectOption('select[aria-label="Board auswählen"]', { label: 'Materialien September' });
  await p.waitForTimeout(300);
}

console.log('\n=== Vier Zustände, feste Reihenfolge, aria-Attribute ===');
{
  const zelle = p.locator('td.board-zelle button.zellzustand').first();
  pruefe('anfangs leer, aria-pressed=false', await zelle.getAttribute('aria-pressed'), 'false');
  pruefe('aria-label vorhanden und sprechend', (await zelle.getAttribute('aria-label')).includes('noch nicht angesehen'), true);

  await zelle.click();
  pruefe('1: haken, blau markiert', await zelle.getAttribute('class'), 'zellzustand zustand-haken');
  pruefe('1: aria-pressed=true', await zelle.getAttribute('aria-pressed'), 'true');
  pruefe('1: Symbol gesetzt', await zelle.innerText(), '✓');

  await zelle.click();
  pruefe('2: teilweise', await zelle.getAttribute('class'), 'zellzustand zustand-teilweise');
  pruefe('2: eigenes Symbol, nicht identisch mit haken', await zelle.innerText(), '◐');

  await zelle.click();
  pruefe('3: x', await zelle.getAttribute('class'), 'zellzustand zustand-x');
  pruefe('3: Symbol x', await zelle.innerText(), '✕');
  pruefe('3: aria-pressed weiterhin true (x ist nicht leer)', await zelle.getAttribute('aria-pressed'), 'true');

  await zelle.click();
  pruefe('4: zurück zu leer', await zelle.getAttribute('class'), 'zellzustand');
  pruefe('4: aria-pressed=false', await zelle.getAttribute('aria-pressed'), 'false');
  pruefe('4: kein Symbol mehr', await zelle.innerText(), '');
}

console.log('\n=== Sofort lokal sichtbar, gebündelt verzögert gespeichert ===');
{
  boardWerteAufrufe.length = 0;
  const heft = p.locator('td.board-zelle button.zellzustand').nth(0);
  const stifte = p.locator('td.board-zelle button.zellzustand').nth(1);

  await heft.click(); // sofort sichtbar:
  pruefe('sofort lokal übernommen, ohne auf das Netz zu warten',
    await heft.getAttribute('class'), 'zellzustand zustand-haken');
  pruefe('Status zeigt "nicht gespeichert" direkt nach dem Antippen',
    (await p.locator('.status-warn').innerText()), 'nicht gespeichert');
  pruefe('noch kein Serveraufruf ausgelöst', boardWerteAufrufe.length, 0);

  await stifte.click(); // zweite Aenderung innerhalb des Verzoegerungsfensters
  await p.waitForTimeout(300);
  pruefe('nach 300ms immer noch kein Aufruf (Verzögerung wirkt)', boardWerteAufrufe.length, 0);

  await p.waitForTimeout(1000);
  pruefe('nach etwa 1s genau ein gebündelter Aufruf', boardWerteAufrufe.length, 1);
  pruefe('beide Änderungen im selben Aufruf', boardWerteAufrufe[0].length, 2);
  pruefe('Status zeigt "gespeichert"', await p.locator('.status-gut').innerText(), 'gespeichert');
}

console.log('\n=== Übersteht ein Neuladen (liegt wirklich in der Tabelle) ===');
{
  await p.reload(); await p.waitForTimeout(700);
  const heftNeu = p.locator('td.board-zelle button.zellzustand').nth(0);
  pruefe('Zustand nach Reload erhalten', await heftNeu.getAttribute('class'), 'zellzustand zustand-haken');
}

console.log('\n=== Spalte umbenennen ===');
{
  p.once('dialog', (d) => { pruefe('Umbenennen-Dialog zeigt aktuellen Namen', d.defaultValue(), 'Heft'); d.accept('Schulheft'); });
  await p.locator('.board-kopf-werkzeuge button[aria-label="Umbenennen"]').first().click();
  await p.waitForTimeout(700);
  pruefe('neue Bezeichnung übernommen', (await p.locator('.board-kopf-name').allInnerTexts())[0], 'Schulheft');
}

console.log('\n=== Reihenfolge ändern ===');
{
  pruefe('Ausgangsreihenfolge', await p.locator('.board-kopf-name').allInnerTexts(), ['Schulheft', 'Stifte']);
  await p.locator('.board-kopf-werkzeuge button[aria-label="Nach rechts verschieben"]').first().click();
  await p.waitForTimeout(700);
  pruefe('vertauscht', await p.locator('.board-kopf-name').allInnerTexts(), ['Stifte', 'Schulheft']);

  await p.reload(); await p.waitForTimeout(700);
  pruefe('Reihenfolge übersteht Neuladen', await p.locator('.board-kopf-name').allInnerTexts(), ['Stifte', 'Schulheft']);
}

console.log('\n=== Spalte löschen fragt nach und kaskadiert ===');
{
  // "Stifte" hat noch den Zustand aus dem gebündelten Speichern von oben.
  let dialogGesehen = false;
  p.once('dialog', (d) => { dialogGesehen = true; d.dismiss(); });
  await p.locator('.board-kopf-werkzeuge button[aria-label="Löschen"]').first().click();
  await p.waitForTimeout(300);
  pruefe('Rückfrage erschien', dialogGesehen, true);
  pruefe('bei Abbruch bleibt die Spalte', await p.locator('.board-kopf-name').count(), 2);

  p.once('dialog', (d) => d.accept());
  await p.locator('.board-kopf-werkzeuge button[aria-label="Löschen"]').first().click();
  await p.waitForTimeout(700);
  pruefe('nach Bestätigung gelöscht', await p.locator('.board-kopf-name').allInnerTexts(), ['Schulheft']);
}

console.log('\n=== Zurücksetzen fragt nach und leert nur die Werte ===');
{
  const zelle = p.locator('td.board-zelle button.zellzustand').first();
  pruefe('Zelle noch belegt vor dem Zurücksetzen', await zelle.getAttribute('class'), 'zellzustand zustand-haken');

  p.once('dialog', (d) => d.dismiss());
  await knopf('Zurücksetzen').click(); await p.waitForTimeout(300);
  pruefe('bei Abbruch unverändert', await p.locator('td.board-zelle button.zellzustand').first().getAttribute('class'), 'zellzustand zustand-haken');

  p.once('dialog', (d) => d.accept());
  await knopf('Zurücksetzen').click(); await p.waitForTimeout(700);
  pruefe('nach Bestätigung leer', await p.locator('td.board-zelle button.zellzustand').first().getAttribute('class'), 'zellzustand');
  pruefe('Spalte bleibt erhalten', await p.locator('.board-kopf-name').count(), 1);
}

console.log('\n=== Kein Gesamtzähler ===');
pruefe('keine Zählerchip-Klasse auf der Seite', await p.locator('.zaehler, .gesamtzaehler').count(), 0);

console.log('\n=== Nummer zeigt listennummer, nicht die Kürzelzahl ===');
{
  const ersteNr = await p.locator('td.sticky-nr').first().innerText();
  pruefe('erste Zeile ist Listenplatz 1', ersteNr, '1');
}

console.log('\n=== Archivieren ===');
{
  let dialogGesehen = false;
  p.once('dialog', (d) => { dialogGesehen = true; d.dismiss(); });
  await knopf('Archivieren').click(); await p.waitForTimeout(300);
  pruefe('Rückfrage vor dem Archivieren', dialogGesehen, true);
  pruefe('bei Abbruch weiterhin in der Auswahl', await p.locator('select[aria-label="Board auswählen"] option').count(), 2);

  p.once('dialog', (d) => d.accept());
  await knopf('Archivieren').click(); await p.waitForTimeout(700);
  pruefe('verschwindet aus der aktiven Auswahl', await p.locator('select[aria-label="Board auswählen"] option').count(), 1);
  const uebrig = await p.locator('select[aria-label="Board auswählen"] option').first().innerText();
  pruefe('das andere Board bleibt aktiv', uebrig, 'Materialien September (3M)');
}

console.log('\n=== Archivansicht: schreibgeschützt, filterbar ===');
{
  await knopf('Archiv ansehen').click(); await p.waitForTimeout(400);
  pruefe('archiviertes Board gelistet', (await p.locator('.werkzeug .titel').allInnerTexts()).includes('Materialien September'), true);

  await p.click('.werkzeug .titel >> text=Materialien September'); await p.waitForTimeout(400);
  pruefe('schreibgeschützte Ansicht: keine anklickbaren Zellzustände',
    await p.locator('td.board-zelle button.zellzustand').count(), 0);
  pruefe('schreibgeschützte Ansicht zeigt die Zustände als Text',
    await p.locator('td.board-zelle span.zellzustand').count() > 0, true);
  pruefe('keine Spaltenwerkzeuge im Archiv', await p.locator('.board-kopf-werkzeuge').count(), 0);
  pruefe('kein Zurücksetzen-Knopf im Archiv', await p.locator('button', { hasText: 'Zurücksetzen' }).count(), 0);

  // Filter nach Label, das nicht vorkommt.
  await p.selectOption('select[aria-label="Nach Label filtern"]', { label: 'September' });
  await p.waitForTimeout(300);
  pruefe('Label "September" zeigt das Board', (await p.locator('.werkzeug .titel').count()) >= 1, true);

  const heute = new Date(); const morgen = new Date(heute.getTime() + 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);
  await p.fill('input[aria-label="Von"]', iso(morgen));
  await p.waitForTimeout(300);
  pruefe('Zeitraum in der Zukunft zeigt nichts', await p.locator('.leer').first().innerText(),
    'Keine archivierten Boards für diese Auswahl.');

  await knopf('Zu den aktiven Boards').click(); await p.waitForTimeout(400);
  pruefe('zurück bei den aktiven Boards', await p.locator('h3.board-titel').innerText(), 'Materialien September (3M)');
}

console.log('\n=== Ungültiges Kürzel wird serverseitig abgewiesen ===');
{
  // Direkter Aufruf ausserhalb der Oberflaeche, wie ein manipulierter Client ihn schicken koennte.
  const antwort = await p.evaluate(async ({ url, token }) => {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ token, aktion: 'boardWerte', aenderungen: [
        { board_id: 'x', spalte_id: 'y', kuerzel: 'Mustermann', zustand: 'haken' }
      ] })
    });
    return r.json();
  }, { url: B + '/exec', token: TOKEN });
  pruefe('Server weist Namen statt Kürzel ab', antwort.ok, false);
  pruefe('Fehlermeldung nennt den Grund', /Ungültiges Kürzel/.test(antwort.fehler), true);
}

console.log('\nJS-Fehler:', fehler.length ? fehler : 'keine');
console.log(schlecht === 0 && !fehler.length
  ? `\nALLE ${n} TESTS BESTANDEN`
  : `\n${schlecht} von ${n} FEHLGESCHLAGEN`);

await browser.close();
process.exit(schlecht === 0 && !fehler.length ? 0 : 1);
