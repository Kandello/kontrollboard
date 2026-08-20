/**
 * ansichten/start.js — Ebene 1, der morgendliche Tagesüberblick.
 *
 * Die Seite ist ein Raster aus Widgets, nicht mehr eine feste Abfolge von
 * Karten: Uhr, Tagesplan, Wochenaufgaben, laufende Unterrichtseinheit,
 * Ferienmodus, Klassen sowie die drei Merklisten To-Do/Deadlines/Termine.
 * Welche davon zu sehen sind, in welcher Reihenfolge und wie breit, steht
 * in der Tabelle (siehe layout.js) — und laesst sich hier per Ziehen
 * aendern. Die Merklisten starten in der Ablage statt im Raster
 * (standardSichtbar: false in BAUSTEINE) — neu, aber nicht aufgedraengt.
 *
 * Gezogen wird ausdruecklich nur an der Griffleiste oben in jedem Widget.
 * Die Inhalte enthalten Knoepfe und Verweise; waere die ganze Flaeche
 * ziehbar, geriete jeder Klick darauf in Gefahr. Bei den Unterrichtseinheiten
 * ist es umgekehrt geloest, weil deren Boxen kaum Bedienelemente tragen.
 */

import { e, leere, setzeMeldung, hinweis } from '../ui.js';
import {
  GRID_SPALTEN, metaSchluessel, leseLayout, schreibeLayout, sichtbare, ausgeblendete,
  versetze as versetzeWidget, groesseAendern, blendeAus, blendeEin
} from '../layout.js';
import { starteZug, starteGroessenzug, messeAlle, gleite, ROLLRAND } from '../ziehen.js';
import { klassenlehrkraftEintrag } from '../zuordnung.js';
import { sende, leereDaten, ladeDaten } from '../server.js';
import {
  SPUREN, jahresplan, einheitInWoche, fortschrittEinheit, fortschrittKlasse, schulwoche
} from '../einheiten.js';
import {
  heute, morgen, uhrzeit, wochentag, wochentagName, istWochenende,
  kwKennung, alsMinuten, alsDeutsch, alsIso
} from '../zeit.js';
import {
  eintraegeFuerTyp, istUeberfaellig, fuegeLokalHinzu, entferneLokal, setzeErledigtLokal
} from '../merkliste.js';

/** Ab dieser Stunde zeigt der Tagesplan schon den Folgetag. */
const TAGESPLAN_VORSCHAU_AB_STUNDE = 17;

/** Arten, die auf die Klassenseite fuehren. */
const KLICKBAR = ['DEUTSCH', 'LESEN'];

/**
 * PEAK muss Mittwochfrueh bei den Klassenlehrkraeften liegen, Frist ist
 * also Dienstagabend. Die Weekly Note ergibt vor Freitag keinen Sinn.
 *
 * Eine offene Aufgabe bleibt die ganze Woche ueber rot markiert, bis sie
 * abgehakt wird — ohne Zeichen und ohne Animation. Zwei Signale fuer
 * dieselbe Aussage stumpfen nur ab.
 */
const AUFGABEN = {
  PEAK:   { titel: 'PEAK',        frist: 'Frist: Dienstagabend' },
  WEEKLY: { titel: 'Weekly Note', frist: 'Frist: Freitag' }
};

let uhrGeber = null;

/** Welcher Tag im Tagesplan stehen muss — ab 17 Uhr schon der folgende. */
function planTag(jetzt = new Date()) {
  const tag = heute(jetzt);
  const vorschau = uhrzeit(jetzt).stunde >= TAGESPLAN_VORSCHAU_AB_STUNDE;
  return { tag: vorschau ? morgen(tag) : tag, istHeute: !vorschau };
}

/**
 * Die Bausteine der Startseite. Reihenfolge und Groesse hier sind nur die
 * Vorgabe fuer den allerersten Aufruf, in Rastereinheiten (siehe layout.js);
 * danach entscheidet die gespeicherte Anordnung. Ein neuer Baustein taucht
 * bei allen automatisch an einer freien Stelle auf.
 */
const BAUSTEINE = [
  { id: 'uhr',       titel: 'Uhr',                         breiteVorgabe: 4,  hoeheVorgabe: 6,  minBreite: 3, minHoehe: 4 },
  { id: 'tagesplan', titel: 'Tagesplan',                   breiteVorgabe: 8,  hoeheVorgabe: 12, minBreite: 4, minHoehe: 6 },
  { id: 'aufgaben',  titel: 'Wochenaufgaben',              breiteVorgabe: 8,  hoeheVorgabe: 5,  minBreite: 3, minHoehe: 3 },
  { id: 'einheit',   titel: 'Aktuelle Unterrichtseinheit', breiteVorgabe: 8,  hoeheVorgabe: 8,  minBreite: 4, minHoehe: 4 },
  { id: 'klassen',   titel: 'Klassen',                     breiteVorgabe: 12, hoeheVorgabe: 5,  minBreite: 3, minHoehe: 3 },
  { id: 'ferien',    titel: 'Ferienmodus',                 breiteVorgabe: 8,  hoeheVorgabe: 3,  minBreite: 3, minHoehe: 2 },
  // Neu und bewusst noch nirgends im Raster: sie tauchen zunaechst in der
  // Ablage auf (standardSichtbar: false), statt sich ungefragt zwischen die
  // bestehenden Widgets zu draengen. Wer sie will, zieht sie selbst hoch.
  { id: 'todo',      titel: 'To-Do',                       breiteVorgabe: 4,  hoeheVorgabe: 8,  minBreite: 3, minHoehe: 4, standardSichtbar: false },
  { id: 'deadline',  titel: 'Deadlines',                   breiteVorgabe: 4,  hoeheVorgabe: 8,  minBreite: 3, minHoehe: 4, standardSichtbar: false },
  { id: 'events',    titel: 'Termine',                     breiteVorgabe: 4,  hoeheVorgabe: 8,  minBreite: 3, minHoehe: 4, standardSichtbar: false }
];

