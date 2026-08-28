/**
 * Prueft das Widget-Raster der Startseite — ein echtes 2D-Raster wie bei
 * einem Handy-Launcher: frei nach x und y verschiebbar, per Anfassgriff
 * stufenlos in Breite und Hoehe veraenderbar, der Inhalt passt sich der
 * eigenen Breite an.
 *
 * Die reine Rasterlogik (Verdraengen statt Blockieren, Platzierung,
 * Kurzform-Vertraeglichkeit) ist bereits in layout.mjs erschoepfend geprueft.
 * Hier geht es um die Verdrahtung im Browser: dass ein Ziehen an der
 * Griffleiste tatsaechlich frei nach x UND y bewegt (nicht nur senkrecht wie
 * in der ersten Fassung), dass der Anfassgriff unten rechts die Groesse
 * stufenlos aendert, dass ein im Weg stehendes Widget durch die Oberflaeche
 * hindurch ausweicht statt die Bewegung zu blockieren — und dabei unbeteiligte
 * Widgets samt ihren Luecken unangetastet laesst —, dass der Inhalt bei
 * geringerer Breite kleiner wird, und dass alles das Neuladen uebersteht.
 *
 *   node mock.js &
 *   node widgets.mjs
 */

import { chromium } from 'playwright';
import { celleFrei, MAX_ZEILEN } from '../js/layout.js';

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

async function ausTabelle() {
  const a = await fetch(`${ADRESSE}/exec?aktion=laden&token=${TOKEN}`);
  return (await a.json()).daten;
}

/** Rasterkoordinaten aller sichtbaren Widgets, aus den gesetzten Inline-Styles. */
async function alleRechtecke(seite) {
  return seite.$$eval('.widgetraster .widget', (els) => {
    const spanne = (s) => {
      const m = /^(\d+)\s*\/\s*span\s*(\d+)$/.exec(s || '');
      return m ? { start: Number(m[1]), spanne: Number(m[2]) } : null;
    };
    const ergebnis = {};
    els.forEach((el) => {
      const spalte = spanne(el.style.gridColumn);
      const zeile = spanne(el.style.gridRow);
      if (spalte && zeile) {
        ergebnis[el.dataset.id] = { x: spalte.start - 1, y: zeile.start - 1, w: spalte.spanne, h: zeile.spanne };
      }
    });
    return ergebnis;
  });
}

/** Pixelmasse des Rasters — dieselbe Rechnung wie rasterGeometrie() in start.js. */
async function rasterGeometrie(seite) {
  return seite.$eval('.widgetraster', (raster) => {
    const kasten = raster.getBoundingClientRect();
    const stil = getComputedStyle(raster);
    const spaltenluecke = parseFloat(stil.columnGap) || 0;
    const zeilenluecke = parseFloat(stil.rowGap) || 0;
    const GRID_SPALTEN = 12, RASTER_REIHE_PX = 24;
    return {
      links: kasten.left, oben: kasten.top,
      spaltenraster: (kasten.width - spaltenluecke * (GRID_SPALTEN - 1)) / GRID_SPALTEN + spaltenluecke,
      zeilenraster: RASTER_REIHE_PX + zeilenluecke
    };
  });
}

