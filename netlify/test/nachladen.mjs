/**
 * Prueft das zweistufige Laden.
 *
 * Die Startseite braucht nur einen Teil der Blaetter. Sie wird deshalb aus
 * der ersten Runde ('kern') gezeichnet, waehrend die grossen Tabellen
 * ('rest') im Hintergrund nachlaufen — Erhebungen, Beteiligungspunkte und
 * die Checklistenwerte wachsen mit dem Schuljahr und kosten am meisten.
 *
 * Geprueft wird deshalb nicht, wie schnell etwas ist — das haengt an der
 * Maschine —, sondern die Reihenfolge: dass die Startseite steht, bevor die
 * zweite Runde beantwortet ist. Die zweite Runde wird dafuer kuenstlich
 * aufgehalten. Damit schlaegt der Test an, sobald die Startseite wieder auf
 * die grossen Tabellen wartet.
 *
 *   node mock.js &
 *   node nachladen.mjs
 */

import { chromium } from 'playwright';

const ADRESSE = 'http://localhost:8901';
const TOKEN = 'testtoken123';

/** So lange wird die zweite Runde aufgehalten. */
const BREMSE_MS = 3000;

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
 * Oeffnet die Startseite. `bremse` haelt die zweite Runde auf, `scheitern`
 * laesst sie fehlschlagen — beides laesst sich waehrend des Laufs umstellen,
 * damit sich auch die Erholung nach einem Fehler pruefen laesst.
 */
async function oeffne() {
  const ctx = await browser.newContext({
    viewport: { width: 1200, height: 1000 }, locale: 'de-DE', timezoneId: 'Europe/Berlin'
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => fehler.push('PAGEERROR: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') fehler.push('CONSOLE: ' + m.text()); });

  const steuerung = { bremse: 0, scheitern: false };
  const runden = [];

  await p.route('**/exec*', async (route) => {
    const adresse = new URL(route.request().url());
    const aktion = adresse.searchParams.get('aktion');
    if (aktion !== 'laden') { await route.continue(); return; }

    const teil = adresse.searchParams.get('teil') || '—';
    runden.push(teil);

    if (teil === 'rest') {
      if (steuerung.bremse) await new Promise((r) => setTimeout(r, steuerung.bremse));
      if (steuerung.scheitern) {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ ok: false, fehler: 'Absichtlich gescheiterte zweite Runde.' })
        });
        return;
      }
    }
    await route.continue();
  });

  await p.goto(ADRESSE + '/');
  await p.evaluate((t) => localStorage.setItem('kz.verbindung',
    JSON.stringify({ url: 'http://localhost:8901/exec', token: t })), TOKEN);
  return { p, ctx, steuerung, runden };
}

// --- Die Startseite wartet nicht auf die grossen Tabellen -------------------

console.log('\n=== Die Startseite steht vor der zweiten Runde ===');
{
  const { p, ctx, steuerung, runden } = await oeffne();
  steuerung.bremse = BREMSE_MS;

  const los = Date.now();
  await p.reload();
  await p.waitForSelector('.klassenraster', { timeout: 15000 });
  const bisStartseite = Date.now() - los;

  pruefe('erste Runde fragt nur den Kern', runden[0], 'kern');
  pruefe('genau zwei Runden angestossen', runden.slice(0, 2), ['kern', 'rest']);

  // Der eigentliche Punkt: die Startseite ist da, obwohl die zweite Runde
  // noch haengt. Ohne die Aufteilung koennte das nicht sein.
  pruefe('Startseite steht, bevor die zweite Runde antwortet', bisStartseite < BREMSE_MS, true);

  // Und sie ist wirklich gezeichnet, nicht bloss ein leeres Geruest.
  pruefe('Klassenknoepfe sind da', await p.locator('.klassenraster a').count() > 0, true);
  pruefe('Tagesplan oder Ferienhinweis ist da',
    await p.locator('.widget[data-id="tagesplan"]').count(), 1);
  pruefe('kein Fehlerbanner', await p.locator('.hinweis.schlecht').count(), 0);

  await ctx.close();
}

// --- Was die zweite Runde braucht, wartet auf sie ---------------------------

console.log('\n=== Noten warten auf die zweite Runde und zeigen das an ===');
{
  const { p, ctx, steuerung, runden } = await oeffne();
  steuerung.bremse = BREMSE_MS;

  await p.reload();
  await p.waitForSelector('.klassenraster', { timeout: 15000 });

  // Sofort weiter, waehrend die zweite Runde noch laeuft.
  await p.locator('.kopfleiste-inhalt a[href="#/noten"]').click();
  await p.waitForSelector('.laedt', { timeout: 2000 });
  pruefe('es wird gewartet, nicht abgestuerzt', await p.locator('.laedt').count() > 0, true);

  // Und danach steht die Ansicht vollstaendig.
  await p.waitForSelector('.werkzeug', { timeout: 15000 });
  pruefe('Notenansicht baut sich auf', await p.locator('.werkzeug').count() > 0, true);
  pruefe('Pfad zeigt Notentracker',
    (await p.locator('.pfad').innerText()).includes('Notentracker'), true);
  pruefe('die zweite Runde lief nur einmal', runden.filter((r) => r === 'rest').length, 1);

  // Zurueck und wieder hin: jetzt liegen die Daten vor, kein neuer Aufruf.
  await p.goto(ADRESSE + '/#/');
  await p.waitForSelector('.klassenraster', { timeout: 8000 });
  await p.locator('.kopfleiste-inhalt a[href="#/noten"]').click();
  await p.waitForSelector('.werkzeug', { timeout: 8000 });
  pruefe('kein zweiter Nachladeaufruf', runden.filter((r) => r === 'rest').length, 1);

  await ctx.close();
}

