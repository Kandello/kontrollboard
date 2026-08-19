/**
 * ziehen.js — Ziehen mit laufender Vorschau, gemeinsam fuer alle Werkzeuge.
 *
 * Herausgezogen aus dem Jahresplan, weil die Widgets der Startseite genau
 * dieselbe Mechanik brauchen. Der Teil ist knifflig genug, dass er nur einmal
 * existieren sollte — jede Kopie waere eine Stelle, an der einer der hier
 * gesammelten Sonderfaelle wieder verlorengeht.
 *
 * Die vier Sonderfaelle, die hier stecken:
 *
 * 1. ZEIGEREIGNISSE AM FENSTER, nicht am Element. Sobald die Vorschau das
 *    gezogene Element im Dokument umhaengt, wird es kurz herausgeloest — und
 *    damit verfaellt eine Zeigererfassung (setPointerCapture). Das Loslassen
 *    kaeme dann nie an.
 *
 * 2. SCHWELLE. Erst nach ein paar Pixeln Bewegung wird gezogen. Ohne sie
 *    waere kein Klick mehr moeglich, weil jedes Antippen als Zug gaelte.
 *    Nach einem Zug wird der folgende Klick verworfen.
 *
 * 3. MITROLLEN. Ein Schuljahr ist laenger als jeder Bildschirm. Am oberen
 *    und unteren Rand rollt die Seite mit, sonst liesse sich nur so weit
 *    schieben, wie gerade sichtbar ist.
 *
 * 4. MESSEN IN DOKUMENTKOORDINATEN. Waehrend des Rollens verschiebt sich
 *    alles gegenueber dem Fenster; eine Messung am Fenster liesse die
 *    Elemente bei jedem Rollschritt scheinbar springen.
 */

/** So viele Pixel Bewegung, bevor aus einem Klick ein Zug wird. */
export const ZIEHSCHWELLE = 5;

/** Dauer der Umsortier-Animation. Kurz genug, um nicht zu bremsen. */
export const GLEITDAUER = 170;

const ROLLRAND = 90;
const ROLLTEMPO = 18;

/**
 * Beginnt einen Zug.
 *
 * `element`   das gezogene Element; bekommt waehrend des Zugs die Klasse
 *             `ist-platzhalter` und bleibt als Umriss an seiner Stelle.
 * `zielSuche` (x, y) -> Ziel oder null. Was ein „Ziel" ist, bestimmt der
 *             Aufrufer; verglichen wird mit `gleich`.
 * `gleich`    (a, b) -> ob zwei Ziele dasselbe meinen. Nur bei einer
 *             Aenderung wird die Vorschau neu gezeichnet.
 * `vorschau`  (ziel) -> zeichnet, wie es nach dem Loslassen aussaehe.
 * `abschluss` (ziel) -> uebernimmt endgueltig; `null`, wenn nie ein Ziel
 *             gefunden wurde.
 */
export function starteZug({ ev, element, zielSuche, gleich, vorschau, abschluss }) {
  if (ev.pointerType === 'mouse' && ev.button !== 0) return;

  const startX = ev.clientX;
  const startY = ev.clientY;
  let zeigerX = startX;
  let zeigerY = startY;
  let zieht = false;
  let beendet = false;
  let flug = null;
  let versatzX = 0;
  let versatzY = 0;
  let letztesZiel = null;
  let gefunden = false;

  function beginne() {
    zieht = true;
    const kasten = element.getBoundingClientRect();
    versatzX = startX - kasten.left;
    versatzY = startY - kasten.top;

    flug = element.cloneNode(true);
    flug.classList.add('wird-geflogen');
    flug.style.cssText = 'position:fixed;z-index:999;pointer-events:none;margin:0;' +
      `width:${kasten.width}px;height:${kasten.height}px;` +
      `left:${kasten.left}px;top:${kasten.top}px`;
    document.body.appendChild(flug);

    element.classList.add('ist-platzhalter');
    document.body.classList.add('zieht-gerade');
    requestAnimationFrame(rollen);
  }

  function pruefeZiel() {
    if (!zieht) return;
    flug.style.left = (zeigerX - versatzX) + 'px';
    flug.style.top = (zeigerY - versatzY) + 'px';

    const ziel = zielSuche(zeigerX, zeigerY);
    if (!ziel) return;
    if (letztesZiel && gleich(ziel, letztesZiel)) return;
    letztesZiel = ziel;
    gefunden = true;
    vorschau(ziel);
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

  function schluckeKlick(klick) {
    klick.preventDefault();
    klick.stopPropagation();
  }

  function loslassen() {
    if (beendet) return;
    beendet = true;
    window.removeEventListener('pointermove', bewegen);
    window.removeEventListener('pointerup', loslassen);
    window.removeEventListener('pointercancel', loslassen);

    // Unter der Schwelle geblieben: das war ein Klick, kein Zug.
    if (!zieht) return;
    zieht = false;

    if (flug) flug.remove();
    element.classList.remove('ist-platzhalter');
    document.body.classList.remove('zieht-gerade');

    element.addEventListener('click', schluckeKlick, { capture: true, once: true });
    setTimeout(() => element.removeEventListener('click', schluckeKlick, { capture: true }), 0);

    abschluss(gefunden ? letztesZiel : null);
  }

  window.addEventListener('pointermove', bewegen);
  window.addEventListener('pointerup', loslassen);
  window.addEventListener('pointercancel', loslassen);
}

// --- Gleiten (FLIP) ----------------------------------------------------------

/**
 * Misst die Lage aller Elemente — in Dokumentkoordinaten, damit ein
 * Rollschritt zwischen Messung und Anwendung nichts verfaelscht.
 */
export function messeAlle(elemente) {
  const stand = new Map();
  const x = window.scrollX, y = window.scrollY;
  elemente.forEach((el, id) => {
    const r = el.getBoundingClientRect();
    stand.set(id, { left: r.left + x, top: r.top + y });
  });
  return stand;
}

/**
 * Laesst die Elemente von ihrer alten an ihre neue Stelle gleiten. Ein
 * Wechsel der Rasterzeile allein liesse sich nicht weich darstellen —
 * deshalb wird die Differenz kurz als Verschiebung gesetzt und dann
 * weggenommen.
 */
export function gleite(elemente, vorher) {
  const x = window.scrollX, y = window.scrollY;
  elemente.forEach((el, id) => {
    const alt = vorher.get(id);
    if (!alt || el.classList.contains('ist-platzhalter')) return;
    const r = el.getBoundingClientRect();
    const dx = alt.left - (r.left + x);
    const dy = alt.top - (r.top + y);
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      el.style.transition = `transform ${GLEITDAUER}ms ease`;
      el.style.transform = '';
    });
  });
}
