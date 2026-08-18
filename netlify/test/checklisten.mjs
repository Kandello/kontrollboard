/**
 * Prueft die Checklisten: Anlegen, geteilt ueber alle Klassen, Spalten, vier
 * Zustaende, sofortige lokale Anzeige bei Strukturaenderungen, gebuendeltes
 * verzoegertes Speichern der Zellwerte, Zuruecksetzen, Archiv.
 *
 *   node mock.js &     (mit leerem Checklisten-Bestand starten)
 *   node checklisten.mjs
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

const aufrufe = [];
p.on('request', (r) => {
  if (!r.url().includes('/exec') || r.method() !== 'POST') return;
  let b = {};
  try { b = JSON.parse(r.postData() || '{}'); } catch (e) {}
  aufrufe.push(b);
});
const boardWerteAufrufe = () => aufrufe.filter((a) => a.aktion === 'boardWerte').map((a) => a.aenderungen);

const knopf = (t) => p.locator('button', { hasText: t }).first();
// Welche Checkliste zuletzt offen war, ist reine Anzeigesache und übersteht
// bewusst kein Neuladen — anders als die gespeicherten Haken selbst. Nach
// jedem reload() also gezielt wieder auswählen, statt uns auf den
// Startzustand (alphabetisch erste Checkliste) zu verlassen.
const waehleCheckliste = async (titel) => {
  await p.selectOption('select[aria-label="Checkliste auswählen"]', { label: titel });
  await p.waitForTimeout(200);
};
const wartetAuf = async (bedingung, versuche = 20) => {
  for (let i = 0; i < versuche; i++) {
    if (bedingung()) return true;
    await p.waitForTimeout(100);
  }
  return bedingung();
};

await p.goto(B + '/');
await p.evaluate(({ url, token }) => localStorage.setItem('kz.verbindung', JSON.stringify({ url, token })),
  { url: B + '/exec', token: TOKEN });
// Ein reiner Hash-Wechsel laedt die Module nicht neu — server.js wuerde die
// gerade gesetzte Verbindung nie einlesen. Erst ein echtes Neuladen liest sie ein.
await p.reload();
await p.goto(B + '#/checklisten/3L');
await p.waitForTimeout(600);

console.log('=== Leerer Zustand ===');
pruefe('Hinweis auf fehlende Checkliste', (await p.locator('.hinweis', { hasText: 'Noch keine Checkliste' }).innerText()).includes('Noch keine Checkliste'), true);
pruefe('keine JS-Fehler bisher', fehler.length, 0);

console.log('\n=== Checkliste anlegen: einfache Maske, sofort sichtbar ===');
{
  await knopf('Neue Checkliste').click(); await p.waitForTimeout(200);
  pruefe('Maske hat nur drei Felder (kein "Spalten übernehmen von")',
    await p.locator('.karte:not([hidden]) input, .karte:not([hidden]) select').count(), 3);

  await p.fill('input[aria-label="Titel"]', 'Materialien September');
  await p.fill('input[aria-label="Untertitel"]', 'Erster Monat');
  await p.fill('input[aria-label="Labels"]', 'Material, September');
  await knopf('Anlegen').click();
  await p.waitForTimeout(80); // absichtlich kurz: die Anzeige soll nicht auf den Server warten.

  pruefe('Titel sofort sichtbar', await p.locator('h3.board-titel').innerText(), 'Materialien September');
  pruefe('Untertitel sofort sichtbar', (await p.locator('.board-untertitel').innerText()), 'Erster Monat');
  const labels = await p.locator('.marke').allInnerTexts();
  pruefe('beide Labels als Chips', labels, ['Material', 'September']);
  pruefe('Checkliste sofort in der Auswahl', await p.locator('select[aria-label="Checkliste auswählen"] option').count(), 1);

  pruefe('boardErstellen läuft im Hintergrund an', await wartetAuf(() => aufrufe.some((a) => a.aktion === 'boardErstellen')), true);
}

console.log('\n=== Spalte hinzufügen: sofort sichtbar, ohne auf den Server zu warten ===');
{
  p.once('dialog', (d) => d.accept('Heft'));
  await p.click('button[aria-label="Spalte hinzufügen"]');
  await p.waitForTimeout(80);
  pruefe('Spalte "Heft" sofort in der Tabelle', await p.locator('.board-kopf-name').allInnerTexts(), ['Heft']);

  p.once('dialog', (d) => d.accept('Stifte'));
  await p.click('button[aria-label="Spalte hinzufügen"]');
  await p.waitForTimeout(80);
  pruefe('Spalte "Stifte" sofort ergänzt', await p.locator('.board-kopf-name').allInnerTexts(), ['Heft', 'Stifte']);

  pruefe('boardSpalteHinzufuegen läuft im Hintergrund', await wartetAuf(() => aufrufe.filter((a) => a.aktion === 'boardSpalteHinzufuegen').length === 2), true);
}

console.log('\n=== Zweite Checkliste, sofort auch geteilt ===');
{
  await knopf('Neue Checkliste').click(); await p.waitForTimeout(200);
  await p.fill('input[aria-label="Titel"]', 'Lesepass');
  await knopf('Anlegen').click(); await p.waitForTimeout(80);
  pruefe('zwei Checklisten in der Auswahl (3L)', await p.locator('select[aria-label="Checkliste auswählen"] option').count(), 2);

  // Zurück zur ersten Checkliste fuer die weiteren Tests.
  await p.selectOption('select[aria-label="Checkliste auswählen"]', { label: 'Materialien September' });
  await p.waitForTimeout(200);
}

console.log('\n=== Geteilt über alle Klassen, aber getrennte Tabellen ===');
{
  await p.goto(B + '#/checklisten/3M'); await p.waitForTimeout(400);
  pruefe('beide Checklisten auch unter 3M sichtbar', await p.locator('select[aria-label="Checkliste auswählen"] option').count(), 2);
  pruefe('dieselben Spalten unter 3M, ohne sie neu anzulegen', await p.locator('.board-kopf-name').allInnerTexts(), ['Heft', 'Stifte']);

  const zelle3M = p.locator('td.board-zelle button.zellzustand').first();
  pruefe('Zustand unter 3M ist unabhängig noch leer', await zelle3M.getAttribute('class'), 'zellzustand');
  await zelle3M.click();
  await p.waitForTimeout(1300); // Debounce abwarten.
  pruefe('unter 3M gesetzt', await zelle3M.getAttribute('class'), 'zellzustand zustand-haken');

  await p.goto(B + '#/checklisten/3L'); await p.waitForTimeout(400);
  const zelle3L = p.locator('td.board-zelle button.zellzustand').first();
  pruefe('unter 3L weiterhin leer — dieselbe Checkliste, aber getrennte Haken', await zelle3L.getAttribute('class'), 'zellzustand');
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

console.log('\n=== Zellwerte: sofort lokal sichtbar, gebündelt verzögert gespeichert ===');
{
  aufrufe.length = 0;
  const heft = p.locator('td.board-zelle button.zellzustand').nth(0);
  const stifte = p.locator('td.board-zelle button.zellzustand').nth(1);

  await heft.click(); // sofort sichtbar:
  pruefe('sofort lokal übernommen, ohne auf das Netz zu warten',
    await heft.getAttribute('class'), 'zellzustand zustand-haken');
  pruefe('Status zeigt "nicht gespeichert" direkt nach dem Antippen',
    (await p.locator('.status-warn').innerText()), 'nicht gespeichert');
  pruefe('noch kein Serveraufruf ausgelöst', boardWerteAufrufe().length, 0);

  await stifte.click(); // zweite Aenderung innerhalb des Verzoegerungsfensters
  await p.waitForTimeout(300);
  pruefe('nach 300ms immer noch kein Aufruf (Verzögerung wirkt)', boardWerteAufrufe().length, 0);

  await p.waitForTimeout(1000);
  pruefe('nach etwa 1s genau ein gebündelter Aufruf', boardWerteAufrufe().length, 1);
  pruefe('beide Änderungen im selben Aufruf', boardWerteAufrufe()[0].length, 2);
  pruefe('Status zeigt "gespeichert"', await p.locator('.status-gut').innerText(), 'gespeichert');
}

console.log('\n=== Übersteht ein Neuladen (liegt wirklich in der Tabelle) ===');
{
  await p.reload(); await p.waitForTimeout(700);
  await waehleCheckliste('Materialien September');
  const heftNeu = p.locator('td.board-zelle button.zellzustand').nth(0);
  pruefe('Zustand nach Reload erhalten', await heftNeu.getAttribute('class'), 'zellzustand zustand-haken');
}

console.log('\n=== Spalte umbenennen: sofort sichtbar ===');
{
  p.once('dialog', (d) => { pruefe('Umbenennen-Dialog zeigt aktuellen Namen', d.defaultValue(), 'Heft'); d.accept('Schulheft'); });
  await p.locator('.board-kopf-werkzeuge button[aria-label="Umbenennen"]').first().click();
  await p.waitForTimeout(80);
  pruefe('neue Bezeichnung sofort übernommen', (await p.locator('.board-kopf-name').allInnerTexts())[0], 'Schulheft');

  await p.reload(); await p.waitForTimeout(700);
  await waehleCheckliste('Materialien September');
  pruefe('übersteht Neuladen', (await p.locator('.board-kopf-name').allInnerTexts())[0], 'Schulheft');
}

console.log('\n=== Reihenfolge ändern: sofort sichtbar ===');
{
  pruefe('Ausgangsreihenfolge', await p.locator('.board-kopf-name').allInnerTexts(), ['Schulheft', 'Stifte']);
  await p.locator('.board-kopf-werkzeuge button[aria-label="Nach rechts verschieben"]').first().click();
  await p.waitForTimeout(80);
  pruefe('sofort vertauscht', await p.locator('.board-kopf-name').allInnerTexts(), ['Stifte', 'Schulheft']);

  await p.reload(); await p.waitForTimeout(700);
  await waehleCheckliste('Materialien September');
  pruefe('Reihenfolge übersteht Neuladen', await p.locator('.board-kopf-name').allInnerTexts(), ['Stifte', 'Schulheft']);
}

console.log('\n=== Spalte löschen fragt nach, kaskadiert und ist sofort sichtbar ===');
{
  // "Stifte" hat noch den Zustand aus dem gebündelten Speichern von oben.
  let dialogGesehen = false;
  p.once('dialog', (d) => { dialogGesehen = true; d.dismiss(); });
  await p.locator('.board-kopf-werkzeuge button[aria-label="Löschen"]').first().click();
  await p.waitForTimeout(200);
  pruefe('Rückfrage erschien', dialogGesehen, true);
  pruefe('bei Abbruch bleibt die Spalte', await p.locator('.board-kopf-name').count(), 2);

  p.once('dialog', (d) => d.accept());
  await p.locator('.board-kopf-werkzeuge button[aria-label="Löschen"]').first().click();
  await p.waitForTimeout(80);
  pruefe('nach Bestätigung sofort gelöscht', await p.locator('.board-kopf-name').allInnerTexts(), ['Schulheft']);
}

console.log('\n=== Zurücksetzen: ohne Rückfrage, sofort sichtbar, nur für die eigene Klasse ===');
{
  const zelle = p.locator('td.board-zelle button.zellzustand').first();
  pruefe('Zelle noch belegt vor dem Zurücksetzen', await zelle.getAttribute('class'), 'zellzustand zustand-haken');
  // Dieselbe Spalte trägt seit "Geteilt über alle Klassen" oben auch für 3M
  // einen Haken — der darf durch das Zurücksetzen auf 3L nicht verschwinden.

  let dialogAufgetreten = false;
  const merkeDialog = (d) => { dialogAufgetreten = true; d.accept(); };
  p.on('dialog', merkeDialog);
  await knopf('Zurücksetzen').click(); await p.waitForTimeout(80);
  p.off('dialog', merkeDialog);
  pruefe('keine Rückfrage mehr — sofort ausgeführt', dialogAufgetreten, false);
  pruefe('3L sofort leer', await p.locator('td.board-zelle button.zellzustand').first().getAttribute('class'), 'zellzustand');
  pruefe('Spalte bleibt erhalten', await p.locator('.board-kopf-name').count(), 1);

  await p.goto(B + '#/checklisten/3M'); await p.waitForTimeout(400);
  await waehleCheckliste('Materialien September');
  pruefe('3M weiterhin gesetzt — Zurücksetzen betraf nur 3L',
    await p.locator('td.board-zelle button.zellzustand').first().getAttribute('class'), 'zellzustand zustand-haken');

  await p.goto(B + '#/checklisten/3L'); await p.waitForTimeout(400);
  await waehleCheckliste('Materialien September');
}

console.log('\n=== Kein Gesamtzähler ===');
pruefe('keine Zählerchip-Klasse auf der Seite', await p.locator('.zaehler, .gesamtzaehler').count(), 0);

console.log('\n=== Nummer zeigt listennummer, nicht die Kürzelzahl ===');
{
  const ersteNr = await p.locator('td.sticky-nr').first().innerText();
  pruefe('erste Zeile ist Listenplatz 1', ersteNr, '1');
}

console.log('\n=== Archivieren: ohne Rückfrage, sofort aus der Auswahl verschwunden ===');
{
  let dialogAufgetreten = false;
  const merkeDialog = (d) => { dialogAufgetreten = true; d.accept(); };
  p.on('dialog', merkeDialog);
  await knopf('Archivieren').click(); await p.waitForTimeout(80);
  p.off('dialog', merkeDialog);
  pruefe('keine Rückfrage mehr — sofort ausgeführt', dialogAufgetreten, false);
  pruefe('verschwindet sofort aus der aktiven Auswahl', await p.locator('select[aria-label="Checkliste auswählen"] option').count(), 1);
  const uebrig = await p.locator('select[aria-label="Checkliste auswählen"] option').first().innerText();
  pruefe('die andere Checkliste bleibt aktiv', uebrig, 'Lesepass');
}

console.log('\n=== Archivansicht: schreibgeschützt, filterbar, auch unter anderer Klasse ===');
{
  await knopf('Archiv ansehen').click(); await p.waitForTimeout(400);
  pruefe('archivierte Checkliste gelistet', (await p.locator('.werkzeug .titel').allInnerTexts()).includes('Materialien September'), true);

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
  pruefe('Label "September" zeigt die Checkliste', (await p.locator('.werkzeug .titel').count()) >= 1, true);

  const heute = new Date(); const morgen = new Date(heute.getTime() + 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);
  await p.fill('input[aria-label="Von"]', iso(morgen));
  await p.waitForTimeout(300);
  pruefe('Zeitraum in der Zukunft zeigt nichts', await p.locator('.leer').first().innerText(),
    'Keine archivierten Checklisten für diese Auswahl.');
  await p.fill('input[aria-label="Von"]', ''); await p.waitForTimeout(300); // Filter wieder zuruecksetzen.

  await knopf('Zu den aktiven Checklisten').click(); await p.waitForTimeout(400);
  pruefe('zurück bei den aktiven Checklisten', await p.locator('h3.board-titel').innerText(), 'Lesepass');

  // Archivieren betraf nur 3L — unter einer anderen Klasse bleibt dieselbe
  // Checkliste aktiv und taucht dort NICHT im Archiv auf.
  await p.goto(B + '#/checklisten/3OB'); await p.waitForTimeout(400);
  pruefe('unter 3OB weiterhin beide Checklisten aktiv',
    await p.locator('select[aria-label="Checkliste auswählen"] option').allInnerTexts(),
    ['Lesepass', 'Materialien September']);
  await knopf('Archiv ansehen').click(); await p.waitForTimeout(400);
  pruefe('unter 3OB nicht archiviert — Archivieren betraf nur 3L',
    (await p.locator('.werkzeug .titel').allInnerTexts()).includes('Materialien September'), false);
}

console.log('\n=== Löschen: ohne Rückfrage, sofort und vollständig — anders als Archivieren betrifft es alle Klassen ===');
{
  await knopf('Zu den aktiven Checklisten').click(); await p.waitForTimeout(400);
  await waehleCheckliste('Materialien September');

  let dialogAufgetreten = false;
  const merkeDialog = (d) => { dialogAufgetreten = true; d.accept(); };
  p.on('dialog', merkeDialog);
  await knopf('Löschen').click(); await p.waitForTimeout(80);
  p.off('dialog', merkeDialog);
  pruefe('keine Rückfrage beim Löschen', dialogAufgetreten, false);
  pruefe('sofort aus der Auswahl verschwunden (3OB)',
    await p.locator('select[aria-label="Checkliste auswählen"] option').allInnerTexts(), ['Lesepass']);

  await p.goto(B + '#/checklisten/3M'); await p.waitForTimeout(400);
  pruefe('auch unter 3M verschwunden',
    await p.locator('select[aria-label="Checkliste auswählen"] option').allInnerTexts(), ['Lesepass']);

  // War auf 3L archiviert (nicht nur aktiv) — muss auch dort aus dem Archiv
  // verschwinden, statt bloß irgendwo hängen zu bleiben.
  await p.goto(B + '#/checklisten/3L'); await p.waitForTimeout(400);
  await knopf('Archiv ansehen').click(); await p.waitForTimeout(400);
  pruefe('auch aus 3Ls Archiv verschwunden — gelöscht, nicht nur reaktiviert',
    (await p.locator('.werkzeug .titel').allInnerTexts()).includes('Materialien September'), false);
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