/** Hoehe einer Rasterzeile in Pixeln — muss zu `grid-auto-rows` im CSS passen. */
const RASTER_REIHE_PX = 24;

/**
 * Die Geometrie des Rasters, frisch gemessen: waehrend eines Zugs rollt die
 * Seite mit, wodurch sich die Lage des Rasters gegenueber dem Fenster
 * laufend aendert. Eine einmalige Messung beim Start des Zugs waere nach
 * dem ersten Rollschritt falsch.
 */
function rasterGeometrie(raster) {
  const kasten = raster.getBoundingClientRect();
  const stil = getComputedStyle(raster);
  const spaltenluecke = parseFloat(stil.columnGap) || 0;
  const zeilenluecke = parseFloat(stil.rowGap) || 0;
  return {
    links: kasten.left, oben: kasten.top,
    spaltenraster: (kasten.width - spaltenluecke * (GRID_SPALTEN - 1)) / GRID_SPALTEN + spaltenluecke,
    zeilenraster: RASTER_REIHE_PX + zeilenluecke
  };
}

export function zeichneStart(ziel, { daten, verbergen, neuZeichnen }) {
  if (uhrGeber) { clearInterval(uhrGeber); uhrGeber = null; }

  const ferien = istWahr(daten.meta.ferienmodus);
  const tag = heute();
  const kw = kwKennung(tag);
  const plan = planTag();

  // --- Inhalte der Bausteine ----------------------------------------------
  const uhr = uhrWidget(tag, ferien);
  const tp = ferien ? null : tagesplan(daten, plan.tag, plan.istHeute);

  const inhalte = {
    uhr: uhr.element,
    tagesplan: tp ? tp.element : e('div', { klasse: 'leer', style: 'padding:20px 16px',
      text: 'Ferienmodus — der Tagesplan ruht.' }),
    aufgaben: e('div', { klasse: 'kachelreihe' }, [
      wochenkachel('PEAK', daten, kw, tag, ferien, neuZeichnen),
      wochenkachel('WEEKLY', daten, kw, tag, ferien, neuZeichnen)
    ]),
    einheit: aktuelleEinheit(daten, tag),
    klassen: klassenknoepfe(daten, verbergen),
    ferien: ferienschalter(ferien, neuZeichnen),
    todo: merklisteWidget(daten, 'TODO', tag),
    deadline: merklisteWidget(daten, 'DEADLINE', tag),
    events: merklisteWidget(daten, 'EVENT', tag)
  };

  // Die Seite bleibt oft stundenlang offen. Ohne diesen Takt bliebe die
  // Markierung „läuft"/„als Nächstes" an der Stunde kleben, die beim
  // Zeichnen gerade dran war, und der Tageswechsel um 17 Uhr bzw. um
  // Mitternacht kaeme erst beim naechsten Neuladen an.
  const gezeichneterTag = alsIso(plan.tag);
  uhrGeber = setInterval(() => {
    uhr.stellen();
    const jetzt = planTag();
    if (alsIso(jetzt.tag) !== gezeichneterTag) { neuZeichnen(); return; }
    if (tp) tp.aktualisiere();
  }, 1000);

  // --- Raster --------------------------------------------------------------
  let layout = leseLayout(daten.meta[metaSchluessel('start')], BAUSTEINE);

  const raster = e('div', { klasse: 'widgetraster' });
  const ablage = e('div', { klasse: 'widget-ablage' });
  const ablageLeer = e('div', { klasse: 'leer', style: 'padding:12px',
    text: 'Alles eingeblendet. Hierher gezogene Widgets verschwinden von der Startseite, ohne dass Daten verlorengehen.' });
  ablage.appendChild(ablageLeer);

  const huellen = new Map();
  BAUSTEINE.forEach((b) => huellen.set(b.id, widgetHuelle(b, inhalte[b.id], {
    starteWidgetZug: (ev) => starteWidgetZug(ev, b.id),
    starteWidgetResize: (ev) => starteWidgetResize(ev, b.id),
    ausblenden: (id) => setze(blendeAus(layout, id)),
    einblenden: (id) => setze(blendeEin(layout, id))
  })));

  function platziere(neuesLayout, animiert) {
    const vorher = animiert ? messeAlle(huellen) : null;

    sichtbare(neuesLayout).forEach((w) => {
      const el = huellen.get(w.id);
      raster.appendChild(el);
      el.style.gridColumn = `${w.x + 1} / span ${w.w}`;
      el.style.gridRow = `${w.y + 1} / span ${w.h}`;
      el.classList.remove('ist-ausgeblendet');
    });
    ausgeblendete(neuesLayout).forEach((w) => {
      const el = huellen.get(w.id);
      ablage.appendChild(el);
      el.style.gridColumn = '';
      el.style.gridRow = '';
      el.classList.add('ist-ausgeblendet');
    });
    ablageLeer.hidden = ausgeblendete(neuesLayout).length > 0;

    if (animiert) gleite(huellen, vorher);
  }

  /** Uebernimmt eine neue Anordnung: erst zeichnen, dann wegschreiben. */
  async function setze(neuesLayout) {
    if (!neuesLayout) return;
    const vorher = layout;
    layout = neuesLayout;
    platziere(layout, true);

    const zeile = schreibeLayout(layout);
    daten.meta[metaSchluessel('start')] = zeile;
    try {
      await sende('meta', { werte: { [metaSchluessel('start')]: zeile } });
    } catch (fehler) {
      layout = vorher;
      daten.meta[metaSchluessel('start')] = schreibeLayout(vorher);
      platziere(layout, true);
      window.alert('Die Anordnung konnte nicht gespeichert werden: ' + fehler.message);
    }
  }

  /**
   * Verschieben: die Zielzelle ergibt sich direkt aus der Zeigerposition,
   * abzueglich der Stelle, an der gegriffen wurde — nicht aus dem Element
   * unter dem Zeiger. Ein 2D-Raster kennt keine Nachbarn, vor die man
   * einsortiert, nur Koordinaten.
   */
  function istUeberAblage(x, y) {
    return document.elementsFromPoint(x, y)
      .some((el) => el === ablage || (el.closest && el.closest('.widget-ablage')));
  }

  function starteWidgetZug(ev, id) {
    const huelle = huellen.get(id);
    const kasten = huelle.getBoundingClientRect();
    const versatzX = ev.clientX - kasten.left;
    const versatzY = ev.clientY - kasten.top;
    let entwurf = null;

    starteZug({
      ev, element: huelle,
      zielSuche: (x, y) => {
        if (istUeberAblage(x, y)) return { ablegen: true };
        const geo = rasterGeometrie(raster);
        const gx = Math.round((x - versatzX - geo.links) / geo.spaltenraster);
        let gy = Math.round((y - versatzY - geo.oben) / geo.zeilenraster);
        // Nur direkt am unteren Bildschirmrand (der Zone, die das Mitrollen
        // ausloest) nicht tiefer vorschlagen, als der Rest des Rasters
        // ohnehin reicht. Sonst waechst das Raster bei jedem Rollschritt
        // selbst ein Stueck mit (der Zeiger bleibt am Rand stehen, waehrend
        // die Seite darunter mitrollt, also rutscht die vorgeschlagene Zeile
        // bei jedem Schritt weiter nach unten) — und das Rollziel liefe dem
        // Rollen immer einen Schritt voraus, ohne je anzukommen. Ausserhalb
        // dieser Randzone bleibt das gewollte Ablegen weit unterhalb allen
        // Inhalts (Luecken bewusst offen lassen) uneingeschraenkt moeglich.
        if (y > window.innerHeight - ROLLRAND) {
          const tiefsteAndere = layout.reduce(
            (m, w) => (w.sichtbar && w.id !== id ? Math.max(m, w.y + w.h) : m), 0);
          gy = Math.min(gy, tiefsteAndere);
        }
        return { ablegen: false, gx, gy };
      },
      gleich: (a, b) => a.ablegen === b.ablegen && a.gx === b.gx && a.gy === b.gy,
      // Steht der Zeiger schon ueber der Ablage, nicht weiter mitrollen —
      // die Ablage liegt ganz unten auf der Seite, direkt im Bereich, der
      // sonst das Mitrollen ausloest. Ohne diese Bremse rollte die Seite
      // immer weiter, sobald man nah genug heran ist, um die Ablage
      // ueberhaupt zu treffen — sie war so praktisch nie erreichbar.
      sollRollen: (x, y) => !istUeberAblage(x, y),
      vorschau: (ziel) => {
        const kandidat = ziel.ablegen ? blendeAus(layout, id) : versetzeWidget(layout, id, ziel.gx, ziel.gy);
        if (kandidat) { entwurf = kandidat; platziere(entwurf, true); }
      },
      abschluss: () => {
        if (entwurf) setze(entwurf);
        else platziere(layout, true);
      }
    });
  }

  /**
   * Groessenaendern: der Griff unten rechts waechst mit dem Zeiger mit, die
   * linke obere Ecke bleibt stehen. Kollidiert die neue Groesse mit einem
   * anderen Widget, bleibt einfach die letzte gueltige Groesse stehen.
   */
  function starteWidgetResize(ev, id) {
    const start = layout.find((w) => w.id === id);
    if (!start) return;
    let entwurf = null;

    starteGroessenzug({
      ev,
      vorschau: (dx, dy) => {
        const geo = rasterGeometrie(raster);
        const deltaSpalten = Math.round(dx / geo.spaltenraster);
        const deltaZeilen = Math.round(dy / geo.zeilenraster);
        const kandidat = groesseAendern(
          layout, id, start.w + deltaSpalten, start.h + deltaZeilen, BAUSTEINE);
        if (kandidat) { entwurf = kandidat; platziere(entwurf, true); }
      },
      abschluss: () => {
        if (entwurf) setze(entwurf);
        else platziere(layout, true);
      }
    });
  }

  ziel.appendChild(raster);
  ziel.appendChild(e('div', { klasse: 'abschnitt-titel', text: 'Ausgeblendet' }));
  ziel.appendChild(ablage);
  platziere(layout, false);
}

