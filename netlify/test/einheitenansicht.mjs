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

/**
 * Die Titel einer Spur in der Reihenfolge, in der sie auf dem Bildschirm
 * stehen. Die Reihenfolge im Dokument taugt dafuer nicht: die Boxen werden
 * einmal gebaut und danach nur noch im Raster umplatziert.
 */
async function spurReihenfolge(seite, spur) {
  return seite.$$eval(`.jahresraster .einheit-box.spur-${spur}`, (els) => els
    .map((el) => ({
      titel: el.querySelector('.einheit-titel').textContent.trim(),
      oben: el.getBoundingClientRect().top
    }))
    .sort((a, b) => a.oben - b.oben)
    .map((x) => x.titel));
}

/** Die Wochenangabe, die unter dem Titel einer Einheit steht. */
async function wochenText(seite, titel) {
  return seite.locator('.einheit-box', { hasText: titel }).first()
    .locator('.einheit-zusatz').innerText();
}
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

const ersteBox = p.locator('.einheit-box', { hasText: 'Wortarten wiederholen' }).first();
pruefe('… läuft auf beiden Spuren',
  (await ersteBox.getAttribute('class')).includes('spur-beide'), true);
pruefe('… und beginnt in Woche 1', (await ersteBox.innerText()).includes('Woche 1–4'), true);
pruefe('… spannt über beide Spalten',
  await ersteBox.evaluate((el) => getComputedStyle(el).gridColumnStart + '/' +
    getComputedStyle(el).gridColumnEnd), '2/span 2');

// Die Startwoche wird gerechnet, nicht gespeichert: die zweite
// Rechtschreib-Einheit muss lueckenlos an die erste anschliessen.
const rsOrdnung = await spurReihenfolge(p, 'rs');
pruefe('die Rechtschreibspur beginnt mit der Wörterliste',
  rsOrdnung[0], 'Mit dem Alphabet und der Wörterliste arbeiten');
pruefe('die erste Rechtschreib-Einheit beginnt nach dem Vorspann',
  (await wochenText(p, rsOrdnung[0])).includes('Woche 5–6'), true);
pruefe('die zweite schließt lückenlos an',
  (await wochenText(p, rsOrdnung[1])).includes('Woche 7–8'), true);

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
  const vorher = await spurReihenfolge(p, 'rs');
  const zweite = vorher[1];

  await p.locator('.einheit-box', { hasText: zweite }).first()
    .locator('button[title="Eine Position früher"]').click();
  await p.waitForTimeout(800);

  const nachher = await spurReihenfolge(p, 'rs');
  pruefe('sie steht jetzt an erster Stelle der Spur', nachher[0], zweite);
  pruefe('… und die vormals erste dahinter', nachher[1], vorher[0]);
  pruefe('… und beginnt nun in Woche 5',
    (await wochenText(p, zweite)).includes('Woche 5'), true);

  const tabelle = await ausTabelle();
  pruefe('die Tabelle kennt dieselbe Reihenfolge',
    tabelle.einheiten.filter((e) => e.spur === 'RS').map((e) => e.titel).slice(0, 2),
    [zweite, vorher[0]]);
  pruefe('keine Einheit ist dabei verlorengegangen', tabelle.einheiten.length, 26);

  // Zurueck, damit die folgenden Pruefungen vom Ausgangsplan ausgehen.
  await p.locator('.einheit-box', { hasText: zweite }).first()
    .locator('button[title="Eine Position später"]').click();
  await p.waitForTimeout(800);
  pruefe('Zurückschieben stellt den alten Plan wieder her',
    (await spurReihenfolge(p, 'rs')).slice(0, 2), vorher.slice(0, 2));
}

