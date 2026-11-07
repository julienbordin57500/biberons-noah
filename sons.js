// 🎵 Sons pour s'endormir : ambiances douces (façon veilleuse pour bébé) et berceuses du domaine public.
// Rien n'est téléchargé : chaque son est fabriqué par le téléphone au moment de l'écouter,
// joué en boucle, puis effacé de la mémoire à l'arrêt. Les sons sont donc libres de droits.
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

  // Met le son à un niveau doux et régulier
  function normaliser(son, niveau) {
    let max = 0;
    for (let i = 0; i < son.length; i++) max = Math.max(max, Math.abs(son[i]));
    const g = max ? niveau / max : 0;
    for (let i = 0; i < son.length; i++) son[i] *= g;
    return son;
  }

  // Boucle sans « clic » : la fin se fond dans le début
  function boucler(son, fondu) {
    const n = son.length - fondu;
    const out = new Float32Array(n);
    out.set(son.subarray(0, n));
    for (let i = 0; i < fondu; i++) {
      const t = i / fondu;
      out[i] = son[i] * t + son[n + i] * (1 - t);
    }
    return out;
  }

  // Bruit rose : comme le bruit blanc, mais sans le côté « grésillement » (graves plus présents)
  function bruitRose(n) {
    const out = new Float32Array(n);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return out;
  }
  // Filtre « adoucissant » (coupe les aigus au-dessus d'environ hz)
  function adoucir(son, hz) {
    const a = 1 - Math.exp((-2 * Math.PI * hz) / FREQ);
    let y = 0;
    for (let i = 0; i < son.length; i++) son[i] = y += a * (son[i] - y);
    return son;
  }

  const DUREE_AMBIANCE = 30; // secondes, répétées en boucle
  const FONDU = FREQ * 2;
  const longueur = () => DUREE_AMBIANCE * FREQ + FONDU;

  // 🌬️ Souffle doux : bruit rose adouci, comme un ventilateur lointain
  function souffle() {
    return boucler(normaliser(adoucir(bruitRose(longueur()), 2600), 0.75), FONDU);
  }

  // 🌊 Vagues : la mer qui monte et descend lentement (une vague toutes les 7,5 s)
  function vagues() {
    const n = longueur();
    const son = bruitRose(n);
    const a = (hz) => 1 - Math.exp((-2 * Math.PI * hz) / FREQ);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const t = i / FREQ;
      const houle = Math.pow(Math.sin((Math.PI * t) / 7.5), 2); // 0 → 1 → 0
      const vague = 0.18 + 0.82 * Math.pow(houle, 1.6);
      y += a(300 + 1500 * houle) * (son[i] - y); // plus clair quand la vague déferle
      son[i] = y * vague;
    }
    return boucler(normaliser(son, 0.85), FONDU);
  }

  // 💓 Cœur de maman : battements doux sur un léger souffle, comme dans le ventre (70 battements/min)
  function coeur() {
    const n = longueur();
    const fond = normaliser(adoucir(bruitRose(n), 500), 0.22);
    const son = new Float32Array(n);
    const periode = 60 / 70;
    const coup = (debut, force) => {
      const i0 = Math.floor(debut * FREQ);
      let phase = 0;
      for (let i = 0; i < 0.22 * FREQ && i0 + i < n; i++) {
        const t = i / FREQ;
        phase += (2 * Math.PI * (38 + 30 * Math.exp(-t * 30))) / FREQ;
        son[i0 + i] += Math.sin(phase) * Math.exp(-t * 18) * Math.min(1, t / 0.004) * force;
      }
    };
    for (let t = 0; t < n / FREQ; t += periode) {
      coup(t, 1);
      coup(t + 0.26, 0.6);
    }
    adoucir(son, 180);
    normaliser(son, 0.8);
    for (let i = 0; i < n; i++) son[i] += fond[i] * (0.85 + 0.15 * Math.sin((2 * Math.PI * i) / (periode * FREQ)));
    return boucler(normaliser(son, 0.85), FONDU);
  }

  // 🌧️ Pluie douce : bruissement léger et petites gouttes
  function pluie() {
    const n = longueur();
    const bruit = bruitRose(n);
    const grave = adoucir(Float32Array.from(bruit), 700);
    const son = new Float32Array(n);
    for (let i = 0; i < n; i++) son[i] = (bruit[i] - grave[i]) * 0.7 + grave[i] * 0.35;
    adoucir(son, 5000);
    for (let k = 0; k < DUREE_AMBIANCE * 22; k++) {
      const i0 = Math.floor(Math.random() * (n - FREQ * 0.05));
      const f = 1800 + Math.random() * 2600;
      const force = 0.05 + Math.random() * 0.1;
      for (let i = 0; i < FREQ * 0.03; i++) son[i0 + i] += Math.sin((2 * Math.PI * f * i) / FREQ) * Math.exp((-i / FREQ) * 160) * force;
    }
    return boucler(normaliser(son, 0.7), FONDU);
  }

  // ---------- Berceuses façon boîte à musique ----------
  const NOTES = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  // « C5 » → fréquence (La 440 Hz), « F#4 » accepté
  const hz = (n) => {
    const m = /^([A-G])(#?)(\d)$/.exec(n);
    return 440 * Math.pow(2, (NOTES[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12) / 12);
  };
  const lireMelodie = (texte) =>
    texte
      .trim()
      .split(/\s+/)
      .map((x) => {
        const [n, d] = x.split(":");
        return { f: hz(n), d: Number(d || 1) };
      });

  // Une note de boîte à musique : son de clochette qui s'éteint doucement
  function note(son, debut, f, force, tenue) {
    const i0 = Math.floor(debut * FREQ);
    const long = Math.min(son.length - i0, Math.floor(tenue * FREQ));
    const amort = 1.6 + f / 900; // les aigus s'éteignent plus vite
    for (let i = 0; i < long; i++) {
      const t = i / FREQ;
      const env = Math.min(1, t / 0.004) * Math.exp(-t * amort);
      son[i0 + i] +=
        force *
        env *
        (Math.sin(2 * Math.PI * f * t) +
          0.32 * Math.sin(2 * Math.PI * f * 2.0 * t) * Math.exp(-t * 3) +
          0.12 * Math.sin(2 * Math.PI * f * 3.01 * t) * Math.exp(-t * 6) +
          0.06 * Math.sin(2 * Math.PI * f * 4.2 * t) * Math.exp(-t * 10));
    }
  }

  // Petite réverbération (comme dans une chambre) pour un son plus rond
  function reverb(son, dose) {
    const out = Float32Array.from(son);
    const peignes = [1557, 1617, 1491, 1422].map((d) => ({ d, buf: new Float32Array(d), i: 0, f: 0 }));
    const passes = [556, 441].map((d) => ({ d, buf: new Float32Array(d), i: 0 }));
    for (let k = 0; k < son.length; k++) {
      let s = 0;
      for (const p of peignes) {
        const y = p.buf[p.i];
        p.f = y * 0.75 + p.f * 0.25;
        p.buf[p.i] = son[k] * 0.25 + p.f * 0.8;
        p.i = (p.i + 1) % p.d;
        s += y;
      }
      for (const a of passes) {
        const y = a.buf[a.i];
        a.buf[a.i] = s + y * 0.5;
        a.i = (a.i + 1) % a.d;
        s = y - s * 0.5;
      }
      out[k] += s * dose;
    }
    return out;
  }

  // Berceuse complète (environ 3 min) : la mélodie jouée 3 fois —
  // simple, puis avec une seconde voix plus grave, puis plus lente et plus douce pour finir
  function berceuse({ melodie, tempo, tonique }) {
    const notes = lireMelodie(melodie);
    const temps = 60 / tempo;
    const tour = notes.reduce((t, n) => t + n.d, 0) * temps;
    const total = tour * 2 + tour * 1.18 + 4;
    const son = new Float32Array(Math.ceil(total * FREQ));
    let t = 0;
    const jouer = (lent, voix2, force) => {
      for (const n of notes) {
        note(son, t, n.f * 2, force, 2.2);
        if (voix2) note(son, t + 0.01, n.f, force * 0.38, 2.6);
        t += n.d * temps * lent;
      }
    };
    jouer(1, false, 0.5);
    jouer(1, true, 0.5);
    jouer(1.18, true, 0.38);
    // Nappe très douce en fond : la note de base et sa quinte, qui « respirent » lentement
    const f0 = hz(tonique) / 2;
    for (let i = 0; i < son.length; i++) {
      const s = i / FREQ;
      const entree = Math.min(1, s / 3) * Math.min(1, (son.length / FREQ - s) / 3);
      son[i] += entree * (0.035 + 0.015 * Math.sin((2 * Math.PI * s) / 8)) * (Math.sin(2 * Math.PI * f0 * s) + 0.6 * Math.sin(2 * Math.PI * f0 * 1.5 * s));
    }
    return normaliser(reverb(son, 0.5), 0.8);
  }

  const BRAHMS = {
    tonique: "C4",
    tempo: 60,
    melodie: `E4:.5 E4:.5 G4:2 E4:.5 E4:.5 G4:2 E4:.5 G4:.5 C5:1 B4:1.5 A4:.5 A4:1 G4:1
      D4:.5 E4:.5 F4:1 D4:1 D4:.5 E4:.5 F4:2 D4:.5 F4:.5 B4:.5 A4:.5 G4:1 B4:1 C5:2
      C4:.5 C4:.5 C5:2 A4:.5 F4:.5 G4:2 E4:.5 C4:.5 F4:1 G4:1 A4:1 G4:2
      C4:.5 C4:.5 C5:2 A4:.5 F4:.5 G4:2 E4:.5 C4:.5 F4:1 E4:1 D4:1 C4:3`,
  };
  const LUNE = {
    tonique: "G4",
    tempo: 76,
    melodie: `G4 G4 G4 A4 B4:2 A4:2 G4 B4 A4 A4 G4:4
      G4 G4 G4 A4 B4:2 A4:2 G4 B4 A4 A4 G4:4
      A4 A4 A4 A4 E4:2 E4:2 A4 G4 F#4 E4 D4:4
      G4 G4 G4 A4 B4:2 A4:2 G4 B4 A4 A4 G4:4`,
  };
  const ETOILE = {
    tonique: "C4",
    tempo: 72,
    melodie: `C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2
      G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2
      C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2`,
  };

  const SONS = [
    { id: "souffle", emoji: "🌬️", nom: "Souffle doux", sous: "bruit blanc tout doux", faire: souffle },
    { id: "coeur", emoji: "💓", nom: "Cœur de maman", sous: "comme dans le ventre", faire: coeur },
    { id: "vagues", emoji: "🌊", nom: "Vagues", sous: "la mer, lentement", faire: vagues },
    { id: "pluie", emoji: "🌧️", nom: "Pluie douce", sous: "sur la fenêtre", faire: pluie },
    { id: "brahms", emoji: "🌙", nom: "Berceuse de Brahms", sous: "boîte à musique · 3 min", faire: () => berceuse(BRAHMS) },
    { id: "lune", emoji: "🌕", nom: "Au clair de la lune", sous: "boîte à musique · 3 min", faire: () => berceuse(LUNE) },
    { id: "etoile", emoji: "⭐", nom: "Brille petite étoile", sous: "« Ah ! vous dirai-je maman »", faire: () => berceuse(ETOILE) },
  ];
  const RAPIDES = [15, 30, 60];
  const MIN_DUREE = 5;
  const MAX_DUREE = 480;

  const lecteur = new Audio();
  lecteur.loop = true;
  lecteur.volume = VOLUME; // pris en compte sur ordinateur ; sur iPhone, boutons du téléphone
  let enCours = null; // id du son qui joue
  let adresse = null;
  let finPrevue = 0;
  // Durée en minutes (0 = sans arrêt)
  let duree = lire("sons-duree", 30, (v) => Number.isInteger(v) && (v === 0 || (v >= MIN_DUREE && v <= MAX_DUREE)));

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
    // On laisse l'écran se redessiner avant de fabriquer le son (une petite seconde)
    await new Promise((r) => setTimeout(r, 30));
    if (enCours !== son.id) return;
    adresse = wav(son.faire());
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
  const verifierFin = () => {
    if (finPrevue && Date.now() >= finPrevue) arreter();
    else if (finPrevue) majReste();
  };
  lecteur.addEventListener("timeupdate", verifierFin);
  document.addEventListener("visibilitychange", verifierFin);

  function choisirDuree(d) {
    duree = d;
    ecrire("sons-duree", d);
    if (enCours) finPrevue = d ? Date.now() + d * 60000 : 0;
    rendre();
  }

  const fmtDureeMin = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${pad(m % 60)}` : ""}`);

  function majReste() {
    const el = $("sons-reste");
    if (!enCours) return (el.textContent = "");
    if (!finPrevue) return (el.textContent = "Joue sans arrêt");
    const min = Math.max(1, Math.ceil((finPrevue - Date.now()) / 60000));
    el.textContent = `S'arrête dans ${fmtDureeMin(min)}`;
  }

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
      ...[...RAPIDES, 0].map((d) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", String(d === duree));
        b.textContent = d ? fmtDureeMin(d) : "Sans arrêt";
        b.addEventListener("click", () => choisirDuree(d));
        return b;
      })
    );
    // Durée au choix : − / + de 5 en 5 minutes
    const perso = duree && !RAPIDES.includes(duree);
    $("sons-perso").classList.toggle("on", !!perso);
    $("sons-perso-val").textContent = fmtDureeMin(duree || 45);
    $("sons-stop").hidden = !enCours;
    majReste();
  }
  const pas = (sens) => {
    const base = duree || 45;
    const pasMin = base >= 120 ? 15 : 5;
    choisirDuree(Math.min(MAX_DUREE, Math.max(MIN_DUREE, Math.round(base / pasMin) * pasMin + sens * pasMin)));
  };
  $("sons-moins").addEventListener("click", () => pas(-1));
  $("sons-plus").addEventListener("click", () => pas(1));
  $("sons-perso-val").addEventListener("click", () => choisirDuree(duree || 45));

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
