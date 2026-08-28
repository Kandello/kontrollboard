/**
 * einheiten.js — Jahresplan der Unterrichtseinheiten, reine Rechenlogik.
 *
 * Kein DOM, kein Serveraufruf: alles hier ist ohne Browser pruefbar
 * (netlify/test/einheiten.mjs).
 *
 * GRUNDGEDANKE: Eine Einheit speichert ihre Startwoche NICHT. Gespeichert
 * sind nur Spur, Reihenfolge und Dauer; die Startwoche entsteht daraus, indem
 * die Einheiten je Spur aufeinandergestapelt werden. Beim Verschieben oder
 * Verlaengern kann so weder eine Ueberschneidung noch eine Luecke entstehen,
 * die von Hand repariert werden muesste. Pausen und Wiederholungswochen sind
 * deshalb selbst Einheiten — nicht etwa Leerraum im Raster.
 */

import { isoWoche } from './zeit.js';

/** Die beiden Spuren des Plans. 'BEIDE' belegt sie gleichzeitig. */
export const SPUREN = [
  { id: 'RS', titel: 'Rechtschreibung' },
  { id: 'GR', titel: 'Grammatik' }
];

export function spurTitel(spur) {
  const treffer = SPUREN.find((s) => s.id === spur);
  if (treffer) return treffer.titel;
  return spur === 'BEIDE' ? 'Beide Spuren' : 'Nicht eingeplant';
}

/** Nach Reihenfolge sortierte Kopie — die Rohdaten bleiben unberuehrt. */
export function nachReihenfolge(einheiten) {
  return einheiten.slice().sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));
}

/**
 * Rechnet den Jahresplan aus: zu jeder eingeplanten Einheit die Start- und
 * Endwoche. Einheiten ohne Spur sind nicht eingeplant und stehen im Vorrat.
 *
 * Eine Einheit auf der Spur 'BEIDE' (etwa die Wortarten-Wiederholung zu
 * Schuljahresbeginn) blockiert beide Spuren: sie beginnt erst, wenn beide
 * frei sind, und setzt danach beide auf dieselbe Woche.
 */
export function jahresplan(einheiten) {
  const zeiger = { RS: 1, GR: 1 };
  const geplant = [];
  const vorrat = [];

  nachReihenfolge(einheiten).forEach((einheit) => {
    const spur = String(einheit.spur || '').toUpperCase();
    const dauer = Math.max(1, Number(einheit.dauer_wochen) || 1);

    if (spur !== 'RS' && spur !== 'GR' && spur !== 'BEIDE') {
      vorrat.push({ ...einheit, spur: '', dauer_wochen: dauer });
      return;
    }

    const von = spur === 'BEIDE' ? Math.max(zeiger.RS, zeiger.GR) : zeiger[spur];
    const bis = von + dauer - 1;

    if (spur === 'BEIDE') { zeiger.RS = bis + 1; zeiger.GR = bis + 1; }
    else zeiger[spur] = bis + 1;

    geplant.push({ ...einheit, spur, dauer_wochen: dauer, von, bis });
  });

  return { geplant, vorrat, wochen: Math.max(zeiger.RS, zeiger.GR) - 1 };
}

/** Die Einheit, die in dieser Schulwoche auf der Spur laeuft — sonst null. */
export function einheitInWoche(plan, spur, woche) {
  return plan.geplant.find((e) =>
    (e.spur === spur || e.spur === 'BEIDE') && woche >= e.von && woche <= e.bis) || null;
}

/**
 * Verschiebt eine Einheit vor eine andere (oder ans Ende einer Spur) und
 * liefert die vollstaendige neue Ordnung als [{ id, spur, reihenfolge }].
 *
 * `zielId === null` heisst: ans Ende der Zielspur. Die Reihenfolge wird
 * anschliessend durchnummeriert, damit keine Luecken und keine doppelten
 * Werte entstehen — die Zahlen selbst sind bedeutungslos, nur ihre
 * Reihenfolge zaehlt.
 */
export function verschiebe(einheiten, id, zielSpur, zielId) {
  const sortiert = nachReihenfolge(einheiten);
  const bewegt = sortiert.find((e) => e.id === id);
  if (!bewegt) return null;

  const spur = String(zielSpur || '').toUpperCase();
  const rest = sortiert.filter((e) => e.id !== id);
  const neu = { ...bewegt, spur: spur === 'RS' || spur === 'GR' || spur === 'BEIDE' ? spur : '' };

  let stelle = rest.findIndex((e) => e.id === zielId);
  if (zielId === null || stelle === -1) {
    // Ans Ende der Zielspur: hinter die letzte Einheit, die diese Spur
    // belegt. Ohne diese Suche landete sie hinter dem gesamten Plan und
    // damit auch hinter den Einheiten der anderen Spur.
    stelle = rest.length;
    for (let i = rest.length - 1; i >= 0; i--) {
      const s = String(rest[i].spur || '').toUpperCase();
      if (s === neu.spur || s === 'BEIDE' || neu.spur === 'BEIDE') { stelle = i + 1; break; }
    }
    if (!neu.spur) stelle = rest.length;
  }

  rest.splice(stelle, 0, neu);
  return rest.map((e, i) => ({ id: e.id, spur: String(e.spur || '').toUpperCase(), reihenfolge: i + 1 }));
}

