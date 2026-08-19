/**
 * Prueft die Anordnungslogik der Widgets.
 *
 * Der heikle Teil ist die Vertraeglichkeit mit alten gespeicherten Zeilen:
 * ein Widget, das dort fehlt, darf nicht verschwinden, sondern muss hinten
 * auftauchen. Sonst wuerde eine neue Fassung der App bei jemandem, der schon
 * einmal etwas verschoben hat, stillschweigend Bausteine unterschlagen.
 *
 *   node layout.mjs
 */

import {
  MAX_BREITE, metaSchluessel, leseLayout, schreibeLayout, sichtbare, ausgeblendete,
  verschiebe, blendeAus, blendeEin, wechsleBreite
} from '../js/layout.js';

let n = 0, schlecht = 0;
function pruefe(name, ist, soll) {
  n++;
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) schlecht++;
  console.log(`${ok ? 'OK  ' : 'FEHL'}  ${name}` +
    (ok ? '' : `\n        ist:  ${JSON.stringify(ist)}\n        soll: ${JSON.stringify(soll)}`));
}

const BAUSTEINE = [
  { id: 'uhr',        titel: 'Uhr',        breite: 1 },
  { id: 'tagesplan',  titel: 'Tagesplan',  breite: 2 },
  { id: 'aufgaben',   titel: 'Aufgaben',   breite: 2 },
  { id: 'klassen',    titel: 'Klassen',    breite: 2 }
];
const ids = (layout) => layout.map((w) => w.id);

// ---------------------------------------------------------------------------
console.log('=== Schluessel ===');
pruefe('Startseite', metaSchluessel('start'), 'layout_start');

console.log('\n=== Ohne gespeicherte Anordnung ===');
{
  const l = leseLayout('', BAUSTEINE);
  pruefe('alle Bausteine in Code-Reihenfolge', ids(l), ['uhr', 'tagesplan', 'aufgaben', 'klassen']);
  pruefe('alle sichtbar', l.every((w) => w.sichtbar), true);
  pruefe('Vorgabebreite uebernommen', l.map((w) => w.breite), [1, 2, 2, 2]);
  pruefe('Titel aus dem Code', l[1].titel, 'Tagesplan');
}
{
  const l = leseLayout(null, BAUSTEINE);
  pruefe('null wie leer behandelt', ids(l), ['uhr', 'tagesplan', 'aufgaben', 'klassen']);
}

console.log('\n=== Gespeicherte Anordnung ===');
{
  const l = leseLayout('klassen:2:1,uhr:2:1,tagesplan:1:0,aufgaben:1:1', BAUSTEINE);
  pruefe('Reihenfolge aus der Zeile', ids(l), ['klassen', 'uhr', 'tagesplan', 'aufgaben']);
  pruefe('Breite aus der Zeile', l.map((w) => w.breite), [2, 2, 1, 1]);
  pruefe('Sichtbarkeit aus der Zeile', l.map((w) => w.sichtbar), [true, true, false, true]);
  pruefe('sichtbare gefiltert', ids(sichtbare(l)), ['klassen', 'uhr', 'aufgaben']);
  pruefe('ausgeblendete gefiltert', ids(ausgeblendete(l)), ['tagesplan']);
}

console.log('\n=== Vertraeglichkeit mit alten Zeilen ===');
{
  // Eine Zeile aus einer Fassung, die "klassen" noch nicht kannte.
  const l = leseLayout('tagesplan:2:1,uhr:1:1', BAUSTEINE);
  pruefe('unbekannte Bausteine werden angehaengt', ids(l),
    ['tagesplan', 'uhr', 'aufgaben', 'klassen']);
  pruefe('… und sind sichtbar', l.find((w) => w.id === 'klassen').sichtbar, true);
}
{
  // Eine Zeile, die ein Widget nennt, das es nicht mehr gibt.
  const l = leseLayout('gibtsnicht:2:1,uhr:1:1', BAUSTEINE);
  pruefe('unbekannte Namen fallen weg', ids(l).includes('gibtsnicht'), false);
  pruefe('der Rest bleibt vollstaendig', ids(l).length, 4);
}
{
  // Alte Kurzform ohne Sichtbarkeit.
  const l = leseLayout('uhr:1,tagesplan:2', BAUSTEINE);
  pruefe('fehlende Sichtbarkeit gilt als sichtbar', l.every((w) => w.sichtbar), true);
}
{
  const l = leseLayout('uhr,tagesplan', BAUSTEINE);
  pruefe('ganz ohne Zusatzangaben', l.map((w) => w.breite), [1, 2, 2, 2]);
}

