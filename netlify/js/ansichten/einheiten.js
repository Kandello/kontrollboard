/**
 * ansichten/einheiten.js — Jahresplan der Unterrichtseinheiten.
 *
 * Zwei Spuren (Rechtschreibung, Grammatik) auf einer Wochenleiste, darunter
 * ein Vorrat fuer noch nicht eingeplante Einheiten. Jede Einheit ist eine
 * Box, die sich in eine andere Woche oder auf die andere Spur ziehen laesst.
 *
 * Die Startwoche wird nicht gespeichert, sondern aus Reihenfolge und Dauer
 * gerechnet (siehe einheiten.js). Ein Verschieben schiebt deshalb alles
 * Nachfolgende mit — genau das, was beim Umplanen eines Schuljahres
 * gebraucht wird, und es kann dabei weder eine Luecke noch eine
 * Ueberschneidung entstehen.
 *
 * ZIEHEN MIT VORSCHAU: Waehrend des Ziehens haengt die Einheit am Zeiger,
 * und der Plan darunter ordnet sich bei jeder Bewegung schon so, wie er nach
 * dem Loslassen aussehen wird — die uebrigen Einheiten gleiten aus dem Weg.
 * Ohne diese Vorschau war nicht abzusehen, wo eine Einheit landet: Ziel war
 * immer die Box unter dem Zeiger, und weil sich nichts bewegte, liess sich
 * praktisch nur eine Position weit verschieben.
 *
 * Das Ziel wird deshalb nicht mehr aus der Box unter dem Zeiger bestimmt,
 * sondern aus der WOCHE unter dem Zeiger: die Einheit rutscht dorthin, wo
 * die Woche liegt, unabhaengig davon, wie weit gezogen wurde.
 *
 * Das Ziehen laeuft ueber Zeigereignisse und funktioniert dadurch mit Maus
 * und Finger gleichermassen. Fuer die Tastatur — und wenn Ziehen einmal
 * haken sollte — traegt jede Box zusaetzlich zwei Pfeilknoepfe.
 *
 * DATENSCHUTZ: Diese Ansicht kennt weder Kuerzel noch Namen.
 */

import { e, karte, hinweis } from '../ui.js';
import { sende } from '../server.js';
import { heute } from '../zeit.js';
import {
  SPUREN, jahresplan, verschiebe, setzeReihenfolgeLokal,
  teilthemenFuer, schulwoche
} from '../einheiten.js';

/** Welche Einheit ist aufgeklappt — ueberlebt ein neuZeichnen(). */
const zustand = { offeneEinheit: null };

/** Dauer der Umsortier-Animation. Kurz genug, um nicht zu bremsen. */
const GLEITDAUER = 170;

/**
 * Ein Schuljahr ist laenger als jeder Bildschirm. Kommt der Zeiger beim
 * Ziehen in diesen Randstreifen, rollt die Seite mit — sonst liesse sich
 * eine Einheit nur so weit schieben, wie gerade sichtbar ist.
 */
const ROLLRAND = 90;
const ROLLTEMPO = 18;

/** So viele Pixel Bewegung, bevor aus einem Klick ein Zug wird. */
const ZIEHSCHWELLE = 5;

/**
 * Rechtschreibung und Grammatik bleiben getrennt: eine eingeplante Einheit
 * behaelt ihre Spur, egal ueber welcher Spalte losgelassen wird. Nur was im
 * Vorrat liegt, hat noch keine Spur und darf in beide.
 */
function erlaubteSpur(eigeneSpur, zellenSpur) {
  if (!eigeneSpur) return zellenSpur;
  return eigeneSpur;
}

