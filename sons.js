// 🎵 Sons pour s'endormir : bruit blanc, bruit doux et 3 berceuses connues (domaine public).
// Rien n'est téléchargé : chaque son est fabriqué par le téléphone au moment de l'écouter
// (quelques secondes de son, puis répétées en boucle), et effacé de la mémoire à l'arrêt.
// On passe par un lecteur audio classique : le son continue écran verrouillé et même en mode silencieux.
(() => {
  const FREQ = 22050; // qualité suffisante pour des sons doux, et deux fois moins lourd
  const VOLUME = 0.32; // sur iPhone, le volume se règle seulement avec les boutons du téléphone

  // ---------- Fabrication d'un fichier son (WAV) à partir des échantillons ----------
  function wav(echantillons) {
    const n = echantillons.length;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const ecrire = (pos, txt) => [...txt].forEach((c, i) => v.setUint8(pos + i, c.charCodeAt(0)));
    ecrire(0, "RIFF");
    v.setUint32(4, 36 + n * 2, true);
    ecrire(8, "WAVE");
    ecrire(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); // PCM
    v.setUint16(22, 1, true); // mono
    v.setUint32(24, FREQ, true);
    v.setUint32(28, FREQ * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    ecrire(36, "data");
    v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, echantillons[i])) * 32767, true);
    return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  }

  // Boucle sans « clic » : la fin se fond dans le début
  function boucler(son, fondu) {
    const n = son.length - fondu;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = son[i];
    for (let i = 0; i < fondu; i++) {
      const t = i / fondu;
      out[i] = son[i] * t + son[n + i] * (1 - t);
    }
    return out;
  }

  // Bruit blanc (comme une hotte ou un ventilateur) ou bruit doux, plus grave (comme dans le ventre)
  function bruit(doux) {
    const fondu = FREQ;
    const son = new Float32Array(FREQ * 12 + fondu);
    let b = 0;
    let max = 0;
    for (let i = 0; i < son.length; i++) {
      const blanc = Math.random() * 2 - 1;
      if (doux) {
        b = (b + 0.02 * blanc) / 1.02; // « bruit brun » : on garde surtout les graves
        son[i] = b;
      } else {
        son[i] = blanc;
      }
      max = Math.max(max, Math.abs(son[i]));
    }
    const gain = (doux ? 0.9 : 0.55) / max;
    for (let i = 0; i < son.length; i++) son[i] *= gain;
    return boucler(son, fondu);
  }

  // ---------- Berceuses façon boîte à musique ----------
  const NOTES = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  // « C5 » → fréquence (La 440 Hz), « F#4 » accepté
  const hz = (n) => {
    const m = /^([A-G])(#?)(\d)$/.exec(n);
    return 440 * Math.pow(2, (NOTES[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12) / 12);
  };
  // Mélodie écrite « note:durée » (durée en temps) ; une note un octave plus haut pour la boîte à musique
  function melodie(texte, tempo) {
    const temps = 60 / tempo;
    const notes = texte.trim().split(/\s+/).map((x) => {
      const [n, d] = x.split(":");
      return { f: hz(n) * 2, d: Number(d || 1) * temps };
    });
    const total = notes.reduce((t, n) => t + n.d, 0) + 1.5; // un petit silence avant de recommencer
    const son = new Float32Array(Math.ceil(total * FREQ));
    let debut = 0;
    for (const n of notes) {
      const i0 = Math.floor(debut * FREQ);
      const long = Math.min(son.length - i0, Math.floor(1.8 * FREQ));
      for (let i = 0; i < long; i++) {
        const t = i / FREQ;
        const enveloppe = Math.min(1, t / 0.006) * Math.exp(-t * 2.6);
        son[i0 + i] +=
          enveloppe * (Math.sin(2 * Math.PI * n.f * t) + 0.25 * Math.sin(4 * Math.PI * n.f * t) + 0.08 * Math.sin(6 * Math.PI * n.f * t)) * 0.45;
      }
      debut += n.d;
    }
    return son;
  }

  const BRAHMS = `E4:.5 E4:.5 G4:2 E4:.5 E4:.5 G4:2 E4:.5 G4:.5 C5:1 B4:1.5 A4:.5 A4:1 G4:1
    D4:.5 E4:.5 F4:1 D4:1 D4:.5 E4:.5 F4:2 D4:.5 F4:.5 B4:.5 A4:.5 G4:1 B4:1 C5:2
    C4:.5 C4:.5 C5:2 A4:.5 F4:.5 G4:2 E4:.5 C4:.5 F4:1 G4:1 A4:1 G4:2
    C4:.5 C4:.5 C5:2 A4:.5 F4:.5 G4:2 E4:.5 C4:.5 F4:1 E4:1 D4:1 C4:3`;
  const LUNE = `G4 G4 G4 A4 B4:2 A4:2 G4 B4 A4 A4 G4:4
    G4 G4 G4 A4 B4:2 A4:2 G4 B4 A4 A4 G4:4
    A4 A4 A4 A4 E4:2 E4:2 A4 G4 F#4 E4 D4:4
    G4 G4 G4 A4 B4:2 A4:2 G4 B4 A4 A4 G4:4`;
  const ETOILE = `C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2
    G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2
    C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2`;

  const SONS = [
    { id: "blanc", emoji: "🌬️", nom: "Bruit blanc", sous: "comme un ventilateur", faire: () => bruit(false) },
    { id: "doux", emoji: "🌊", nom: "Bruit doux", sous: "comme dans le ventre", faire: () => bruit(true) },
    { id: "brahms", emoji: "🌙", nom: "Berceuse de Brahms", sous: "boîte à musique", faire: () => melodie(BRAHMS, 66) },
    { id: "lune", emoji: "🌕", nom: "Au clair de la lune", sous: "boîte à musique", faire: () => melodie(LUNE, 84) },
    { id: "etoile", emoji: "⭐", nom: "Ah ! vous dirai-je maman", sous: "« Brille petite étoile »", faire: () => melodie(ETOILE, 80) },
  ];
  const DUREES = [
    [15, "15 min"],
    [30, "30 min"],
    [60, "1 h"],
    [0, "Sans arrêt"],
  ];

  const lecteur = new Audio();
  lecteur.loop = true;
  lecteur.volume = VOLUME; // pris en compte sur ordinateur ; sur iPhone, boutons du téléphone
  let enCours = null; // id du son qui joue
  let adresse = null;
  let finPrevue = 0;
  let duree = lire("sons-duree", 30, (v) => DUREES.some(([d]) => d === v));

  function arreter() {
    lecteur.pause();
    lecteur.removeAttribute("src");
    if (adresse) URL.revokeObjectURL(adresse); // libère la mémoire
    adresse = null;
    enCours = null;
    finPrevue = 0;
    rendre();
  }

  async function jouer(son) {
    if (enCours === son.id) return arreter();
    arreter();
    enCours = son.id;
    rendre();
    // On laisse l'écran se redessiner avant de fabriquer le son (une fraction de seconde)
    await new Promise((r) => setTimeout(r, 30));
    if (enCours !== son.id) return;
    const echantillons = son.faire();
    for (let i = 0; i < echantillons.length; i++) echantillons[i] *= son.id === "blanc" || son.id === "doux" ? 1 : 1.6;
    adresse = wav(echantillons);
    lecteur.src = adresse;
    finPrevue = duree ? Date.now() + duree * 60000 : 0;
    try {
      await lecteur.play();
    } catch (e) {
      arreter();
      toast("Le son n'a pas pu démarrer. Réessaie.");
      return;
    }
    if ("mediaSession" in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: son.nom, artist: "Le carnet de Noah" });
    rendre();
  }

  // Minuterie : vérifiée pendant la lecture (marche aussi écran verrouillé)
  lecteur.addEventListener("timeupdate", () => {
    if (finPrevue && Date.now() >= finPrevue) arreter();
  });
  document.addEventListener("visibilitychange", () => {
    if (finPrevue && Date.now() >= finPrevue) arreter();
  });

  // ---------- Fenêtre ----------
  function rendre() {
    $("sons-svg").classList.toggle("joue", !!enCours);
    $("sons-liste").replaceChildren(
      ...SONS.map((s) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "son-tuile" + (enCours === s.id ? " joue" : "");
        b.setAttribute("aria-pressed", String(enCours === s.id));
        b.innerHTML = `<span class="son-emoji" aria-hidden="true">${s.emoji}</span>
          <span class="son-nom">${s.nom}</span>
          <span class="son-sous">${enCours === s.id ? "▶ en cours · toucher pour arrêter" : s.sous}</span>`;
        b.addEventListener("click", () => jouer(s));
        return b;
      })
    );
    $("sons-durees").replaceChildren(
      ...DUREES.map(([d, l]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", String(d === duree));
        b.textContent = l;
        b.addEventListener("click", () => {
          duree = d;
          ecrire("sons-duree", d);
          if (enCours) finPrevue = d ? Date.now() + d * 60000 : 0;
          rendre();
        });
        return b;
      })
    );
    $("sons-stop").hidden = !enCours;
  }

  const ouvrir = () => {
    rendre();
    $("sons").showModal();
  };
  $("sons-svg").addEventListener("click", ouvrir);
  $("sons-svg").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      ouvrir();
    }
  });
  $("sons-stop").addEventListener("click", arreter);
  window.addEventListener("connecte", () => $("sons-svg").removeAttribute("hidden"));
  if (typeof profil !== "undefined" && profil) $("sons-svg").removeAttribute("hidden");
})();
