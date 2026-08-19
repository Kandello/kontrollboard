/**
 * Prueft die Ansichten zu den Unterrichtseinheiten:
 * Jahresplan (#/einheiten), das Abhaken je Klasse und das Startseiten-Widget.
 *
 * Der heikle Teil ist das Verschieben: es aendert die Wochen aller
 * nachfolgenden Einheiten. Geprueft wird deshalb nicht nur, dass sich etwas
 * bewegt, sondern dass die Tabelle danach denselben Plan hat wie die Anzeige.
 *
 *   node mock.js &
 *   node einheitenansicht.mjs
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

/** Der Stand in der Tabelle — nicht der in der Anzeige. */
async function ausTabelle() {
  const a = await fetch(`${ADRESSE}/exec?aktion=laden&token=${TOKEN}`);
  return (await a.json()).daten;
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fehler = [];
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 1200 }, locale: 'de-DE', timezoneId: 'Europe/Berlin'
});
const p = await ctx.newPage();
p.on('pageerror', (e) => fehler.push('PAGEERROR: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') fehler.push('CONSOLE: ' + m.text()); });

await p.clock.setFixedTime(new Date('2026-09-16T08:00:00Z')); // Schulwoche 5
await p.goto(ADRESSE + '/');
await p.evaluate((t) => localStorage.setItem('kz.verbindung',
  JSON.stringify({ url: 'http://localhost:8901/exec', token: t })), TOKEN);
await p.reload();
await p.waitForSelector('.klassenraster', { timeout: 8000 });

// ---------------------------------------------------------------------------
console.log('=== Jahresplan: Aufbau ===');
await p.goto(ADRESSE + '#/einheiten');
await p.waitForSelector('.jahresraster', { timeout: 8000 });

pruefe('26 Einheiten als Boxen', await p.locator('.jahresraster .einheit-box').count(), 26);
// innerText liefert die per CSS grossgeschriebene Fassung — hier zaehlt der Text.
pruefe('zwei Spurenüberschriften',
  (await p.locator('.jahresraster-kopf').allInnerTexts()).map((t) => t.toLowerCase()),
  ['woche', 'rechtschreibung', 'grammatik']);

const ersteBox = p.locator('.jahresraster .einheit-box').first();
pruefe('die Wortarten-Einheit steht zuerst',
  (await ersteBox.innerText()).includes('Wortarten wiederholen'), true);
pruefe('… läuft auf beiden Spuren',
  (await ersteBox.getAttribute('class')).includes('spur-beide'), true);
pruefe('… und beginnt in Woche 1', (await ersteBox.innerText()).includes('Woche 1–4'), true);
pruefe('… spannt über beide Spalten',
  await ersteBox.evaluate((el) => getComputedStyle(el).gridColumnStart + '/' +
    getComputedStyle(el).gridColumnEnd), '2/span 2');

// Die Startwoche wird gerechnet, nicht gespeichert: die zweite
// Rechtschreib-Einheit muss lueckenlos an die erste anschliessen.
const rsBoxen = p.locator('.einheit-box.spur-rs');
pruefe('die erste Rechtschreib-Einheit beginnt nach dem Vorspann',
  (await rsBoxen.first().innerText()).includes('Woche 5–6'), true);
pruefe('die zweite schließt lückenlos an',
  (await rsBoxen.nth(1).innerText()).includes('Woche 7–8'), true);

pruefe('aktuelle Schulwoche ist hervorgehoben', await p.locator('.jahreswoche.ist-jetzt').count(), 1);
pruefe('… und es ist Woche 5',
  (await p.locator('.jahreswoche.ist-jetzt').innerText()).trim(), '5');
pruefe('Vorrat ist zunächst leer',
  (await p.locator('.jahresvorrat').innerText()).includes('Alle Einheiten sind eingeplant'), true);

// ---------------------------------------------------------------------------
console.log('\n=== Einheit aufklappen ===');
await ersteBox.locator('.einheit-kopf').click();
await p.waitForTimeout(300);
pruefe('Teilthemen erscheinen',
  await p.locator('.einheit-box.offen ol.teilthemenliste li').count(), 7);
pruefe('erstes Teilthema',
  (await p.locator('.einheit-box.offen ol.teilthemenliste li').first().innerText())
    .includes('Merkheftchen Nomen'), true);