export function zeichneEinheiten(ziel, kontext) {
  const { daten, neuZeichnen } = kontext;
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
  const boxen = new Map();     // id -> Box-Element
  const zusatzEl = new Map();  // id -> Element mit „Woche X–Y · N Teilthemen"

  const raster = e('div', { klasse: 'jahresraster' });
  const vorratBehaelter = e('div', { klasse: 'jahresvorrat' });
  const vorratLeer = e('div', { klasse: 'leer', style: 'padding:16px',
    text: 'Alle Einheiten sind eingeplant. Hierher gezogene Einheiten fallen aus dem Plan, ohne gelöscht zu werden.' });

  /** Baut Wochenleiste und Ablageflaechen fuer so viele Wochen wie noetig. */
  let gezeichneteWochen = 0;
  function baueWochen(anzahl) {
    for (let w = gezeichneteWochen + 1; w <= anzahl; w++) {
      raster.appendChild(e('div', {
        klasse: 'jahreswoche' + (w === aktuelleWoche ? ' ist-jetzt' : ''),
        style: `grid-row:${w + 1}`, daten: { woche: String(w) }, text: String(w)
      }));
      SPUREN.forEach((s, i) => raster.appendChild(e('div', {
        klasse: 'jahreszelle', style: `grid-row:${w + 1};grid-column:${i + 2}`,
        daten: { woche: String(w), spur: s.id }
      })));
    }
    gezeichneteWochen = Math.max(gezeichneteWochen, anzahl);
  }

  raster.appendChild(e('div', { klasse: 'jahresraster-kopf woche', text: 'Woche' }));
  SPUREN.forEach((s) => raster.appendChild(
    e('div', { klasse: 'jahresraster-kopf spur-' + s.id.toLowerCase(), text: s.titel })));

  daten.einheiten.forEach((einheit) => {
    const { box, zusatz } = einheitBox(daten, einheit, {
      neuZeichnen, starteZiehen, verschiebeUeberKnopf, aktuellerPlan: () => jahresplan(daten.einheiten)
    });
    boxen.set(einheit.id, box);
    zusatzEl.set(einheit.id, zusatz);
  });

  /**
   * Legt alle Boxen an die Stellen, die ein Plan vorgibt.
   * `animiert` misst vorher und nachher und laesst die Boxen die Differenz
   * herübergleiten (FLIP) — ein Wechsel der Rasterzeile allein liesse sich
   * nicht weich darstellen.
   */
  function platziere(plan, animiert) {
    const vorher = animiert ? messeAlle(boxen) : null;

    baueWochen(plan.wochen);

    plan.geplant.forEach((einheit) => {
      const box = boxen.get(einheit.id);
      if (!box) return;
      const spalte = einheit.spur === 'BEIDE' ? '2 / span 2' : (einheit.spur === 'RS' ? '2' : '3');
      if (box.parentElement !== raster) raster.appendChild(box);
      box.style.gridRow = `${einheit.von + 1} / span ${einheit.dauer_wochen}`;
      box.style.gridColumn = spalte;
      setzeKlasse(box, einheit);
      box.dataset.spur = einheit.spur;
      setzeZusatz(einheit);
    });

    plan.vorrat.forEach((einheit) => {
      const box = boxen.get(einheit.id);
      if (!box) return;
      if (box.parentElement !== vorratBehaelter) vorratBehaelter.appendChild(box);
      box.style.gridRow = '';
      box.style.gridColumn = '';
      setzeKlasse(box, einheit);
      box.dataset.spur = '';
      setzeZusatz(einheit);
    });

    vorratLeer.hidden = plan.vorrat.length > 0;

    if (animiert) gleite(boxen, vorher);
  }

  function setzeZusatz(einheit) {
    const el = zusatzEl.get(einheit.id);
    if (!el) return;
    const anzahl = teilthemenFuer(daten, einheit.id).length;
    const themenText = `${anzahl} ${anzahl === 1 ? 'Teilthema' : 'Teilthemen'}`;
    el.textContent = einheit.von
      ? `Woche ${einheit.von}${einheit.dauer_wochen > 1 ? '–' + einheit.bis : ''} · ${themenText}`
      : themenText;
  }

  /**
   * Die Markierung des Platzhalters ueberlebt ein Umplatzieren — sonst
   * verschwaende der Umriss beim ersten Vorschauschritt wieder, also genau
   * dann, wenn er gebraucht wird.
   */
  function setzeKlasse(box, einheit) {
    const platzhalter = box.classList.contains('ist-platzhalter');
    box.className = 'einheit-box spur-' + (einheit.spur || 'frei').toLowerCase() +
      (zustand.offeneEinheit === einheit.id ? ' offen' : '') +
      (platzhalter ? ' ist-platzhalter' : '');
  }

  /** Wendet eine neue Ordnung an: erst lokal zeichnen, dann wegschreiben. */
  async function uebernimm(ordnung) {
    const vorherigerStand = daten.einheiten.map((x) =>
      ({ id: x.id, spur: x.spur, reihenfolge: x.reihenfolge }));

    setzeReihenfolgeLokal(daten, ordnung);
    platziere(jahresplan(daten.einheiten), true);
    statusEl.textContent = 'wird gespeichert …';
    statusEl.className = 'feldhilfe';

    try {
      await sende('einheitenReihenfolge', { saetze: ordnung });
      statusEl.textContent = 'gespeichert';
      statusEl.className = 'feldhilfe status-gut';
    } catch (fehler) {
      setzeReihenfolgeLokal(daten, vorherigerStand);
      platziere(jahresplan(daten.einheiten), true);
      statusEl.textContent = 'nicht gespeichert — ' + fehler.message;
      statusEl.className = 'feldhilfe status-schlecht';
    }
  }

  function verschiebeUeberKnopf(einheitId, richtung) {
    const plan = jahresplan(daten.einheiten);
    const eigen = plan.geplant.find((x) => x.id === einheitId);
    if (!eigen) return;

    const aufSpur = plan.geplant.filter((x) =>
      x.spur === eigen.spur || x.spur === 'BEIDE' || eigen.spur === 'BEIDE');
    const i = aufSpur.findIndex((x) => x.id === einheitId);
    if (!aufSpur[i + richtung]) return;

    const zielId = richtung < 0
      ? aufSpur[i - 1].id
      : (aufSpur[i + 2] ? aufSpur[i + 2].id : null);
    const ordnung = verschiebe(daten.einheiten, einheitId, eigen.spur, zielId);
    if (ordnung) uebernimm(ordnung);
  }

  // --- Ziehen mit laufender Vorschau ----------------------------------------

  function starteZiehen(ev, einheitId) {
    // Nur die linke Maustaste zieht; Rechtsklick und Mausrad nicht.
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;

    const box = boxen.get(einheitId);
    const eigeneSpur = box.dataset.spur || '';
    const startX = ev.clientX;
    const startY = ev.clientY;

    // Grundriss ohne die gezogene Einheit: daran wird abgelesen, vor welche
    // Einheit sie gehoert, wenn der Zeiger ueber einer bestimmten Woche steht.
    const ohneEigene = daten.einheiten.filter((x) => x.id !== einheitId);
    let letzteWahl = null;
    let ordnung = null;
    let zeigerX = startX;
    let zeigerY = startY;
    let zieht = false;      // erst ab der Schwelle wird wirklich gezogen
    let beendet = false;
    let flug = null;
    let versatzX = 0;
    let versatzY = 0;

    /**
     * Der Zug beginnt erst nach ein paar Pixeln Bewegung. Ohne diese Schwelle
     * waere kein Klick mehr moeglich: jedes Antippen der Box wuerde als
     * Verschieben gelten, und die Teilthemen liessen sich nicht mehr oeffnen.
     */
    function beginne() {
      zieht = true;
      einheitBeimZiehen = einheitId;

      const kasten = box.getBoundingClientRect();
      versatzX = startX - kasten.left;
      versatzY = startY - kasten.top;

      // Die Einheit haengt sichtbar am Zeiger; im Raster bleibt an ihrer
      // Stelle der Umriss stehen, damit erkennbar ist, wo sie landen wird.
      flug = box.cloneNode(true);
      flug.className = box.className + ' einheit-flug';
      flug.style.cssText = `position:fixed;z-index:999;pointer-events:none;margin:0;` +
        `width:${kasten.width}px;height:${kasten.height}px;` +
        `left:${kasten.left}px;top:${kasten.top}px`;
      document.body.appendChild(flug);
      box.classList.add('ist-platzhalter');
      document.body.classList.add('zieht-gerade');
      requestAnimationFrame(rollen);
    }

    function pruefeZiel() {
      if (!zieht) return;
      flug.style.left = (zeigerX - versatzX) + 'px';
      flug.style.top = (zeigerY - versatzY) + 'px';

      const wahl = zielUnter(zeigerX, zeigerY, ohneEigene, eigeneSpur);
      if (!wahl) return;
      if (letzteWahl && wahl.spur === letzteWahl.spur && wahl.vorId === letzteWahl.vorId) return;
      letzteWahl = wahl;

      ordnung = verschiebe(daten.einheiten, einheitId, wahl.spur, wahl.vorId);
      if (ordnung) platziere(vorschauPlan(daten.einheiten, ordnung), true);
    }

    function bewegen(e2) {
      zeigerX = e2.clientX;
      zeigerY = e2.clientY;
      if (!zieht) {
        if (Math.abs(zeigerX - startX) < ZIEHSCHWELLE &&
            Math.abs(zeigerY - startY) < ZIEHSCHWELLE) return;
        beginne();
      }
      pruefeZiel();
    }

    /** Rollt die Seite, solange der Zeiger am oberen oder unteren Rand steht. */
    function rollen() {
      if (!zieht) return;
      const hoehe = window.innerHeight;
      let schritt = 0;
      if (zeigerY < ROLLRAND) schritt = -ROLLTEMPO * (1 - zeigerY / ROLLRAND);
      else if (zeigerY > hoehe - ROLLRAND) schritt = ROLLTEMPO * (1 - (hoehe - zeigerY) / ROLLRAND);

      if (schritt) {
        const vorherOben = window.scrollY;
        window.scrollBy(0, schritt);
        if (window.scrollY !== vorherOben) pruefeZiel();
      }
      requestAnimationFrame(rollen);
    }
    requestAnimationFrame(rollen);

    function loslassen() {
      if (beendet) return;
      beendet = true;
      window.removeEventListener('pointermove', bewegen);
      window.removeEventListener('pointerup', loslassen);
      window.removeEventListener('pointercancel', loslassen);

      // Unter der Schwelle geblieben: das war ein Klick, kein Zug. Nichts
      // aufraeumen, nichts speichern — der Kopf oeffnet gleich die Teilthemen.
      if (!zieht) return;
      zieht = false;

      if (flug) flug.remove();
      box.classList.remove('ist-platzhalter');
      document.body.classList.remove('zieht-gerade');
      einheitBeimZiehen = null;

      // Nach einem Zug darf sich die Einheit nicht auch noch aufklappen.
      box.addEventListener('click', schluckeKlick, { capture: true, once: true });
      setTimeout(() => box.removeEventListener('click', schluckeKlick, { capture: true }), 0);

      if (ordnung) uebernimm(ordnung);
      else platziere(jahresplan(daten.einheiten), true);
    }

    function schluckeKlick(klick) {
      klick.preventDefault();
      klick.stopPropagation();
    }

    window.addEventListener('pointermove', bewegen);
    window.addEventListener('pointerup', loslassen);
    window.addEventListener('pointercancel', loslassen);
  }

  /**
   * Wo landet die Einheit, wenn hier losgelassen wird? Massgeblich ist die
   * Woche unter dem Zeiger, nicht die Box darunter: dadurch laesst sich in
   * einem Zug ueber beliebig viele Wochen verschieben.
   */
  function zielUnter(x, y, ohneEigene, eigeneSpur) {
    const treffer = document.elementsFromPoint(x, y);

    for (const el of treffer) {
      if (el === vorratBehaelter || el.closest?.('.jahresvorrat')) {
        return { spur: '', vorId: null };
      }
      if (el.classList?.contains('jahreszelle')) {
        const spur = erlaubteSpur(eigeneSpur, el.dataset.spur);
        return { spur, vorId: vorWelcher(ohneEigene, spur, Number(el.dataset.woche)) };
      }
      if (el.classList?.contains('jahreswoche')) {
        // Ueber der Wochenzahl selbst zaehlt nur die Woche; die Spur bleibt.
        const spur = erlaubteSpur(eigeneSpur, eigeneSpur || 'RS');
        return { spur, vorId: vorWelcher(ohneEigene, spur, Number(el.dataset.woche)) };
      }
    }
    return null;
  }

  let einheitBeimZiehen = null;

  // --- Zusammenbau ----------------------------------------------------------
  ziel.appendChild(karte(null, [
    e('div', { klasse: 'leiste', style: 'margin:0 0 10px' }, [
      e('div', { klasse: 'feldhilfe', style: 'margin:0', text:
        'Eine Einheit lässt sich überall anfassen und in eine andere Woche ziehen — der Plan ordnet ' +
        'sich schon beim Ziehen so, wie er danach aussieht. Ein kurzer Klick klappt stattdessen die ' +
        'Teilthemen auf. Rechtschreibung und Grammatik bleiben getrennt; wer eine Einheit in die ' +
        'andere Spur bringen will, legt sie erst unten ab und zieht sie von dort hinüber.' }),
      e('span', { klasse: 'schub' }, [statusEl])
    ]),
    e('div', { klasse: 'jahresrahmen' }, [raster])
  ]));

  ziel.appendChild(e('div', { klasse: 'abschnitt-titel', text: 'Nicht eingeplant' }));
  vorratBehaelter.appendChild(vorratLeer);
  ziel.appendChild(vorratBehaelter);

  platziere(jahresplan(daten.einheiten), false);
}

