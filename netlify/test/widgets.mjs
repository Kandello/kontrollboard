/**
 * Prueft das Widget-Raster der Startseite.
 *
 * Der heikle Teil ist, dass die Anordnung in der Tabelle landet und von dort
 * wiederkommt — sonst waere sie nach dem naechsten Geraetewechsel weg. Es
 * wird deshalb nicht nur geprueft, dass sich etwas bewegt, sondern dass die
 * Tabelle danach dieselbe Anordnung kennt wie die Anzeige.
 *
 *   node mock.js &
 *   node widgets.mjs
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

async function ausTabelle() {
  const a = await fetch(`${ADRESSE}/exec?aktion=laden&token=${TOKEN}`);
  return (await a.json()).daten;
}

/** Die Widgets in der Reihenfolge, in der sie auf dem Bildschirm stehen. */
async function rasterReihenfolge(seite) {
  return seite.$$eval('.widgetraster .widget', (els) => els
    .map((el) => ({ id: el.dataset.id, oben: el.getBoundingClientRect().top,
                    links: el.getBoundingClientRect().left }))
    .sort((a, b) => (a.oben - b.oben) || (a.links - b.links))
    .map((x) => x.id));
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fehler = [];
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 1100 }, locale: 'de-DE', timezoneId: 'Europe/Berlin'
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
pruefe('sechs Widgets', await p.locator('.widgetraster .widget').count(), 6);
pruefe('Reihenfolge wie im Code vorgegeben', await rasterReihenfolge(p),
  ['uhr', 'tagesplan', 'aufgaben', 'einheit', 'klassen', 'ferien']);
pruefe('Ablage ist zunaechst leer',
  (await p.locator('.widget-ablage').innerText()).includes('Alles eingeblendet'), true);
pruefe('jedes Widget hat eine Griffleiste',
  await p.locator('.widgetraster .widget-griff').count(), 6);
pruefe('die Uhr ist schmal',
  await p.locator('.widget[data-id="uhr"]').getAttribute('data-breite'), '1');
pruefe('der Tagesplan ist breit',
  await p.locator('.widget[data-id="tagesplan"]').getAttribute('data-breite'), '2');
pruefe('die Inhalte sind da', await p.locator('.widget .uhr-zeit').count(), 1);
pruefe('… auch der Tagesplan', await p.locator('.widget ul.tagesplan').count(), 1);

// ---------------------------------------------------------------------------
console.log('\n=== Breite umschalten ===');
{
  await p.locator('.widget[data-id="uhr"] button[title="Breite umschalten"]').click();
  await p.waitForTimeout(900);
  pruefe('die Uhr ist jetzt breit',
    await p.locator('.widget[data-id="uhr"]').getAttribute('data-breite'), '2');
  const meta = (await ausTabelle()).meta;
  pruefe('in der Tabelle gespeichert', /uhr:2:1/.test(meta.layout_start || ''), true);

  await p.locator('.widget[data-id="uhr"] button[title="Breite umschalten"]').click();
  await p.waitForTimeout(900);
  pruefe('und wieder schmal',
    await p.locator('.widget[data-id="uhr"]').getAttribute('data-breite'), '1');
}

// ---------------------------------------------------------------------------
console.log('\n=== Aus- und Einblenden ueber die Knoepfe ===');
{
  await p.locator('.widget[data-id="ferien"] button[title="Ausblenden"]').click();
  await p.waitForTimeout(900);
  pruefe('nur noch fuenf im Raster', await p.locator('.widgetraster .widget').count(), 5);
  pruefe('das sechste liegt in der Ablage',
    await p.locator('.widget-ablage .widget[data-id="ferien"]').count(), 1);
  pruefe('sein Inhalt ist dort verborgen',
    await p.locator('.widget-ablage .widget[data-id="ferien"] .widget-inhalt').isVisible(), false);
  pruefe('in der Tabelle als ausgeblendet vermerkt',
    /ferien:\d:0/.test((await ausTabelle()).meta.layout_start || ''), true);

  await p.locator('.widget-ablage .widget[data-id="ferien"] button[title="Wieder einblenden"]').click();
  await p.waitForTimeout(900);
  pruefe('wieder im Raster', await p.locator('.widgetraster .widget').count(), 6);
  pruefe('Ablage wieder leer',
    (await p.locator('.widget-ablage').innerText()).includes('Alles eingeblendet'), true);
}

