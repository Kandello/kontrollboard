# Nachmessung — zweite Runde

Die erste Runde hat fast alles beantwortet. Offen ist genau **eine** Frage, und von ihrer
Antwort hängt ab, ob die App normal gebaut werden kann oder umziehen muss.

**Zeitaufwand:** etwa 8 Minuten, davon 5 auf dem iPad.

---

## Was aktualisiert werden muss

Im Apps-Script-Projekt `Vorabpruefung` die Datei **`Index`** öffnen, kompletten Inhalt
löschen, den neuen Inhalt von `vorabpruefung/Index.html` einfügen, **speichern**, dann
**Bereitstellen → Bereitstellungen verwalten → Stift → Version: Neue Version →
Bereitstellen**.

`Code.gs` bleibt unverändert.

Neu sind zwei Prüfungen und eine Zeile im Umgebungsblock:

- **„Gestartet als"** — erkennt selbst, ob die Seite im Safari-Tab oder als
  Home-Bildschirm-App läuft. Damit muss ich nicht mehr raten.
- **Prüfung 6** — läuft automatisch, kein Knopf. Setzt neben der dauerhaften Marke eine
  zweite, die planmäßig nur bis zum Schließen des Browsers hält. Verschwinden beide
  gemeinsam, ist die Ursache bewiesen.
- **Prüfung 7** — fragt den Browser, ob er dauerhaften Speicher gewährt. Das ist der
  einzige vorgesehene Ausweg, falls Prüfung 6 den Verdacht bestätigt.

---

## A. iPad — der wichtige Teil

Bitte **zweimal** durchführen: einmal im normalen Safari, einmal als Home-Bildschirm-App.
Der Vergleich ist der eigentliche Zweck.

### Durchgang 1 — normaler Safari-Tab

1. Web-App-URL in Safari öffnen.
2. Oben im Umgebungsblock nachsehen, ob dort **„normaler Browser-Tab"** steht.
3. **„Marke setzen"** antippen.
4. In **Prüfung 7** auf **„Dauerhaften Speicher anfordern"** tippen. Erscheint eine
   Rückfrage von Safari, bitte zustimmen. Ergebnis notieren.
5. Safari **vollständig** schließen: App-Umschalter öffnen (von unten nach oben wischen
   und halten), Safari nach oben wegwischen. Ein bloßes Wechseln zum Home-Bildschirm
   genügt nicht.
6. Safari neu öffnen, URL aufrufen.
7. **Bericht erzeugen**, Text kopieren, bei „GERAET" *iPad Safari-Tab* eintragen und bei
   „SCHRITT" *Browser ganz geschlossen und neu geoeffnet*.

### Durchgang 2 — Home-Bildschirm-App

1. URL in Safari öffnen, Teilen-Symbol → **Zum Home-Bildschirm**.
2. Die App **vom Home-Bildschirm** starten.
3. Prüfen, ob im Umgebungsblock nun **„Home-Bildschirm-App"** steht. Falls dort weiter
   „normaler Browser-Tab" steht, bitte genau das melden — auch das ist ein Ergebnis.
4. **„Marke setzen"** antippen, danach **Prüfung 7** antippen.
5. Die App **vollständig** schließen (App-Umschalter, nach oben wegwischen).
6. Die App vom Home-Bildschirm neu starten.
7. **Bericht erzeugen**, bei „GERAET" *iPad Home-Bildschirm* eintragen.

---

## B. Dienst-PC — kurz, eine offene Frage

Beim ersten Bericht war das Feld „SCHRITT" leer, deshalb weiß ich nicht, ob Firefox
zwischendurch wirklich **ganz geschlossen** war.

1. URL öffnen, **„Marke setzen"**, **Prüfung 7** antippen.
2. Firefox **vollständig beenden** — alle Fenster schließen, nicht nur den Tab.
3. Firefox neu starten, URL aufrufen.
4. **Bericht erzeugen** und bei „SCHRITT" eintragen, was Sie getan haben.

---

## C. Heim-PC

Kann warten. Er ist das unkritischste der drei Geräte, weil dort weder unterrichtet noch
projiziert wird. Wenn Sie ohnehin am Rechner sitzen, gern denselben Ablauf wie unter B.

---

## Was ich mit den Ergebnissen mache

| Ergebnis auf dem iPad | Folge |
|---|---|
| Home-Bildschirm-App behält die Marke | Bestmöglicher Fall. Alles bleibt beim Plan, keine Änderung. |
| Prüfung 7 wird gewährt **und** die Marke hält danach | Fast so gut. Die App fordert den Speicher beim Start einmal an. |
| Beides scheitert | Dann liegt die Entscheidung bei Ihnen — ich lege Ihnen die zwei Möglichkeiten mit ihren echten Kosten vor, bevor irgendetwas umgebaut wird. |

In **keinem** dieser Fälle gehen Noten, Kontrollboards oder Einheiten verloren. Es geht
ausschließlich darum, wie oft die Zuordnungsdatei neu geladen werden muss.