/** Zieht ein Widget an seiner Griffleiste an eine Rasterzelle (x, y). */
async function ziehen(seite, id, zielX, zielY, { pruefeFlug = false } = {}) {
  const widget = seite.locator(`.widget[data-id="${id}"]`);
  const griff = widget.locator('.widget-griff');
  const wKasten = await widget.boundingBox();
  const gKasten = await griff.boundingBox();
  const greifX = gKasten.x + 20;
  const greifY = gKasten.y + gKasten.height / 2;
  const versatzX = greifX - wKasten.x;
  const versatzY = greifY - wKasten.y;
  const geo = await rasterGeometrie(seite);
  const zielPixelX = geo.links + zielX * geo.spaltenraster + versatzX;
  const zielPixelY = geo.oben + zielY * geo.zeilenraster + versatzY;

  await seite.mouse.move(greifX, greifY);
  await seite.mouse.down();
  await seite.mouse.move(zielPixelX, zielPixelY, { steps: 16 });
  await seite.waitForTimeout(250);
  if (pruefeFlug) {
    pruefe(`„${id}" haengt waehrend des Ziehens am Zeiger`, await seite.locator('.wird-geflogen').count(), 1);
    pruefe('… und an seiner Stelle steht ein Umriss', await seite.locator('.widget.ist-platzhalter').count(), 1);
  }
  await seite.mouse.up();
  await seite.waitForTimeout(900);
}

/** Zieht ein Widget an den Ablage-Bereich (blendet es aus). */
async function inAblageZiehen(seite, id) {
  const widget = seite.locator(`.widget[data-id="${id}"]`);
  const ablage = seite.locator('.widget-ablage');
  const griff = widget.locator('.widget-griff');
  const gKasten = await griff.boundingBox();
  const aKasten = await ablage.boundingBox();
  await seite.mouse.move(gKasten.x + 20, gKasten.y + gKasten.height / 2);
  await seite.mouse.down();
  await seite.mouse.move(aKasten.x + aKasten.width / 2, aKasten.y + 20, { steps: 14 });
  await seite.waitForTimeout(250);
  await seite.mouse.up();
  await seite.waitForTimeout(900);
}

/** Zieht den Anfassgriff unten rechts, um Breite/Hoehe um ganze Rastereinheiten zu aendern. */
async function groesseZiehen(seite, id, deltaSpalten, deltaZeilen) {
  const griff = seite.locator(`.widget[data-id="${id}"] .widget-resize`);
  await griff.scrollIntoViewIfNeeded();
  const kasten = await griff.boundingBox();
  const geo = await rasterGeometrie(seite);
  const startX = kasten.x + kasten.width / 2;
  const startY = kasten.y + kasten.height / 2;
  await seite.mouse.move(startX, startY);
  await seite.mouse.down();
  await seite.mouse.move(
    startX + deltaSpalten * geo.spaltenraster,
    startY + deltaZeilen * geo.zeilenraster,
    { steps: 14 }
  );
  await seite.waitForTimeout(250);
  await seite.mouse.up();
  await seite.waitForTimeout(900);
}

function erwarteteUhrSchrift(px) {
  if (px <= 200) return '24px';
  if (px <= 260) return '30px';
  return '46px';
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fehler = [];
// Grosszuegige Hoehe, damit auch isolierte Testbereiche weit unten im
// Raster ohne Mitrollen erreichbar sind — ein Ziehen ueber mehrere
// Rollschritte hinweg wuerde die einmal gemessene Rastergeometrie
// verfaelschen.
const ctx = await browser.newContext({
  viewport: { width: 1400, height: 4200 }, locale: 'de-DE', timezoneId: 'Europe/Berlin'
});
const p = await ctx.newPage();
p.on('pageerror', (e) => fehler.push('PAGEERROR: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') fehler.push('CONSOLE: ' + m.text()); });

await p.clock.setFixedTime(new Date('2026-09-16T08:00:00Z'));
await p.goto(ADRESSE + '/');
await p.evaluate((t) => localStorage.setItem('kz.verbindung',
  JSON.stringify({ url: 'http://localhost:8901/exec', token: t })), TOKEN);
await p.reload();
await p.waitForSelector('.widgetraster', { timeout: 8000 });

// ---------------------------------------------------------------------------
console.log('=== Aufbau ===');
pruefe('sechs Widgets im Raster', await p.locator('.widgetraster .widget').count(), 6);
// Die drei Merklisten (To-Do, Deadlines, Termine) sind neu und starten mit
// standardSichtbar: false — sie liegen darum von Anfang an in der Ablage,
// nicht das Raster ist ohne sie leer.
pruefe('die drei Merklisten liegen von Anfang an in der Ablage', await p.locator(
  '.widget-ablage .widget[data-id="todo"], .widget-ablage .widget[data-id="deadline"], ' +
  '.widget-ablage .widget[data-id="events"]').count(), 3);
