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
async function oeffne(utcZeitpunkt, { steuerbareUhr = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1000, height: 1000 }, locale: 'de-DE', timezoneId: 'Europe/Berlin'
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fehler.push('PAGEERROR: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') fehler.push('CONSOLE: ' + m.text()); });

  // setFixedTime statt install: Date liefert einen festen Wert, die
  // Zeitgeber laufen aber weiter — sonst blieben fetch-Ketten haengen.
  // Fuer den Lauf ohne Neuladen brauchen wir dagegen eine vorspulbare Uhr.
  if (steuerbareUhr) await p.clock.install({ time: new Date(utcZeitpunkt) });
  else await p.clock.setFixedTime(new Date(utcZeitpunkt));
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

async function setzeStatus(kw, aufgabe, erledigt, klasse) {
  await fetch(ADRESSE + '/exec', {
    method: 'POST', headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ token: TOKEN, aktion: 'wochenstatus', kw, aufgabe, erledigt, klasse })
  });
}

async function setzeMetaWert(werte) {
  await fetch(ADRESSE + '/exec', {
    method: 'POST', headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ token: TOKEN, aktion: 'meta', werte })
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
  pruefe('Tagesplan-Überschrift nennt den Wochentag',
    (await p.locator('.tagesplan-kopf').innerText()).trim(), 'Tagesplan am Montag');

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

  // 3L hat keine eigene Farbe hinterlegt, faellt also auf k-farbe-1 zurueck
  // (--klassenfarbe-text: #1d6b93). Nicht nur der Punkt, auch der Name selbst.
  pruefe('der Klassenname selbst zeigt die Klassenfarbe, nicht nur der Punkt davor',
    await p.locator('ul.tagesplan li').first().locator('.bezeichnung')
      .evaluate((el) => getComputedStyle(el).color),
    'rgb(29, 107, 147)');

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
// Montag 16:59 — noch der heutige Plan, samt laufender/naechster Markierung.
// ---------------------------------------------------------------------------
console.log('\n=== Montag, Seite bleibt offen (ohne Neuladen) ===');
{
  const { p, ctx } = await oeffne('2026-08-17T07:20:00Z', { steuerbareUhr: true });

  pruefe('09:20 — erste Stunde läuft',
    await p.locator('ul.tagesplan li').first().getAttribute('class'), 'ist-laufend');

  // Vorspulen auf 10:45 Berliner Zeit: keine Stunde laeuft, die um 11:30
  // ist als Naechste dran — ganz ohne Neuladen.
  await p.clock.fastForward('01:25:30');
  await p.waitForTimeout(200);
  pruefe('10:45 — keine laufende Stunde mehr', await p.locator('li.ist-laufend').count(), 0);
  pruefe('10:45 — die 11:30 ist als Nächstes markiert',
    (await p.locator('li.ist-naechste').innerText()).includes('11:30'), true);
  pruefe('Markierung klebt nicht mehr an der ersten Stunde',
    await p.locator('ul.tagesplan li').first().getAttribute('class'), '');
  pruefe('Uhr ist mitgelaufen',
    (await p.locator('.uhr-zeit').innerText()).replace(/\s/g, '').startsWith('10:45'), true);

  // Weiter bis 12:00: jetzt laeuft die Stunde von 11:30 bis 12:15.
  await p.clock.fastForward('01:15:00');
  await p.waitForTimeout(200);
  pruefe('12:00 — die 11:30 läuft jetzt',
    (await p.locator('li.ist-laufend').innerText()).includes('11:30'), true);
  pruefe('genau eine laufende Stunde', await p.locator('li.ist-laufend').count(), 1);
  pruefe('keine „als Nächstes"-Marke solange eine läuft',
    await p.locator('li.ist-naechste').count(), 0);

  // Und ueber 17 Uhr hinaus: der Tagesplan wechselt von selbst auf morgen.
  await p.clock.fastForward('05:05:00');
  await p.waitForTimeout(500);
  pruefe('nach 17 Uhr springt die Überschrift auf Dienstag',
    (await p.locator('.tagesplan-kopf').innerText()).trim(), 'Tagesplan am Dienstag');
  pruefe('… und der Dienstagsplan steht da', await p.locator('ul.tagesplan li').count(), 4);

  await ctx.close();
}

console.log('\n=== Montag 16:59, kurz vor der Umschaltung ===');
{
  const { p, ctx } = await oeffne('2026-08-17T14:59:00Z');
  pruefe('Überschrift zeigt noch Montag',
    (await p.locator('.tagesplan-kopf').innerText()).trim(), 'Tagesplan am Montag');
  pruefe('noch sechs Einträge (heutiger Plan)', await p.locator('ul.tagesplan li').count(), 6);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Montag 17:00 — ab hier zeigt der Tagesplan schon den Dienstag voraus.
// ---------------------------------------------------------------------------
console.log('\n=== Montag 17:00, Vorschau auf Dienstag ===');
{
  const { p, ctx } = await oeffne('2026-08-17T15:00:00Z');
  pruefe('Überschrift wechselt bereits auf Dienstag',
    (await p.locator('.tagesplan-kopf').innerText()).trim(), 'Tagesplan am Dienstag');
  pruefe('Uhr zeigt aber weiterhin Montag',
    (await p.locator('.uhr-tag').innerText()).startsWith('Montag'), true);
  pruefe('vier Einträge (Dienstagsplan)', await p.locator('ul.tagesplan li').count(), 4);
  pruefe('in der Vorschau läuft nichts', await p.locator('li.ist-laufend').count(), 0);
  pruefe('in der Vorschau auch keine „als Nächstes"-Marke',
    await p.locator('li.ist-naechste').count(), 0);
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

  pruefe('vier Kacheln: PEAK, Weekly Note, Seesaw, Lernwörter',
    await p.locator('.kachel').count(), 4);
  const peak = p.locator('.kachel[data-aufgabe="PEAK"]');
  const weekly = p.locator('.kachel[data-aufgabe="WEEKLY"]');

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
  const peakNeu = p.locator('.kachel[data-aufgabe="PEAK"]');
  pruefe('nach dem Knopf erledigt', (await peakNeu.innerText()).includes('erledigt'), true);
  pruefe('Kachel wird als erledigt gezeichnet',
    (await peakNeu.getAttribute('class')).includes('erledigt'), true);
  pruefe('Datum wird genannt', /\d{2}\.\d{2}\.\d{4}/.test(await peakNeu.innerText()), true);
  pruefe('Weekly bleibt offen', (await p.locator('.kachel[data-aufgabe="WEEKLY"]').innerText()).includes('offen'), true);

  // Zuruecknehmen ueber denselben Weg
  await peakNeu.locator('.kachel-kopf').click();
  await p.waitForTimeout(200);
  await peakNeu.locator('button:has-text("Doch noch offen")').click();
  await p.waitForTimeout(900);
  pruefe('lässt sich zurücknehmen',
    (await p.locator('.kachel[data-aufgabe="PEAK"]').innerText()).includes('offen'), true);

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
// Freitag 17:00 — die Vorschau springt uebers Wochenende auf den Samstag.
// ---------------------------------------------------------------------------
console.log('\n=== Freitag 17:00, Vorschau aufs Wochenende ===');
{
  const { p, ctx } = await oeffne('2026-08-21T15:00:00Z');
  pruefe('Überschrift zeigt Samstag',
    (await p.locator('.tagesplan-kopf').innerText()).trim(), 'Tagesplan am Samstag');
  pruefe('ruhiger Hinweis statt Stundenliste', await p.locator('ul.tagesplan').count(), 0);
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
    (await p.locator('.kachel[data-aufgabe="PEAK"]').innerText()).includes('pausiert'), true);
  pruefe('Kachel neutral gezeichnet',
    (await p.locator('.kachel[data-aufgabe="PEAK"]').getAttribute('class')).includes('ruhend'), true);
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
    (await p.locator('.kachel[data-aufgabe="WEEKLY"]').innerText()).includes('erledigt'), true);
  pruefe('PEAK derselben Woche weiterhin offen',
    (await p.locator('.kachel[data-aufgabe="PEAK"]').innerText()).includes('offen'), true);
  await ctx.close();
  await setzeStatus('2026-W53', 'WEEKLY', false);
}

// ---------------------------------------------------------------------------
// Merklisten: To-Do, Deadlines, Termine — neu, starten ausgeblendet.
// ---------------------------------------------------------------------------
console.log('\n=== Merklisten: To-Do, Deadlines, Termine ===');
{
  const { p, ctx } = await oeffne('2026-09-15T09:00:00Z'); // Dienstag

  pruefe('To-Do startet in der Ablage, nicht im Raster',
    await p.locator('.widgetraster .widget[data-id="todo"]').count(), 0);
  pruefe('… auch Deadlines', await p.locator('.widgetraster .widget[data-id="deadline"]').count(), 0);
  pruefe('… auch Termine', await p.locator('.widgetraster .widget[data-id="events"]').count(), 0);
  pruefe('alle drei liegen in der Ablage', await p.locator(
    '.widget-ablage .widget[data-id="todo"], .widget-ablage .widget[data-id="deadline"], ' +
    '.widget-ablage .widget[data-id="events"]').count(), 3);

  // Hochziehen ueber den „Wieder einblenden"-Knopf, wie in widgets.mjs etabliert.
  for (const id of ['todo', 'deadline', 'events']) {
    await p.locator(`.widget-ablage .widget[data-id="${id}"] button[title="Wieder einblenden"]`).click();
    await p.waitForTimeout(900);
  }
  pruefe('jetzt alle drei im Raster', await p.locator(
    '.widgetraster .widget[data-id="todo"], .widgetraster .widget[data-id="deadline"], ' +
    '.widgetraster .widget[data-id="events"]').count(), 3);

  // Jede der drei bekommt ihre eigene, gedeckte Kopffarbe.
  const griffFarbe = (id) => p.locator(`.widget[data-id="${id}"] .widget-griff`)
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  pruefe('To-Do: dunkles Gelb', await griffFarbe('todo'), 'rgb(107, 83, 22)');
  pruefe('Deadlines: dunkles Rot', await griffFarbe('deadline'), 'rgb(110, 47, 47)');
  pruefe('Termine: dunkles Blau', await griffFarbe('events'), 'rgb(39, 74, 114)');
  pruefe('… und die drei Farben sind tatsaechlich verschieden',
    new Set([await griffFarbe('todo'), await griffFarbe('deadline'), await griffFarbe('events')]).size, 3);

  // --- To-Do: hinzufuegen, Sortierung, Abhaken --------------------------------
  const todoWidget = p.locator('.widget[data-id="todo"]');
  async function todoHinzufuegen(text, datum, { perEnter = false } = {}) {
    await todoWidget.locator('.merkliste-plus').click();
    const textFeld = todoWidget.locator('.merkliste-felder input[type="text"]');
    await textFeld.fill(text);
    if (!datum && perEnter) {
      await textFeld.press('Enter');
    } else {
      if (datum) await todoWidget.locator('.merkliste-felder input[type="date"]').fill(datum);
      if (perEnter) await todoWidget.locator('.merkliste-felder input[type="date"]').press('Enter');
      else await todoWidget.locator('button:has-text("Hinzufügen")').click();
    }
    await p.waitForTimeout(150);
  }
  // Die ersten zwei ueber Enter statt Klick — einmal im Textfeld, einmal im
  // Datumfeld — die dritte ganz klassisch ueber den Knopf.
  await todoHinzufuegen('Einkaufen', '', { perEnter: true });
  await todoHinzufuegen('Formular ausfüllen', '2026-09-20', { perEnter: true });
  await todoHinzufuegen('Urlaub planen', '2026-09-18');
  pruefe('alle drei kamen an, zwei davon per Enter statt per Klick',
    await todoWidget.locator('.merkliste-liste li').count(), 3);
  pruefe('nach Datum sortiert, undatiert ans Ende',
    await todoWidget.locator('.merkliste-text').allInnerTexts(),
    ['Urlaub planen', 'Formular ausfüllen', 'Einkaufen']);
  pruefe('Fälligkeitstext: Wochentag und Datum ohne Jahr',
    await todoWidget.locator('.merkliste-liste li').first().locator('.merkliste-datum').innerText(),
    'Freitag, 18.9.');

  // Die Liste beginnt jetzt auf Hoehe des Plus-Knopfs, nicht mehr darunter
  // haengend — beide oben in derselben Zeile ausgerichtet.
  const knopfOben = (await todoWidget.locator('.merkliste-plus').boundingBox()).y;
  const ersterEintragOben = (await todoWidget.locator('.merkliste-liste li').first().boundingBox()).y;
  pruefe('erster Eintrag beginnt auf Hoehe des Plus-Knopfs, haengt nicht mehr tief',
    Math.abs(knopfOben - ersterEintragOben) < 10, true);

  await todoWidget.locator('.merkliste-liste li').first().locator('input[type="checkbox"]').click();
  await p.waitForTimeout(150);
  pruefe('abgehakter Eintrag rutscht ans Ende',
    await todoWidget.locator('.merkliste-text').allInnerTexts(),
    ['Formular ausfüllen', 'Einkaufen', 'Urlaub planen']);
  pruefe('abgehakter Eintrag ist ausgegraut (Klasse ist-erledigt)',
    await todoWidget.locator('.merkliste-liste li').last().getAttribute('class'), 'ist-erledigt');

  // --- Deadline: rotes Ausrufezeichen am Fälligkeitstag -----------------------
  const deadlineWidget = p.locator('.widget[data-id="deadline"]');
  async function deadlineHinzufuegen(text, datum, uhrzeit) {
    await deadlineWidget.locator('.merkliste-plus').click();
    await deadlineWidget.locator('.merkliste-felder input[type="text"]').fill(text);
    if (datum) await deadlineWidget.locator('.merkliste-felder input[type="date"]').fill(datum);
    if (uhrzeit) await deadlineWidget.locator('.merkliste-felder input[type="time"]').fill(uhrzeit);
    await deadlineWidget.locator('button:has-text("Hinzufügen")').click();
    await p.waitForTimeout(150);
  }
  await deadlineHinzufuegen('Zeugnisse fertig', '2026-09-15', '14:00'); // heute
  await deadlineHinzufuegen('Elternbrief', '2026-10-01', '');

  pruefe('heute fällige Deadline zeigt das rote Ausrufezeichen',
    await deadlineWidget.locator('.merkliste-liste li').first().locator('.merkliste-ausruf').count(), 1);
  pruefe('zukünftige Deadline zeigt keins',
    await deadlineWidget.locator('.merkliste-liste li').last().locator('.merkliste-ausruf').count(), 0);
  pruefe('Fälligkeitstext zeigt auch die Uhrzeit',
    await deadlineWidget.locator('.merkliste-liste li').first().locator('.merkliste-datum').innerText(),
    'Dienstag, 15.9. · 14:00');

  await deadlineWidget.locator('.merkliste-liste li').first().locator('input[type="checkbox"]').click();
  await p.waitForTimeout(150);
  pruefe('nach dem Abhaken verschwindet das Ausrufezeichen',
    await deadlineWidget.locator('li.ist-erledigt .merkliste-ausruf').count(), 0);

  // --- Termine: Datum ist Pflicht, keine Checkbox -----------------------------
  const eventsWidget = p.locator('.widget[data-id="events"]');
  await eventsWidget.locator('.merkliste-plus').click();
  await eventsWidget.locator('.merkliste-felder input[type="text"]').fill('Elternabend');
  await eventsWidget.locator('button:has-text("Hinzufügen")').click();
  await p.waitForTimeout(150);
  pruefe('Termin ohne Datum wird abgewiesen', await eventsWidget.locator('.merkliste-fehler').isVisible(), true);
  pruefe('… und nicht in die Liste übernommen', await eventsWidget.locator('.merkliste-liste li').count(), 0);

  await eventsWidget.locator('.merkliste-felder input[type="date"]').fill('2026-09-25');
  await eventsWidget.locator('button:has-text("Hinzufügen")').click();
  await p.waitForTimeout(150);
  pruefe('mit Datum wird der Termin übernommen', await eventsWidget.locator('.merkliste-liste li').count(), 1);
  pruefe('Termine haben keine Checkbox', await eventsWidget.locator('.merkliste-liste input[type="checkbox"]').count(), 0);

  // --- übersteht das Neuladen ---------------------------------------------------
  await p.reload();
  await p.waitForSelector('.widgetraster', { timeout: 8000 });
  pruefe('To-Dos überstehen das Neuladen', await p.locator('.widget[data-id="todo"] .merkliste-liste li').count(), 3);
  pruefe('Termin übersteht das Neuladen', await p.locator('.widget[data-id="events"] .merkliste-liste li').count(), 1);

  await ctx.close();
}

// ---------------------------------------------------------------------------
// Seesaw: eine Wochenaufgabe, die je Klasse einzeln ansteht. Erst wenn alle
// versorgt sind, gilt sie als erledigt; ab Donnerstag mahnt sie, was fehlt.
// ---------------------------------------------------------------------------
console.log('\n=== Seesaw: je Klasse abhaken ===');
{
  // Mittwoch der KW 38 — vor dem Mahntag.
  await setzeFerien(false);
  for (const k of ['3L', '3M', '3OB']) await setzeStatus('2026-W38', 'SEESAW', false, k);
  const { p, ctx } = await oeffne('2026-09-16T07:20:00Z');

  const seesaw = p.locator('.kachel[data-aufgabe="SEESAW"]');
  pruefe('die Seesaw-Kachel ist da', await seesaw.count(), 1);

  const marke = seesaw.locator('.seesaw-marke');
  pruefe('das Zeichen führt zu Seesaw', await marke.getAttribute('href'), 'https://app.seesaw.me/');
  pruefe('… und öffnet einen eigenen Tab', await marke.getAttribute('target'), '_blank');
  pruefe('… abgesichert gegen den öffnenden Tab',
    await marke.getAttribute('rel'), 'noopener noreferrer');
  pruefe('der Schriftzug steht dabei', await marke.locator('.seesaw-wort').innerText(), 'Seesaw');

  const kaesten = seesaw.locator('.seesaw-klasse input');
  pruefe('ein Kästchen je Klasse', await kaesten.count(), 3);
  pruefe('zu Beginn ist keines gesetzt', await seesaw.locator('input:checked').count(), 0);
  pruefe('jedes Kästchen nennt seine Klasse',
    await seesaw.locator('.seesaw-klasse').allInnerTexts(), ['3L', '3M', '3OB']);
  pruefe('am Mittwoch mahnt noch nichts', await seesaw.locator('.kachel-ausruf').count(), 0);
  pruefe('… und die Kachel ist nicht grün',
    (await seesaw.getAttribute('class')).includes('voll'), false);

  // Zwei von drei abhaken — noch nicht vollstaendig.
  await kaesten.nth(0).check();
  await p.waitForTimeout(400);
  await kaesten.nth(1).check();
  await p.waitForTimeout(400);
  pruefe('zwei Klassen abgehakt', await seesaw.locator('input:checked').count(), 2);
  pruefe('zwei von drei reichen noch nicht für Grün',
    (await seesaw.getAttribute('class')).includes('voll'), false);

  // Die dritte macht es voll.
  await seesaw.locator('.seesaw-klasse input').nth(2).check();
  await p.waitForTimeout(500);
  pruefe('alle drei abgehakt: die Kachel färbt sich grün',
    (await seesaw.getAttribute('class')).includes('voll'), true);
  pruefe('… und zählt als erledigt',
    (await seesaw.getAttribute('class')).includes('erledigt'), true);

  // Wieder abwaehlen wirkt genauso — und nur auf diese eine Klasse.
  await seesaw.locator('.seesaw-klasse input').nth(1).uncheck();
  await p.waitForTimeout(500);
  pruefe('eine Klasse zurückgenommen: das Grün geht wieder weg',
    (await seesaw.getAttribute('class')).includes('voll'), false);
  pruefe('… und nur diese eine ist wieder offen',
    await seesaw.locator('input:checked').count(), 2);

  // Alles uebersteht das Neuladen, liegt also wirklich in der Tabelle.
  await p.reload();
  await p.waitForSelector('.klassenraster', { timeout: 8000 });
  pruefe('die Haken überstehen das Neuladen',
    await p.locator('.kachel[data-aufgabe="SEESAW"] input:checked').count(), 2);

  await ctx.close();
}

console.log('\n=== Seesaw: ab Donnerstag mahnt es ===');
{
  // Donnerstag derselben Woche: 3L und 3OB stehen noch aus (siehe oben).
  const { p, ctx } = await oeffne('2026-09-17T07:20:00Z');
  const seesaw = p.locator('.kachel[data-aufgabe="SEESAW"]');
  pruefe('ab Donnerstag steht ein rotes Ausrufezeichen da',
    await seesaw.locator('.kachel-ausruf').count(), 1);
  pruefe('… in der Warnfarbe',
    await seesaw.locator('.kachel-ausruf').evaluate((el) => getComputedStyle(el).color),
    'rgb(179, 38, 30)');

  // Sind alle versorgt, verschwindet die Mahnung sofort wieder.
  await seesaw.locator('.seesaw-klasse input').nth(1).check();
  await p.waitForTimeout(500);
  pruefe('vollständig versorgt: die Mahnung verschwindet',
    await seesaw.locator('.kachel-ausruf').count(), 0);
  pruefe('… und die Kachel ist grün', (await seesaw.getAttribute('class')).includes('voll'), true);

  await ctx.close();
}

console.log('\n=== Seesaw: im Ferienmodus ruht auch das ===');
{
  await setzeFerien(true);
  const { p, ctx } = await oeffne('2026-09-17T07:20:00Z');
  const seesaw = p.locator('.kachel[data-aufgabe="SEESAW"]');
  pruefe('die Kachel ruht', (await seesaw.getAttribute('class')).includes('ruhend'), true);
  pruefe('keine Mahnung in den Ferien', await seesaw.locator('.kachel-ausruf').count(), 0);
  pruefe('die Kästchen sind gesperrt',
    await seesaw.locator('.seesaw-klasse input').first().isDisabled(), true);
  await setzeFerien(false);
  await ctx.close();
}

// ---------------------------------------------------------------------------
// Lernwoerter: eine gewoehnliche Wochenaufgabe, deren Schriftzug aber selbst
// zur Vorlage fuehrt.
// ---------------------------------------------------------------------------
console.log('\n=== Lernwörter: der Schriftzug führt zur Vorlage ===');
{
  await setzeMetaWert({ link_lernwoerter: '' });
  let { p, ctx } = await oeffne('2026-09-16T07:20:00Z');
  let lw = p.locator('.kachel[data-aufgabe="LERNWOERTER"]');
  pruefe('die Lernwörter-Kachel ist da', await lw.count(), 1);
  pruefe('ohne hinterlegten Link bleibt der Titel schlichter Text',
    await lw.locator('.kachel-marke').count(), 0);
  pruefe('… der Titel steht trotzdem da',
    await lw.locator('.kachel-titel').innerText(), 'Lernwörter');
  await ctx.close();

  await setzeMetaWert({ link_lernwoerter: 'https://www.canva.com/design/BEISPIEL/edit' });
  ({ p, ctx } = await oeffne('2026-09-16T07:20:00Z'));
  lw = p.locator('.kachel[data-aufgabe="LERNWOERTER"]');
  const marke = lw.locator('.kachel-marke');
  pruefe('mit hinterlegtem Link wird der Schriftzug anklickbar', await marke.count(), 1);
  pruefe('… und führt zur Vorlage',
    await marke.getAttribute('href'), 'https://www.canva.com/design/BEISPIEL/edit');
  pruefe('… in einem eigenen Tab', await marke.getAttribute('target'), '_blank');
  pruefe('… mit dem richtigen Text', await marke.innerText(), 'Lernwörter');
  pruefe('der Verweis steht NICHT im Klappknopf — das wäre weder gültig noch bedienbar',
    await lw.locator('.kachel-kopf a').count(), 0);

  // Abhaken funktioniert wie bei PEAK und Weekly Note.
  pruefe('zunächst offen', (await lw.innerText()).includes('offen'), true);
  await lw.locator('.kachel-kopf').click();
  await p.waitForTimeout(200);
  await lw.locator('button:has-text("Als erledigt markieren")').click();
  await p.waitForTimeout(900);
  pruefe('lässt sich abhaken wie die übrigen Wochenaufgaben',
    (await p.locator('.kachel[data-aufgabe="LERNWOERTER"]').innerText()).includes('erledigt'), true);
  await ctx.close();
}

console.log('\nJS-Fehler:', fehler.length ? fehler : 'keine');
console.log(schlecht === 0 && !fehler.length
  ? `\nALLE ${n} TESTS BESTANDEN`
  : `\n${schlecht} von ${n} FEHLGESCHLAGEN`);

await browser.close();
process.exit(schlecht === 0 && !fehler.length ? 0 : 1);