console.log('\n=== Unsinnige Breiten ===');
{
  const l = leseLayout('uhr:0:1,tagesplan:9:1,aufgaben:x:1,klassen:-3:1', BAUSTEINE);
  pruefe('0 wird 1', l[0].breite, 1);
  pruefe('zu gross wird begrenzt', l[1].breite, MAX_BREITE);
  pruefe('Buchstabe wird 1', l[2].breite, 1);
  pruefe('negativ wird 1', l[3].breite, 1);
}

console.log('\n=== Zurueckschreiben ===');
{
  const l = leseLayout('klassen:2:1,uhr:1:0,tagesplan:2:1,aufgaben:1:1', BAUSTEINE);
  pruefe('Zeile wieder erzeugt', schreibeLayout(l), 'klassen:2:1,uhr:1:0,tagesplan:2:1,aufgaben:1:1');
  pruefe('Lesen und Schreiben sind umkehrbar',
    schreibeLayout(leseLayout(schreibeLayout(l), BAUSTEINE)), schreibeLayout(l));
}

console.log('\n=== Verschieben ===');
{
  const l = leseLayout('', BAUSTEINE);
  pruefe('klassen vor uhr', ids(verschiebe(l, 'klassen', 'uhr')),
    ['klassen', 'uhr', 'tagesplan', 'aufgaben']);
  pruefe('uhr ans Ende', ids(verschiebe(l, 'uhr', null)),
    ['tagesplan', 'aufgaben', 'klassen', 'uhr']);
  pruefe('auf sich selbst tut nichts', verschiebe(l, 'uhr', 'uhr'), null);
  pruefe('unbekanntes Widget tut nichts', verschiebe(l, 'gibtsnicht', 'uhr'), null);
  pruefe('die Rohdaten bleiben unberuehrt', ids(l), ['uhr', 'tagesplan', 'aufgaben', 'klassen']);
}
{
  // Ans Ende heisst: vor die ausgeblendeten, nicht dahinter.
  const l = leseLayout('uhr:1:1,tagesplan:2:1,aufgaben:2:0,klassen:2:0', BAUSTEINE);
  const neu = verschiebe(l, 'uhr', null);
  pruefe('ans Ende der sichtbaren Reihe', ids(neu), ['tagesplan', 'uhr', 'aufgaben', 'klassen']);
  pruefe('die ausgeblendeten bleiben ausgeblendet',
    neu.filter((w) => !w.sichtbar).map((w) => w.id), ['aufgaben', 'klassen']);
}
{
  // Ein ausgeblendetes Widget ins Raster ziehen macht es sichtbar.
  const l = leseLayout('uhr:1:1,tagesplan:2:0,aufgaben:2:1,klassen:2:1', BAUSTEINE);
  const neu = verschiebe(l, 'tagesplan', 'uhr');
  pruefe('beim Einsortieren wird es sichtbar',
    neu.find((w) => w.id === 'tagesplan').sichtbar, true);
  pruefe('… an der Zielstelle', ids(neu), ['tagesplan', 'uhr', 'aufgaben', 'klassen']);
}

console.log('\n=== Aus- und Einblenden ===');
{
  const l = leseLayout('', BAUSTEINE);
  const ohne = blendeAus(l, 'tagesplan');
  pruefe('wandert nach hinten', ids(ohne), ['uhr', 'aufgaben', 'klassen', 'tagesplan']);
  pruefe('und ist unsichtbar', ohne.find((w) => w.id === 'tagesplan').sichtbar, false);
  pruefe('zweimal ausblenden tut nichts', blendeAus(ohne, 'tagesplan'), null);

  const wieder = blendeEin(ohne, 'tagesplan');
  pruefe('Einblenden haengt hinten an die sichtbaren an',
    ids(wieder), ['uhr', 'aufgaben', 'klassen', 'tagesplan']);
  pruefe('und ist wieder sichtbar', wieder.find((w) => w.id === 'tagesplan').sichtbar, true);
  pruefe('Einblenden eines sichtbaren tut nichts', blendeEin(l, 'uhr'), null);
}

console.log('\n=== Breite umschalten ===');
{
  const l = leseLayout('uhr:1:1,tagesplan:2:1,aufgaben:2:1,klassen:2:1', BAUSTEINE);
  pruefe('schmal wird breit', wechsleBreite(l, 'uhr').find((w) => w.id === 'uhr').breite, 2);
  pruefe('breit wird schmal',
    wechsleBreite(l, 'tagesplan').find((w) => w.id === 'tagesplan').breite, 1);
  pruefe('die anderen bleiben', wechsleBreite(l, 'uhr').map((w) => w.breite), [2, 2, 2, 2]);
  pruefe('unbekanntes Widget tut nichts', wechsleBreite(l, 'gibtsnicht'), null);
}

console.log(schlecht === 0 ? `\nALLE ${n} TESTS BESTANDEN` : `\n${schlecht} von ${n} FEHLGESCHLAGEN`);
process.exit(schlecht === 0 ? 0 : 1);