pruefe('sonst nichts in der Ablage', await p.locator('.widget-ablage .widget').count(), 3);
pruefe('jedes Widget hat eine Griffleiste', await p.locator('.widgetraster .widget-griff').count(), 6);
pruefe('jedes Widget hat einen Anfassgriff zum Skalieren',
  await p.locator('.widgetraster .widget-resize').count(), 6);
pruefe('die Inhalte sind da', await p.locator('.widget .uhr-zeit').count(), 1);
pruefe('… auch der Tagesplan', await p.locator('.widget ul.tagesplan, .widget .leer').count() >= 1, true);

{
  const rechtecke = await alleRechtecke(p);
  const ids = Object.keys(rechtecke);
  pruefe('alle sechs haben eine Rasterposition', ids.length, 6);
  const ueberlappungsfrei = ids.every((id) => {
    const andere = ids.filter((x) => x !== id).map((x) => rechtecke[x]);
    return celleFrei(rechtecke[id], andere);
  });
  pruefe('keine zwei Widgets ueberschneiden sich beim ersten Aufbau', ueberlappungsfrei, true);
}

// ---------------------------------------------------------------------------
console.log('\n=== Frei nach x UND y ziehen (nicht mehr nur senkrecht) ===');
let y1;
{
  const rechtecke = await alleRechtecke(p);
  const untenRand = Math.max(...Object.values(rechtecke).map((r) => r.y + r.h));
  y1 = untenRand + 3;

  // Erst an eine leere, isolierte Stelle holen — mit Bewegung in beiden
  // Richtungen zugleich, wie es ein freies Raster erlauben muss.
  await ziehen(p, 'uhr', 6, y1, { pruefeFlug: true });
  let r = (await alleRechtecke(p)).uhr;
  pruefe('die Uhr steht jetzt frei unten im Raster', { x: r.x, y: r.y }, { x: 6, y: y1 });
  pruefe('Breite und Hoehe blieben beim Verschieben unveraendert', { w: r.w, h: r.h }, { w: 4, h: 6 });

  // Jetzt eine reine Waagerecht-Bewegung: gleiche Zeile, andere Spalte. Genau
  // das ging in der ersten Fassung nicht — Widgets liessen sich nur
  // untereinander umsortieren.
  await ziehen(p, 'uhr', 0, y1);
  r = (await alleRechtecke(p)).uhr;
  pruefe('rein waagerecht verschoben: die Zeile blieb gleich', r.y, y1);
  pruefe('… nur die Spalte hat sich geaendert', r.x, 0);

  const meta = (await ausTabelle()).meta;
  pruefe('in der Tabelle im neuen Format vermerkt',
    new RegExp(`uhr:0:${y1}:4:6:1`).test(meta.layout_start || ''), true);
}