/**
 * Die Huelle um einen Baustein: Griffleiste mit Namen zum Verschieben, ein
 * Ausblenden-Knopf, darunter der eigentliche Inhalt, unten rechts ein
 * Anfassgriff zum Skalieren.
 */
function widgetHuelle(baustein, inhalt, { starteWidgetZug, starteWidgetResize, ausblenden, einblenden }) {
  const griff = e('div', { klasse: 'widget-griff' }, [
    e('span', { klasse: 'widget-punkte', 'aria-hidden': 'true' }),
    e('span', { klasse: 'widget-name', text: baustein.titel }),
    e('span', { klasse: 'widget-knoepfe' }, [
      e('button', {
        klasse: 'klein leise', text: '×', title: 'Ausblenden',
        'aria-label': baustein.titel + ' ausblenden',
        auf: { click: (ev) => { ev.stopPropagation(); ausblenden(baustein.id); } }
      }),
      e('button', {
        klasse: 'klein zurueckholen', text: '+', title: 'Wieder einblenden',
        'aria-label': baustein.titel + ' wieder einblenden',
        auf: { click: (ev) => { ev.stopPropagation(); einblenden(baustein.id); } }
      })
    ])
  ]);

  // Gezogen wird nur an der Griffleiste — der Inhalt bleibt bedienbar.
  griff.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('button')) return;
    starteWidgetZug(ev);
  });

  const groessenGriff = e('div', {
    klasse: 'widget-resize', title: 'Größe ändern', 'aria-hidden': 'true'
  });
  groessenGriff.addEventListener('pointerdown', (ev) => {
    ev.stopPropagation();
    starteWidgetResize(ev);
  });

  return e('div', { klasse: 'karte widget', daten: { id: baustein.id } }, [
    griff,
    e('div', { klasse: 'widget-inhalt' }, [inhalt]),
    groessenGriff
  ]);
}