/**
 * Vor welche Einheit der Spur gehoert eine Einheit, die in dieser Woche
 * beginnen soll? Verglichen wird mit der Mitte jeder vorhandenen Einheit:
 * oberhalb davon wird davor einsortiert, unterhalb dahinter.
 */
function vorWelcher(einheitenOhneEigene, spur, woche) {
  const plan = jahresplan(einheitenOhneEigene);
  const aufSpur = plan.geplant.filter((x) => x.spur === spur || x.spur === 'BEIDE');
  const treffer = aufSpur.find((x) => woche < x.von + x.dauer_wochen / 2);
  return treffer ? treffer.id : null;
}

/** Plan, wie er nach dem Loslassen aussaehe — ohne die echten Daten zu aendern. */
function vorschauPlan(einheiten, ordnung) {
  const kopie = einheiten.map((x) => ({ ...x }));
  setzeReihenfolgeLokal({ einheiten: kopie }, ordnung);
  return jahresplan(kopie);
}

// --- Gleiten (FLIP) ----------------------------------------------------------

/**
 * Gemessen wird in Dokumentkoordinaten, nicht relativ zum Fenster: waehrend
 * des Ziehens rollt die Seite mit, und eine Messung am Fenster liesse die
 * Boxen bei jedem Rollschritt scheinbar springen.
 */