// --- Checklisten ebenso -----------------------------------------------------

console.log('\n=== Checklisten warten ebenfalls ===');
{
  const { p, ctx, steuerung } = await oeffne();
  steuerung.bremse = BREMSE_MS;

  await p.reload();
  await p.waitForSelector('.klassenraster', { timeout: 15000 });
  await p.locator('.kopfleiste-inhalt a[href="#/checklisten"]').click();
  await p.waitForSelector('.laedt', { timeout: 2000 });
  pruefe('es wird gewartet', await p.locator('.laedt').count() > 0, true);

  await p.waitForSelector('.pfad', { timeout: 15000 });
  await p.waitForFunction(() => !document.querySelector('.laedt'), null, { timeout: 15000 });
  pruefe('Pfad zeigt Checklisten',
    (await p.locator('.pfad').innerText()).includes('Checklisten'), true);
  pruefe('kein Fehlerbanner', await p.locator('.hinweis.schlecht').count(), 0);

  await ctx.close();
}

// --- Scheitert die zweite Runde, sagt es das — und laesst sich wiederholen ---

console.log('\n=== Gescheiterte zweite Runde: Meldung statt kaputter Seite ===');
{
  const { p, ctx, steuerung } = await oeffne();
  steuerung.scheitern = true;

  await p.reload();
  // Die Startseite kommt trotzdem: sie braucht die zweite Runde nicht.
  await p.waitForSelector('.klassenraster', { timeout: 15000 });
  pruefe('Startseite bleibt benutzbar', await p.locator('.klassenraster a').count() > 0, true);

  await p.locator('.kopfleiste-inhalt a[href="#/noten"]').click();
  await p.waitForSelector('.hinweis.schlecht', { timeout: 15000 });
  pruefe('Fehler wird gemeldet',
    (await p.locator('.hinweis.schlecht').innerText()).includes('Absichtlich gescheiterte'), true);
  // Keine halbgezeichnete Ansicht daneben — die Daten fehlen ja wirklich.
  pruefe('keine halbe Notenansicht', await p.locator('.werkzeug').count(), 0);
  pruefe('keine haengende Ladeanzeige', await p.locator('.laedt').count(), 0);

  // Jetzt geht es wieder: „Erneut versuchen" muss die Ansicht aufbauen.
  steuerung.scheitern = false;
  await p.locator('button', { hasText: 'Erneut versuchen' }).first().click();
  await p.waitForSelector('.werkzeug', { timeout: 15000 });
  pruefe('nach dem zweiten Anlauf steht die Ansicht',
    await p.locator('.werkzeug').count() > 0, true);
  pruefe('Fehlerbanner ist weg', await p.locator('.hinweis.schlecht').count(), 0);

  await ctx.close();
}

// --- Gegenprobe an der Schnittstelle selbst ---------------------------------

console.log('\n=== Was die beiden Runden liefern ===');
{
  const hole = async (teil) => (await (await fetch(
    `${ADRESSE}/exec?aktion=laden&token=${TOKEN}` + (teil ? `&teil=${teil}` : ''))).json()).daten;

  const kern = await hole('kern');
  const rest = await hole('rest');
  const alles = await hole(null);

  pruefe('Kern bringt den Stundenplan mit', Array.isArray(kern.stundenplan), true);
  pruefe('Kern bringt die Merkliste mit', Array.isArray(kern.merkliste), true);
  pruefe('Kern laesst die Erhebungen weg', kern.erhebungen, undefined);
  pruefe('Kern laesst die Beteiligungspunkte weg', kern.beteiligungspunkte, undefined);
  pruefe('Kern laesst die Checklistenwerte weg', kern.boardWerte, undefined);
  pruefe('Rest bringt die Erhebungen mit', Array.isArray(rest.erhebungen), true);
  pruefe('Rest laesst den Stundenplan weg', rest.stundenplan, undefined);

  // Nichts geht verloren: beide Runden zusammen ergeben den alten Umfang.
  const ohneHuelle = (o) => Object.keys(o)
    .filter((s) => !['stand', 'fach', 'teil', 'vollstaendig'].includes(s)).sort();
  pruefe('zusammen so vollstaendig wie zuvor',
    [...ohneHuelle(kern), ...ohneHuelle(rest)].sort(), ohneHuelle(alles));
}

console.log('\nJS-Fehler:', fehler.length ? fehler : 'keine');
console.log(schlecht === 0 && !fehler.length
  ? `\nALLE ${n} TESTS BESTANDEN`
  : `\n${schlecht} von ${n} FEHLGESCHLAGEN`);

await browser.close();
process.exit(schlecht === 0 && !fehler.length ? 0 : 1);