// ---------------------------------------------------------------------------
console.log('\n=== Ein im Weg stehendes Widget weicht aus, statt zu blockieren ===');
let y3;
{
  const rechtecke = await alleRechtecke(p);
  const untenRand = Math.max(...Object.values(rechtecke).map((r) => r.y + r.h));
  y3 = untenRand + 3;

  // Tagesplan und ein unbeteiligtes Widget (Ferien) an isolierte, bekannte
  // Stellen holen — mit deutlichem Zwischenraum dazwischen, genau die Art
  // Luecke, die eine Lehrkraft bewusst haette anlegen koennen.
  await ziehen(p, 'tagesplan', 0, y3);
  await ziehen(p, 'ferien', 0, y3 + 20);
  const vorher = await alleRechtecke(p);

  // Aufgaben genau auf die Stelle des Tagesplans ziehen — dort steht schon
  // ein anderes sichtbares Widget.
  await ziehen(p, 'aufgaben', vorher.tagesplan.x, vorher.tagesplan.y);
  const nachher = await alleRechtecke(p);

  pruefe('Aufgaben kommt an der Zielstelle an, statt abgewiesen zu werden',
    { x: nachher.aufgaben.x, y: nachher.aufgaben.y }, { x: vorher.tagesplan.x, y: vorher.tagesplan.y });
  pruefe('der Tagesplan weicht senkrecht aus, direkt unter Aufgaben',
    { x: nachher.tagesplan.x, y: nachher.tagesplan.y },
    { x: vorher.tagesplan.x, y: nachher.aufgaben.y + nachher.aufgaben.h });
  pruefe('keine Ueberschneidung zwischen Aufgaben und dem Tagesplan entstanden',
    celleFrei(nachher.aufgaben, [nachher.tagesplan]), true);
  pruefe('Ferien bleibt trotz der Umraeumung oben exakt an seiner Stelle — die Luecke bleibt erhalten',
    nachher.ferien, vorher.ferien);
}

// ---------------------------------------------------------------------------
console.log('\n=== Groesse per Anfassgriff aendern: wachsen, schrumpfen, Kollision ===');
let y2;
{
  const rechtecke = await alleRechtecke(p);
  const untenRand = Math.max(...Object.values(rechtecke).map((r) => r.y + r.h));
  // Unterhalb von allem — aber mit genug Luft bis zum Seitenende: die Einheit
  // waechst hier gleich auf neun Zeilen, und Ferien (zwei Zeilen hoch) muss
  // darunter noch ausweichen koennen, ohne an die Kante zu stossen.
  y2 = Math.min(untenRand + 3, MAX_ZEILEN - 11);
  await ziehen(p, 'einheit', 0, y2);
  let r = (await alleRechtecke(p)).einheit;
  pruefe('die Einheit steht isoliert bereit', { x: r.x, y: r.y }, { x: 0, y: y2 });

  // Wachsen: der Griff zieht Breite UND Hoehe zugleich, stufenlos statt in
  // einem einzigen Klick-Schritt.
  await groesseZiehen(p, 'einheit', 1, 1);
  r = (await alleRechtecke(p)).einheit;
  pruefe('nach dem Ziehen um eine Spalte/Zeile: neue Groesse', { w: r.w, h: r.h }, { w: 9, h: 9 });
  pruefe('die linke obere Ecke blieb beim Wachsen stehen', { x: r.x, y: r.y }, { x: 0, y: y2 });

  // Ein zweites Widget direkt an die neue rechte Kante setzen — verkleinert,
  // damit es in den verbleibenden Rand passt.
  await groesseZiehen(p, 'ferien', -5, -1);
  let fr = (await alleRechtecke(p)).ferien;
  pruefe('Ferien ist auf die Mindestbreite geschrumpft', fr.w, 3);
  await ziehen(p, 'ferien', 9, y2);
  fr = (await alleRechtecke(p)).ferien;
  pruefe('Ferien steht nun buendig an der Kante der Einheit', { x: fr.x, y: fr.y }, { x: 9, y: y2 });

  // Weiter wachsen, jetzt in die belegte Stelle hinein — waechst trotzdem,
  // Ferien weicht aus statt die Groessenaenderung zu blockieren.
  await groesseZiehen(p, 'einheit', 2, 0);
  r = (await alleRechtecke(p)).einheit;
  pruefe('waechst auch in ein belegtes Widget hinein, statt blockiert zu werden', { w: r.w, h: r.h }, { w: 11, h: 9 });
  const ferienNachDemWachsen = (await alleRechtecke(p)).ferien;
  pruefe('Ferien weicht dabei nach unten aus',
    { x: ferienNachDemWachsen.x, y: ferienNachDemWachsen.y }, { x: 9, y: y2 + 9 });
  pruefe('keine Ueberschneidung mit Ferien entstanden', celleFrei(r, [ferienNachDemWachsen]), true);

  // Schrumpfen bis unter die Mindestgroesse: bleibt an der Mindestgroesse
  // stehen (minBreite 4, minHoehe 4 fuer die Einheit), statt unbrauchbar zu werden.
  await groesseZiehen(p, 'einheit', -50, -50);
  r = (await alleRechtecke(p)).einheit;
  pruefe('an der Mindestgroesse angehalten statt unbrauchbar zu schrumpfen', { w: r.w, h: r.h }, { w: 4, h: 4 });
}

