/**
 * ansichten/einheiten.js — Jahresplan der Unterrichtseinheiten.
 *
 * Zwei Spalten (Rechtschreibung, Grammatik) auf einer Wochenleiste, darunter
 * ein Vorrat fuer noch nicht eingeplante Einheiten. Jede Einheit ist eine
 * Box, die sich in eine andere Woche oder auf die andere Spur ziehen laesst.
 *
 * Die Startwoche wird nicht gespeichert, sondern aus Reihenfolge und Dauer
 * gerechnet (siehe einheiten.js). Ein Verschieben schiebt deshalb alles
 * Nachfolgende mit — genau das, was beim Umplanen eines Schuljahres
 * gebraucht wird, und es kann dabei weder eine Luecke noch eine
 * Ueberschneidung entstehen.
 *
 * ZIEHEN UND TIPPEN: Das Ziehen laeuft ueber die Zeigereignisse des Browsers
 * und funktioniert dadurch mit Maus und mit dem Finger gleichermassen. Fuer
 * die Tastatur — und wenn Ziehen einmal haken sollte — traegt jede Box
 * zusaetzlich zwei Pfeilknoepfe.
 *
 * DATENSCHUTZ: Diese Ansicht kennt weder Kuerzel noch Namen. Der Fortschritt
 * je Klasse haengt an der Klassenbezeichnung, die ohnehin in der Tabelle steht.
 */

import { e, leere, karte, hinweis, setzeMeldung } from '../ui.js';
import { sende, leereDaten, ladeDaten } from '../server.js';
import { gehe } from '../router.js';
import { heute } from '../zeit.js';
import {
  SPUREN, spurTitel, jahresplan, verschiebe, setzeReihenfolgeLokal,
  teilthemenFuer, fortschrittEinheit, schulwoche
} from '../einheiten.js';

/** Welche Einheit ist aufgeklappt — ueberlebt ein neuZeichnen(). */
const zustand = { offeneEinheit: null };

export function zeichneEinheiten(ziel, kontext) {
  const { daten, neuZeichnen } = kontext;
  const plan = jahresplan(daten.einheiten || []);
  const aktuelleWoche = schulwoche(heute(), daten.meta.schuljahresbeginn);

  ziel.appendChild(e('div', { klasse: 'leiste' }, [
    e('div', {}, [
      e('h1', { text: 'Unterrichtseinheiten' }),
      e('div', { klasse: 'feldhilfe', text: aktuelleWoche
        ? `Jahresplan · aktuell Schulwoche ${aktuelleWoche}`
        : 'Jahresplan · für die aktuelle Woche fehlt der Schuljahresbeginn in den Einstellungen' })
    ]),
    e('div', { klasse: 'schub' }, [
      e('button', { text: 'Neue Einheit', auf: { click: () => neueEinheit(daten, neuZeichnen) } })
    ])
  ]));

  if (!daten.einheiten || !daten.einheiten.length) {
    ziel.appendChild(hinweis({
      art: 'warn', zeichen: '→', titel: 'Noch keine Unterrichtseinheiten',
      text: 'Im Blatt „Einheiten" steht noch nichts. Der vorbereitete Jahresplan lässt sich in der ' +
            'Tabelle über „Kommandozentrale → Jahresplan einfügen" eintragen — oder du legst hier ' +
            'eine erste Einheit von Hand an.'
    }));
    return;
  }

  const statusEl = e('span', { klasse: 'feldhilfe' });

  /** Verschiebt eine Einheit und schreibt die neue Ordnung weg. */
  async function verschiebeEinheit(id, zielSpur, zielId) {
    const saetze = verschiebe(daten.einheiten, id, zielSpur, zielId);
    if (!saetze) return;

    // Vorherigen Stand merken, damit ein fehlgeschlagener Aufruf die
    // Anzeige nicht mit einem Plan zuruecklaesst, den die Tabelle nicht hat.
    const vorher = daten.einheiten.map((x) => ({ id: x.id, spur: x.spur, reihenfolge: x.reihenfolge }));
    setzeReihenfolgeLokal(daten, saetze);
    neuZeichnen();

    try {
      await sende('einheitenReihenfolge', { saetze });
    } catch (fehler) {
      setzeReihenfolgeLokal(daten, vorher);
      window.alert('Der Plan konnte nicht gespeichert werden: ' + fehler.message);
      neuZeichnen();
    }
  }

  ziel.appendChild(karte(null, [
    e('div', { klasse: 'feldhilfe', style: 'margin-top:0', text:
      'Einheiten lassen sich mit der Maus oder dem Finger in eine andere Woche oder auf die andere ' +
      'Spur ziehen; die Pfeilknöpfe tun dasselbe. Die Wochen rechnen sich neu — Lücken oder ' +
      'Überschneidungen können dabei nicht entstehen.' }),
    statusEl,
    rasterBauen(daten, plan, aktuelleWoche, verschiebeEinheit, neuZeichnen)
  ]));

  ziel.appendChild(e('div', { klasse: 'abschnitt-titel', text: 'Nicht eingeplant' }));
  ziel.appendChild(vorratBauen(daten, plan, verschiebeEinheit, neuZeichnen));
}