export function raeumeStartAuf() {
  if (uhrGeber) { clearInterval(uhrGeber); uhrGeber = null; }
}

// --- Uhr -------------------------------------------------------------------

function uhrWidget(tag, ferien) {
  const stundeMinute = e('span');
  const sekunde = e('span', { klasse: 'sekunden' });
  const zeitZeile = e('div', { klasse: 'uhr-zeit' }, [stundeMinute, sekunde]);
  const tagZeile = e('div', { klasse: 'uhr-tag' });

  function stellen() {
    const u = uhrzeit();
    stundeMinute.textContent =
      `${String(u.stunde).padStart(2, '0')}:${String(u.minute).padStart(2, '0')}`;
    sekunde.textContent = ':' + String(u.sekunde).padStart(2, '0');
    const t = heute();
    tagZeile.textContent = `${wochentagName(wochentag(t))}, ${alsDeutsch(t)}`;
  }
  stellen();

  // Den Takt setzt zeichneStart, damit Uhr und Tagesplan im selben
  // Zeitgeber laufen und nicht um Sekundenbruchteile auseinanderfallen.
  return {
    element: e('div', { klasse: 'uhr' }, [
      zeitZeile, tagZeile,
      ferien ? e('span', { klasse: 'marke ruhend', text: 'Ferienmodus' }) : null
    ]),
    stellen
  };
}

// --- Tagesplan -------------------------------------------------------------

/** Ueberschrift „Tagesplan am ⟨Wochentag⟩" — der Wochentag in groesserer Schrift. */
function tagesplanUeberschrift(tag) {
  return e('h2', { klasse: 'tagesplan-kopf', style: 'margin-bottom:12px' }, [
    'Tagesplan am ',
    e('span', { klasse: 'tagesplan-wochentag', text: wochentagName(wochentag(tag)) })
  ]);
}

function tagesplanKarte(tag, kinder) {
  return e('div', {}, [
    tagesplanUeberschrift(tag),
    ...(Array.isArray(kinder) ? kinder : [kinder])
  ]);
}

/**
 * Welche Stunde laeuft gerade, welche kommt als Naechste? Bei einer
 * Vorschau auf den Folgetag keine von beiden — die aktuelle Uhrzeit gehoert
 * ja noch zum heutigen Tag.
 */
export function markierteStunden(stunden, istHeute, jetztMinuten) {
  if (!istHeute) return { laufend: -1, naechste: -1 };
  const laufend = stunden.findIndex((s) => {
    const von = alsMinuten(s.von);
    const bis = alsMinuten(s.bis);
    return von !== null && bis !== null && jetztMinuten >= von && jetztMinuten < bis;
  });
  const naechste = laufend === -1
    ? stunden.findIndex((s) => (alsMinuten(s.von) ?? 0) > jetztMinuten)
    : -1;
  return { laufend, naechste };
}

