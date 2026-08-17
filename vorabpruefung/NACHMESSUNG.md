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

**Bitte ausdrücklich in Safari**, dem vorinstallierten Browser — nicht in Firefox oder
einem anderen nachinstallierten Browser. Der Grund: Nur für Safari sieht der spätere
Einrichtungsweg (`DEPLOY.md`, Punkt 10) den Home-Bildschirm-Eintrag vor, der laut Apple
vom siebentägigen Löschen ausgenommen ist. Ein Befund aus einem anderen Browser beantwortet
die eigentliche Frage nicht, so aufschlussreich er sonst sein mag.

Bitte **zweimal** durchführen: einmal im normalen Safari-Tab, einmal als
Home-Bildschirm-App. Der Vergleich der beiden ist der eigentliche Zweck.

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

## B. Dienst-PC — nur noch Nachtrag

Die eigentliche Frage ist beantwortet: Schließen über das X beendet Firefox unter Windows
im Regelfall vollständig, und die Marke hat das in der ersten Runde bereits überstanden.
Hier geht es nur noch darum, die beiden neuen Prüfungen 6 und 7 einmal mitlaufen zu lassen.

1. URL öffnen, **„Marke setzen"**, **Prüfung 7** antippen.
2. Firefox über das X schließen, neu öffnen, URL erneut aufrufen.
3. **Bericht erzeugen**, bei „SCHRITT" *wie beim ersten Mal, ueber das X geschlossen*
   eintragen.

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