// ---------------------------------------------------------------------------
console.log('\n=== Ziehen ueber mehrere Wochen ===');
{
  // Der gemeldete Fehler: egal wie weit gezogen wurde, die Einheit rutschte
  // immer nur eine Position. Hier wird die erste Rechtschreib-Einheit quer
  // durchs halbe Jahr gezogen — sie muss dort landen, wo losgelassen wurde.
  const vorher = await spurReihenfolge(p, 'rs');
  const titel = vorher[0];

  // Bewusst OHNE vorheriges Scrollen: Woche 20 liegt auf einem gewoehnlichen
  // Bildschirm ausserhalb des Sichtbereichs. Am unteren Rand muss die Seite
  // von selbst mitrollen, sonst waere ein weiter Zug gar nicht moeglich.
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(150);
  const griff = p.locator('.einheit-box', { hasText: titel }).first().locator('.einheit-griff');
  const vonKasten = await griff.boundingBox();
  await p.mouse.move(vonKasten.x + vonKasten.width / 2, vonKasten.y + vonKasten.height / 2);
  await p.mouse.down();

  const standVorRollen = await p.evaluate(() => window.scrollY);
  const hoehe = p.viewportSize().height;
  await p.mouse.move(vonKasten.x + vonKasten.width / 2, hoehe - 20, { steps: 12 });

  // Warten, bis die Zielwoche durch das Mitrollen sichtbar geworden ist.
  await p.waitForFunction(() => {
    const z = document.querySelector('.jahreszelle[data-woche="20"][data-spur="RS"]');
    const r = z.getBoundingClientRect();
    return r.top > 100 && r.bottom < window.innerHeight - 100;
  }, null, { timeout: 8000 });
  pruefe('die Seite rollt beim Ziehen am Rand mit',
    (await p.evaluate(() => window.scrollY)) > standVorRollen, true);

  const zielKasten = await p.locator('.jahreszelle[data-woche="20"][data-spur="RS"]').boundingBox();
  await p.mouse.move(zielKasten.x + zielKasten.width / 2, zielKasten.y + zielKasten.height / 2,
                     { steps: 10 });
  await p.waitForTimeout(250);

  // Schon vor dem Loslassen muss der Umriss an der kuenftigen Stelle stehen.
  pruefe('waehrend des Ziehens ist ein Platzhalter zu sehen',
    await p.locator('.einheit-box.ist-platzhalter').count(), 1);
  pruefe('… und die Einheit haengt sichtbar am Zeiger',
    await p.locator('.einheit-flug').count(), 1);

  await p.mouse.up();
  await p.waitForTimeout(900);

  const nachher = await spurReihenfolge(p, 'rs');
  pruefe('die Einheit ist nicht mehr die erste', nachher[0] !== titel, true);
  pruefe('sie ist weit nach hinten gerutscht, nicht nur eine Position',
    nachher.indexOf(titel) > 3, true);
  const woche = Number(/Woche (\d+)/.exec(await wochenText(p, titel))[1]);
  pruefe('sie liegt jetzt ungefaehr in der Zielwoche', woche >= 16 && woche <= 23, true);
  const tabelle = await ausTabelle();
  pruefe('nichts wurde dabei geloescht', tabelle.einheiten.length, 26);
  pruefe('die Tabelle kennt dieselbe Reihenfolge',
    tabelle.einheiten.filter((e) => e.spur === 'RS').map((e) => e.titel), nachher);

  // Zurueck an den Anfang der Spur ziehen — genauso weit in die Gegenrichtung.
  const g2 = await p.locator('.einheit-box', { hasText: titel }).first()
    .locator('.einheit-griff').boundingBox();
  await p.mouse.move(g2.x + g2.width / 2, g2.y + g2.height / 2);
  await p.mouse.down();
  await p.mouse.move(g2.x + g2.width / 2, 20, { steps: 12 });
  await p.waitForFunction(() => {
    const z = document.querySelector('.jahreszelle[data-woche="5"][data-spur="RS"]');
    const r = z.getBoundingClientRect();
    return r.top > 100 && r.bottom < window.innerHeight - 100;
  }, null, { timeout: 15000 });
  const z2 = await p.locator('.jahreszelle[data-woche="5"][data-spur="RS"]').boundingBox();
  await p.mouse.move(z2.x + z2.width / 2, z2.y + 2, { steps: 10 });
  await p.waitForTimeout(250);
  await p.mouse.up();
  await p.waitForTimeout(900);
  pruefe('sie laesst sich genauso weit zurueckziehen',
    (await spurReihenfolge(p, 'rs'))[0], titel);
}

