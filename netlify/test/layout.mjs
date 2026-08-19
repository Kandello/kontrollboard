/**
 * Prueft die Rasterlogik der Widgets — ein echtes 2D-Raster wie bei einem
 * Handy-Launcher, mit freier Position, freier Groesse und Kollisionspruefung.
 *
 * Der heikle Teil ist die Kollisionsregel: zwei sichtbare Widgets duerfen
 * sich niemals ueberschneiden, egal ob durch Ziehen, Groessenaendern oder
 * automatisches Platzieren. Und die Vertraeglichkeit mit der alten,
 * eindimensionalen Speicherform darf keine Widgets verschlucken.
 *
 *   node layout.mjs
 */

import {
  GRID_SPALTEN, metaSchluessel, celleFrei, findePlatz, leseLayout, schreibeLayout,
  sichtbare, ausgeblendete, versetze, groesseAendern, blendeAus, blendeEin
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
  { id: 'uhr',       titel: 'Uhr',       breiteVorgabe: 4, hoeheVorgabe: 8,  minBreite: 2, minHoehe: 4 },
  { id: 'tagesplan', titel: 'Tagesplan', breiteVorgabe: 8, hoeheVorgabe: 14, minBreite: 3, minHoehe: 6 },
  { id: 'aufgaben',  titel: 'Aufgaben',  breiteVorgabe: 8, hoeheVorgabe: 8,  minBreite: 4, minHoehe: 4 },
  { id: 'klassen',   titel: 'Klassen',   breiteVorgabe: 12, hoeheVorgabe: 6, minBreite: 3, minHoehe: 3 }
];

const rechteck = (w) => ({ x: w.x, y: w.y, w: w.w, h: w.h });
const finde = (layout, id) => layout.find((w) => w.id === id);

// ---------------------------------------------------------------------------
console.log('=== Grundlagen ===');
pruefe('Schluessel', metaSchluessel('start'), 'layout_start');
pruefe('zwoelf Spalten', GRID_SPALTEN, 12);

console.log('\n=== celleFrei ===');
{
  pruefe('leeres Feld ist frei', celleFrei({ x: 0, y: 0, w: 4, h: 4 }, []), true);
  pruefe('negative Spalte ist unfrei', celleFrei({ x: -1, y: 0, w: 4, h: 4 }, []), false);
  pruefe('negative Zeile ist unfrei', celleFrei({ x: 0, y: -1, w: 4, h: 4 }, []), false);
  pruefe('ragt ueber den rechten Rand', celleFrei({ x: 10, y: 0, w: 4, h: 4 }, []), false);
  pruefe('genau am rechten Rand ist frei', celleFrei({ x: 8, y: 0, w: 4, h: 4 }, []), true);
  pruefe('Breite 0 ist unfrei', celleFrei({ x: 0, y: 0, w: 0, h: 4 }, []), false);

  const belegt = [{ x: 2, y: 2, w: 4, h: 4 }];
  pruefe('klare Ueberschneidung', celleFrei({ x: 3, y: 3, w: 2, h: 2 }, belegt), false);
  pruefe('beruehrt nur die Kante (rechts) ist frei', celleFrei({ x: 6, y: 2, w: 2, h: 4 }, belegt), true);
  pruefe('beruehrt nur die Kante (unten) ist frei', celleFrei({ x: 2, y: 6, w: 4, h: 2 }, belegt), true);
  pruefe('umschliesst das belegte Feld', celleFrei({ x: 0, y: 0, w: 8, h: 8 }, belegt), false);
  pruefe('liegt komplett daneben', celleFrei({ x: 8, y: 8, w: 2, h: 2 }, belegt), true);
}

console.log('\n=== findePlatz ===');
{
  pruefe('leeres Raster: oben links', findePlatz([], 4, 4), { x: 0, y: 0, w: 4, h: 4 });
  const belegt = [{ x: 0, y: 0, w: 4, h: 4 }];
  pruefe('weicht nach rechts aus', findePlatz(belegt, 4, 4), { x: 4, y: 0, w: 4, h: 4 });

  // Die ganze erste Zeile ist voll (12 Spalten in Dreierschritten).
  const volleZeile = [
    { x: 0, y: 0, w: 4, h: 3 }, { x: 4, y: 0, w: 4, h: 3 }, { x: 8, y: 0, w: 4, h: 3 }
  ];
  pruefe('weicht in die naechste Zeile aus', findePlatz(volleZeile, 4, 3), { x: 0, y: 3, w: 4, h: 3 });

  pruefe('zu breit fuer das Raster wird gekappt', findePlatz([], 99, 4).w, 12);
}