// ---------------------------------------------------------------------------
console.log('\n=== Der Inhalt passt sich der eigenen Breite an (nicht der Fensterbreite) ===');
{
  // Die Uhr steht seit dem Ziehtest oben frei bei (0, y1). Erst schmal auf
  // Mindestbreite, dann wieder breit — derselbe Bildschirm, aber ein
  // unterschiedlich breiter Rahmen.
  await groesseZiehen(p, 'uhr', -1, -2);
  let r = (await alleRechtecke(p)).uhr;
  pruefe('die Uhr ist auf Mindestgroesse geschrumpft', { w: r.w, h: r.h }, { w: 3, h: 4 });

  let breitePx = await p.locator('.widget[data-id="uhr"] .widget-inhalt').evaluate((el) => el.getBoundingClientRect().width);
  let schrift = await p.locator('.widget[data-id="uhr"] .uhr-zeit').evaluate((el) => getComputedStyle(el).fontSize);
  pruefe(`schmal (${Math.round(breitePx)}px): Schriftgroesse passt zur Container-Query-Schwelle`,
    schrift, erwarteteUhrSchrift(breitePx));
  const schriftSchmal = parseFloat(schrift);

  await groesseZiehen(p, 'uhr', 5, 2);
  r = (await alleRechtecke(p)).uhr;
  pruefe('die Uhr ist wieder gewachsen', { w: r.w, h: r.h }, { w: 8, h: 6 });

  breitePx = await p.locator('.widget[data-id="uhr"] .widget-inhalt').evaluate((el) => el.getBoundingClientRect().width);
  schrift = await p.locator('.widget[data-id="uhr"] .uhr-zeit').evaluate((el) => getComputedStyle(el).fontSize);
  pruefe(`breit (${Math.round(breitePx)}px): Schriftgroesse passt zur Container-Query-Schwelle`,
    schrift, erwarteteUhrSchrift(breitePx));
  pruefe('breiter Rahmen zeigt eine mindestens so grosse Schrift wie der schmale',
    parseFloat(schrift) >= schriftSchmal, true);
}

// ---------------------------------------------------------------------------
console.log('\n=== Aus- und Einblenden ueber die Knoepfe ===');
{
  const vorher = (await alleRechtecke(p)).klassen;

  await p.locator('.widget[data-id="klassen"] button[title="Ausblenden"]').click();
  await p.waitForTimeout(900);
  pruefe('nur noch fuenf im Raster', await p.locator('.widgetraster .widget').count(), 5);
  pruefe('Klassen liegt in der Ablage', await p.locator('.widget-ablage .widget[data-id="klassen"]').count(), 1);
  pruefe('sein Inhalt ist dort verborgen',
    await p.locator('.widget-ablage .widget[data-id="klassen"] .widget-inhalt').isVisible(), false);
  pruefe('… auch der Anfassgriff ist dort verborgen',
    await p.locator('.widget-ablage .widget[data-id="klassen"] .widget-resize').isVisible(), false);
  pruefe('in der Tabelle als ausgeblendet vermerkt',
    /klassen:\d+:\d+:\d+:\d+:0/.test((await ausTabelle()).meta.layout_start || ''), true);

  await p.locator('.widget-ablage .widget[data-id="klassen"] button[title="Wieder einblenden"]').click();
  await p.waitForTimeout(900);
  pruefe('wieder im Raster', await p.locator('.widgetraster .widget').count(), 6);
  pruefe('Klassen nicht mehr in der Ablage — die drei Merklisten bleiben aber dort',
    await p.locator('.widget-ablage .widget').count(), 3);
  pruefe('an der alten Stelle wieder aufgetaucht, weil sie noch frei war',
    (await alleRechtecke(p)).klassen, vorher);
}

