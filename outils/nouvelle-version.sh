#!/bin/bash
# Passe l'appli à la version suivante (ex. 32 → 33) dans les 4 fichiers qui portent le numéro,
# pour que les téléphones téléchargent bien la nouvelle version.
# Ne fait ni commit ni push : ça reste à faire après vérification.
#
# Utilisation (depuis le dossier de l'appli) : ./outils/nouvelle-version.sh
set -euo pipefail

cd "$(dirname "$0")/.."
PREFIXE="carnet-noah-v"

N="$(tr -d '[:space:]' < version.txt)"
if ! [[ "$N" =~ ^[0-9]+$ ]]; then
  echo "❌ version.txt ne contient pas un simple numéro (« $N »)."; exit 1
fi
S=$((N + 1))

# Vérifie que les 4 fichiers sont bien tous au même numéro avant de changer quoi que ce soit
grep -q "const VERSION_APPLI = \"$N\";" commun.js || { echo "❌ commun.js n'est pas en version $N."; exit 1; }
grep -q "const CACHE = \"$PREFIXE$N\";"  sw.js     || { echo "❌ sw.js n'est pas en version $N."; exit 1; }
grep -q "?v=$N\""                        index.html || { echo "❌ index.html n'a pas de ?v=$N."; exit 1; }

echo "$S" > version.txt
# (sed -i.bak puis effacer le .bak : marche à la fois sur Mac et sur Linux, ex. sessions cloud)
sed -i.bak "s/const VERSION_APPLI = \"$N\";/const VERSION_APPLI = \"$S\";/" commun.js
sed -i.bak "s/const CACHE = \"$PREFIXE$N\";/const CACHE = \"$PREFIXE$S\";/" sw.js
sed -i.bak "s/?v=$N\"/?v=$S\"/g" index.html sw.js
rm -f commun.js.bak sw.js.bak index.html.bak

# Un ?v= qui ne serait pas au nouveau numéro = un fichier oublié
RESTE="$(grep -n '?v=[0-9]*"' index.html sw.js | grep -v "?v=$S\"" || true)"
if [ -n "$RESTE" ]; then
  echo "⚠️  Ces lignes n'ont pas le numéro $S, à vérifier :"; echo "$RESTE"
fi

echo "✅ Carnet de Noah : version $N → $S"
git --no-pager diff --stat -- version.txt commun.js index.html sw.js
echo "Reste à faire (après accord) : commit puis git push."
