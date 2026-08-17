# Tests der Oberfläche

Setzen einen nachgebauten Apps-Script-Endpunkt voraus, damit ohne echte
Google-Tabelle getestet werden kann. Das Datenpaket erzeugt
`../../apps-script/test/erzeuge-paket.js` aus der echten Serverlogik.

```
node ../../apps-script/test/erzeuge-paket.js   # paket.json erzeugen
node mock.js &                                 # Port 8901
node e2e.mjs                                   # Navigation, Zuordnung, Anzeige
node startseite.mjs                            # Tagesplan, Wochenaufgaben, Ferienmodus
node datenschutz.mjs                           # belauscht den Netzverkehr
```

`zeit.mjs` braucht keinen Server:

```
node zeit.mjs                                  # ISO-Kalenderwochen
```

`startseite.mjs` stellt die Uhr auf feste Zeitpunkte, damit „laufende
Stunde" und die Erinnerungszeichen überhaupt prüfbar sind — sonst hinge das
Ergebnis davon ab, wann der Test zufällig läuft.

`datenschutz.mjs` ist der wichtigste Test: Er legt auffällige Namen in die
Zuordnungsliste, klickt sich durch alle Ansichten und prüft anschließend
jeden einzelnen Serveraufruf darauf, ob einer dieser Namen darin auftaucht.
Eine Gegenprobe stellt sicher, dass die Suche ein eingebautes Leck auch
tatsächlich finden würde.
