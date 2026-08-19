/**
 * ansichten/start.js — Ebene 1, der morgendliche Tagesüberblick.
 *
 * Uhr, Tagesplan, die beiden Wochenaufgaben, Ferienmodus und die
 * Klassenknoepfe. Das Widget zur laufenden Unterrichtseinheit folgt mit
 * den Einheiten (Schritt 9); sein Platz ist vorgesehen.
 */

import { e, karte, setzeMeldung, hinweis } from '../ui.js';
import { klassenlehrkraftEintrag } from '../zuordnung.js';
import { sende, leereDaten, ladeDaten } from '../server.js';
import {
  SPUREN, jahresplan, einheitInWoche, fortschrittEinheit, fortschrittKlasse, schulwoche
} from '../einheiten.js';
import {
  heute, morgen, uhrzeit, wochentag, wochentagName, istWochenende,
  kwKennung, alsMinuten, alsDeutsch, alsIso
} from '../zeit.js';

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

export function zeichneStart(ziel, { daten, verbergen, neuZeichnen }) {
  if (uhrGeber) { clearInterval(uhrGeber); uhrGeber = null; }

  const ferien = istWahr(daten.meta.ferienmodus);
  const tag = heute();
  const kw = kwKennung(tag);
  const plan = planTag();

  const uhr = uhrWidget(tag, ferien);
  ziel.appendChild(uhr.element);

  let planAktualisieren = null;
  if (!ferien) {
    const p = tagesplan(daten, plan.tag, plan.istHeute);
    ziel.appendChild(p.element);
    planAktualisieren = p.aktualisiere;
  }

  // Die Seite bleibt oft stundenlang offen. Ohne diesen Takt bliebe die
  // Markierung „läuft"/„als Nächstes" an der Stunde kleben, die beim
  // Zeichnen gerade dran war, und der Tageswechsel um 17 Uhr bzw. um
  // Mitternacht kaeme erst beim naechsten Neuladen an.
  const gezeichneterTag = alsIso(plan.tag);
  uhrGeber = setInterval(() => {
    uhr.stellen();
    const jetzt = planTag();
    if (alsIso(jetzt.tag) !== gezeichneterTag) { neuZeichnen(); return; }
    if (planAktualisieren) planAktualisieren();
  }, 1000);

  ziel.appendChild(e('div', { klasse: 'kachelreihe' }, [
    wochenkachel('PEAK', daten, kw, tag, ferien, neuZeichnen),
    wochenkachel('WEEKLY', daten, kw, tag, ferien, neuZeichnen)
  ]));

  ziel.appendChild(ferienschalter(ferien, neuZeichnen));

  ziel.appendChild(aktuelleEinheit(daten, tag));

  ziel.appendChild(e('div', { klasse: 'abschnitt-titel', text: 'Klassen' }));
  ziel.appendChild(klassenknoepfe(daten, verbergen));
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
    element: e('div', { klasse: 'karte uhr' }, [
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
  return e('div', { klasse: 'karte' }, [
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
    return karte('Aktuelle Unterrichtseinheit', [
      e('div', { klasse: 'leer', style: 'padding:20px 16px' }, [
        e('div', { text: 'Es ist noch keine Unterrichtseinheit eingeplant.' }),
        e('div', { klasse: 'leiste', style: 'justify-content:center;margin-top:14px' }, [
          e('a', { klasse: 'knopf', href: '#/einheiten', text: 'Jahresplan öffnen' })
        ])
      ])
    ]);
  }

  if (woche === null) {
    return karte('Aktuelle Unterrichtseinheit', [
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
    return karte('Aktuelle Unterrichtseinheit', [
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

  return karte('Aktuelle Unterrichtseinheit', [
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

  return e('div', { klasse: 'leiste ferienleiste' }, [
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
