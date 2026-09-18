/**
 * Prueft das Verhalten bei einem Aussetzer der Tabelle.
 *
 * Vorgeschichte: Google nimmt gelegentlich eine Weile keine Schreibzugriffe
 * an, waehrend das Lesen weiterlaeuft — oder umgekehrt. Genau in so einem
 * Fenster liessen sich weder die Anordnung der Widgets noch die
 * Wochenaufgaben speichern; eine Stunde spaeter ging alles wieder.
 *
 * Zwei Dinge muessen dabei halten:
 *
 *   1. Ein einzelner Aussetzer darf eine Eingabe nicht verschlucken.
 *      Geschrieben wird mit einem zweiten Anlauf.
 *   2. Scheitert das Nachladen NACH einem erfolgreichen Schreibvorgang,
 *      darf die App nicht ohne Daten zurueckbleiben. Frueher stand dort
 *      leereDaten() vor dem Laden — schlug das Laden fehl, war der
 *      Zwischenspeicher leer und die naechste Neuzeichnung ergab eine
 *      leere Startseite.
 *
 *   node mock.js &
 *   node aussetzer.mjs
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

/**
 * `steuerung.schreibenScheitert` laesst POST-Aufrufe fehlschlagen,
 * `steuerung.ladenScheitert` die Leserunden — beide zur Laufzeit
 * umstellbar, damit sich ein Aussetzer und seine Erholung nachstellen
 * lassen. Gezaehlt wird mit, wie oft geschrieben wurde.
 */
async function oeffne() {
  const ctx = await browser.newContext({
    viewport: { width: 1200, height: 1100 }, locale: 'de-DE', timezoneId: 'Europe/Berlin'
  });
  const p = await ctx.newPage();
  p.on('pageerror', (ev) => fehler.push('PAGEERROR: ' + ev.message));
  p.on('console', (m) => { if (m.type() === 'error') fehler.push('CONSOLE: ' + m.text()); });

  // Wie viele der naechsten Schreibversuche scheitern sollen. Eine Zahl
  // statt eines Zeitfensters: sonst haengt das Ergebnis daran, wie schnell
  // der Rechner den Klick verarbeitet.
  const steuerung = { schreibenScheitertNochMal: 0, ladenScheitert: false };
  const schreibVersuche = [];

  await p.route('**/exec*', async (route) => {
    const anfrage = route.request();
    const istSchreiben = anfrage.method() === 'POST';

    if (istSchreiben) {
      let aktion = '?';
      try { aktion = JSON.parse(anfrage.postData() || '{}').aktion || '?'; } catch (e) { /* egal */ }
      schreibVersuche.push(aktion);
      if (steuerung.schreibenScheitertNochMal > 0) {
        steuerung.schreibenScheitertNochMal--;
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ ok: false, fehler: 'Der Dokumentspeicher ist vorübergehend nicht verfügbar.' })
        });
        return;
      }
    } else if (steuerung.ladenScheitert && /aktion=laden/.test(anfrage.url())) {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: false, fehler: 'Der Dokumentspeicher ist vorübergehend nicht verfügbar.' })
      });
      return;
    }
    await route.continue();
  });

  // Meldungen werden als Systemdialog gezeigt; ohne Behandlung blockieren sie.
  const dialoge = [];
  p.on('dialog', async (d) => { dialoge.push(d.message()); await d.dismiss(); });

  await p.goto(ADRESSE + '/');
  await p.evaluate((t) => localStorage.setItem('kz.verbindung',
    JSON.stringify({ url: 'http://localhost:8901/exec', token: t })), TOKEN);
  await p.reload();
  await p.waitForSelector('.klassenraster', { timeout: 10000 });
  return { p, ctx, steuerung, schreibVersuche, dialoge };
}

/**
 * Klappt die PEAK-Kachel auf und schaltet sie um. Welcher Weg — abhaken
 * oder zuruecknehmen — haengt am Stand, den die Tabelle gerade hat; die
 * Suiten teilen sich einen Mock-Server. Zurueckgegeben wird der Stand
 * davor, damit der Test dagegen pruefen kann.
 */
async function toggelPeak(p) {
  const kachel = p.locator('.kachel[data-aufgabe="PEAK"]');
  const vorher = (await kachel.innerText()).includes('erledigt');
  await kachel.locator('.kachel-kopf').click();
  const knopf = kachel.locator('.kachel-bereich button').first();
  await knopf.waitFor({ state: 'visible', timeout: 4000 });
  await knopf.click();
  return vorher;
}

// --- Ein einzelner Aussetzer wird ueberbrueckt ------------------------------