// ---------------------------------------------------------------------------
console.log('\n=== Die Anordnung uebersteht das Neuladen ===');
{
  const vorher = await alleRechtecke(p);
  const vorherAusgeblendet = await p.locator('.widget-ablage .widget').count();
  await p.reload();
  await p.waitForSelector('.widgetraster', { timeout: 8000 });
  const nachher = await alleRechtecke(p);
  pruefe('jedes Widget steht nach dem Neuladen wieder an derselben Stelle', nachher, vorher);
  pruefe('die Ablage ist unveraendert', await p.locator('.widget-ablage .widget').count(), vorherAusgeblendet);

  const meta = (await ausTabelle()).meta;
  pruefe('die gespeicherte Zeile ist vollstaendig im neuen Format (id:x:y:w:h:sichtbar)',
    /^([\w]+:\d+:\d+:\d+:\d+:[01],?)+$/.test(meta.layout_start || ''), true);
}

// ---------------------------------------------------------------------------
// Eigener, realistisch kleiner Bildschirm: die bisherigen Tests laufen
// bewusst auf einem ueberhohen Fenster, damit kein Mitrollen noetig ist.
// Genau das Mitrollen ist hier aber der Pruefgegenstand — die Ablage liegt
// ganz unten auf der Seite, im selben Bereich, der das Mitrollen ausloest.
// ---------------------------------------------------------------------------
console.log('\n=== Die Ablage bleibt beim Mitrollen erreichbar (nicht nur ueberrollt) ===');
{
  const ctx2 = await browser.newContext({
    viewport: { width: 900, height: 800 }, locale: 'de-DE', timezoneId: 'Europe/Berlin'
  });
  const p2 = await ctx2.newPage();
  const fehler2 = [];
  p2.on('pageerror', (e) => fehler2.push('PAGEERROR: ' + e.message));
  p2.on('console', (m) => { if (m.type() === 'error') fehler2.push('CONSOLE: ' + m.text()); });

  await p2.clock.setFixedTime(new Date('2026-09-16T08:00:00Z'));
  await p2.goto(ADRESSE + '/');
  await p2.evaluate((t) => localStorage.setItem('kz.verbindung',
    JSON.stringify({ url: 'http://localhost:8901/exec', token: t })), TOKEN);
  await p2.reload();
  await p2.waitForSelector('.widgetraster', { timeout: 8000 });

  const ablageOben = () => p2.locator('.widget-ablage').evaluate((el) => el.getBoundingClientRect().top);
  pruefe('die Ablage ist zu Beginn nicht im sichtbaren Bereich — ohne Rollen unerreichbar',
    (await ablageOben()) > 800, true);

  // „Klassen" greifen: das einzige Widget, das in den vorigen Abschnitten
  // dieser Datei nie an eine isolierte Stelle irgendwo weit unten gezogen
  // wurde (nur aus- und wieder eingeblendet) — es steht darum zuverlaessig
  // noch nahe an seiner urspruenglichen, sichtbaren Stelle oben im Raster.
  const obersteId = 'klassen';
  const griffLocator = p2.locator(`.widget[data-id="${obersteId}"] .widget-griff`);
  await griffLocator.scrollIntoViewIfNeeded();
  const griff = await griffLocator.boundingBox();
  const rasterhoehe = () => p2.locator('.widgetraster').evaluate((el) => el.getBoundingClientRect().height);
  const hoeheVorher = await rasterhoehe();
  await p2.mouse.move(griff.x + 20, griff.y + griff.height / 2);
  await p2.mouse.down();
  // In die untere Rollzone (die letzten 90px des Fensters), aber nicht ganz
  // an die aeusserste Kante — dort bliebe sonst kein Spielraum, um die
  // Ablage noch exakt zu treffen.
  await p2.mouse.move(450, 740, { steps: 10 });
  await p2.waitForTimeout(600);

  const scrollA = await p2.evaluate(() => window.scrollY);
  pruefe('die Seite ist tatsaechlich losgerollt', scrollA > 0, true);

  // Wie hoch die Seite in diesem Testlauf gerade ist, haengt von allem ab,
  // was die vorigen Abschnitte schon damit angestellt haben — statt eine
  // feste Wartezeit zu raten, wird wiederholt gemessen, bis sich der
  // Rollstand zwischen zwei Messungen nicht mehr aendert (oder das Limit
  // erreicht ist, was hier als Fehlschlag zaehlen soll).
  let stand = scrollA;
  let stabil = false;
  for (let i = 0; i < 40 && !stabil; i++) {
    await p2.waitForTimeout(400);
    const neu = await p2.evaluate(() => window.scrollY);
    stabil = neu === stand;
    stand = neu;
  }
  pruefe('… und kommt zur Ruhe, statt endlos weiterzurollen', stabil, true);
  pruefe('die Ablage steht jetzt tatsaechlich im sichtbaren Bereich',
    (await ablageOben()) < 800, true);

  // Der Kern des Ganzen: das Raster ist waehrend des Zugs kein Stueck
  // gewachsen. Genau daran scheiterte es vorher — es wuchs bei jedem
  // Rollschritt mit, die Ablage darunter rutschte mit nach unten, und man
  // jagte ihr hinterher, ohne sie je einzuholen. (Dass die Ablage selbst
  // etwas hoeher wird, sobald das Widget in der Vorschau darin liegt, ist
  // etwas anderes: das geschieht genau einmal und erst, wenn man schon da
  // ist — dort wird ohnehin nicht mehr weitergerollt.)
  pruefe('das Raster ist waehrend des Ziehens nicht gewachsen',
    await rasterhoehe(), hoeheVorher);

  // Letzter, kleiner Feinschliff, wie ihn auch eine Person von Hand macht:
  // die Ablage ist jetzt sichtbar, der Zeiger wandert die letzten Pixel
  // dorthin — und darf das, ohne dass die Seite dabei wieder lostrollt.
  const ablageKasten = await p2.locator('.widget-ablage').boundingBox();
  await p2.mouse.move(ablageKasten.x + ablageKasten.width / 2, ablageKasten.y + 20, { steps: 5 });
  await p2.waitForTimeout(300);
  pruefe('am Zeiger steht jetzt tatsaechlich die Ablage',
    await p2.evaluate(({ x, y }) => document.elementsFromPoint(x, y)
      .some((el) => el.closest && el.closest('.widget-ablage')),
      { x: ablageKasten.x + ablageKasten.width / 2, y: ablageKasten.y + 20 }), true);

  await p2.mouse.up();
  await p2.waitForTimeout(900);
  pruefe('das gegriffene Widget ist wirklich in der Ablage gelandet',
    await p2.locator(`.widget-ablage .widget[data-id="${obersteId}"]`).count(), 1);

  console.log('JS-Fehler (eigener Bildschirm):', fehler2.length ? fehler2 : 'keine');
  fehler.push(...fehler2);
  await ctx2.close();
}