function messeAlle(boxen) {
  const stand = new Map();
  const x = window.scrollX, y = window.scrollY;
  boxen.forEach((el, id) => {
    const r = el.getBoundingClientRect();
    stand.set(id, { left: r.left + x, top: r.top + y });
  });
  return stand;
}

function gleite(boxen, vorher) {
  const x = window.scrollX, y = window.scrollY;
  boxen.forEach((el, id) => {
    const alt = vorher.get(id);
    if (!alt || el.classList.contains('ist-platzhalter')) return;
    const r = el.getBoundingClientRect();
    const neu = { left: r.left + x, top: r.top + y };
    const dx = alt.left - neu.left;
    const dy = alt.top - neu.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      el.style.transition = `transform ${GLEITDAUER}ms ease`;
      el.style.transform = '';
    });
  });
}

// --- Eine Einheit als Box ----------------------------------------------------

function einheitBox(daten, einheit, { neuZeichnen, starteZiehen, verschiebeUeberKnopf, aktuellerPlan }) {
  const offen = zustand.offeneEinheit === einheit.id;
  const themen = teilthemenFuer(daten, einheit.id);
  const anzahl = themen.length;

  const zusatz = e('span', { klasse: 'einheit-zusatz',
    text: `${anzahl} ${anzahl === 1 ? 'Teilthema' : 'Teilthemen'}` });

  const kopf = e('button', {
    klasse: 'einheit-kopf', 'aria-expanded': String(offen),
    auf: { click: () => { zustand.offeneEinheit = offen ? null : einheit.id; neuZeichnen(); } }
  }, [e('span', { klasse: 'einheit-titel', text: einheit.titel }), zusatz]);

  const griff = e('div', {
    klasse: 'einheit-griff', title: 'Zum Verschieben ziehen', 'aria-hidden': 'true'
  });

  const box = e('div', {
    klasse: 'einheit-box spur-' + (einheit.spur || 'frei').toLowerCase() + (offen ? ' offen' : ''),
    daten: { id: einheit.id, spur: einheit.spur || '' }
  }, [
    griff, kopf,
    e('div', { klasse: 'einheit-knoepfe' }, [
      e('button', {
        klasse: 'klein leise', text: '↑', title: 'Eine Position früher',
        'aria-label': einheit.titel + ' eine Position früher',
        auf: { click: (ev) => { ev.stopPropagation(); verschiebeUeberKnopf(einheit.id, -1); } }
      }),
      e('button', {
        klasse: 'klein leise', text: '↓', title: 'Eine Position später',
        'aria-label': einheit.titel + ' eine Position später',
        auf: { click: (ev) => { ev.stopPropagation(); verschiebeUeberKnopf(einheit.id, 1); } }
      })
    ]),
    offen ? einheitBereich(daten, einheit, themen, neuZeichnen, aktuellerPlan) : null
  ]);

  // Gezogen wird an der GANZEN Box, nicht nur am schmalen Griffstreifen —
  // der war zu leicht zu verfehlen. Ausgenommen sind die Pfeilknoepfe und
  // der aufgeklappte Bereich, die ihr eigenes Verhalten behalten.
  box.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('.einheit-knoepfe, .einheit-bereich')) return;
    starteZiehen(ev, einheit.id);
  });

  return { box, zusatz };
}