console.log('\n=== Ein misslungener Versuch wird wiederholt ===');
{
  const { p, ctx, steuerung, schreibVersuche } = await oeffne();

  // Genau der erste Schreibversuch scheitert, der zweite geht durch.
  steuerung.schreibenScheitertNochMal = 1;

  const warErledigt = await toggelPeak(p);
  await p.waitForTimeout(3500);

  pruefe('es wurde ein zweites Mal geschrieben',
    schreibVersuche.filter((a) => a === 'wochenstatus').length, 2);

  const inTabelle = await (await fetch(`${ADRESSE}/exec?aktion=laden&token=${TOKEN}`)).json();
  pruefe('die Umschaltung steht trotz des Aussetzers in der Tabelle',
    inTabelle.daten.wochenstatus.some((w) => w.aufgabe === 'PEAK'), !warErledigt);

  await ctx.close();
}

// --- Scheitert das Nachladen, bleibt die App bedienbar ----------------------

console.log('\n=== Schreiben klappt, Nachladen scheitert ===');
{
  const { p, ctx, steuerung, dialoge } = await oeffne();

  // Schreiben geht durch, nur die anschliessende Leserunde faellt aus.
  steuerung.ladenScheitert = true;
  const warErledigt = await toggelPeak(p);
  await p.waitForTimeout(2500);

  // Der entscheidende Punkt: der Zwischenspeicher darf nicht leer sein.
  pruefe('die Daten sind noch da', await p.evaluate(async () => {
    const s = await import('/js/server.js');
    return s.holeDaten() !== null;
  }), true);

  // Und eine Neuzeichnung — hier ueber den Schalter in der Kopfleiste —
  // ergibt weiterhin eine vollstaendige Startseite, keine leere Seite.
  await p.locator('.schalter input').check();
  await p.waitForTimeout(600);
  pruefe('die Startseite steht nach dem Neuzeichnen noch',
    await p.locator('.klassenraster').count(), 1);
  pruefe('mit ihren Klassenknoepfen',
    await p.locator('.klassenraster a').count() > 0, true);

  // Geschrieben wurde es ja — das muss in der Tabelle stehen.
  const inTabelle = await (await fetch(`${ADRESSE}/exec?aktion=laden&token=${TOKEN}`)).json();
  pruefe('die Umschaltung ist trotzdem gespeichert',
    inTabelle.daten.wochenstatus.some((w) => w.aufgabe === 'PEAK'), !warErledigt);

  pruefe('keine Skriptfehler dabei', fehler, []);
  await ctx.close();
}

// --- Haelt der Aussetzer an, wird sauber zurueckgenommen --------------------

console.log('\n=== Anhaltender Aussetzer: Meldung und Rueckname ===');
{
  const { p, ctx, steuerung, schreibVersuche, dialoge } = await oeffne();
  // Beide Versuche scheitern.
  steuerung.schreibenScheitertNochMal = 2;

  // Seesaw hakt oertlich sofort ab und nimmt es bei Misserfolg zurueck.
  // Ein noch offenes Kaestchen nehmen — die Suiten teilen sich den Server.
  const kaesten = p.locator('.kachel.seesaw .seesaw-klassen input[type="checkbox"]');
  let erste = null;
  for (let i = 0; i < await kaesten.count(); i++) {
    if (!(await kaesten.nth(i).isChecked())) { erste = kaesten.nth(i); break; }
  }
  pruefe('ein offenes Seesaw-Kaestchen gefunden', erste !== null, true);
  await erste.check();
  await p.waitForTimeout(3500);

  pruefe('zwei Versuche unternommen',
    schreibVersuche.filter((a) => a === 'wochenstatus').length, 2);
  pruefe('der Haken ist wieder weg', await erste.isChecked(), false);
  pruefe('es wurde gemeldet', dialoge.length > 0, true);
  pruefe('die Meldung nennt den Grund',
    dialoge[0].includes('Dokumentspeicher'), true);
  pruefe('… und sagt, dass schon zweimal versucht wurde',
    dialoge[0].includes('zweites Mal'), true);

  pruefe('das Kaestchen ist wieder offen', await erste.isChecked(), false);

  await ctx.close();
}

console.log('\nJS-Fehler:', fehler.length ? fehler : 'keine');
console.log(schlecht === 0 && !fehler.length
  ? `\nALLE ${n} TESTS BESTANDEN`
  : `\n${schlecht} von ${n} FEHLGESCHLAGEN`);

await browser.close();
process.exit(schlecht === 0 && !fehler.length ? 0 : 1);