console.log('\n=== Lesen ohne gespeicherte Anordnung ===');
{
  const l = leseLayout('', BAUSTEINE);
  pruefe('alle vier Bausteine da', l.map((w) => w.id), ['uhr', 'tagesplan', 'aufgaben', 'klassen']);
  pruefe('alle sichtbar', l.every((w) => w.sichtbar), true);
  pruefe('Groessen aus der Vorgabe', l.map((w) => [w.w, w.h]),
    [[4, 8], [8, 14], [8, 8], [12, 6]]);
  let kollision = false;
  for (let i = 0; i < l.length; i++) {
    for (let j = i + 1; j < l.length; j++) {
      if (!celleFrei(rechteck(l[i]), [rechteck(l[j])])) kollision = true;
    }
  }
  pruefe('automatische Platzierung ueberschneidet sich nirgends', kollision, false);
  pruefe('alle Rechtecke bleiben im Raster',
    l.every((w) => w.x >= 0 && w.x + w.w <= GRID_SPALTEN), true);
}

console.log('\n=== Lesen mit vollstaendig gespeicherter Anordnung ===');
{
  const zeile = 'klassen:0:0:12:5:1,uhr:0:5:4:6:1,tagesplan:4:5:8:10:0,aufgaben:0:11:6:6:1';
  const l = leseLayout(zeile, BAUSTEINE);
  pruefe('Position und Groesse exakt uebernommen', finde(l, 'klassen'), {
    id: 'klassen', titel: 'Klassen', x: 0, y: 0, w: 12, h: 5, sichtbar: true
  });
  pruefe('Sichtbarkeit aus der Zeile', finde(l, 'tagesplan').sichtbar, false);
  pruefe('sichtbare gefiltert', sichtbare(l).map((w) => w.id), ['klassen', 'uhr', 'aufgaben']);
  pruefe('ausgeblendete gefiltert', ausgeblendete(l).map((w) => w.id), ['tagesplan']);
}

console.log('\n=== Vertraeglichkeit mit dem alten Kurzformat ===');
{
  // So sah die Zeile vor dem freien Raster aus: nur id, Breite (1 oder 2
  // Spalten im damaligen Zweispalten-Raster) und Sichtbarkeit.
  const l = leseLayout('uhr:1:1,tagesplan:2:0,klassen:2:1', BAUSTEINE);
  pruefe('alle Bausteine da, auch der fehlende', l.map((w) => w.id).sort(),
    ['aufgaben', 'klassen', 'tagesplan', 'uhr']);
  pruefe('Breite aus der alten Zeile uebernommen', finde(l, 'uhr').w, 1);
  pruefe('Sichtbarkeit aus der alten Zeile uebernommen', finde(l, 'tagesplan').sichtbar, false);
  pruefe('… und bekommt trotzdem eine gueltige Position', finde(l, 'tagesplan').x, 0);
  pruefe('Position wurde neu vergeben, keine Ueberschneidung',
    celleFrei(rechteck(finde(l, 'klassen')), [rechteck(finde(l, 'uhr'))]), true);
  pruefe('unbekannter Baustein aus alter Zeile faellt weg',
    leseLayout('gibtsnicht:1:1', BAUSTEINE).some((w) => w.id === 'gibtsnicht'), false);
}

console.log('\n=== Unsinnige oder unvollstaendige Werte ===');
{
  const l = leseLayout('uhr:0:0:0:0:1', BAUSTEINE);
  pruefe('Breite 0 wird auf 1 angehoben', finde(l, 'uhr').w, 1);
  pruefe('Hoehe 0 wird auf 1 angehoben', finde(l, 'uhr').h, 1);
}
{
  const l = leseLayout('uhr:-3:-3:99:99:1', BAUSTEINE);
  pruefe('negative Position wird auf 0 gehoben', [finde(l, 'uhr').x, finde(l, 'uhr').y], [0, 0]);
  pruefe('zu grosse Breite wird gekappt', finde(l, 'uhr').w, GRID_SPALTEN);
}
{
  const l = leseLayout('uhr::::1,tagesplan:3:3:::0', BAUSTEINE);
  pruefe('ganz leere Zahlenfelder fallen auf die Vorgabe zurueck',
    finde(l, 'uhr').w, BAUSTEINE[0].breiteVorgabe);
}

console.log('\n=== Zurueckschreiben und Umkehrbarkeit ===');
{
  const l = leseLayout('klassen:0:0:12:5:1,uhr:0:5:4:6:0', BAUSTEINE);
  pruefe('Zeile im neuen Format', schreibeLayout(l).startsWith('klassen:0:0:12:5:1'), true);
  pruefe('Lesen und Schreiben sind umkehrbar',
    schreibeLayout(leseLayout(schreibeLayout(l), BAUSTEINE)), schreibeLayout(l));
}

console.log('\n=== Verschieben ===');
const ZWEI = BAUSTEINE.slice(0, 2);