// --- Aufgeklappter Bereich einer Einheit ------------------------------------

function einheitBereich(daten, einheit, themen, neuZeichnen) {
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
      e('button', { klasse: 'klein leise', text: 'Löschen',
                    auf: { click: () => einheitLoeschen(daten, einheit, neuZeichnen) } })
    ])
  ]);
}

// --- Aktionen ----------------------------------------------------------------

async function neueEinheit(daten, neuZeichnen) {
  const titel = window.prompt('Titel der neuen Unterrichtseinheit:');
  if (!titel || !titel.trim()) return;

  const id = 'neu-' + Date.now();
  daten.einheiten.push({
    id, titel: titel.trim(), beschreibung: '', reihenfolge: 9999,
    geplante_stunden: null, lehrplanbezug: '', status: 'geplant',
    spur: '', dauer_wochen: 1
  });
  zustand.offeneEinheit = id;
  neuZeichnen();

  try {
    await sende('einheitErstellen', { titel: titel.trim(), spur: '', dauer_wochen: 1, id });
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
  if (!daten.teilthemen) daten.teilthemen = [];
  daten.teilthemen.push({
    id, einheit_id: einheit.id, titel: titel.trim(),
    reihenfolge: teilthemenFuer(daten, einheit.id).length + 1
  });
  neuZeichnen();

  try {
    await sende('teilthemaErstellen', { einheit_id: einheit.id, titel: titel.trim(), id });
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