// ---------------------------------------------------------------------------
console.log('\n=== Verschieben über die Pfeilknöpfe ===');
{
  const vorher = await ausTabelle();
  const rsVorher = vorher.einheiten.filter((e) => e.spur === 'RS').map((e) => e.titel);

  // Die zweite Rechtschreib-Einheit eine Position nach vorn.
  const box = p.locator('.einheit-box.spur-rs').nth(1);
  const titel = (await box.locator('.einheit-titel').innerText()).trim();
  await box.locator('button[title="Eine Position früher"]').click();
  await p.waitForTimeout(700);

  pruefe('sie steht jetzt an erster Stelle der Spur',
    (await p.locator('.einheit-box.spur-rs').first().locator('.einheit-titel').innerText()).trim(),
    titel);
  pruefe('… und beginnt nun in Woche 5',
    (await p.locator('.einheit-box.spur-rs').first().innerText()).includes('Woche 5'), true);

  const nachher = await ausTabelle();
  const rsNachher = nachher.einheiten.filter((e) => e.spur === 'RS').map((e) => e.titel);
  pruefe('die Tabelle kennt dieselbe Reihenfolge',
    rsNachher.slice(0, 2), [rsVorher[1], rsVorher[0]]);
  pruefe('keine Einheit ist dabei verlorengegangen',
    nachher.einheiten.length, vorher.einheiten.length);

  // Zurueck, damit die folgenden Pruefungen vom Ausgangsplan ausgehen.
  await p.locator('.einheit-box.spur-rs').first()
    .locator('button[title="Eine Position später"]').click();
  await p.waitForTimeout(700);
  const zurueck = await ausTabelle();
  pruefe('Zurückschieben stellt den alten Plan wieder her',
    zurueck.einheiten.filter((e) => e.spur === 'RS').map((e) => e.titel).slice(0, 2),
    rsVorher.slice(0, 2));
}

// ---------------------------------------------------------------------------
console.log('\n=== Verschieben durch Ziehen ===');
{
  const vorher = await ausTabelle();
  const grVorher = vorher.einheiten.filter((e) => e.spur === 'GR').map((e) => e.titel);

  // Die erste Grammatik-Einheit am Griff auf die Rechtschreibspur ziehen.
  const quelle = p.locator('.einheit-box.spur-gr').first();
  const titel = (await quelle.locator('.einheit-titel').innerText()).trim();
  const griff = quelle.locator('.einheit-griff');
  const vonKasten = await griff.boundingBox();

  // Ziel: die erste Rechtschreib-Box — dorthin wird davor einsortiert.
  const ziel = p.locator('.einheit-box.spur-rs').first();
  const zielKasten = await ziel.boundingBox();

  await p.mouse.move(vonKasten.x + vonKasten.width / 2, vonKasten.y + vonKasten.height / 2);
  await p.mouse.down();
  await p.mouse.move(zielKasten.x + zielKasten.width / 2, zielKasten.y + 12, { steps: 12 });
  await p.waitForTimeout(120);
  await p.mouse.up();
  await p.waitForTimeout(800);

  const nachher = await ausTabelle();
  const gezogen = nachher.einheiten.find((e) => e.titel === titel);
  pruefe('die gezogene Einheit liegt auf der Rechtschreibspur', gezogen.spur, 'RS');
  pruefe('sie steht dort an erster Stelle',
    (await p.locator('.einheit-box.spur-rs').first().locator('.einheit-titel').innerText()).trim(),
    titel);
  pruefe('die Grammatikspur hat eine Einheit weniger',
    nachher.einheiten.filter((e) => e.spur === 'GR').length, grVorher.length - 1);
  pruefe('nichts wurde dabei gelöscht', nachher.einheiten.length, vorher.einheiten.length);

  // In den Vorrat ziehen — die Einheit faellt aus dem Plan, bleibt aber da.
  // Die LETZTE Einheit der Spur nehmen: sie liegt am unteren Ende des Rasters
  // und ist damit gleichzeitig mit dem Vorrat sichtbar. Bei einer Box vom
  // Jahresanfang waere nach dem Scrollen zum Vorrat der Griff aus dem Bild.
  const raus = p.locator('.einheit-box.spur-rs').last();
  const rausTitel = (await raus.locator('.einheit-titel').innerText()).trim();
  const rausGriff = raus.locator('.einheit-griff');
  const vorrat = p.locator('.jahresvorrat');
  await vorrat.scrollIntoViewIfNeeded();
  await p.waitForTimeout(150);
  const rausKasten = await rausGriff.boundingBox();
  const vorratKasten = await vorrat.boundingBox();

  await p.mouse.move(rausKasten.x + rausKasten.width / 2, rausKasten.y + rausKasten.height / 2);
  await p.mouse.down();
  await p.mouse.move(vorratKasten.x + vorratKasten.width / 2,
                     vorratKasten.y + vorratKasten.height / 2, { steps: 12 });
  await p.waitForTimeout(120);
  await p.mouse.up();
  await p.waitForTimeout(800);

  const imVorrat = await ausTabelle();
  pruefe('die in den Vorrat gezogene Einheit ist ausgeplant',
    imVorrat.einheiten.find((e) => e.titel === rausTitel).spur, '');
  pruefe('… und ist nicht gelöscht', imVorrat.einheiten.length, vorher.einheiten.length);
  pruefe('der Vorrat zeigt sie an',
    (await p.locator('.jahresvorrat .einheit-box').first().innerText()).includes(rausTitel), true);

  // Und wieder zurück in den Plan — über den Knopf im aufgeklappten Kasten.
  await p.locator('.jahresvorrat .einheit-box .einheit-kopf').first().click();
  await p.waitForTimeout(300);
  await p.locator('.jahresvorrat button', { hasText: 'In den Plan' }).first().click();
  await p.waitForTimeout(800);
  const zurueckImPlan = await ausTabelle();
  pruefe('„In den Plan" holt sie zurück',
    zurueckImPlan.einheiten.find((e) => e.titel === rausTitel).spur, 'RS');
}