{
  const l = leseLayout('uhr:0:0:4:4:1,tagesplan:4:0:4:4:1', ZWEI);
  const verschoben = versetze(l, 'uhr', 8, 0);
  pruefe('Verschieben auf freie Flaeche klappt', finde(verschoben, 'uhr').x, 8);
  pruefe('Groesse bleibt beim Verschieben gleich',
    [finde(verschoben, 'uhr').w, finde(verschoben, 'uhr').h], [4, 4]);
  pruefe('das andere Widget bleibt unberuehrt', finde(verschoben, 'tagesplan').x, 4);

  pruefe('Verschieben auf belegte Flaeche wird abgelehnt', versetze(l, 'uhr', 5, 0), null);
  pruefe('Verschieben ueber den Rand wird begrenzt, nicht abgelehnt',
    finde(versetze(l, 'uhr', 20, 0), 'uhr').x, GRID_SPALTEN - 4);
  pruefe('negative Zeile wird auf 0 begrenzt', finde(versetze(l, 'uhr', 0, -5), 'uhr').y, 0);
  pruefe('unbekanntes Widget liefert null', versetze(l, 'gibtsnicht', 0, 0), null);
  pruefe('die Rohdaten bleiben unberuehrt', finde(l, 'uhr').x, 0);
}
{
  const l = leseLayout('uhr:0:0:4:4:1,tagesplan:4:0:4:4:0', ZWEI);
  const neu = versetze(l, 'tagesplan', 8, 0);
  pruefe('wird beim Verschieben sichtbar', finde(neu, 'tagesplan').sichtbar, true);
}

console.log('\n=== Groesse aendern ===');
{
  const l = leseLayout('uhr:0:0:4:4:1,tagesplan:4:0:4:4:1', ZWEI);
  const groesser = groesseAendern(l, 'uhr', 4, 8, ZWEI);
  pruefe('waechst nach unten', [finde(groesser, 'uhr').w, finde(groesser, 'uhr').h], [4, 8]);
  pruefe('Position bleibt (linke obere Ecke)', [finde(groesser, 'uhr').x, finde(groesser, 'uhr').y], [0, 0]);

  pruefe('Wachstum in ein belegtes Feld wird abgelehnt',
    groesseAendern(l, 'uhr', 8, 4, ZWEI), null);

  const geschrumpft = groesseAendern(l, 'tagesplan', 3, 6, ZWEI);
  pruefe('Schrumpfen auf die Mindestgroesse klappt', [finde(geschrumpft, 'tagesplan').w, finde(geschrumpft, 'tagesplan').h], [3, 6]);

  pruefe('unter die Mindestbreite wird auf das Minimum gehoben',
    finde(groesseAendern(l, 'tagesplan', 1, 6, ZWEI), 'tagesplan').w, 3);
  pruefe('unter die Mindesthoehe wird auf das Minimum gehoben',
    finde(groesseAendern(l, 'tagesplan', 4, 1, ZWEI), 'tagesplan').h, 6);
  pruefe('unbekanntes Widget liefert null', groesseAendern(l, 'gibtsnicht', 4, 4, ZWEI), null);
}
{
  // Ueber den rechten Rand hinaus waechst nicht — celleFrei lehnt das ab.
  const nurKlassen = BAUSTEINE.filter((b) => b.id === 'klassen');
  const l = leseLayout('klassen:8:0:4:4:1', nurKlassen);
  pruefe('Wachstum ueber den Rasterrand wird abgelehnt',
    groesseAendern(l, 'klassen', 8, 4, nurKlassen), null);
}

console.log('\n=== Aus- und Einblenden ===');
{
  const l = leseLayout('uhr:0:0:4:4:1,tagesplan:4:0:4:4:1', ZWEI);
  const ohne = blendeAus(l, 'uhr');
  pruefe('als unsichtbar markiert', finde(ohne, 'uhr').sichtbar, false);
  pruefe('Position bleibt gemerkt', finde(ohne, 'uhr').x, 0);
  pruefe('zweimal ausblenden liefert null', blendeAus(ohne, 'uhr'), null);

  const wieder = blendeEin(ohne, 'uhr');
  pruefe('an der alten Stelle wieder da, wenn frei', [finde(wieder, 'uhr').x, finde(wieder, 'uhr').y], [0, 0]);
  pruefe('wieder sichtbar', finde(wieder, 'uhr').sichtbar, true);
  pruefe('Einblenden eines sichtbaren liefert null', blendeEin(l, 'uhr'), null);
}
{
  // Waehrend ein Widget ausgeblendet war, hat ein anderes seine alte Stelle
  // uebernommen — beim Einblenden muss eine neue freie Stelle her.
  let l = leseLayout('uhr:0:0:4:4:0,tagesplan:4:0:4:4:1', ZWEI);
  l = versetze(l, 'tagesplan', 0, 0);
  const wieder = blendeEin(l, 'uhr');
  pruefe('weicht auf eine freie Stelle aus, wenn die alte belegt ist',
    celleFrei(rechteck(finde(wieder, 'uhr')), [rechteck(finde(wieder, 'tagesplan'))]), true);
  pruefe('behaelt seine Groesse dabei', [finde(wieder, 'uhr').w, finde(wieder, 'uhr').h], [4, 4]);
}

console.log(schlecht === 0 ? `\nALLE ${n} TESTS BESTANDEN` : `\n${schlecht} von ${n} FEHLGESCHLAGEN`);
process.exit(schlecht === 0 ? 0 : 1);