function tagesplan(daten, tag, istHeute = true) {
  const wt = wochentag(tag);

  if (istWochenende(tag)) {
    return { aktualisiere: null, element: tagesplanKarte(tag, [
      e('div', { klasse: 'leer', style: 'padding:24px 16px',
                 text: wt === 6 ? 'Samstag — kein Unterricht.' : 'Sonntag — kein Unterricht.' })
    ]) };
  }

  const stunden = daten.stundenplan
    .filter((s) => Number(s.wochentag) === wt)
    .slice()
    .sort((a, b) => (alsMinuten(a.von) ?? 0) - (alsMinuten(b.von) ?? 0));

  if (!stunden.length) {
    return { aktualisiere: null, element: tagesplanKarte(tag, [
      e('div', { klasse: 'leer', style: 'padding:24px 16px',
                 text: 'Für diesen Tag steht nichts im Stundenplan.' })
    ]) };
  }

  const { laufend, naechste } = markierteStunden(stunden, istHeute, uhrzeit().minuten);

  // Zeile und Markenplatz jeder Stunde merken: die Markierung wandert im
  // Sekundentakt weiter, ohne dass die Seite neu gezeichnet wird.
  const zeilen = [];

  const liste = e('ul', { klasse: 'tagesplan' }, stunden.map((s, i) => {
    // Anklickbar nur, wenn die Klasse auch wirklich im Blatt Klassen steht.
    // 1A und 1S aus den FuF-Stunden stehen dort nicht — ein Tippen darauf
    // fuehrte sonst ins Leere.
    const klasse = daten.klassen.find((k) => k.klasse === s.klasse);
    const anklickbar = KLICKBAR.includes(s.art) && Boolean(klasse);

    // Deutsch/Lesen/FuF nennen im fetten Slot bereits die Klasse; der
    // Art-Slot ergaenzt "Deutsch" bzw. "Lesen · +4H", ohne sich zu
    // wiederholen. Dienst-Eintraege haben keine Klasse — dort steht die Art
    // selbst im fetten Slot, und der zweite Slot zeigt nur noch den Zusatz,
    // damit "Break Duty" nicht zweimal in derselben Zeile auftaucht.
    const hatEigeneKlasse = Boolean(klasse || s.klasse);
    const artSpanText = hatEigeneKlasse ? artText(s) : (s.zusatz || null);

    // Der Markenplatz wird immer angelegt, auch leer: so kann die Markierung
    // spaeter hierher wandern, ohne die Zeile neu zu bauen.
    const marke = e('span', {
      klasse: laufend === i ? 'marke laufend' : (naechste === i ? 'marke naechste' : 'marke'),
      text: laufend === i ? 'läuft' : (naechste === i ? 'als Nächstes' : ''),
      hidden: laufend !== i && naechste !== i
    });

    const inhalt = [
      e('span', { klasse: 'zeit', text: `${s.von}–${s.bis}` }),
      e('span', { klasse: 'was' }, [
        e('span', {
          klasse: 'bezeichnung ' + (klasse ? farbklasse(klasse, i) : ''),
          style: klasse && klasse.farbe ? `--klassenfarbe:${klasse.farbe}` : null
        }, [
          klasse ? e('span', { klasse: 'klassenfarbe-punkt', 'aria-hidden': 'true' }) : null,
          klasse ? klasse.bezeichnung : (s.klasse || bezeichneArt(s))
        ]),
        artSpanText ? e('span', { klasse: 'art', text: artSpanText }) : null
      ]),
      marke
    ];

    const zeile = anklickbar
      ? e('a', { klasse: 'eintrag anklickbar', href: '#/klasse/' + encodeURIComponent(s.klasse),
                 'aria-label': `${klasse.bezeichnung} öffnen, ${s.von} bis ${s.bis}` }, inhalt)
      : e('div', { klasse: 'eintrag' }, inhalt);

    const li = e('li', {
      klasse: laufend === i ? 'ist-laufend' : (naechste === i ? 'ist-naechste' : '')
    }, [zeile]);

    zeilen.push({ li, marke });
    return li;
  }));

  /**
   * Setzt die Markierung neu, ohne die Seite zu zeichnen. Nur wirklich
   * geaenderte Zeilen werden angefasst — sonst flimmerte im Sekundentakt
   * die ganze Liste.
   */
  function aktualisiere() {
    const stand = markierteStunden(stunden, istHeute, uhrzeit().minuten);
    zeilen.forEach(({ li, marke }, i) => {
      const liKlasse = stand.laufend === i ? 'ist-laufend'
                     : (stand.naechste === i ? 'ist-naechste' : '');
      if (li.className !== liKlasse) li.className = liKlasse;

      const text = stand.laufend === i ? 'läuft' : (stand.naechste === i ? 'als Nächstes' : '');
      const markeKlasse = stand.laufend === i ? 'marke laufend'
                        : (stand.naechste === i ? 'marke naechste' : 'marke');
      if (marke.textContent !== text) marke.textContent = text;
      if (marke.className !== markeKlasse) marke.className = markeKlasse;
      marke.hidden = !text;
    });
  }

  return { element: tagesplanKarte(tag, [liste]), aktualisiere };
}

function bezeichneArt(s) {
  return s.art === 'DIENST' ? 'Break Duty' : (s.art === 'FUF' ? 'FuF' : s.art);
}

function artText(s) {
  const namen = { DEUTSCH: 'Deutsch', LESEN: 'Lesen', FUF: 'FuF', DIENST: 'Break Duty' };
  const grund = namen[s.art] || s.art;
  // Bei LESEN nennt zusatz die vierte Klasse, aus der Gastkinder kommen.
  // Reine Anzeigeinformation — diese Kinder werden nicht getrackt.
  if (s.art === 'LESEN' && s.zusatz) return `${grund} · ${s.zusatz}`;
  if (s.zusatz) return `${grund} · ${s.zusatz}`;
  return grund;
}

// --- Aktuelle Unterrichtseinheit --------------------------------------------

/**
 * Was steht in dieser Schulwoche an — auf beiden Spuren, mit dem Fortschritt
 * jeder Klasse. Ohne hinterlegten Schuljahresbeginn laesst sich die
 * Schulwoche nicht bestimmen; dann sagt die Karte genau das.
 */
function aktuelleEinheit(daten, tag) {
  const woche = schulwoche(tag, daten.meta.schuljahresbeginn);
  const plan = jahresplan(daten.einheiten || []);

  if (!plan.geplant.length) {
    return e('div', {}, [
      e('div', { klasse: 'leer', style: 'padding:20px 16px' }, [
        e('div', { text: 'Es ist noch keine Unterrichtseinheit eingeplant.' }),
        e('div', { klasse: 'leiste', style: 'justify-content:center;margin-top:14px' }, [
          e('a', { klasse: 'knopf', href: '#/einheiten', text: 'Jahresplan öffnen' })
        ])
      ])
    ]);
  }

  if (woche === null) {
    return e('div', {}, [
      e('div', { klasse: 'leer', style: 'padding:20px 16px' }, [
        e('div', { text: 'Für die laufende Schulwoche fehlt der Schuljahresbeginn.' }),
        e('div', { klasse: 'feldhilfe', style: 'margin-top:6px',
                   text: 'Er steht im Blatt „Meta" unter „schuljahresbeginn" (Format 2026-08-17).' }),
        e('div', { klasse: 'leiste', style: 'justify-content:center;margin-top:14px' }, [
          e('a', { klasse: 'knopf', href: '#/einheiten', text: 'Jahresplan öffnen' })
        ])
      ])
    ]);
  }

  const laufende = SPUREN
    .map((s) => ({ spur: s, einheit: einheitInWoche(plan, s.id, woche) }))
    .filter((x) => x.einheit);

  if (!laufende.length) {
    return e('div', {}, [
      e('div', { klasse: 'leer', style: 'padding:20px 16px' }, [
        e('div', { text: `Schulwoche ${woche} — dafür steht im Jahresplan nichts.` }),
        e('div', { klasse: 'leiste', style: 'justify-content:center;margin-top:14px' }, [
          e('a', { klasse: 'knopf', href: '#/einheiten', text: 'Jahresplan öffnen' })
        ])
      ])
    ]);
  }

  // Eine Einheit auf beiden Spuren erscheint sonst zweimal.
  const gezeigt = [];
  laufende.forEach((x) => {
    if (!gezeigt.some((g) => g.einheit.id === x.einheit.id)) gezeigt.push(x);
  });

  return e('div', {}, [
    e('div', { klasse: 'feldhilfe', style: 'margin-top:0', text: `Schulwoche ${woche}` }),
    ...gezeigt.map(({ spur, einheit }) => e('div', { klasse: 'laufende-einheit' }, [
      e('div', { klasse: 'leiste', style: 'margin:0' }, [
        e('div', {}, [
          e('div', { klasse: 'laufende-titel', text: einheit.titel }),
          e('div', { klasse: 'feldhilfe', text:
            `${einheit.spur === 'BEIDE' ? 'Beide Spuren' : spur.titel} · Woche ${einheit.von}` +
            (einheit.dauer_wochen > 1 ? '–' + einheit.bis : '') })
        ]),
        e('div', { klasse: 'schub' }, daten.klassen.map((k) => {
          const f = fortschrittEinheit(daten, einheit.id, k.klasse);
          return e('a', {
            klasse: 'knopf klein',
            href: '#/klasse/' + encodeURIComponent(k.klasse) + '/einheiten',
            title: `${k.bezeichnung}: ${f.erledigt} von ${f.gesamt} Teilthemen`,
            text: `${k.bezeichnung} ${f.prozent === null ? '–' : f.prozent + ' %'}`
          });
        }))
      ])
    ]))
  ]);
}