console.log('\n=== Ueber den Vorrat die Spur wechseln ===');
{
  // Direkt von Spur zu Spur geht nicht (siehe unten). Der Umweg ueber den
  // Vorrat ist der vorgesehene Weg: dort hat eine Einheit keine Spur mehr
  // und darf anschliessend in beide.
  const grVorher = await spurReihenfolge(p, 'gr');
  const titel = grVorher[0];

  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(150);
  const g = await p.locator('.jahresraster .einheit-box', { hasText: titel }).first().boundingBox();
  await p.mouse.move(g.x + g.width / 2, g.y + 20);
  await p.mouse.down();
  await p.mouse.move(g.x + g.width / 2, p.viewportSize().height - 15, { steps: 12 });
  await p.waitForFunction(() => {
    const r = document.querySelector('.jahresvorrat').getBoundingClientRect();
    return r.top > 100 && r.top < window.innerHeight - 120;
  }, null, { timeout: 15000 });

  const v = await p.locator('.jahresvorrat').boundingBox();
  await p.mouse.move(v.x + v.width / 2, v.y + Math.min(40, v.height / 2), { steps: 10 });
  await p.waitForTimeout(250);
  await p.mouse.up();
  await p.waitForTimeout(900);

  const imVorrat = await ausTabelle();
  pruefe('die in den Vorrat gezogene Einheit ist ausgeplant',
    imVorrat.einheiten.find((e) => e.titel === titel).spur, '');
  pruefe('… und ist nicht geloescht', imVorrat.einheiten.length, 26);
  pruefe('der Vorrat zeigt sie an',
    (await p.locator('.jahresvorrat .einheit-box').first().innerText()).includes(titel), true);
  pruefe('die Grammatikspur hat eine Einheit weniger',
    (await spurReihenfolge(p, 'gr')).length, grVorher.length - 1);

  // Aus dem Vorrat in die ANDERE Spur — das ist erlaubt. Der Vorrat liegt
  // unter dem ganzen Jahr, also wird von dort aus nach oben gerollt.
  const rsVorher = await spurReihenfolge(p, 'rs');
  await p.locator('.jahresvorrat').scrollIntoViewIfNeeded();
  await p.waitForTimeout(250);
  const vk = await p.locator('.jahresvorrat .einheit-box', { hasText: titel }).first().boundingBox();
  await p.mouse.move(vk.x + vk.width / 2, vk.y + 20);
  await p.mouse.down();
  await p.mouse.move(vk.x + vk.width / 2, 15, { steps: 12 });
  await p.waitForFunction(() => {
    const z = document.querySelector('.jahreszelle[data-woche="9"][data-spur="RS"]');
    const r = z.getBoundingClientRect();
    return r.top > 120 && r.bottom < window.innerHeight - 120;
  }, null, { timeout: 15000 });

  const rsZelle = await p.locator('.jahreszelle[data-woche="9"][data-spur="RS"]').boundingBox();
  await p.mouse.move(rsZelle.x + rsZelle.width / 2, rsZelle.y + rsZelle.height / 2, { steps: 10 });
  await p.waitForTimeout(250);
  await p.mouse.up();
  await p.waitForTimeout(900);

  pruefe('aus dem Vorrat heraus ist die Spur frei waehlbar',
    (await ausTabelle()).einheiten.find((e) => e.titel === titel).spur, 'RS');
  pruefe('die Rechtschreibspur ist eine Einheit laenger',
    (await spurReihenfolge(p, 'rs')).length, rsVorher.length + 1);
}