/** Wendet das Ergebnis von verschiebe() lokal an — fuer die sofortige Anzeige. */
export function setzeReihenfolgeLokal(daten, saetze) {
  const nachId = new Map(saetze.map((s) => [s.id, s]));
  daten.einheiten.forEach((e) => {
    const s = nachId.get(e.id);
    if (!s) return;
    e.spur = s.spur;
    e.reihenfolge = s.reihenfolge;
  });
  daten.einheiten.sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));
}

// --- Teilthemen und Fortschritt ---------------------------------------------

export function teilthemenFuer(daten, einheitId) {
  return (daten.teilthemen || [])
    .filter((t) => t.einheit_id === einheitId)
    .slice()
    .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0));
}

export function istErledigt(daten, teilthemaId, klasse) {
  return (daten.einheitFortschritt || [])
    .some((f) => f.teilthema_id === teilthemaId && f.klasse === klasse && f.erledigt);
}

export function erledigtAm(daten, teilthemaId, klasse) {
  const treffer = (daten.einheitFortschritt || [])
    .find((f) => f.teilthema_id === teilthemaId && f.klasse === klasse && f.erledigt);
  return treffer ? treffer.datum : '';
}

/** Lokal setzen — fehlender Eintrag heisst „offen", genau wie auf dem Server. */
export function setzeFortschrittLokal(daten, teilthemaId, klasse, erledigt, datum) {
  if (!daten.einheitFortschritt) daten.einheitFortschritt = [];
  const i = daten.einheitFortschritt.findIndex(
    (f) => f.teilthema_id === teilthemaId && f.klasse === klasse);

  if (!erledigt) {
    if (i !== -1) daten.einheitFortschritt.splice(i, 1);
    return;
  }
  if (i === -1) {
    daten.einheitFortschritt.push({
      teilthema_id: teilthemaId, klasse, erledigt: true, datum: datum || '', notiz: ''
    });
  } else {
    daten.einheitFortschritt[i].erledigt = true;
    daten.einheitFortschritt[i].datum = datum || daten.einheitFortschritt[i].datum;
  }
}

/** Fortschritt einer einzelnen Einheit in einer Klasse. */
export function fortschrittEinheit(daten, einheitId, klasse) {
  const themen = teilthemenFuer(daten, einheitId);
  const erledigt = themen.filter((t) => istErledigt(daten, t.id, klasse)).length;
  return {
    gesamt: themen.length,
    erledigt,
    prozent: themen.length ? Math.floor((erledigt / themen.length) * 100 + 0.5) : null
  };
}

/** Fortschritt ueber alle eingeplanten Einheiten einer Klasse. */
export function fortschrittKlasse(daten, klasse) {
  const eingeplant = jahresplan(daten.einheiten || []).geplant;
  let gesamt = 0, erledigt = 0;
  eingeplant.forEach((einheit) => {
    const f = fortschrittEinheit(daten, einheit.id, klasse);
    gesamt += f.gesamt;
    erledigt += f.erledigt;
  });
  return {
    gesamt, erledigt,
    prozent: gesamt ? Math.floor((erledigt / gesamt) * 100 + 0.5) : null
  };
}

// --- Schulwoche --------------------------------------------------------------

/**
 * Die wievielte Schulwoche laeuft an diesem Tag? Zaehlt Kalenderwochen ab
 * dem Schuljahresbeginn — Ferien sind darin nicht abgezogen, weil die
 * Tabelle sie nicht kennt. Der Wert ist deshalb ein Anhaltspunkt, keine
 * amtliche Zaehlung; deswegen laesst er sich in der Ansicht auch verstellen.
 *
 * Ohne hinterlegten Schuljahresbeginn gibt es keine sinnvolle Zaehlung —
 * dann null, und die Ansicht zeigt schlicht keine „aktuelle Woche" an.
 */
export function schulwoche(tagesobjekt, schuljahresbeginn) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(schuljahresbeginn || '').trim());
  if (!m) return null;

  const beginn = { jahr: Number(m[1]), monat: Number(m[2]), tag: Number(m[3]) };
  const a = isoWoche(beginn);
  const b = isoWoche(tagesobjekt);

  // Ueber den Jahreswechsel hinweg zaehlen: die Wochen des Startjahres
  // auffuellen und die des Folgejahres dazuzaehlen.
  const wochenImJahr = (jahr) => isoWoche({ jahr, monat: 12, tag: 28 }).woche;

  let differenz = b.woche - a.woche;
  for (let jahr = a.jahr; jahr < b.jahr; jahr++) differenz += wochenImJahr(jahr);
  for (let jahr = b.jahr; jahr < a.jahr; jahr++) differenz -= wochenImJahr(jahr);

  return differenz + 1;
}