// ---------------------------------------------------------------------------
console.log('\n=== Abhaken je Klasse ===');
{
  await p.goto(ADRESSE + '#/klasse/3L/einheiten');
  await p.waitForSelector('ul.teilthemen-abhaken', { timeout: 8000 });

  const kaesten = p.locator('ul.teilthemen-abhaken input');
  pruefe('Teilthemen sind abhakbar', (await kaesten.count()) > 10, true);
  pruefe('zu Beginn nichts erledigt', await p.locator('li.ist-erledigt').count(), 0);

  await kaesten.first().check();
  await p.waitForTimeout(300);
  pruefe('sofort als erledigt gezeichnet', await p.locator('li.ist-erledigt').count(), 1);
  pruefe('mit Datum', /am \d{4}-\d{2}-\d{2}/.test(await p.locator('li.ist-erledigt').innerText()), true);

  await p.waitForTimeout(1400); // Debounce abwarten.
  const gespeichert = await ausTabelle();
  pruefe('in der Tabelle angekommen',
    gespeichert.einheitFortschritt.filter((f) => f.klasse === '3L' && f.erledigt).length, 1);
  pruefe('… und nur für diese Klasse',
    gespeichert.einheitFortschritt.filter((f) => f.klasse === '3M').length, 0);

  // Die Parallelklasse darf davon nichts sehen — das ist der ganze Sinn der
  // getrennten Fortschrittsfuehrung bei ausgefallenen Stunden.
  await p.goto(ADRESSE + '#/klasse/3M/einheiten');
  await p.waitForSelector('ul.teilthemen-abhaken', { timeout: 8000 });
  pruefe('3M ist unberührt', await p.locator('li.ist-erledigt').count(), 0);

  // Zuruecknehmen entfernt den Eintrag wieder.
  await p.goto(ADRESSE + '#/klasse/3L/einheiten');
  await p.waitForSelector('ul.teilthemen-abhaken', { timeout: 8000 });
  await p.locator('ul.teilthemen-abhaken input').first().uncheck();
  await p.waitForTimeout(1500);
  const zurueck = await ausTabelle();
  pruefe('Zurücknehmen löscht die Zeile',
    zurueck.einheitFortschritt.filter((f) => f.klasse === '3L').length, 0);
}

// ---------------------------------------------------------------------------
console.log('\n=== Startseiten-Widget ===');
{
  // Ein Teilthema abhaken, damit der Fortschritt sichtbar wird.
  await p.locator('ul.teilthemen-abhaken input').first().check();
  await p.waitForTimeout(1500);

  await p.goto(ADRESSE + '#/');
  await p.waitForSelector('.klassenraster', { timeout: 8000 });

  const widget = p.locator('.karte', { hasText: 'Aktuelle Unterrichtseinheit' });
  pruefe('das Widget nennt die Schulwoche',
    (await widget.innerText()).includes('Schulwoche 5'), true);
  pruefe('… und zeigt laufende Einheiten',
    (await p.locator('.laufende-einheit').count()) >= 1, true);
  pruefe('… mit einem Prozentwert je Klasse',
    (await p.locator('.laufende-einheit .knopf').count()) >= 3, true);

  pruefe('die Klassenkachel hat einen gefüllten Balken',
    await p.locator('.klassenknopf').first().locator('.balken > i')
      .evaluate((el) => el.style.width !== '0%'), true);
  pruefe('die Balken der anderen Klassen bleiben leer',
    await p.locator('.klassenknopf').nth(1).locator('.balken > i')
      .evaluate((el) => el.style.width), '0%');

  // Aufraeumen, damit ein zweiter Lauf denselben Ausgangsstand hat.
  await p.goto(ADRESSE + '#/klasse/3L/einheiten');
  await p.waitForSelector('ul.teilthemen-abhaken', { timeout: 8000 });
  await p.locator('ul.teilthemen-abhaken input').first().uncheck();
  await p.waitForTimeout(1500);
}

// ---------------------------------------------------------------------------
console.log('\n=== Einstieg über die Kopfleiste ===');
{
  await p.goto(ADRESSE + '#/');
  await p.waitForSelector('.klassenraster', { timeout: 8000 });
  await p.locator('.kopfleiste-inhalt a', { hasText: 'Einheiten' }).click();
  await p.waitForTimeout(500);
  pruefe('führt zum Jahresplan', p.url().includes('#/einheiten'), true);
  pruefe('Brotkrume nennt das Werkzeug',
    (await p.locator('.pfad').innerText()).includes('Unterrichtseinheiten'), true);
}

console.log('\nJS-Fehler:', fehler.length ? fehler : 'keine');
console.log(schlecht === 0 && !fehler.length
  ? `\nALLE ${n} TESTS BESTANDEN`
  : `\n${schlecht} von ${n} FEHLGESCHLAGEN`);

await browser.close();
process.exit(schlecht === 0 && !fehler.length ? 0 : 1);