// --- Wochenaufgaben --------------------------------------------------------

function wochenkachel(aufgabe, daten, kw, tag, ferien, neuZeichnen) {
  const einstellung = AUFGABEN[aufgabe];
  const eintrag = daten.wochenstatus.find((w) => w.kw === kw && w.aufgabe === aufgabe);
  const erledigt = Boolean(eintrag);

  const link = aufgabe === 'PEAK' ? daten.meta.link_peak : daten.meta.link_weekly;

  // Aufklappbarer Bereich: ein versehentliches Antippen darf nichts ausloesen.
  const bereich = e('div', { klasse: 'kachel-bereich', hidden: true });
  const knopf = e('button', {
    klasse: erledigt ? '' : 'wichtig',
    text: erledigt ? 'Doch noch offen' : 'Als erledigt markieren'
  });

  knopf.addEventListener('click', async () => {
    knopf.disabled = true;
    try {
      await sende('wochenstatus', { kw, aufgabe, erledigt: !erledigt });
      leereDaten();
      await ladeDaten({ neu: true });
      setzeMeldung(hinweis({
        art: 'gut', zeichen: '✓',
        text: erledigt
          ? `${einstellung.titel} wieder als offen markiert.`
          : `${einstellung.titel} für diese Woche als erledigt vermerkt.`
      }));
      neuZeichnen();
    } catch (fehler) {
      knopf.disabled = false;
      bereich.appendChild(hinweis({ art: 'schlecht', zeichen: '×', text: fehler.message }));
    }
  });

  bereich.appendChild(e('div', { klasse: 'leiste', style: 'margin:0' }, [
    knopf,
    link ? e('a', { klasse: 'knopf', href: link, target: '_blank', rel: 'noopener noreferrer',
                    text: 'Dokument öffnen' })
         : e('span', { klasse: 'feldhilfe', text: 'Kein Link hinterlegt (Einstellungen).' })
  ]));

  const kopf = e('button', {
    klasse: 'kachel-kopf',
    'aria-expanded': 'false',
    auf: { click: () => {
      const zu = bereich.hidden;
      bereich.hidden = !zu;
      kopf.setAttribute('aria-expanded', String(zu));
    } }
  }, [
    e('span', { klasse: 'kachel-titel', text: einstellung.titel }),
    e('span', { klasse: 'kachel-stand',
                text: ferien ? 'pausiert' : (erledigt ? 'erledigt' : 'offen') }),
    e('span', { klasse: 'feldhilfe',
                text: ferien ? '' : (erledigt && eintrag.erledigt_am
                  ? 'am ' + alsDeutsch(zerlegeIso(eintrag.erledigt_am))
                  : einstellung.frist) })
  ]);

  return e('div', {
    klasse: 'kachel' + (ferien ? ' ruhend' : (erledigt ? ' erledigt' : ' offen'))
  }, [kopf, bereich]);
}

function zerlegeIso(iso) {
  const [jahr, monat, tag] = String(iso).slice(0, 10).split('-').map(Number);
  return { jahr, monat, tag };
}

// --- Ferienmodus -----------------------------------------------------------

function ferienschalter(ferien, neuZeichnen) {
  const knopf = e('button', {
    klasse: ferien ? 'wichtig' : '',
    text: ferien ? 'Ferienmodus beenden' : 'Ferienmodus einschalten'
  });

  knopf.addEventListener('click', async () => {
    knopf.disabled = true;
    try {
      await sende('meta', { werte: { ferienmodus: ferien ? 'FALSE' : 'TRUE' } });
      leereDaten();
      await ladeDaten({ neu: true });
      setzeMeldung(hinweis({
        art: 'gut', zeichen: '✓',
        text: ferien
          ? 'Ferienmodus beendet. Tagesplan und Wochenaufgaben sind wieder aktiv.'
          : 'Ferienmodus eingeschaltet. Er bleibt bis zum manuellen Zurückstellen aktiv.'
      }));
      neuZeichnen();
    } catch (fehler) {
      knopf.disabled = false;
      alert(fehler.message);
    }
  });

  return e('div', { klasse: 'leiste ferienleiste', style: 'margin:0' }, [
    e('span', { klasse: 'feldhilfe', text: ferien
      ? 'Keine Woche wird als versäumt gewertet.'
      : 'Blendet Tagesplan und Wochenaufgaben aus.' }),
    e('span', { klasse: 'schub' }, [knopf])
  ]);
}