// --- Raster -----------------------------------------------------------------

function rasterBauen(daten, plan, aktuelleWoche, verschiebeEinheit, neuZeichnen) {
  const raster = e('div', { klasse: 'jahresraster' });

  raster.appendChild(e('div', { klasse: 'jahresraster-kopf woche', text: 'Woche' }));
  SPUREN.forEach((s) => raster.appendChild(
    e('div', { klasse: 'jahresraster-kopf', text: s.titel })));

  // Wochenleiste und leere Zellen liegen unter den Boxen; die Boxen selbst
  // werden anschliessend per grid-row darueber gelegt.
  for (let w = 1; w <= plan.wochen; w++) {
    raster.appendChild(e('div', {
      klasse: 'jahreswoche' + (w === aktuelleWoche ? ' ist-jetzt' : ''),
      style: `grid-row:${w + 1}`,
      text: String(w)
    }));
    SPUREN.forEach((s, i) => raster.appendChild(e('div', {
      klasse: 'jahreszelle', style: `grid-row:${w + 1};grid-column:${i + 2}`
    })));
  }

  plan.geplant.forEach((einheit) => {
    const spalte = einheit.spur === 'BEIDE' ? '2 / span 2'
                 : (einheit.spur === 'RS' ? '2' : '3');
    raster.appendChild(einheitBox(daten, einheit, {
      style: `grid-row:${einheit.von + 1} / span ${einheit.dauer_wochen};grid-column:${spalte}`,
      verschiebeEinheit, neuZeichnen, plan
    }));
  });

  return e('div', { klasse: 'jahresrahmen' }, [raster]);
}

function vorratBauen(daten, plan, verschiebeEinheit, neuZeichnen) {
  const behaelter = e('div', { klasse: 'jahresvorrat', daten: { spur: '' } });

  if (!plan.vorrat.length) {
    behaelter.appendChild(e('div', { klasse: 'leer', style: 'padding:16px',
      text: 'Alle Einheiten sind eingeplant. Hierher gezogene Einheiten fallen aus dem Plan, ohne gelöscht zu werden.' }));
  } else {
    plan.vorrat.forEach((einheit) => behaelter.appendChild(
      einheitBox(daten, einheit, { verschiebeEinheit, neuZeichnen, plan })));
  }
  return behaelter;
}

// --- Eine Einheit als Box ----------------------------------------------------