// ---------------------------------------------------------------------------
// Ein einzelner Aussetzer der Tabelle darf die gerade gebaute Anordnung nicht
// zurueckwerfen. Genau das trat in freier Wildbahn auf: kurz nach einer neuen
// Bereitstellung meldete die Tabelle sporadisch „Zugang verweigert", das
// Widget sprang zurueck, und beim naechsten Versuch ging alles wieder.
// ---------------------------------------------------------------------------
console.log('\n=== Ein kurzer Aussetzer beim Speichern wirft nichts zurueck ===');
{
  const ctx3 = await browser.newContext({
    viewport: { width: 1400, height: 4200 }, locale: 'de-DE', timezoneId: 'Europe/Berlin'
  });
  const p3 = await ctx3.newPage();
  const fehler3 = [];
  p3.on('pageerror', (e) => fehler3.push('PAGEERROR: ' + e.message));

  // Meldungsfenster mitzaehlen, statt sie nur wegzuklicken: ihr Ausbleiben
  // ist hier die eigentliche Aussage.
  const meldungen = [];
  p3.on('dialog', (d) => { meldungen.push(d.message()); d.accept().catch(() => {}); });

  // Der ERSTE Speicherversuch der Anordnung scheitert, jeder weitere geht
  // durch — so verhaelt sich ein kurzer Aussetzer.
  let schonGescheitert = false;
  await p3.route('**/exec', async (route) => {
    const anfrage = route.request();
    const rumpf = anfrage.method() === 'POST' ? (anfrage.postData() || '') : '';
    if (!schonGescheitert && rumpf.includes('layout_start')) {
      schonGescheitert = true;
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: false, fehler: 'Zugang verweigert. Bitte den Zugangsschlüssel in den Einstellungen prüfen.' })
      });
      return;
    }
    await route.continue();
  });

  await p3.clock.setFixedTime(new Date('2026-09-16T08:00:00Z'));
  await p3.goto(ADRESSE + '/');
  await p3.evaluate((t) => localStorage.setItem('kz.verbindung',
    JSON.stringify({ url: 'http://localhost:8901/exec', token: t })), TOKEN);
  await p3.reload();
  await p3.waitForSelector('.widgetraster', { timeout: 8000 });

  // Irgendeines der sichtbaren Widgets — welche das sind, haengt davon ab,
  // was die vorigen Abschnitte mit ihnen angestellt haben.
  const alle = await alleRechtecke(p3);
  const id = Object.keys(alle)[0];
  const vorher = alle[id];
  const zielY = Math.min(vorher.y + 4, MAX_ZEILEN - vorher.h);
  await ziehen(p3, id, 0, zielY);
  // Der zweite Versuch startet erst nach einer kurzen Pause.
  await p3.waitForTimeout(2000);

  pruefe('der erste Speicherversuch ist tatsaechlich gescheitert', schonGescheitert, true);
  pruefe('trotzdem kein Meldungsfenster', meldungen, []);
  const nachher = (await alleRechtecke(p3))[id];
  pruefe('das Widget ist an der neuen Stelle geblieben, statt zurueckzuspringen',
    { x: nachher.x, y: nachher.y }, { x: 0, y: zielY });

  // Und die Anordnung ist wirklich in der Tabelle gelandet, nicht bloss im Bild.
  await p3.reload();
  await p3.waitForSelector('.widgetraster', { timeout: 8000 });
  const nachNeuladen = (await alleRechtecke(p3))[id];
  pruefe('… und uebersteht das Neuladen, war also wirklich gespeichert',
    { x: nachNeuladen.x, y: nachNeuladen.y }, { x: 0, y: zielY });

  console.log('JS-Fehler (Aussetzer-Bildschirm):', fehler3.length ? fehler3 : 'keine');
  fehler.push(...fehler3);
  await ctx3.close();
}

console.log('\nJS-Fehler:', fehler.length ? fehler : 'keine');
console.log(schlecht === 0 && !fehler.length
  ? `\nALLE ${n} TESTS BESTANDEN`
  : `\n${schlecht} von ${n} FEHLGESCHLAGEN`);

await browser.close();
process.exit(schlecht === 0 && !fehler.length ? 0 : 1);