console.log('\n=== Ziehen an der ganzen Box, Klick bleibt Klick ===');
{
  // Gemeldet: das Greifen misslang, weil nur ein schmaler Streifen zog.
  // Jetzt zieht die ganze Box — ein kurzer Klick darf aber weiterhin nur
  // die Teilthemen aufklappen.
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(150);

  const box = p.locator('.jahresraster .einheit-box.spur-rs').first();
  const titelText = (await box.locator('.einheit-titel').innerText()).trim();
  const k = await box.boundingBox();

  // 1. Klick mitten auf die Box (nicht auf den Streifen): klappt nur auf.
  await p.mouse.click(k.x + k.width / 2, k.y + 20);
  await p.waitForTimeout(400);
  // Es ist immer nur eine Einheit zugleich aufgeklappt — geprueft wird
  // deshalb, dass genau DIESE offen ist.
  pruefe('Klick auf die Fläche klappt die Teilthemen auf',
    await p.locator('.einheit-box.offen .einheit-titel').innerText(), titelText);
  const ordnungNachKlick = await spurReihenfolge(p, 'rs');
  pruefe('… und verschiebt nichts', ordnungNachKlick[0], titelText);

  // Wieder zuklappen.
  await p.mouse.click(k.x + k.width / 2, k.y + 20);
  await p.waitForTimeout(400);

  // 2. Winzige Bewegung unter der Schwelle zaehlt weiterhin als Klick.
  await p.mouse.move(k.x + k.width / 2, k.y + 20);
  await p.mouse.down();
  await p.mouse.move(k.x + k.width / 2 + 3, k.y + 22, { steps: 3 });
  pruefe('unter der Schwelle beginnt kein Zug',
    await p.locator('.einheit-flug').count(), 0);
  await p.mouse.up();
  await p.waitForTimeout(400);
  await p.locator('.einheit-box.offen .einheit-kopf').first().click().catch(() => {});
  await p.waitForTimeout(300);

  // 3. Ziehen von der Mitte der Box aus — ohne den Streifen zu treffen.
  const kNeu = await p.locator('.einheit-box', { hasText: titelText }).first().boundingBox();
  await p.mouse.move(kNeu.x + kNeu.width / 2, kNeu.y + 20);
  await p.mouse.down();
  await p.mouse.move(kNeu.x + kNeu.width / 2, kNeu.y + 160, { steps: 14 });
  await p.waitForTimeout(250);
  pruefe('Ziehen aus der Fläche heraus funktioniert',
    await p.locator('.einheit-flug').count(), 1);
  await p.mouse.up();
  await p.waitForTimeout(900);
  pruefe('die Einheit ist verschoben',
    (await spurReihenfolge(p, 'rs'))[0] !== titelText, true);
  pruefe('nach dem Zug klappt sich nichts auf',
    await p.locator('.einheit-box.offen').count(), 0);
}

console.log('\n=== Spurtreue: Rechtschreibung bleibt Rechtschreibung ===');
{
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(150);

  const rsVorher = await spurReihenfolge(p, 'rs');
  const grVorher = await spurReihenfolge(p, 'gr');
  const titelRS = rsVorher[1];

  // Eine Rechtschreib-Einheit mitten auf die Grammatikspalte ziehen.
  const kasten = await p.locator('.einheit-box', { hasText: titelRS }).first().boundingBox();
  const grZelle = await p.locator('.jahreszelle[data-woche="9"][data-spur="GR"]').boundingBox();
  await p.mouse.move(kasten.x + kasten.width / 2, kasten.y + 20);
  await p.mouse.down();
  await p.mouse.move(grZelle.x + grZelle.width / 2, grZelle.y + grZelle.height / 2, { steps: 16 });
  await p.waitForTimeout(250);
  await p.mouse.up();
  await p.waitForTimeout(900);

  const tabelle = await ausTabelle();
  pruefe('sie bleibt auf der Rechtschreibspur',
    tabelle.einheiten.find((e) => e.titel === titelRS).spur, 'RS');
  pruefe('die Grammatikspur hat keine Einheit dazubekommen',
    (await spurReihenfolge(p, 'gr')).length, grVorher.length);
  pruefe('die Rechtschreibspur ist vollzählig geblieben',
    (await spurReihenfolge(p, 'rs')).length, rsVorher.length);

  // Und die Gegenrichtung.
  const titelGR = grVorher[1];
  const kastenGR = await p.locator('.einheit-box', { hasText: titelGR }).first().boundingBox();
  const rsZelle = await p.locator('.jahreszelle[data-woche="9"][data-spur="RS"]').boundingBox();
  await p.mouse.move(kastenGR.x + kastenGR.width / 2, kastenGR.y + 20);
  await p.mouse.down();
  await p.mouse.move(rsZelle.x + rsZelle.width / 2, rsZelle.y + rsZelle.height / 2, { steps: 16 });
  await p.waitForTimeout(250);
  await p.mouse.up();
  await p.waitForTimeout(900);

  pruefe('umgekehrt bleibt Grammatik ebenfalls Grammatik',
    (await ausTabelle()).einheiten.find((e) => e.titel === titelGR).spur, 'GR');
  pruefe('beide Spuren unverändert lang',
    [(await spurReihenfolge(p, 'rs')).length, (await spurReihenfolge(p, 'gr')).length],
    [rsVorher.length, grVorher.length]);
}

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
