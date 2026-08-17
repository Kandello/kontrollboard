/**
 * Prueft die Startseite: Tagesplan, Wochenaufgaben, Ferienmodus.
 *
 * Die Uhr wird auf feste Zeitpunkte gestellt, damit „laufende Stunde" und
 * die Erinnerungszeichen ueberhaupt pruefbar sind. Ohne feste Zeit haengt
 * das Ergebnis davon ab, wann der Test zufaellig laeuft.
 *
 *   node mock.js &
 *   node startseite.mjs
 */

import { chromium } from 'playwright';

const ADRESSE = 'http://localhost:8901';
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
const fehler = [];

/** Oeffnet die Startseite zu einem festen Zeitpunkt. */
async function oeffne(utcZeitpunkt) {
  const ctx = await browser.newContext({
    viewport: { width: 1000, height: 1000 }, locale: 'de-DE', timezoneId: 'Europe/Berlin'
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fehler.push('PAGEERROR: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') fehler.push('CONSOLE: ' + m.text()); });

  // setFixedTime statt install: Date liefert einen festen Wert, die
  // Zeitgeber laufen aber weiter — sonst blieben fetch-Ketten haengen.
  await p.clock.setFixedTime(new Date(utcZeitpunkt));
  await p.goto(ADRESSE + '/');
  await p.evaluate((t) => localStorage.setItem('kz.verbindung',
    JSON.stringify({ url: 'http://localhost:8901/exec', token: t })), TOKEN);
  // Neu laden, nicht nur die Fragmentkennung aendern: die Module lesen ihre
  // Einstellungen beim Laden, ein Hash-Wechsel allein loest das nicht aus.
  await p.reload();
  await p.waitForSelector('.klassenraster', { timeout: 8000 });
  return { p, ctx };
}

async function setzeFerien(an) {
  await fetch(ADRESSE + '/exec', {
    method: 'POST', headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ token: TOKEN, aktion: 'meta', werte: { ferienmodus: an ? 'TRUE' : 'FALSE' } })
  });
}

async function setzeStatus(kw, aufgabe, erledigt) {
  await fetch(ADRESSE + '/exec', {
    method: 'POST', headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ token: TOKEN, aktion: 'wochenstatus', kw, aufgabe, erledigt })
  });
}

// ---------------------------------------------------------------------------
// Montag, 17.08.2026, 09:20 Berlin — mitten in der ersten Stunde von 3L.
// ---------------------------------------------------------------------------
console.log('=== Montag 09:20, laufende Stunde ===');
{
  const { p, ctx } = await oeffne('2026-08-17T07:20:00Z');

  pruefe('Uhr zeigt Berliner Zeit mit Sekunden',
    /^09:20:\d{2}$/.test((await p.locator('.uhr-zeit').innerText()).replace(/\s/g, '')), true);
  pruefe('Datum und Wochentag', await p.locator('.uhr-tag').innerText(), 'Montag, 17.08.2026');

  const zeilen = await p.locator('ul.tagesplan li').count();
  pruefe('sechs Einträge am Montag', zeilen, 6);

  const zeiten = await p.locator('ul.tagesplan .zeit').allInnerTexts();
  pruefe('zeitlich sortiert', zeiten, [
    '09:00–09:45', '09:45–10:30', '11:30–12:15', '12:15–13:00', '13:30–14:00', '14:00–14:45'
  ]);

  pruefe('erste Stunde ist als laufend markiert',
    await p.locator('ul.tagesplan li').first().getAttribute('class'), 'ist-laufend');
  pruefe('Marke „läuft" sichtbar',
    await p.locator('ul.tagesplan li.ist-laufend .marke').innerText(), 'läuft');
  pruefe('genau eine laufende Stunde', await p.locator('li.ist-laufend').count(), 1);
  pruefe('keine „als Nächstes"-Marke solange eine läuft',
    await p.locator('li.ist-naechste').count(), 0);

  const ersteZeile = await p.locator('ul.tagesplan li').first().innerText();
  pruefe('LESEN zeigt den Zusatz', ersteZeile.includes('+4H'), true);
  pruefe('LESEN nennt die eigene Klasse', ersteZeile.includes('3L'), true);

  // Anklickbarkeit
  pruefe('DEUTSCH/LESEN der eigenen Klassen sind Links',
    await p.locator('ul.tagesplan a.eintrag').count(), 4);
  const fuf = p.locator('ul.tagesplan li').nth(3);
  pruefe('FuF ist kein Link', await fuf.locator('a').count(), 0);
  pruefe('FuF zeigt die Fremdklasse', (await fuf.innerText()).includes('1A'), true);
  const dienst = p.locator('ul.tagesplan li').nth(4);
  pruefe('Dienst ist kein Link', await dienst.locator('a').count(), 0);
  pruefe('Dienst nennt den Zusatz', (await dienst.innerText()).includes('Pausenaufsicht'), true);

  // Tippen fuehrt auf die Klassenseite
  await p.locator('ul.tagesplan a.eintrag').first().click();
  await p.waitForTimeout(400);
  pruefe('Tippen führt zur Klassenseite', p.url().includes('#/klasse/3L'), true);

  await ctx.close();
}

