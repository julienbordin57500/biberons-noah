# Le carnet de Noah — repères pour Claude

Appli web (PWA) des parents de Noah : repas, couches, sommeil, garde (nounou / mamies), santé.
Toujours répondre en français, à un utilisateur novice. Les commentaires du code sont en français.

## Techno
- Site statique : HTML + CSS + JavaScript « à la main ». Pas de npm, pas de build, pas de framework.
- Données : Supabase (URL et clé publique en haut de `commun.js`), client chargé depuis le CDN
  `@supabase/supabase-js@2.45.4` (version figée, aussi listée dans `sw.js`).
- Hébergement : GitHub Pages, branche `main` → https://julienbordin57500.github.io/biberons-noah/
- Hors ligne : `sw.js` garde les fichiers sur le téléphone (mémoire `carnet-noah-vN`).

## Commandes
- Lancer en local : outil d'aperçu, configuration `noah` (port 8765), ou
  `python3 -m http.server 8765 --directory "/Users/tch/Application bébé/biberons-noah"`
- Tests automatiques : aucun. Vérifier dans l'aperçu (format iPhone) la page modifiée + la console.
- Compiler : rien à compiler.
- Publier : nouvelle version (voir ci-dessous), puis commit + `git push` sur `main` (après accord).

## Publier une nouvelle version (à chaque changement visible)
`./outils/nouvelle-version.sh` fait tout (sans commit). Sinon, N + 1 partout :
1. `version.txt` → N
2. `commun.js` → `const VERSION_APPLI = "N";`
3. `index.html` → tous les `?v=N` (style.css et chaque script)
4. `sw.js` → `const CACHE = "carnet-noah-vN";` et tous les `?v=N`

## Structure
- `index.html` : toutes les pages et fenêtres ; `style.css` : tout le style (décor savane, mode nuit)
- Un fichier JS par page : `repas.js`, `couches.js`, `sommeil.js`, `sante.js`, `medicaments.js`, `garde.js`
- `commun.js` (Supabase, file d'attente hors ligne, version), `auth.js` (profils), `pages.js` (glisser),
  `notifs.js` (cloche), `graphiques.js`, `fetes.js`, `resume.js`, `tuto.js`, `scene.js` (animaux)
- `droits.sql` + `supabase/*.sql` : règles d'accès et changements de base, à appliquer dans Supabase.

## Conventions
- Noms de variables, fonctions et fichiers en français, même style que le code autour.
- Changement de base = nouveau fichier `supabase/nom_clair.sql`, idempotent (`if not exists`), finissant par `notify pgrst, 'reload schema';`.
- Les deux applis (Noah et Hortense) partagent beaucoup de code : une amélioration faite ici est souvent à reporter dans `../carnets-hortense` (demander avant).
- Messages de commit en français, une phrase qui dit ce qui change pour les parents.

## Ne pas toucher sans demander
- URL et clé Supabase, `droits.sql` (ce que la famille peut voir), les vraies données dans Supabase.
- Le filtre `carnet-noah-` dans `sw.js` : il évite d'effacer la mémoire de l'appli d'Hortense.
- Ne jamais committer, pousser ou appliquer un SQL sans accord.
