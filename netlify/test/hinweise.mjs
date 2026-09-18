/**
 * Prueft, dass sich Hinweisfelder wirklich schliessen lassen.
 *
 * Vorgeschichte: das Zeichen links im Feld war reine Verzierung — bei
 * Fehlern stand dort ein „×", das wie ein Schliessen-Kreuz aussah, aber
 * auf keinen Tipp reagierte. Es gab ueberhaupt keinen Weg, eine
 * Fehlermeldung wegzubekommen.
 *
 * Darum pruefen die Tests hier zweierlei: dass der Schliessen-Knopf da ist
 * und wirkt — und dass kein „×" mehr auf dem Bildschirm steht, das nur so
 * tut. Der zweite Teil ist der wichtigere: er faengt den Rueckfall ab.
 *
 *   node mock.js &
 *   node hinweise.mjs
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

async function oeffne({ ladenScheitert = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1200, height: 1000 }, locale: 'de-DE', timezoneId: 'Europe/Berlin'
  });
  const p = await ctx.newPage();
  p.on('pageerror', (ev) => fehler.push('PAGEERROR: ' + ev.message));
  p.on('console', (m) => { if (m.type() === 'error') fehler.push('CONSOLE: ' + m.text()); });

  if (ladenScheitert) {
    await p.route('**/exec*', async (route) => {
      if (/aktion=laden/.test(route.request().url())) {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ ok: false, fehler: 'Absichtlich gescheitertes Laden.' })
        });
        return;
      }
      await route.continue();
    });
  }

  await p.goto(ADRESSE + '/');
  await p.evaluate((t) => localStorage.setItem('kz.verbindung',
    JSON.stringify({ url: 'http://localhost:8901/exec', token: t })), TOKEN);
  await p.reload();
  return { p, ctx };
}

/**
 * Jedes „×" auf dem Bildschirm muss ein Knopf sein oder in einem stecken.
 * Genau das war der Fehler: ein „×" im reinen Text, das nach Bedienelement
 * aussah.
 */
async function falscheKreuze(p) {
  return p.evaluate(() => {
    const treffer = [];
    document.querySelectorAll('body *').forEach((el) => {
      // Nur Elemente ohne eigene Kinder ansehen, sonst zaehlt jeder
      // Vorfahr denselben Text mit.
      if (el.children.length) return;
      if (!/[×✕✖]/.test(el.textContent || '')) return;
      if (el.closest('button') || el.closest('a')) return;
      treffer.push((el.className || el.tagName) + ': ' + el.textContent.trim());
    });
    return treffer;
  });
}

// --- Fehlermeldung ----------------------------------------------------------

console.log('\n=== Fehlermeldung laesst sich schliessen ===');
{
  const { p, ctx } = await oeffne({ ladenScheitert: true });
  await p.waitForSelector('.hinweis.schlecht', { timeout: 10000 });

  pruefe('Fehler wird gezeigt',
    (await p.locator('.hinweis.schlecht').innerText()).includes('Absichtlich gescheitertes Laden'), true);
  pruefe('ein echter Schliessen-Knopf ist da',
    await p.locator('.hinweis.schlecht .hinweis-zu').count(), 1);
  pruefe('er traegt eine Beschriftung fuer Vorleseprogramme',
    await p.locator('.hinweis.schlecht .hinweis-zu').getAttribute('aria-label'), 'Hinweis schließen');

  // Fingergerecht: auf dem iPad ist alles unter 44 px Gluecksache.
  const flaeche = await p.locator('.hinweis.schlecht .hinweis-zu').boundingBox();
  pruefe('Trefferflaeche mindestens 44 × 44',
    [flaeche.width >= 44, flaeche.height >= 44], [true, true]);

  pruefe('kein „×" ausserhalb eines Knopfes', await falscheKreuze(p), []);

  await p.locator('.hinweis.schlecht .hinweis-zu').click();
  pruefe('nach dem Klick ist die Meldung weg',
    await p.locator('.hinweis.schlecht').count(), 0);

  await ctx.close();
}

// --- Banner bleiben geschlossen ---------------------------------------------

console.log('\n=== Geschlossene Banner kommen nicht zurueck ===');
{
  const { p, ctx } = await oeffne();
  // Ohne Zuordnungsdatei auf dem Geraet erscheint der Erstlauf-Hinweis.
  await p.waitForSelector('.hinweis.warn', { timeout: 10000 });
  const banner = p.locator('.hinweis.warn', { hasText: 'Zuordnungsdatei laden' });
  pruefe('Erstlauf-Hinweis ist da', await banner.count(), 1);
  pruefe('mit Schliessen-Knopf', await banner.locator('.hinweis-zu').count(), 1);

  await banner.locator('.hinweis-zu').click();
  pruefe('sofort verschwunden', await banner.count(), 0);

  // Das Schliessen darf die Seite nicht neu aufbauen — sonst saehe man
  // mitten im Arbeiten wieder die frische Startseite.
  pruefe('die Startseite steht weiterhin', await p.locator('.klassenraster').count(), 1);

  await p.reload();
  await p.waitForSelector('.klassenraster', { timeout: 10000 });
  pruefe('nach dem Neuladen bleibt er weg',
    await p.locator('.hinweis', { hasText: 'Zuordnungsdatei laden' }).count(), 0);
  pruefe('kein „×" ausserhalb eines Knopfes', await falscheKreuze(p), []);

  await ctx.close();
}

console.log('\nJS-Fehler:', fehler.length ? fehler : 'keine');
console.log(schlecht === 0 && !fehler.length
  ? `\nALLE ${n} TESTS BESTANDEN`
  : `\n${schlecht} von ${n} FEHLGESCHLAGEN`);

await browser.close();
process.exit(schlecht === 0 && !fehler.length ? 0 : 1);
