# Le carnet de Noah 🦁🍼🧷🌙

Petite appli web pour suivre le quotidien de Noah, en cinq pages qu'on fait glisser du doigt :

- **Repas** : biberons (ml) et allaitements (côté, durée), minuteur depuis le dernier repas, totaux du jour et sur 24 h
- **Couches** : pipi, caca et taille du caca, minuteur depuis la dernière couche et depuis le dernier caca
- **Sommeil** : « il s'endort » / « il se réveille », minuteur en direct, temps dormi du jour et sur 24 h
- **Garde** : espace séparé pour la nounou ou les mamies (note du jour, récap repas / couches / dodos)
- **Santé** : rendez-vous médicaux, calendrier vaccins et examens obligatoires, croissance, fiche santé

Décor savane animé (girafe qui boit, éléphant, oiseaux, suricate), mode nuit automatique.

- Site statique (HTML / CSS / JS), hébergé sur GitHub Pages
- Données dans Supabase : tables `biberons`, `couches`, `sommeils`, `sante_profil`, `rendez_vous`, `mesures`, `suivi_calendrier`, `garde_jours`, `garde_evenements`, `medicaments_prises`

La nuit (23 h – 7 h), un repas noté pendant un dodo met le sommeil en pause ; « Fin du repas, il se rendort » le relance.
