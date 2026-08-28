#!/bin/sh
#
# hochladen.sh — schiebt die .gs-Dateien nach Google und macht sie live.
#
# Ersetzt das Kopieren jeder einzelnen Datei von Hand in den Apps-Script-
# Editor. Zwei Schritte stecken darin, denn beim Hochladen allein aendert
# sich noch nichts an der laufenden Web-App: die /exec-Adresse liefert
# weiterhin die zuletzt VEROEFFENTLICHTE Fassung aus. Erst eine neue
# Version derselben Bereitstellung schaltet den neuen Stand scharf — und
# behaelt dabei die Adresse, sodass in der Oberflaeche nichts umgestellt
# werden muss.
#
# Einmalige Einrichtung siehe EINSPIELEN.md im Wurzelverzeichnis.
#
#   ./hochladen.sh                 (nimmt die Kennung aus .bereitstellung)
#   ./hochladen.sh AKfycb…         (oder ausdruecklich mitgegeben)
#
set -e
cd "$(dirname "$0")"

if ! command -v clasp >/dev/null 2>&1; then
  echo "clasp ist nicht installiert.  ->  npm install -g @google/clasp" >&2
  exit 1
fi

if [ ! -f .clasp.json ]; then
  echo "Hier fehlt .clasp.json — die Verbindung zum Apps-Script-Projekt." >&2
  echo "Siehe EINSPIELEN.md, Abschnitt „Einmalige Einrichtung\"." >&2
  exit 1
fi

echo "→ Dateien werden hochgeladen …"
clasp push --force

# Die Kennung der Bereitstellung steht in einer eigenen, nicht
# eingecheckten Datei: sie gehoert zur persoenlichen Tabelle, nicht zum Code.
kennung="$1"
if [ -z "$kennung" ] && [ -f .bereitstellung ]; then
  kennung=$(tr -d ' \t\r\n' < .bereitstellung)
fi

if [ -z "$kennung" ]; then
  echo ""
  echo "Hochgeladen — aber noch nicht scharfgeschaltet."
  echo "Es ist keine Bereitstellung hinterlegt. Einmalig anlegen mit:"
  echo ""
  echo "    clasp deployments            # Kennung heraussuchen (AKfycb…)"
  echo "    echo AKfycb… > apps-script/.bereitstellung"
  echo ""
  echo "Bis dahin: im Editor über „Bereitstellen → Bereitstellungen verwalten"
  echo "→ Stift → Version: Neue Version → Bereitstellen\"."
  exit 0
fi

echo "→ Neue Version wird veröffentlicht …"
clasp deploy -i "$kennung" -d "Stand $(date '+%Y-%m-%d %H:%M')"

echo ""
echo "Fertig. Die /exec-Adresse liefert jetzt den neuen Stand."
