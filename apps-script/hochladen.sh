#!/bin/sh
#
# hochladen.sh — holt den neuesten Stand und spielt ihn in die Tabelle ein.
#
# Ersetzt das Kopieren jeder einzelnen Datei von Hand in den Apps-Script-
# Editor. Drei Schritte stecken darin:
#
#   1. den neuesten Stand von GitHub holen (git pull)
#   2. die .gs-Dateien ins Apps-Script-Projekt schieben (clasp push)
#   3. eine neue Version veroeffentlichen (clasp deploy)
#
# Schritt 3 ist noetig, weil sich beim Hochladen allein noch nichts an der
# laufenden Web-App aendert: die /exec-Adresse liefert weiterhin die zuletzt
# VEROEFFENTLICHTE Fassung aus. Erst eine neue Version derselben
# Bereitstellung schaltet den neuen Stand scharf — und behaelt dabei die
# Adresse, sodass in der Oberflaeche nichts umgestellt werden muss.
#
# Einmalige Einrichtung siehe EINSPIELEN.md im Wurzelverzeichnis.
#
#   ./hochladen.sh                 (nimmt die Kennung aus .bereitstellung)
#   ./hochladen.sh AKfycb…         (oder ausdruecklich mitgegeben)
#
# Die geschweiften Klammern sind Absicht: sie zwingen die Shell, die ganze
# Datei zu lesen, bevor sie etwas ausfuehrt. Ohne sie koennte `git pull`
# dieses Skript mitten im eigenen Lauf unter den Fuessen austauschen.
{
set -e
cd "$(dirname "$0")"

if ! command -v clasp >/dev/null 2>&1; then
  echo ""
  echo "  clasp ist nicht installiert."
  echo "  Bitte einmalig ausfuehren:  npm install -g @google/clasp@2.4.2"
  echo ""
  exit 1
fi

if [ ! -f .clasp.json ]; then
  echo ""
  echo "  Hier fehlt die Datei .clasp.json — die Verbindung zu deinem"
  echo "  Apps-Script-Projekt. Siehe EINSPIELEN.md, Abschnitt"
  echo "  \"Einmalige Einrichtung\", Schritt \"Verbindungsdatei anlegen\"."
  echo ""
  exit 1
fi

# --- 1. Neuesten Stand holen ------------------------------------------------
pruefsumme() { cksum hochladen.sh 2>/dev/null | awk '{print $1}'; }

if [ -d ../.git ]; then
  echo "[1/3] Neuesten Stand von GitHub holen …"
  vorher=$(pruefsumme)
  if ! git pull --ff-only; then
    echo ""
    echo "  Der neueste Stand liess sich nicht holen."
    echo ""
    echo "  Haeufigste Ursache: auf diesem PC wurde eine Datei veraendert."
    echo "  Wenn du diese Aenderungen NICHT brauchst, verwirf sie mit:"
    echo ""
    echo "      git checkout -- ."
    echo ""
    echo "  und starte danach ./hochladen.sh erneut. Bist du dir unsicher,"
    echo "  frag lieber nach — der Befehl wirft lokale Aenderungen weg."
    echo ""
    exit 1
  fi

  # Hat der Abgleich dieses Skript selbst erneuert, laeuft trotzdem noch die
  # alte Fassung weiter: die Shell hat die Datei beim Start vollstaendig
  # eingelesen (siehe die geschweiften Klammern oben). Eine Verbesserung AM
  # SKRIPT wirkt also erst beim naechsten Start — und bis dahin arbeitet man
  # ahnungslos mit dem alten Stand. Darum hier anhalten und darauf hinweisen.
  if [ -n "$vorher" ] && [ "$vorher" != "$(pruefsumme)" ]; then
    echo ""
    echo "  Das Hochladeskript selbst wurde gerade erneuert."
    echo ""
    echo "  Bitte einfach noch einmal starten — dann laeuft die neue Fassung:"
    echo ""
    echo "      ./hochladen.sh"
    echo ""
    echo "  (Es ist noch nichts hochgeladen worden. Nichts kaputt.)"
    echo ""
    exit 0
  fi
else
  echo "[1/3] Kein Git-Verzeichnis gefunden — ueberspringe das Holen."
fi

# --- 2. Dateien hochladen ---------------------------------------------------
echo ""
echo "[2/3] Dateien ins Apps-Script-Projekt hochladen …"
clasp push --force

# --- 3. Veroeffentlichen ----------------------------------------------------
# Die Kennung der Bereitstellung steht in einer eigenen, nicht eingecheckten
# Datei: sie gehoert zur persoenlichen Tabelle, nicht zum geteilten Code.
kennung="$1"
if [ -z "$kennung" ] && [ -f .bereitstellung ]; then
  kennung=$(tr -d ' \t\r\n' < .bereitstellung)
fi

# Es darf auch die ganze Web-App-Adresse hinterlegt sein: die Kennung steckt
# ohnehin darin, hinter dem letzten /s/. Das erspart das fehleranfaellige
# Heraussuchen der ID im Editor — die Adresse hat man ohnehin schon.
#
# Auf das letzte /s/ abgestellt, nicht auf /macros/s/: Konten einer Schule
# oder Firma (Google Workspace) tragen den Domainnamen mitten in der Adresse,
# also .../a/macros/schule.de/s/AKfycb…/exec.
kennung=$(printf '%s' "$kennung" | sed -e 's#.*/s/##' -e 's#/.*##')

if [ -z "$kennung" ]; then
  echo ""
  echo "[3/3] UEBERSPRUNGEN — hochgeladen, aber noch nicht scharfgeschaltet."
  echo ""
  echo "  Es ist keine Bereitstellung hinterlegt. Einmalig anlegen: im Editor"
  echo "  unter \"Bereitstellen -> Bereitstellungen verwalten\" die Web-App-"
  echo "  Adresse kopieren, dann:"
  echo ""
  echo "      echo \"https://script.google.com/macros/s/AKfycb…/exec\" > .bereitstellung"
  echo ""
  exit 0
fi

echo ""
echo "[3/3] Neue Version veroeffentlichen …"
if ! clasp deploy -i "$kennung" -d "Stand $(date '+%Y-%m-%d %H:%M')"; then
  echo ""
  echo "  Das Veroeffentlichen ist fehlgeschlagen. Hochgeladen ist alles —"
  echo "  nur scharfgeschaltet ist der neue Stand noch nicht."
  echo ""
  echo "  Verwendete Kennung: $kennung"
  echo ""
  echo "  Steht bei \"Invalid deployment ID\", passt der Inhalt von"
  echo "  .bereitstellung nicht. Er muss die Web-App-Adresse ODER die reine"
  echo "  Kennung enthalten — nachsehen mit:"
  echo ""
  echo "      cat .bereitstellung"
  echo ""
  echo "  Welche es gibt, zeigt:  clasp deployments"
  echo ""
  echo "  Bis das geklaert ist, kannst du im Editor unter \"Bereitstellen ->"
  echo "  Bereitstellungen verwalten -> Stift -> Version: Neue Version\""
  echo "  von Hand scharfschalten."
  echo ""
  exit 1
fi

echo ""
echo "  Fertig. Die /exec-Adresse liefert jetzt den neuen Stand."
echo "  In der Oberflaeche muss nichts umgestellt werden."
echo ""
exit 0
}