// ---------------------------------------------------------------------------
// Montag 10:45 — keine Stunde laeuft, die naechste wird dezent markiert.
// ---------------------------------------------------------------------------
console.log('\n=== Montag 10:45, Pause ===');
{
  const { p, ctx } = await oeffne('2026-08-17T08:45:00Z');
  pruefe('keine laufende Stunde', await p.locator('li.ist-laufend').count(), 0);
  pruefe('genau eine nächste Stunde', await p.locator('li.ist-naechste').count(), 1);
  pruefe('nächste ist die um 11:30',
    (await p.locator('li.ist-naechste').innerText()).includes('11:30'), true);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Wochenaufgaben — Montag ist ein PEAK-Erinnerungstag, kein Weekly-Tag.
// ---------------------------------------------------------------------------
console.log('\n=== Wochenaufgaben am Montag ===');
{
  await setzeStatus('2026-W34', 'PEAK', false);
  await setzeStatus('2026-W34', 'WEEKLY', false);
  const { p, ctx } = await oeffne('2026-08-17T07:20:00Z');

  pruefe('zwei Kacheln', await p.locator('.kachel').count(), 2);
  const peak = p.locator('.kachel').first();
  const weekly = p.locator('.kachel').nth(1);

  pruefe('PEAK offen', (await peak.innerText()).includes('offen'), true);
  pruefe('PEAK nennt die Frist', (await peak.innerText()).includes('Dienstagabend'), true);

  // Kein Zeichen, keine Animation: die Markierung traegt der Rand, die
  // Aussage das Wort „offen".
  pruefe('kein grosses Zeichen mehr', await peak.locator('.kachel-zeichen').count(), 0);
  pruefe('kein schwebendes Symbol', await p.locator('.schwebend').count(), 0);
  pruefe('offene Kachel ist als offen gezeichnet',
    (await peak.getAttribute('class')).includes('offen'), true);

  // Ein versehentliches Antippen darf nichts ausloesen.
  pruefe('Bereich ist zunächst zu', await peak.locator('.kachel-bereich').isHidden(), true);
  await peak.locator('.kachel-kopf').click();
  await p.waitForTimeout(200);
  pruefe('Antippen klappt nur auf', await peak.locator('.kachel-bereich').isVisible(), true);
  pruefe('Status noch offen', (await peak.innerText()).includes('offen'), true);

  await peak.locator('button:has-text("Als erledigt markieren")').click();
  await p.waitForTimeout(900);
  const peakNeu = p.locator('.kachel').first();
  pruefe('nach dem Knopf erledigt', (await peakNeu.innerText()).includes('erledigt'), true);
  pruefe('Kachel wird als erledigt gezeichnet',
    (await peakNeu.getAttribute('class')).includes('erledigt'), true);
  pruefe('Datum wird genannt', /\d{2}\.\d{2}\.\d{4}/.test(await peakNeu.innerText()), true);
  pruefe('Weekly bleibt offen', (await p.locator('.kachel').nth(1).innerText()).includes('offen'), true);

  // Zuruecknehmen ueber denselben Weg
  await peakNeu.locator('.kachel-kopf').click();
  await p.waitForTimeout(200);
  await peakNeu.locator('button:has-text("Doch noch offen")').click();
  await p.waitForTimeout(900);
  pruefe('lässt sich zurücknehmen',
    (await p.locator('.kachel').first().innerText()).includes('offen'), true);

  await ctx.close();
}

// ---------------------------------------------------------------------------
// Freitag — nur die Weekly Note erinnert.
// ---------------------------------------------------------------------------
console.log('\n=== Freitag ===');
{
  await setzeStatus('2026-W34', 'PEAK', false);
  const { p, ctx } = await oeffne('2026-08-21T07:20:00Z');
  pruefe('Freitag erkannt', (await p.locator('.uhr-tag').innerText()).startsWith('Freitag'), true);
  pruefe('offene Aufgaben bleiben ganzwöchig markiert',
    (await p.locator('.kachel.offen').count()) >= 1, true);
  pruefe('vier Stunden am Freitag', await p.locator('ul.tagesplan li').count(), 4);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Mittwoch — keine der beiden Kacheln erinnert.
// ---------------------------------------------------------------------------
console.log('\n=== Mittwoch, ruhige Kacheln ===');
{
  const { p, ctx } = await oeffne('2026-08-19T07:20:00Z');
  pruefe('nirgends ein schwebendes Symbol', await p.locator('.schwebend').count(), 0);
  pruefe('drei Stunden am Mittwoch', await p.locator('ul.tagesplan li').count(), 3);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Samstag — ruhiger Hinweis statt leerer Liste.
// ---------------------------------------------------------------------------
console.log('\n=== Wochenende ===');
{
  const { p, ctx } = await oeffne('2026-08-22T09:00:00Z');
  pruefe('keine Stundenliste', await p.locator('ul.tagesplan').count(), 0);
  pruefe('ruhiger Hinweis statt Leere',
    (await p.locator('.karte').nth(1).innerText()).includes('kein Unterricht'), true);
  pruefe('Klassenknöpfe bleiben erreichbar', await p.locator('.klassenknopf').count(), 3);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Ferienmodus
// ---------------------------------------------------------------------------
console.log('\n=== Ferienmodus ===');
{
  await setzeFerien(true);
  const { p, ctx } = await oeffne('2026-08-17T07:20:00Z');

  pruefe('Tagesplan ausgeblendet', await p.locator('ul.tagesplan').count(), 0);
  pruefe('Kacheln pausiert',
    (await p.locator('.kachel').first().innerText()).includes('pausiert'), true);
  pruefe('Kachel neutral gezeichnet',
    (await p.locator('.kachel').first().getAttribute('class')).includes('ruhend'), true);
  pruefe('Ferienmarke an der Uhr', await p.locator('.uhr .marke').count(), 1);
  pruefe('Klassen weiter erreichbar', await p.locator('.klassenknopf').count(), 3);

  await p.locator('button:has-text("Ferienmodus beenden")').click();
  await p.waitForTimeout(900);
  pruefe('Ferienmodus beendet', await p.locator('ul.tagesplan').count(), 1);

  await ctx.close();
  await setzeFerien(false);
}

// ---------------------------------------------------------------------------
// Jahreswechsel — die Woche muss zum ISO-Wochenjahr passen.
// ---------------------------------------------------------------------------
console.log('\n=== Jahreswechsel ===');
{
  // 01.01.2027 ist ein Freitag und gehoert noch zu 2026-W53.
  await setzeStatus('2026-W53', 'WEEKLY', true);
  const { p, ctx } = await oeffne('2027-01-01T09:00:00Z');
  pruefe('Weekly aus 2026-W53 gilt am 01.01.2027',
    (await p.locator('.kachel').nth(1).innerText()).includes('erledigt'), true);
  pruefe('PEAK derselben Woche weiterhin offen',
    (await p.locator('.kachel').first().innerText()).includes('offen'), true);
  await ctx.close();
  await setzeStatus('2026-W53', 'WEEKLY', false);
}

console.log('\nJS-Fehler:', fehler.length ? fehler : 'keine');
console.log(schlecht === 0 && !fehler.length
  ? `\nALLE ${n} TESTS BESTANDEN`
  : `\n${schlecht} von ${n} FEHLGESCHLAGEN`);

await browser.close();
process.exit(schlecht === 0 && !fehler.length ? 0 : 1);