function einheitBox(daten, einheit, { style, verschiebeEinheit, neuZeichnen, plan }) {
  const offen = zustand.offeneEinheit === einheit.id;
  const themen = teilthemenFuer(daten, einheit.id);

  const kopf = e('button', {
    klasse: 'einheit-kopf',
    'aria-expanded': String(offen),
    auf: { click: () => {
      zustand.offeneEinheit = offen ? null : einheit.id;
      neuZeichnen();
    } }
  }, [
    e('span', { klasse: 'einheit-titel', text: einheit.titel }),
    e('span', { klasse: 'einheit-zusatz', text: einheit.von
      ? `Woche ${einheit.von}${einheit.dauer_wochen > 1 ? '–' + einheit.bis : ''} · ` +
        `${themen.length} ${themen.length === 1 ? 'Teilthema' : 'Teilthemen'}`
      : `${themen.length} ${themen.length === 1 ? 'Teilthema' : 'Teilthemen'}` })
  ]);

  const box = e('div', {
    klasse: 'einheit-box spur-' + (einheit.spur || 'frei').toLowerCase() + (offen ? ' offen' : ''),
    style: style || null,
    daten: { id: einheit.id, spur: einheit.spur || '' }
  }, [
    e('div', { klasse: 'einheit-griff', title: 'Zum Verschieben ziehen', 'aria-hidden': 'true' }),
    kopf,
    e('div', { klasse: 'einheit-knoepfe' }, [
      e('button', {
        klasse: 'klein leise', text: '↑', title: 'Eine Position früher',
        'aria-label': einheit.titel + ' eine Position früher',
        auf: { click: (ev) => { ev.stopPropagation(); nachbarTausch(plan, einheit, -1, verschiebeEinheit); } }
      }),
      e('button', {
        klasse: 'klein leise', text: '↓', title: 'Eine Position später',
        'aria-label': einheit.titel + ' eine Position später',
        auf: { click: (ev) => { ev.stopPropagation(); nachbarTausch(plan, einheit, 1, verschiebeEinheit); } }
      })
    ]),
    offen ? einheitBereich(daten, einheit, themen, neuZeichnen, verschiebeEinheit) : null
  ]);

  ziehbarMachen(box, einheit, verschiebeEinheit);
  return box;
}

/**
 * Tauscht die Einheit mit ihrer Nachbarin auf derselben Spur. Ueber die
 * Pfeilknoepfe erreichbar, damit der Plan auch ohne Ziehen umzustellen ist.
 */
function nachbarTausch(plan, einheit, richtung, verschiebeEinheit) {
  const spur = einheit.spur;
  if (!spur) return;

  const aufSpur = plan.geplant.filter((x) => x.spur === spur || x.spur === 'BEIDE' || spur === 'BEIDE');
  const i = aufSpur.findIndex((x) => x.id === einheit.id);
  const ziel = aufSpur[i + richtung];
  if (!ziel) return;

  // Nach oben: vor die Vorgaengerin. Nach unten: vor die Uebernaechste,
  // ersatzweise ans Ende der Spur.
  const zielId = richtung < 0 ? ziel.id : (aufSpur[i + 2] ? aufSpur[i + 2].id : null);
  verschiebeEinheit(einheit.id, spur, zielId);
}

// --- Aufgeklappter Bereich einer Einheit ------------------------------------

function einheitBereich(daten, einheit, themen, neuZeichnen, verschiebeEinheit) {
  const liste = themen.length
    ? e('ol', { klasse: 'teilthemenliste' }, themen.map((t) => e('li', {}, [
        e('span', { text: t.titel }),
        e('button', {
          klasse: 'klein leise', text: 'Entfernen', 'aria-label': 'Teilthema entfernen: ' + t.titel,
          auf: { click: () => teilthemaLoeschen(daten, t, neuZeichnen) }
        })
      ])))
    : e('div', { klasse: 'feldhilfe', text: 'Noch keine Teilthemen.' });

  return e('div', { klasse: 'einheit-bereich' }, [
    einheit.beschreibung ? e('div', { klasse: 'feldhilfe', text: einheit.beschreibung }) : null,
    liste,
    e('div', { klasse: 'leiste', style: 'margin:10px 0 0' }, [
      e('button', { klasse: 'klein', text: 'Teilthema hinzufügen',
                    auf: { click: () => teilthemaAnlegen(daten, einheit, neuZeichnen) } }),
      e('button', { klasse: 'klein', text: 'Bearbeiten',
                    auf: { click: () => einheitBearbeiten(daten, einheit, neuZeichnen) } }),
      einheit.spur
        ? e('button', { klasse: 'klein leise', text: 'Aus dem Plan nehmen',
                        auf: { click: () => verschiebeEinheit(einheit.id, '', null) } })
        : e('button', { klasse: 'klein', text: 'In den Plan',
                        auf: { click: () => verschiebeEinheit(einheit.id, 'RS', null) } }),
      e('button', { klasse: 'klein leise', text: 'Löschen',
                    auf: { click: () => einheitLoeschen(daten, einheit, neuZeichnen) } })
    ])
  ]);
}