// --- Klassen ---------------------------------------------------------------

function klassenknoepfe(daten, verbergen) {
  const raster = e('div', { klasse: 'klassenraster' });

  if (!daten.klassen.length) {
    raster.appendChild(e('div', { klasse: 'leer',
      text: 'Im Blatt „Klassen" ist noch keine aktive Klasse eingetragen.' }));
    return raster;
  }

  daten.klassen.forEach((k, i) => {
    const anzahl = daten.schueler.filter((s) => s.klasse === k.klasse && s.aktiv).length;
    const lehrkraft = verbergen ? null : klassenlehrkraftEintrag(k.klasse);
    const fortschritt = fortschrittKlasse(daten, k.klasse);

    // Der Kachelinhalt ist ein Link auf die Klassenseite. Der Verweis auf
    // die E-Mail-Adresse muss deshalb daneben stehen, nicht darin —
    // verschachtelte Links sind nicht zulaessig.
    raster.appendChild(e('div', {
      klasse: 'klassenknopf ' + farbklasse(k, i),
      style: k.farbe ? `--klassenfarbe:${k.farbe}` : null
    }, [
      e('a', {
        href: '#/klasse/' + encodeURIComponent(k.klasse),
        style: 'text-decoration:none;color:inherit;display:block',
        'aria-label': 'Klasse ' + k.bezeichnung + ' öffnen'
      }, [
        e('span', { klasse: 'name', text: k.bezeichnung }),
        e('span', { klasse: 'zusatz', text: anzahl + (anzahl === 1 ? ' Kind' : ' Kinder') })
      ]),
      lehrkraft ? e('span', { klasse: 'zusatz' }, [lehrkraftVerweis(lehrkraft)]) : null,
      // Anteil der abgehakten Teilthemen aller eingeplanten Einheiten.
      e('div', {
        klasse: 'balken', role: 'img',
        'aria-label': fortschritt.prozent === null
          ? 'Noch keine Unterrichtseinheiten eingeplant'
          : `Unterrichtseinheiten: ${fortschritt.prozent} % erledigt`
      }, [e('i', { style: `width:${fortschritt.prozent || 0}%` })])
    ]));
  });

  return raster;
}

// --- Merklisten: To-Do, Deadlines, Termine ----------------------------------
//
// Alle drei teilen sich Datenmodell und Sortierung (merkliste.js) und fast
// die ganze Oberflaeche — sie unterscheiden sich nur in den Eingabefeldern,
// ob abgehakt werden kann und ob eine ueberfaellige Deadline ein rotes
// Ausrufezeichen zeigt.
const MERKLISTE_KONFIG = {
  TODO: {
    datumErforderlich: false, zeitFeld: false, checkbox: true, ausrufezeichen: false,
    datumBeschriftung: 'Datum (optional)', textPlatzhalter: 'Was ist zu tun?',
    leerText: 'Noch nichts eingetragen.'
  },
  DEADLINE: {
    datumErforderlich: false, zeitFeld: true, checkbox: true, ausrufezeichen: true,
    datumBeschriftung: 'Deadline (optional)', textPlatzhalter: 'Was ist fällig?',
    leerText: 'Noch keine Deadline eingetragen.'
  },
  EVENT: {
    datumErforderlich: true, zeitFeld: true, checkbox: false, ausrufezeichen: false,
    datumBeschriftung: 'Datum', textPlatzhalter: 'Was steht an?',
    leerText: 'Noch kein Termin eingetragen.'
  }
};

/** „Freitag, 28.8." bzw. mit Uhrzeit „Freitag, 28.8. · 14:00". Ohne Datum: nichts. */
function formatiereFaelligkeit(eintrag) {
  if (!eintrag.datum) return '';
  const tag = zerlegeIso(eintrag.datum);
  const text = `${wochentagName(wochentag(tag))}, ${tag.tag}.${tag.monat}.`;
  return eintrag.uhrzeit ? `${text} · ${eintrag.uhrzeit}` : text;
}

/**
 * Eine der drei Merklisten. Aendert sich etwas (neuer Eintrag, Haken
 * gesetzt), zeichnet die Funktion nur ihre eigene Liste neu — ein
 * Seitenweites neuZeichnen() ist dafuer nicht noetig, die Aenderung betrifft
 * ja nur dieses eine Widget.
 */
