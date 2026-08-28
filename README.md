# kontrollboard
Kandels Deutsch-Zentrale

## Aufbau

- `netlify/` — die Oberfläche (reines HTML/CSS/JS, keine Abhängigkeiten).
  `netlify/test/` enthält die Testsuiten.
- `apps-script/` — die Tabellenlogik (Google Apps Script).
- `vorabpruefung/` — Prüfwerkzeuge vor dem Einspielen.

## Einspielen

Siehe **[EINSPIELEN.md](EINSPIELEN.md)** — mit clasp genügt ein Befehl
statt des Kopierens jeder einzelnen `.gs`-Datei.

## Tests

Die reine Rechenlogik läuft ohne Browser und ohne Server:

```
cd netlify/test
node layout.mjs && node merkliste.mjs && node zeit.mjs
```

Die übrigen Suiten brauchen den Mock-Server, der die echte Tabellenlogik
ausführt — je Suite frisch gestartet, damit sie sich nicht gegenseitig den
Datenstand verstellen:

```
cd netlify/test
node mock.js &
node widgets.mjs        # ebenso: e2e, startseite, checklisten, einheiten,
                        # einheitenansicht, noten, notenansicht
node datenschutz.mjs    # prüft, dass kein Klarname das Gerät verlässt
```

Die Tabellenlogik selbst:

```
cd apps-script/test && node test-server.js
```

## Datenschutz

Klarnamen verlassen das Gerät nie. Auf dem Server und im Repository stehen
ausschließlich Kürzel; die Zuordnung Kürzel → Name liegt allein lokal im
Browser (`netlify/js/zuordnung.js` und der lokale Speicher des Geräts).
`datenschutz.mjs` prüft das bei jedem Durchlauf nach.
