// Petit tuto en 4 étapes pour Mamita et les grands-parents (affiché à leur première connexion)
(() => {
  const ETAPES = (nom) => [
    {
      emoji: "👋",
      titre: `Bienvenue ${nom} !`,
      texte: "Ce carnet sert à suivre la journée de Noah quand tu le gardes. Ça prend 30 secondes à comprendre.",
    },
    {
      emoji: "👵",
      titre: "Ton espace : l'onglet Garde",
      texte: "C'est le dernier onglet, tout à droite (👵 Garde). C'est ici que tu notes ce qui se passe. Ce que tu écris est signé de ton nom.",
    },
    {
      emoji: "🍼",
      titre: "Un appui quand ça arrive",
      texte: "« + Biberon » pour un repas, « + 💧 » ou « + 💩 » pour une couche. Pour la sieste : « Il s'endort » puis « Il se réveille », ou ajoute-la plus tard avec les heures. Pour effacer une erreur, touche-la deux fois.",
    },
    {
      emoji: "📝",
      titre: "La note du jour",
      texte: "Écris ce que vous avez fait, comment il était, puis « Enregistrer ma note ». Les parents la liront sur leur téléphone.",
    },
    {
      emoji: "👀",
      titre: "Le reste, tu regardes",
      texte: "Repas, Couches, Sommeil et Santé : tu peux tout consulter (c'est grisé), seuls les parents modifient. Bonne garde !",
    },
  ];

  let etapes = [];
  let i = 0;

  function rendre() {
    const e = etapes[i];
    $("tuto-emoji").textContent = e.emoji;
    $("tuto-titre").textContent = e.titre;
    $("tuto-texte").textContent = e.texte;
    $("tuto-dots").innerHTML = etapes.map((_, j) => `<span class="${j === i ? "on" : ""}"></span>`).join("");
    $("tuto-suivant").textContent = i === etapes.length - 1 ? "C'est parti !" : "Suivant";
    $("tuto-passer").hidden = i === etapes.length - 1;
    // petite animation à chaque étape
    const box = $("tuto").querySelector(".tuto-box");
    box.classList.remove("pas");
    void box.offsetWidth;
    box.classList.add("pas");
  }

  function ouvrir() {
    if (!profil) return;
    etapes = ETAPES(profil.nom === "Autre" ? "" : profil.nom).map((e, j) =>
      j === 0 && profil.nom === "Autre" ? { ...e, titre: "Bienvenue !" } : e
    );
    i = 0;
    rendre();
    $("tuto").showModal();
  }

  $("tuto-suivant").addEventListener("click", () => {
    if (i < etapes.length - 1) {
      i++;
      rendre();
    } else {
      $("tuto").close("fin");
    }
  });
  $("tuto").addEventListener("close", () => ecrire(`tuto-vu:${profil?.nom}`, true));
  $("g-tuto").addEventListener("click", ouvrir);

  function apresConnexion() {
    const famille = profil && !estParent();
    $("g-tuto-box").hidden = !famille;
    // Une seule fois par personne et par téléphone, juste après l'arrivée sur l'appli
    if (famille && !lire(`tuto-vu:${profil.nom}`, false, (v) => v === true) && !$("tuto").open) setTimeout(ouvrir, 900);
  }
  window.addEventListener("connecte", apresConnexion);
  if (profil) apresConnexion(); // déjà connecté avant le chargement de ce fichier
})();
