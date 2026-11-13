// Page Garde : espace de Mamita et des grands-parents (notes du jour + récap simplifié)
// Les données sont à part (tables garde_*) et ne se mélangent pas avec celles des parents.
// Le profil connecté (auth.js) signe les notes : la famille note, les parents consultent.
(() => {
  const EMOJI_CONNUS = Object.fromEntries(PROFILS.map((p) => [p.nom, p.emoji]));

  // Profil côté garde : { nom, emoji, parent }
  let tel = null;
  // Celui qui peut noter : Mamita ou un grand-parent (les parents consultent seulement)
  let moi = null;
  // Suit le profil connecté (appelé à chaque chargement : la connexion peut arriver avant ou après ce fichier)
  function suivreProfil() {
    const cle = profil ? `${profil.role}:${profil.nom}` : "";
    if (cle === suivreProfil.cle) return;
    suivreProfil.cle = cle;
    tel = profil ? { nom: profil.nom, emoji: profil.emoji, parent: estParent() } : null;
    moi = tel && !tel.parent ? tel : null;
    noteModifiee = false;
  }

  let jour = minuit(); // jour affiché
  let notes = []; // notes du jour, une par personne
  let evenements = [];
  let dodoEnCours = null; // tous jours confondus
  let noteModifiee = false;

  const isoJour = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const estAujourdhui = () => jour.getTime() === minuit().getTime();
  const emojiDe = (nom) => EMOJI_CONNUS[nom] || (moi && moi.nom === nom ? moi.emoji : "🙂");
  const qui = (nom) => `${emojiDe(nom)} ${nom}`;

  async function charger() {
    suivreProfil();
    window.chargerResume?.();
    const fin = new Date(jour);
    fin.setDate(fin.getDate() + 1);
    try {
      const [n, ev, enCours] = await Promise.all([
        api("garde_jours", `?select=*&jour=eq.${isoJour(jour)}&order=updated_at.asc`),
        api(
          "garde_evenements",
          `?select=*&quand=gte.${encodeURIComponent(jour.toISOString())}&quand=lt.${encodeURIComponent(fin.toISOString())}&order=quand.asc`
        ),
        api("garde_evenements", "?select=*&type=eq.sommeil&fin=is.null&limit=1"),
      ]);
      notes = n;
      evenements = ev;
      dodoEnCours = enCours[0] || null;
      annoncerReactions();
      marquerVu();
      if (!noteModifiee) $("g-note").value = (moi && notes.find((x) => x.gardien === moi.nom)?.note) || "";
    } catch (e) {
      afficherErreur("Impossible de charger l'espace garde. Vérifie la connexion internet.");
    }
    rendre();
  }

  // ---------- Affichage ----------
  function rendre() {
    // Qui utilise ce téléphone
    $("g-who-name").textContent = !tel ? "" : tel.parent ? `${tel.emoji} ${tel.nom} · mode parents (consultation)` : `${tel.emoji} ${tel.nom} · tu peux noter la journée`;

    // Jour
    const nom = jour.toLocaleDateString("fr-FR", { weekday: "long" });
    $("g-day-name").textContent = estAujourdhui() ? `Aujourd'hui, ${nom}` : nom[0].toUpperCase() + nom.slice(1);
    $("g-day-date").textContent = jour.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    $("g-next").disabled = estAujourdhui();

    // Qui a gardé ce jour-là (d'après les notes et le récap)
    const gardiens = [...new Set([...notes.map((x) => x.gardien), ...evenements.map((e) => e.gardien).filter(Boolean)])];
    $("g-by").innerHTML = gardiens.length
      ? `Gardé par <strong>${gardiens.map((g) => esc(qui(g))).join(" et ")}</strong>`
      : "Personne n'a encore rien noté ce jour-là.";

    // Notes de chacun (sauf la mienne, qui est dans le champ d'écriture)
    const autres = notes.filter((x) => x.note && (!moi || x.gardien !== moi.nom));
    $("g-notes").innerHTML = autres
      .map(
        (x) => `<li class="note-card">
          <p class="note-head">${esc(qui(x.gardien))} <span>· ${fmtHeure(x.updated_at)}</span></p>
          <p class="note-text">${esc(x.note)}</p>
        </li>`
      )
      .join("");
    $("g-my-note").hidden = !moi;
    if (moi) {
      $("g-my-note-label").textContent = `📝 Ma note du jour (${moi.nom})`;
      const mienne = notes.find((x) => x.gardien === moi.nom);
      if (!noteModifiee)
        $("g-note-saved").textContent = mienne?.updated_at ? `✅ Enregistrée en ligne à ${fmtHeure(mienne.updated_at)} : tout le monde peut la lire.` : "";
    }

    // Boutons d'ajout : seulement pour un téléphone qui a choisi qui il est
    const aujourdhui = estAujourdhui();
    document.querySelectorAll("#page-garde [data-today-only]").forEach((el) => (el.hidden = !moi || !aujourdhui));
    document.querySelectorAll("#page-garde [data-writer-only]").forEach((el) => (el.hidden = !moi));
    $("g-read-hint").hidden = !!moi;
    $("g-read-hint").textContent = tel?.parent
      ? "👀 Mode parents : vous voyez tout ce que Mamita et les grands-parents notent."
      : "👀 Mode consultation.";
    $("g-past-hint").hidden = !moi || aujourdhui;

    // Récap
    const plusieurs = gardiens.length > 1;
    const signe = (e) => (plusieurs && e.gardien ? ` · ${e.gardien}` : "");
    const repas = evenements.filter((e) => e.type === "repas");
    const couches = evenements.filter((e) => e.type === "couche");
    const dodos = evenements.filter((e) => e.type === "sommeil");

    const ml = repas.reduce((t, e) => t + (e.ml || 0), 0);
    $("g-repas-sum").textContent = `${repas.length}` + (ml ? ` · ${ml} ml` : "");
    remplir("g-repas-list", repas, (e) => `${fmtHeure(e.quand)} · ${e.ml ? e.ml + " ml" : "?"}${e.lait === "maternel" ? " 🥛" : ""}${signe(e)}`, "Pas encore de repas");

    const cacas = couches.filter((e) => e.caca).length;
    $("g-couche-sum").textContent = `${couches.length}` + (cacas ? ` · ${cacas} 💩` : "");
    remplir("g-couche-list", couches, (e) => `${fmtHeure(e.quand)} ${e.pipi ? "💧" : ""}${e.caca ? "💩" : ""}${signe(e)}`, "Pas encore de couche");

    const total = dodos.reduce((t, e) => t + ((e.fin ? new Date(e.fin) : new Date()) - new Date(e.quand)), 0);
    $("g-sleep-sum").textContent = dodos.length ? fmtMinutes(total) : "0";
    remplir("g-sleep-list", dodos, (e) => `${fmtHeure(e.quand)} → ${e.fin ? fmtHeure(e.fin) : "en cours"}${signe(e)}`, "Pas encore de dodo");
    majBoutonDodo();
    rendreVu();
    contenuChange();
  }

  function majBoutonDodo() {
    const btn = $("g-sleep-btn");
    btn.textContent = dodoEnCours ? `☀️ Il se réveille · ${fmtDuree(Date.now() - new Date(dodoEnCours.quand).getTime())}` : "🌙 Il s'endort maintenant";
    btn.classList.toggle("on", !!dodoEnCours);
  }

  // Deux notes identiques à moins de 10 minutes d'écart : sans doute un appui en trop
  const memeContenu = (a, b) =>
    a.type === b.type && a.gardien === b.gardien && (a.ml ?? null) === (b.ml ?? null) && (a.lait ?? null) === (b.lait ?? null) &&
    !!a.pipi === !!b.pipi && !!a.caca === !!b.caca;
  const estDoublon = (e, liste) =>
    e.type !== "sommeil" && liste.some((x) => x.id < e.id && memeContenu(x, e) && Math.abs(new Date(e.quand) - new Date(x.quand)) < 10 * 60000);

  // Pastilles : la famille efface les siennes, les parents peuvent tout effacer (un appui « Effacer ? », un second efface).
  // Les parents peuvent aussi réagir avec un émoji, que les grands-parents voient.
  function remplir(id, liste, texte, vide) {
    const el = $(id);
    if (!liste.length) {
      el.innerHTML = `<span class="pill empty">${vide}</span>`;
      return;
    }
    el.replaceChildren(
      ...liste.map((e) => {
        const groupe = document.createElement("span");
        groupe.className = "pill-groupe";
        const b = document.createElement("button");
        b.type = "button";
        const effacable = (moi && e.gardien === moi.nom) || tel?.parent;
        const doublon = estDoublon(e, liste);
        const etiquette = () => texte(e) + (doublon ? " · ⚠️ doublon ?" : "");
        b.className = "pill" + (e.type === "sommeil" && !e.fin ? " live" : "") + (effacable ? "" : " readonly") + (doublon ? " doublon" : "");
        b.textContent = etiquette();
        groupe.append(b, boutonReaction(e));
        if (!effacable) {
          b.disabled = true;
          return groupe;
        }
        b.addEventListener("click", () => {
          if (b.classList.contains("confirm")) return supprimer(e.id);
          b.classList.add("confirm");
          b.textContent = "Effacer ?";
          setTimeout(() => {
            if (!b.isConnected) return;
            b.classList.remove("confirm");
            b.textContent = etiquette();
          }, 3000);
        });
        return groupe;
      })
    );
  }

  // ---------- Réactions ----------
  const REACTIONS = ["❤️", "😊", "👍", "😂", "😮", "😕"];
  // Parents : petit bouton « 🙂+ » (ou la réaction déjà mise) qui ouvre la palette.
  // Famille : la réaction des parents s'affiche simplement à côté de la note.
  function boutonReaction(e) {
    const r = document.createElement("button");
    r.type = "button";
    r.className = "reaction" + (e.reaction ? " mise" : "");
    if (!tel?.parent) {
      if (!e.reaction) return document.createTextNode("");
      r.disabled = true;
      r.textContent = e.reaction;
      r.title = `${e.reaction_par || "Les parents"} a réagi`;
      return r;
    }
    r.textContent = e.reaction || "🙂+";
    r.setAttribute("aria-label", e.reaction ? `Changer la réaction ${e.reaction}` : "Réagir avec un émoji");
    r.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ouvrirPalette(r, e);
    });
    return r;
  }

  function fermerPalette() {
    document.querySelector(".palette-reactions")?.remove();
  }
  function ouvrirPalette(ancre, e) {
    const dejaOuverte = document.querySelector(".palette-reactions")?.dataset.id === String(e.id);
    fermerPalette();
    if (dejaOuverte) return;
    const pal = document.createElement("div");
    pal.className = "palette-reactions";
    pal.dataset.id = e.id;
    pal.setAttribute("role", "menu");
    [...REACTIONS, ...(e.reaction ? ["✕"] : [])].forEach((emo) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = emo;
      b.setAttribute("aria-label", emo === "✕" ? "Retirer la réaction" : `Réagir ${emo}`);
      if (emo === e.reaction) b.classList.add("choisi");
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        fermerPalette();
        reagir(e, emo === "✕" || emo === e.reaction ? null : emo);
      });
      pal.append(b);
    });
    ancre.parentElement.append(pal);
    // Ne pas dépasser du bord droit de l'écran
    const deborde = pal.getBoundingClientRect().right - (window.innerWidth - 8);
    if (deborde > 0) pal.style.left = `${-deborde}px`;
  }
  document.addEventListener("click", (ev) => {
    if (!ev.target.closest?.(".palette-reactions")) fermerPalette();
  });

  async function reagir(e, emo) {
    const avant = { reaction: e.reaction, reaction_par: e.reaction_par, reaction_le: e.reaction_le };
    Object.assign(e, { reaction: emo, reaction_par: emo ? tel.nom : null, reaction_le: emo ? new Date().toISOString() : null });
    rendre(); // tout de suite à l'écran
    try {
      await api("garde_evenements", `?id=eq.${e.id}`, {
        method: "PATCH",
        body: JSON.stringify({ reaction: e.reaction, reaction_par: e.reaction_par, reaction_le: e.reaction_le }),
      });
      if (emo) toast(`${emo} envoyé à ${e.gardien || "la famille"}`);
    } catch (err) {
      Object.assign(e, avant);
      rendre();
      afficherErreur("La réaction n'a pas pu être envoyée. Réessaie.");
    }
  }

  // ---------- « Vu par les parents » ----------
  // Un parent qui regarde la page Garde marque tout seul les notes de la famille comme vues
  const gardeAffichee = () => lire("page-id", null, (v) => typeof v === "string") === "page-garde" && document.visibilityState === "visible";
  async function marquerVu() {
    if (!tel?.parent || !gardeAffichee() || !evenements.some((e) => !e.vu_le)) return;
    const maintenant = new Date().toISOString();
    try {
      await api("garde_evenements", `?vu_le=is.null&created_at=lte.${encodeURIComponent(maintenant)}`, {
        method: "PATCH",
        body: JSON.stringify({ vu_le: maintenant, vu_par: tel.nom }),
      });
      evenements.forEach((e) => !e.vu_le && Object.assign(e, { vu_le: maintenant, vu_par: tel.nom }));
    } catch (e) {
      /* pas grave : ce sera marqué la prochaine fois */
    }
  }
  window.addEventListener("page-vue", (e) => e.detail === "page-garde" && marquerVu());
  document.addEventListener("visibilitychange", () => marquerVu());

  // Famille : « 👀 Vu par Maman à 14:12 » pour ses notes du jour
  function rendreVu() {
    const el = $("g-vu");
    const miennes = moi ? evenements.filter((e) => e.gardien === moi.nom) : [];
    if (!miennes.length) return (el.hidden = true);
    const vues = miennes.filter((e) => e.vu_le).sort((a, b) => new Date(a.vu_le) - new Date(b.vu_le));
    const pasVues = miennes.length - vues.length;
    const der = vues[vues.length - 1];
    el.textContent = !der
      ? "🕓 Les parents n'ont pas encore vu tes notes"
      : `👀 Vu par ${der.vu_par || "les parents"} à ${fmtHeure(der.vu_le)}` +
        (pasVues ? ` · ${pasVues} nouvelle${pasVues > 1 ? "s" : ""} pas encore vue${pasVues > 1 ? "s" : ""}` : " · tout est vu ✓");
    el.hidden = false;
  }

  // Famille : prévenue des nouvelles réactions des parents sur ses notes (une fois chacune)
  async function annoncerReactions() {
    if (!moi) return;
    const cle = `reactions-vues-${moi.nom}`;
    const vu = lire(cle, 0, Number.isFinite);
    try {
      const depuis = new Date(Math.max(vu, Date.now() - 3 * DAY_MS)).toISOString();
      const liste = await api(
        "garde_evenements",
        `?select=type,quand,ml,reaction,reaction_par,reaction_le&gardien=eq.${encodeURIComponent(moi.nom)}&reaction_le=gt.${encodeURIComponent(depuis)}&order=reaction_le.desc`
      );
      if (!liste.length) return;
      ecrire(cle, Date.now());
      if (!vu) return; // première fois sur ce téléphone : on ne ressort pas l'historique
      const quoi = { repas: "ton biberon", couche: "ta couche", sommeil: "ton dodo" };
      const x = liste[0];
      const autres = liste.length > 1 ? ` (et ${liste.length - 1} autre${liste.length > 2 ? "s" : ""})` : "";
      $("g-reactions").textContent = `${x.reaction} ${x.reaction_par || "Les parents"} a réagi à ${quoi[x.type] || "ta note"} de ${fmtHeure(x.quand)}${autres}`;
      $("g-reactions").hidden = false;
    } catch (e) {
      /* pas grave : on réessaiera au prochain chargement */
    }
  }
  $("g-reactions").addEventListener("click", () => ($("g-reactions").hidden = true));

  // ---------- Actions ----------
  async function enregistrerNote() {
    if (!moi) return;
    const btn = $("g-note-btn");
    btn.disabled = true;
    try {
      await api("garde_jours", "?on_conflict=jour,gardien", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          jour: isoJour(jour),
          gardien: moi.nom,
          note: $("g-note").value.trim() || null,
          updated_at: new Date().toISOString(),
        }),
      });
      noteModifiee = false;
      animerBouton(btn);
      toast("📝 Note enregistrée");
      await charger();
    } catch (e) {
      afficherErreur("La note n'a pas pu être enregistrée. Réessaie.");
    } finally {
      btn.disabled = false;
    }
  }

  async function ajouter(ligne, msg) {
    if (!moi) return;
    const nouvelle = { type: ligne.type, gardien: moi.nom, ...ligne };
    const recente = !ligne.quand && evenements.filter((x) => memeContenu(x, nouvelle) && Date.now() - new Date(x.created_at || x.quand) < 5 * 60000).pop();
    if (recente) {
      const quoi = ligne.type === "repas" ? `ce biberon${ligne.ml ? ` de ${ligne.ml} ml` : ""}` : "cette couche";
      const ilYa = fmtIlYa(Date.now() - new Date(recente.created_at || recente.quand));
      if (!(await demanderDoublon(`Tu as déjà noté ${quoi} ${ilYa}. C'est bien un deuxième ?`))) {
        toast("Pas ajouté 👍");
        return;
      }
    }
    try {
      await api("garde_evenements", "", {
        method: "POST",
        body: JSON.stringify({ quand: new Date().toISOString(), gardien: moi.nom, ...ligne }),
      });
      toast(msg);
      afficherErreur(null);
      await charger();
    } catch (e) {
      afficherErreur(e.status === 409 ? "Un dodo est déjà en cours." : "Impossible d'enregistrer. Vérifie les heures et réessaie.");
      await charger();
    }
  }

  async function basculerDodo() {
    if (!dodoEnCours) return ajouter({ type: "sommeil" }, "🌙 Dodo lancé");
    try {
      await api("garde_evenements", `?id=eq.${dodoEnCours.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fin: new Date().toISOString() }),
      });
      toast(`☀️ Réveillé après ${fmtMinutes(Date.now() - new Date(dodoEnCours.quand).getTime())}`);
      await charger();
    } catch (e) {
      afficherErreur("Impossible d'enregistrer le réveil. Réessaie.");
    }
  }

  // Dodo ajouté après coup : « endormi à 13:00, réveillé à 14:30 » pour le jour affiché
  async function ajouterDodoManuel() {
    const a = $("g-dodo-debut").value;
    const b = $("g-dodo-fin").value;
    if (!a || !b) {
      afficherErreur("Indique l'heure d'endormissement et l'heure de réveil.");
      return;
    }
    const aLe = (hhmm) => {
      const [h, m] = hhmm.split(":").map(Number);
      const d = new Date(jour);
      d.setHours(h, m, 0, 0);
      return d;
    };
    const debut = aLe(a);
    const fin = aLe(b);
    if (fin <= debut) fin.setDate(fin.getDate() + 1); // ex. 23:00 → 01:30
    if (fin > new Date(Date.now() + 5 * 60 * 1000)) {
      afficherErreur("Ce dodo finit dans le futur : vérifie les heures.");
      return;
    }
    await ajouter({ type: "sommeil", quand: debut.toISOString(), fin: fin.toISOString() }, `😴 Dodo de ${fmtMinutes(fin - debut)} ajouté`);
    $("g-dodo-debut").value = "";
    $("g-dodo-fin").value = "";
  }

  async function supprimer(id) {
    try {
      await api("garde_evenements", `?id=eq.${id}`, { method: "DELETE" });
      toast("Effacé");
      await charger();
    } catch (e) {
      afficherErreur("Suppression impossible. Réessaie.");
    }
  }

  function changerJour(delta) {
    const d = new Date(jour);
    d.setDate(d.getDate() + delta);
    if (d > minuit()) return;
    jour = d;
    noteModifiee = false;
    charger();
  }

  $("g-prev").addEventListener("click", () => changerJour(-1));
  $("g-next").addEventListener("click", () => changerJour(1));
  $("g-note").addEventListener("input", () => {
    noteModifiee = true;
    $("g-note-saved").textContent = "Pense à enregistrer 👇";
  });
  $("g-note-btn").addEventListener("click", enregistrerNote);
  $("g-repas-btn").addEventListener("click", () => {
    const ml = $("g-ml").value ? Number($("g-ml").value) : null;
    ajouter({ type: "repas", ml, lait: $("g-lait").value }, "🍼 Biberon noté");
  });
  document.querySelectorAll("#page-garde [data-couche]").forEach((b) =>
    b.addEventListener("click", () => {
      const c = b.dataset.couche;
      ajouter({ type: "couche", pipi: c !== "caca", caca: c !== "pipi" }, "👶 Couche notée");
    })
  );
  $("g-sleep-btn").addEventListener("click", basculerDodo);
  $("g-dodo-add").addEventListener("click", ajouterDodoManuel);

  // Minuit passé : on revient sur le nouveau jour (sauf si une note est en cours d'écriture)
  let dernierMinuit = minuit().getTime();
  function tick() {
    if (minuit().getTime() !== dernierMinuit) {
      const etaitAujourdhui = jour.getTime() === dernierMinuit;
      dernierMinuit = minuit().getTime();
      if (etaitAujourdhui && !noteModifiee) {
        jour = minuit();
        charger();
        return;
      }
    }
    // Seul le bouton bouge chaque seconde (redessiner les pastilles annulerait un « Effacer ? »)
    if (dodoEnCours) majBoutonDodo();
  }

  enregistrerRubrique({ charger, tick });
})();