// ---------------------------------------------------------------------------
console.log('\n=== Ziehen an der Griffleiste ===');
{
  const vorher = await rasterReihenfolge(p);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(150);

  // Den Tagesplan vor die Uhr. Bewusst zwei Widgets aus den obersten Reihen:
  // ein weit unten liegendes waere nach dem Hochrollen ausserhalb des Bildes,
  // und dann begaenne der Zug gar nicht erst.
  const griff = await p.locator('.widget[data-id="tagesplan"] .widget-griff').boundingBox();
  const ziel = await p.locator('.widget[data-id="uhr"]').boundingBox();
  await p.mouse.move(griff.x + 30, griff.y + griff.height / 2);
  await p.mouse.down();
  await p.mouse.move(ziel.x + ziel.width / 2, ziel.y + 30, { steps: 16 });
  await p.waitForTimeout(300);
  pruefe('waehrend des Ziehens haengt es am Zeiger',
    await p.locator('.wird-geflogen').count(), 1);
  pruefe('… und an seiner Stelle steht ein Umriss',
    await p.locator('.widget.ist-platzhalter').count(), 1);
  await p.mouse.up();
  await p.waitForTimeout(900);

  const nachher = await rasterReihenfolge(p);
  pruefe('der Tagesplan steht jetzt vorn', nachher[0], 'tagesplan');
  pruefe('die Uhr ist dahinter gerutscht', nachher[1], 'uhr');
  pruefe('nichts ist verlorengegangen', nachher.length, vorher.length);
  pruefe('die Tabelle kennt dieselbe Anordnung',
    (await ausTabelle()).meta.layout_start.split(',').map((t) => t.split(':')[0])
      .filter((id) => nachher.includes(id)),
    nachher);
}

// ---------------------------------------------------------------------------
console.log('\n=== In die Ablage ziehen ===');
{
  await p.locator('.widget-ablage').scrollIntoViewIfNeeded();
  await p.waitForTimeout(200);
  const griff = await p.locator('.widget[data-id="aufgaben"] .widget-griff').boundingBox();
  const ablage = await p.locator('.widget-ablage').boundingBox();
  await p.mouse.move(griff.x + 30, griff.y + griff.height / 2);
  await p.mouse.down();
  await p.mouse.move(ablage.x + ablage.width / 2, ablage.y + 30, { steps: 14 });
  await p.waitForTimeout(300);
  await p.mouse.up();
  await p.waitForTimeout(900);

  pruefe('das Widget liegt in der Ablage',
    await p.locator('.widget-ablage .widget[data-id="aufgaben"]').count(), 1);
  pruefe('in der Tabelle vermerkt',
    /aufgaben:\d:0/.test((await ausTabelle()).meta.layout_start || ''), true);
}

// ---------------------------------------------------------------------------
console.log('\n=== Die Anordnung ueberlebt das Neuladen ===');
{
  const vorher = await rasterReihenfolge(p);
  await p.reload();
  await p.waitForSelector('.widgetraster', { timeout: 8000 });
  pruefe('gleiche Reihenfolge nach dem Neuladen', await rasterReihenfolge(p), vorher);
  pruefe('das ausgeblendete bleibt ausgeblendet',
    await p.locator('.widget-ablage .widget[data-id="aufgaben"]').count(), 1);

  // Aufraeumen, damit ein zweiter Lauf denselben Ausgangsstand hat.
  await p.locator('.widget-ablage .widget[data-id="aufgaben"] button[title="Wieder einblenden"]').click();
  await p.waitForTimeout(900);
}

console.log('\nJS-Fehler:', fehler.length ? fehler : 'keine');
console.log(schlecht === 0 && !fehler.length
  ? `\nALLE ${n} TESTS BESTANDEN`
  : `\n${schlecht} von ${n} FEHLGESCHLAGEN`);

await browser.close();
process.exit(schlecht === 0 && !fehler.length ? 0 : 1);