// --- Ziehen ------------------------------------------------------------------

/**
 * Ziehen ueber Zeigereignisse statt ueber die Ziehschnittstelle des Browsers:
 * jene loest auf Tablets gar nicht aus, und genau dort wird der Plan am
 * ehesten umgestellt.
 */
function ziehbarMachen(box, einheit, verschiebeEinheit) {
  const griff = box.querySelector('.einheit-griff');
  if (!griff) return;

  griff.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    griff.setPointerCapture(ev.pointerId);

    box.classList.add('wird-gezogen');
    let ziel = null;

    function markiere(neuesZiel) {
      if (ziel === neuesZiel) return;
      if (ziel) ziel.element.classList.remove('ist-ziel');
      ziel = neuesZiel;
      if (ziel) ziel.element.classList.add('ist-ziel');
    }

    function bewegen(e2) {
      markiere(zielUnter(e2.clientX, e2.clientY, einheit.id));
    }

    function loslassen() {
      griff.removeEventListener('pointermove', bewegen);
      griff.removeEventListener('pointerup', loslassen);
      griff.removeEventListener('pointercancel', loslassen);
      box.classList.remove('wird-gezogen');
      if (ziel) {
        ziel.element.classList.remove('ist-ziel');
        verschiebeEinheit(einheit.id, ziel.spur, ziel.vorId);
      }
    }

    griff.addEventListener('pointermove', bewegen);
    griff.addEventListener('pointerup', loslassen);
    griff.addEventListener('pointercancel', loslassen);
  });
}

/**
 * Was liegt unter dem Zeiger? Entweder eine leere Rasterzelle (dann zaehlt
 * die Spur und die Einheit, die dort beginnt) oder eine andere Box (dann
 * wird davor einsortiert) oder der Vorrat.
 */
function zielUnter(x, y, eigeneId) {
  const treffer = document.elementsFromPoint(x, y);

  for (const el of treffer) {
    if (el.classList.contains('jahresvorrat')) {
      return { element: el, spur: '', vorId: null };
    }

    const box = el.closest && el.closest('.einheit-box');
    if (box && box.dataset.id !== eigeneId) {
      return { element: box, spur: box.dataset.spur || '', vorId: box.dataset.id };
    }

    if (el.classList.contains('jahreszelle')) {
      const spalte = Number(getComputedStyle(el).gridColumnStart);
      return { element: el, spur: spalte === 3 ? 'GR' : 'RS', vorId: null };
    }
  }
  return null;
}

// --- Aktionen ----------------------------------------------------------------

async function neueEinheit(daten, neuZeichnen) {
  const titel = window.prompt('Titel der neuen Unterrichtseinheit:');
  if (!titel || !titel.trim()) return;

  const id = 'neu-' + Date.now();
  const einheit = {
    id, titel: titel.trim(), beschreibung: '', reihenfolge: 9999,
    geplante_stunden: null, lehrplanbezug: '', status: 'geplant',
    spur: '', dauer_wochen: 1
  };
  daten.einheiten.push(einheit);
  zustand.offeneEinheit = id;
  neuZeichnen();

  try {
    await sende('einheitErstellen', { titel: einheit.titel, spur: '', dauer_wochen: 1, id });
  } catch (fehler) {
    const i = daten.einheiten.findIndex((x) => x.id === id);
    if (i !== -1) daten.einheiten.splice(i, 1);
    window.alert('Die Einheit konnte nicht angelegt werden: ' + fehler.message);
    neuZeichnen();
  }
}

