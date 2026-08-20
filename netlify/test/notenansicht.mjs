/**
 * Prueft die Oberflaeche des Notentrackers: Testkacheln mit Thema, Eingabe,
 * gebuendeltes verzoegertes Speichern, Uebersicht und Auswertung.
 *
 * Die Notenformel selbst wird in noten.mjs gegen die bisherige Tabelle
 * geprueft — hier geht es darum, dass die Oberflaeche die richtigen Werte
 * an den richtigen Stellen zeigt und speichert.
 *
 *   node mock.js &     (mit leerem Notenbestand starten)
 *   node notenansicht.mjs
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
const ctx = await browser.newContext({ viewport: { width: 1200, height: 1100 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
const p = await ctx.newPage();
const fehler = [];
p.on('pageerror', (e) => fehler.push('PAGEERROR: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') fehler.push('CONSOLE: ' + m.text()); });

const aufrufe = [];
p.on('request', (r) => {
  if (!r.url().includes('/exec') || r.method() !== 'POST') return;
  try { aufrufe.push(JSON.parse(r.postData() || '{}')); } catch (e) {}
});
const erhebungsAufrufe = () => aufrufe.filter((a) => a.aktion === 'erhebungen');

const knopf = (t) => p.locator('button', { hasText: t }).first();
const kachel = (t) => p.locator('.werkzeug', { hasText: t }).first();

await p.goto(B + '/');
await p.evaluate(({ url, token }) => localStorage.setItem('kz.verbindung', JSON.stringify({ url, token })),
  { url: B + '/exec', token: TOKEN });
await p.reload();
await p.goto(B + '#/noten');
await p.waitForTimeout(800);

console.log('=== Einstieg ===');
pruefe('landet direkt in der ersten Klasse', p.url().includes('#/noten/3L'), true);
pruefe('Pfad zeigt Notentracker', (await p.locator('.pfad').innerText()).includes('Notentracker'), true);
pruefe('drei Klassenknöpfe im Kopf',
  await p.locator('[role="group"][aria-label="Klasse wechseln"] button').count(), 3);
pruefe('keine JS-Fehler bisher', fehler.length, 0);

console.log('\n=== Testkacheln: drei Tests je Halbjahr, Thema als kleine Zeile ===');
{
  const titel = await p.locator('.werkzeug .titel').allInnerTexts();
  pruefe('genau drei Tests, keine Monatskacheln mehr', titel, ['Test 1', 'Test 2', 'Test 3']);
  pruefe('Thema anfangs leer',
    (await kachel('Test 1').innerText()).includes('Thema noch nicht eingetragen'), true);
  pruefe('Erfassungsstand anfangs leer',
    (await kachel('Test 1').innerText()).includes('noch nichts erfasst'), true);
}

console.log('\n=== Test erfassen: Thema und Werte ===');
{
  await kachel('Test 1').click(); await p.waitForTimeout(400);
  pruefe('Eingabeliste offen', await p.locator('.noten-titel').innerText(), 'Test 1');
  pruefe('ein Feld je Kind', await p.locator('input.notenfeld').count(), 23);
  pruefe('Themenfeld vorhanden', await p.locator('input[aria-label="Thema des Tests"]').count(), 1);

  await p.fill('input[aria-label="Thema des Tests"]', 'Wortarten');
  await p.locator('input[aria-label="Thema des Tests"]').blur();
  await p.waitForTimeout(600);
  pruefe('Thema wurde gesendet', aufrufe.some((a) => a.aktion === 'testThema' && a.thema === 'Wortarten'), true);

  aufrufe.length = 0;
  const felder = p.locator('input.notenfeld');
  await felder.nth(0).fill('96');
  pruefe('noch kein Serveraufruf direkt nach der Eingabe', erhebungsAufrufe().length, 0);
  pruefe('Status meldet ungespeichert', await p.locator('.status-warn').innerText(), 'nicht gespeichert');

  await felder.nth(1).fill('82');
  await p.waitForTimeout(300);
  pruefe('nach 300ms weiterhin kein Aufruf (Verzögerung wirkt)', erhebungsAufrufe().length, 0);

  await p.waitForTimeout(1000);
  pruefe('genau ein gebündelter Aufruf', erhebungsAufrufe().length, 1);
  pruefe('beide Werte im selben Aufruf', erhebungsAufrufe()[0].aenderungen.length, 2);
  pruefe('Status meldet gespeichert', await p.locator('.status-gut').innerText(), 'gespeichert');
}

console.log('\n=== Unsinnige Eingabe wird sichtbar markiert ===');
{
  const feld = p.locator('input.notenfeld').nth(2);
  await feld.fill('150'); await p.waitForTimeout(200);
  pruefe('Feld ist als fehlerhaft markiert',
    (await feld.getAttribute('class')).includes('fehlerhaft'), true);
  await feld.fill('75'); await p.waitForTimeout(200);
  pruefe('nach Korrektur wieder unauffällig',
    (await feld.getAttribute('class')).includes('fehlerhaft'), false);
  await p.waitForTimeout(1200);
}

console.log('\n=== Kachel zeigt Thema und Stand nach der Rückkehr ===');
{
  await knopf('Zurück').click(); await p.waitForTimeout(500);
  const text = await kachel('Test 1').innerText();
  pruefe('Thema steht auf der Kachel', text.includes('Wortarten'), true);
  pruefe('Erfassungsstand steht auf der Kachel', text.includes('3 von 23 erfasst'), true);
}

console.log('\n=== Werte überstehen ein Neuladen ===');
{
  await p.reload(); await p.waitForTimeout(900);
  await kachel('Test 1').click(); await p.waitForTimeout(500);
  pruefe('erster Wert erhalten', await p.locator('input.notenfeld').nth(0).inputValue(), '96');
  pruefe('Thema erhalten', await p.locator('input[aria-label="Thema des Tests"]').inputValue(), 'Wortarten');
  await knopf('Zurück').click(); await p.waitForTimeout(400);
}

console.log('\n=== Beteiligung: eigene Ansicht, Monat- und Wochenwahl, 1-10 Punkte ===');
{
  await knopf('Beteiligung').click(); await p.waitForTimeout(400);
  const monate = await p.locator('.werkzeug .titel').allInnerTexts();
  pruefe('sechs Monate im ersten Halbjahr', monate, ['August', 'September', 'Oktober', 'November', 'Dezember', 'Januar']);
  pruefe('Fortschritt anfangs leer',
    (await kachel('September').innerText()).includes('noch nichts erfasst'), true);

  await kachel('September').click(); await p.waitForTimeout(400);
  pruefe('vier Wochen im September', await p.locator('[role="group"][aria-label="Woche wählen"] button').count(), 4);
  pruefe('zwei Felder je Kind (mündlich, schriftlich)', await p.locator('input.notenfeld').count(), 46);
  pruefe('kein Themenfeld hier', await p.locator('input[aria-label="Thema des Tests"]').count(), 0);
  pruefe('Monatsspalten in Prozent im Kopf',
    (await p.locator('table.liste thead').innerText()).includes('Mündlich Monat (%)'), true);

  const felder = p.locator('input.notenfeld');
  await felder.nth(0).fill('9');   // Mündlich, erstes Kind, Woche 1
  await felder.nth(1).fill('8');   // Schriftlich, erstes Kind, Woche 1

  const zeile = await p.locator('table.liste tbody tr').first().innerText();
  pruefe('Monatsprozent aktualisiert sich sofort, ohne auf den Server zu warten',
    zeile.includes('90 %') && zeile.includes('80 %'), true);

  // Farben aus der Vorlage (Primary Participation Tracker): dunkles Blau
  // mit weisser Schrift im Kopf, sechs Bandfarben nach Leistungsstufe.
  const kopfzelle = p.locator('table.beteiligung-tabelle thead th').first();
  pruefe('Tabellenkopf: dunkles Blau wie in der Vorlage',
    await kopfzelle.evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(23, 54, 93)');
  pruefe('Tabellenkopf: weisse Schrift',
    await kopfzelle.evaluate((el) => getComputedStyle(el).color), 'rgb(255, 255, 255)');

  const monatszellenKind1 = p.locator('table.beteiligung-tabelle tbody tr').first().locator('td.zahl');
  pruefe('90 % (Note 2) sofort blau eingefärbt, wie im Kriterienblatt der Vorlage',
    await monatszellenKind1.first().evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(217, 234, 247)');

  // Zweites Kind: niedriger Wert -> andere Bandfarbe (orange-rot, Note 5).
  // Nur zur Farbprobe — wird danach wieder geleert, damit die Übersicht
  // weiter unten mit einem unveränderten zweiten Kind rechnet.
  await felder.nth(2).fill('3'); // Mündlich, zweites Kind, Woche 1
  const monatszellenKind2 = p.locator('table.beteiligung-tabelle tbody tr').nth(1).locator('td.zahl');
  pruefe('30 % (Note 5) andere Bandfarbe als 90 % (Note 2)',
    await monatszellenKind2.first().evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(252, 228, 214)');
  await felder.nth(2).fill('');
  pruefe('geleert: Bandfarbe verschwindet wieder',
    await monatszellenKind2.first().evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');

  await p.waitForTimeout(1400);
  pruefe('Punkte wurden gesendet',
    aufrufe.some((a) => a.aktion === 'beteiligungspunkte' &&
      a.aenderungen.some((x) => x.kuerzel === '3L-01' && x.art === 'MUND' && x.punkte === '9')), true);
  pruefe('daraus abgeleitete Monatsnote wurde als Erhebung gesendet',
    aufrufe.some((a) => a.aktion === 'erhebungen' &&
      a.aenderungen.some((x) => x.kuerzel === '3L-01' && x.kategorie_id === 'MUND' && x.wert === 90)), true);

  await knopf('Zurück').click(); await p.waitForTimeout(400);
  pruefe('Fortschritt auf der Monatskachel', (await kachel('September').innerText()).includes('1 von 4 Wochen erfasst'), true);
  await knopf('Tests').click(); await p.waitForTimeout(300);
}

console.log('\n=== Übersicht rechnet wie die bisherige Tabelle ===');
{
  await knopf('Übersicht').click(); await p.waitForTimeout(500);
  const kopf = await p.locator('table.liste thead').innerText();
  pruefe('Gewichte stehen in den Spaltenköpfen',
    kopf.includes('80 %') && kopf.includes('20 %'), true);

  // Erstes Kind: Test 96, Beteiligung (90+80)/2 = 85 -> 96*0,8 + 85*0,2 = 93,8 -> 94 -> Note 1
  const zeile = (await p.locator('table.liste tbody tr').first().innerText()).split('\t');
  pruefe('Testmittel', zeile[3], '96.0');
  pruefe('Beteiligung ist das Mittel aus mündlich (90 %) und schriftlich (80 %)', zeile[4], '85.0');
  pruefe('Gesamt aufgerundet', zeile[5], '94');
  pruefe('Note', zeile[6], '1');

  // Zweites Kind hat nur einen Testwert, keine Beteiligung -> Gewicht wandert.
  const zwei = (await p.locator('table.liste tbody tr').nth(1).innerText()).split('\t');
  pruefe('ohne Beteiligung zählt der Test allein', zwei[5], '82');
  pruefe('Note dazu', zwei[6], '2');

  // Kind ganz ohne Werte bekommt keine Note, keine Sechs.
  const leer = (await p.locator('table.liste tbody tr').nth(3).innerText()).split('\t');
  pruefe('ohne Werte kein Gesamtwert', leer[5], '–');
  pruefe('ohne Werte keine Note — keine Sechs', leer[6], '–');
  pruefe('Hinweis auf Kinder ohne Werte',
    (await p.locator('.feldhilfe').last().innerText()).includes('keine Note'), true);
}

console.log('\n=== Auswertung: Verteilung und Schnitt ===');
{
  await knopf('Auswertung').click(); await p.waitForTimeout(500);
  pruefe('sechs Säulen für sechs Noten', await p.locator('.verteilung-saeule').count(), 6);
  pruefe('Notenziffern unter den Säulen',
    await p.locator('.verteilung-note').allInnerTexts(), ['1', '2', '3', '4', '5', '6']);
  const text = await p.locator('.karte').first().innerText();
  pruefe('bewertete Kinder gezählt', text.includes('3 von 23 Kindern bewertet'), true);
  pruefe('Notenschnitt genannt', /Notenschnitt \d/.test(text), true);
  pruefe('Kinder ohne Werte werden benannt',
    (await p.locator('.karte').nth(1).innerText()).includes('3L-'), true);
}

console.log('\n=== Halbjahre sind getrennt ===');
{
  await knopf('Tests').click(); await p.waitForTimeout(300);
  await knopf('Zweites Halbjahr').click(); await p.waitForTimeout(400);
  pruefe('zweites Halbjahr: noch nichts erfasst',
    (await kachel('Test 1').innerText()).includes('noch nichts erfasst'), true);
  await knopf('Übersicht').click(); await p.waitForTimeout(400);
  const zeile = (await p.locator('table.liste tbody tr').first().innerText()).split('\t');
  pruefe('erstes Kind hat im zweiten Halbjahr keine Note', zeile[6], '–');

  await knopf('Erstes Halbjahr').click(); await p.waitForTimeout(400);
  const wieder = (await p.locator('table.liste tbody tr').first().innerText()).split('\t');
  pruefe('erstes Halbjahr weiterhin bewertet', wieder[6], '1');
}

console.log('\n=== Klassen sind getrennt ===');
{
  await p.locator('[role="group"][aria-label="Klasse wechseln"] button', { hasText: '3M' }).click();
  await p.waitForTimeout(500);
  pruefe('Klasse gewechselt', p.url().includes('#/noten/3M'), true);
  const zeile = (await p.locator('table.liste tbody tr').first().innerText()).split('\t');
  pruefe('3M hat noch keine Noten', zeile[6], '–');

  await knopf('Tests').click(); await p.waitForTimeout(400);
  pruefe('Thema gilt aber klassenübergreifend',
    (await kachel('Test 1').innerText()).includes('Wortarten'), true);
}

console.log('\n=== Server weist Namen statt Kürzel ab ===');
{
  const antwort = await p.evaluate(async ({ url, token }) => {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ token, aktion: 'erhebungen', aenderungen: [
        { kuerzel: 'Mustermann', kategorie_id: 'TEST', anlass: 'X', datum: '2026-09-15', wert: 50 }
      ] })
    });
    return r.json();
  }, { url: B + '/exec', token: TOKEN });
  pruefe('abgewiesen', antwort.ok, false);
  pruefe('Grund genannt', /Ungültiges Kürzel/.test(antwort.fehler), true);
}

console.log('\nJS-Fehler:', fehler.length ? fehler : 'keine');
console.log(schlecht === 0 && !fehler.length
  ? `\nALLE ${n} TESTS BESTANDEN`
  : `\n${schlecht} von ${n} FEHLGESCHLAGEN`);

await browser.close();
process.exit(schlecht === 0 && !fehler.length ? 0 : 1);