function merklisteWidget(daten, typ, tag) {
  const konfig = MERKLISTE_KONFIG[typ];
  const heuteIso = alsIso(tag);

  // Auf Enter abschicken, egal in welchem Feld — nicht nur per Klick auf
  // „Hinzufügen". Ein <form>-Element bräuchte es dafür nicht: preventDefault
  // reicht, weil die Felder ohnehin in keinem <form> stecken.
  function aufEingabetaste(ev) {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    hinzufuegen();
  }

  const liste = e('ul', { klasse: 'merkliste-liste' });
  const textFeld = e('input', {
    type: 'text', placeholder: konfig.textPlatzhalter, 'aria-label': 'Text',
    autocomplete: 'off', auf: { keydown: aufEingabetaste }
  });
  const datumFeld = e('input', {
    type: 'date', 'aria-label': konfig.datumBeschriftung, auf: { keydown: aufEingabetaste }
  });
  const zeitFeld = konfig.zeitFeld
    ? e('input', { type: 'time', 'aria-label': 'Uhrzeit (optional)', auf: { keydown: aufEingabetaste } })
    : null;
  const fehlerZeile = e('div', { klasse: 'feldhilfe merkliste-fehler', hidden: true });

  const formular = e('div', { klasse: 'merkliste-formular', hidden: true }, [
    e('div', { klasse: 'merkliste-felder' }, [textFeld, datumFeld, zeitFeld].filter(Boolean)),
    fehlerZeile,
    e('div', { klasse: 'leiste', style: 'margin:8px 0 0' }, [
      e('button', { klasse: 'klein wichtig', text: 'Hinzufügen', auf: { click: hinzufuegen } }),
      e('button', { klasse: 'klein leise', text: 'Abbrechen', auf: { click: () => { formular.hidden = true; } } })
    ])
  ]);

  const plusKnopf = e('button', {
    klasse: 'klein merkliste-plus', text: '+', title: 'Eintrag hinzufügen',
    'aria-label': 'Eintrag hinzufügen',
    auf: { click: () => {
      formular.hidden = !formular.hidden;
      if (!formular.hidden) textFeld.focus();
    } }
  });

  // Liste und Knopf in derselben Zeile: die Eintraege beginnen dadurch direkt
  // oben, quasi neben dem Knopf, statt unter einer eigenen, sonst leeren
  // Kopfzeile zu haengen.
  const wrapper = e('div', { klasse: 'merkliste' }, [
    formular,
    e('div', { klasse: 'merkliste-reihe' }, [liste, plusKnopf])
  ]);
  zeichneListe();
  return wrapper;

  function zeigeFehler(text) {
    fehlerZeile.textContent = text;
    fehlerZeile.hidden = false;
  }

  function hinzufuegen() {
    const text = textFeld.value.trim();
    const datum = datumFeld.value;
    const uhrzeit = zeitFeld ? zeitFeld.value : '';
    fehlerZeile.hidden = true;

    if (!text) { zeigeFehler('Bitte einen Text eingeben.'); return; }
    if (konfig.datumErforderlich && !datum) { zeigeFehler('Bitte ein Datum eingeben.'); return; }

    const id = crypto.randomUUID();
    fuegeLokalHinzu(daten, {
      id, typ, text, datum, uhrzeit, erledigt: false, erstellt_am: new Date().toISOString()
    });
    textFeld.value = '';
    datumFeld.value = '';
    if (zeitFeld) zeitFeld.value = '';
    formular.hidden = true;
    zeichneListe();

    sende('merklisteHinzufuegen', { id, typ, text, datum, uhrzeit }).catch((fehler) => {
      entferneLokal(daten, id);
      zeichneListe();
      window.alert('Eintrag konnte nicht gespeichert werden: ' + fehler.message);
    });
  }

  function umschalten(eintrag, checked) {
    const vorher = setzeErledigtLokal(daten, eintrag.id, checked);
    zeichneListe();
    sende('merklisteErledigt', { id: eintrag.id, erledigt: checked }).catch((fehler) => {
      setzeErledigtLokal(daten, eintrag.id, vorher);
      zeichneListe();
      window.alert('Änderung konnte nicht gespeichert werden: ' + fehler.message);
    });
  }

  function zeichneListe() {
    leere(liste);
    const eintraege = eintraegeFuerTyp(daten, typ);
    if (!eintraege.length) {
      liste.appendChild(e('div', { klasse: 'leer', style: 'padding:8px 2px', text: konfig.leerText }));
      return;
    }
    eintraege.forEach((eintrag) => liste.appendChild(zeile(eintrag)));
  }

  function zeile(eintrag) {
    const faellig = konfig.ausrufezeichen && istUeberfaellig(eintrag, heuteIso);
    const faelligkeitText = formatiereFaelligkeit(eintrag);
    const inhalt = e('div', { klasse: 'merkliste-inhalt' }, [
      e('span', { klasse: 'merkliste-text', text: eintrag.text }),
      faelligkeitText ? e('span', { klasse: 'feldhilfe merkliste-datum', text: faelligkeitText }) : null
    ]);

    const kinder = [];
    if (konfig.checkbox) {
      const kasten = e('input', {
        type: 'checkbox', checked: eintrag.erledigt, 'aria-label': eintrag.text,
        auf: { change: (ev) => umschalten(eintrag, ev.target.checked) }
      });
      kinder.push(e('label', { klasse: 'merkliste-zeile' }, [kasten, inhalt]));
    } else {
      kinder.push(inhalt);
    }
    if (faellig) {
      kinder.push(e('span', {
        klasse: 'merkliste-ausruf', 'aria-label': 'Deadline heute oder überfällig', text: '!'
      }));
    }

    return e('li', { klasse: eintrag.erledigt ? 'ist-erledigt' : '' }, kinder);
  }
}

/**
 * Name der Klassenlehrkraft, bei hinterlegter Adresse als mailto-Verweis.
 * Name und Adresse stammen aus der lokalen Zuordnungsdatei und verlassen
 * das Geraet nicht.
 */
export function lehrkraftVerweis(lehrkraft) {
  if (!lehrkraft) return null;
  if (!lehrkraft.email) return e('span', { text: lehrkraft.name });
  return e('a', {
    klasse: 'lehrkraft',
    href: 'mailto:' + encodeURIComponent(lehrkraft.email).replace(/%40/g, '@'),
    title: 'E-Mail an ' + lehrkraft.name,
    text: lehrkraft.name
  });
}

/**
 * Farbe der Klasse. Steht im Blatt Klassen nichts, greift eine Palette
 * nach Reihenfolge — nichts davon ist an eine bestimmte Klasse gebunden.
 */
function farbklasse(k, i) {
  if (k.farbe) return '';
  return 'k-farbe-' + (((k.reihenfolge || i + 1) - 1) % 5 + 1);
}

function istWahr(wert) {
  const t = String(wert || '').trim().toLowerCase();
  return t === 'true' || t === 'wahr' || t === '1' || t === 'ja';
}