async function einheitBearbeiten(daten, einheit, neuZeichnen) {
  const titel = window.prompt('Titel der Einheit:', einheit.titel);
  if (titel === null) return;
  const dauerText = window.prompt('Dauer in Wochen:', String(einheit.dauer_wochen || 1));
  if (dauerText === null) return;

  const dauer = Number(dauerText);
  if (!Number.isInteger(dauer) || dauer < 1 || dauer > 40) {
    window.alert('Die Dauer muss eine ganze Zahl zwischen 1 und 40 Wochen sein.');
    return;
  }

  const vorher = { titel: einheit.titel, dauer_wochen: einheit.dauer_wochen };
  einheit.titel = titel.trim() || einheit.titel;
  einheit.dauer_wochen = dauer;
  neuZeichnen();

  try {
    await sende('einheitAktualisieren', {
      id: einheit.id, titel: einheit.titel, beschreibung: einheit.beschreibung || '',
      lehrplanbezug: einheit.lehrplanbezug || '', dauer_wochen: dauer,
      geplante_stunden: einheit.geplante_stunden === null ? '' : einheit.geplante_stunden
    });
  } catch (fehler) {
    Object.assign(einheit, vorher);
    window.alert('Die Änderung konnte nicht gespeichert werden: ' + fehler.message);
    neuZeichnen();
  }
}

async function einheitLoeschen(daten, einheit, neuZeichnen) {
  const i = daten.einheiten.findIndex((x) => x.id === einheit.id);
  if (i === -1) return;
  const entfernt = daten.einheiten.splice(i, 1)[0];
  const themen = teilthemenFuer(daten, einheit.id);
  daten.teilthemen = (daten.teilthemen || []).filter((t) => t.einheit_id !== einheit.id);
  if (zustand.offeneEinheit === einheit.id) zustand.offeneEinheit = null;
  neuZeichnen();

  try {
    await sende('einheitLoeschen', { id: einheit.id });
  } catch (fehler) {
    daten.einheiten.splice(i, 0, entfernt);
    themen.forEach((t) => daten.teilthemen.push(t));
    window.alert('Die Einheit konnte nicht gelöscht werden: ' + fehler.message);
    neuZeichnen();
  }
}

async function teilthemaAnlegen(daten, einheit, neuZeichnen) {
  const titel = window.prompt('Titel des Teilthemas:');
  if (!titel || !titel.trim()) return;

  const id = 'neu-t-' + Date.now();
  const vorhandene = teilthemenFuer(daten, einheit.id);
  const thema = {
    id, einheit_id: einheit.id, titel: titel.trim(),
    reihenfolge: vorhandene.length + 1
  };
  if (!daten.teilthemen) daten.teilthemen = [];
  daten.teilthemen.push(thema);
  neuZeichnen();

  try {
    await sende('teilthemaErstellen', { einheit_id: einheit.id, titel: thema.titel, id });
  } catch (fehler) {
    const i = daten.teilthemen.findIndex((t) => t.id === id);
    if (i !== -1) daten.teilthemen.splice(i, 1);
    window.alert('Das Teilthema konnte nicht angelegt werden: ' + fehler.message);
    neuZeichnen();
  }
}

async function teilthemaLoeschen(daten, thema, neuZeichnen) {
  const i = daten.teilthemen.findIndex((t) => t.id === thema.id);
  if (i === -1) return;
  const entfernt = daten.teilthemen.splice(i, 1)[0];
  const fortschritt = (daten.einheitFortschritt || []).filter((f) => f.teilthema_id === thema.id);
  daten.einheitFortschritt = (daten.einheitFortschritt || [])
    .filter((f) => f.teilthema_id !== thema.id);
  neuZeichnen();

  try {
    await sende('teilthemaLoeschen', { id: thema.id });
  } catch (fehler) {
    daten.teilthemen.splice(i, 0, entfernt);
    fortschritt.forEach((f) => daten.einheitFortschritt.push(f));
    window.alert('Das Teilthema konnte nicht gelöscht werden: ' + fehler.message);
    neuZeichnen();
  }
}
