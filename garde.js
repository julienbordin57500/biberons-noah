// Page Garde : espace de la nounou et des mamies (note du jour + récap simplifié)
// Les données sont à part (tables garde_*) et ne se mélangent pas avec celles des parents.
(() => {
  const GARDIENS = ["Nounou", "Mamie", "Papi", "Autre"];
  const GARDIEN_EMOJI = { Nounou: "👩", Mamie: "👵", Papi: "👴", Autre: "🙂" };

  let jour = minuit(); // jour affiché
  let infoJour = null; // { gardien, note, updated_at }
  let evenements = [];
  let dodoEnCours = null; // tous jours confondus
  let gardien = null;
  let noteModifiee = false;

  const isoJour = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const estAujourdhui = () => jour.getTime() === minuit().getTime();

  async function charger() {
    const debut = jour;
    const fin = new Date(jour);
    fin.setDate(fin.getDate() + 1);
    try {
      const [j, ev, enCours] = await Promise.all([
        api("garde_jours", `?select=*&jour=eq.${isoJour(jour)}`),
        api(
          "garde_evenements",
          `?select=*&quand=gte.${encodeURIComponent(debut.toISOString())}&quand=lt.${encodeURIComponent(fin.toISOString())}&order=quand.asc`
        ),
        api("garde_evenements", "?select=*&type=eq.sommeil&fin=is.null&limit=1"),
      ]);
      infoJour = j[0] || null;
      evenements = ev;
      dodoEnCours = enCours[0] || null;
      if (!noteModifiee) {
        $("g-note").value = infoJour?.note || "";
        gardien = infoJour?.gardien || null;
      }
    } catch (e) {
      afficherErreur("Impossible de charger l'espace garde. Vérifie la connexion internet.");
    }
    rendre();
  }

  // ---------- Affichage ----------
  function rendre() {
    const nom = jour.toLocaleDateString("fr-FR", { weekday: "long" });
    $("g-day-name").textContent = estAujourdhui() ? `Aujourd'hui, ${nom}` : nom[0].toUpperCase() + nom.slice(1);
    $("g-day-date").textContent = jour.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    $("g-next").disabled = estAujourdhui();
    rendreGardiens();
    $("g-note-saved").textContent = infoJour?.updated_at && !noteModifiee
      ? `Enregistrée à ${fmtHeure(infoJour.updated_at)}${jourSiPasAujourdhui(infoJour.updated_at)}`
      : "";

    const aujourdhui = estAujourdhui();
    document.querySelectorAll("#page-garde [data-today-only]").forEach((el) => (el.hidden = !aujourdhui));
    $("g-past-hint").hidden = aujourdhui;

    const repas = evenements.filter((e) => e.type === "repas");
    const couches = evenements.filter((e) => e.type === "couche");
    const dodos = evenements.filter((e) => e.type === "sommeil");

    const ml = repas.reduce((t, e) => t + (e.ml || 0), 0);
    $("g-repas-sum").textContent = `${repas.length}` + (ml ? ` · ${ml} ml` : "");
    remplir("g-repas-list", repas, (e) => `${fmtHeure(e.quand)} · ${e.ml ? e.ml + " ml" : "?"}${e.lait === "maternel" ? " 🥛" : ""}`, "Pas encore de repas");

    const cacas = couches.filter((e) => e.caca).length;
    $("g-couche-sum").textContent = `${couches.length}` + (cacas ? ` · ${cacas} 💩` : "");
    remplir("g-couche-list", couches, (e) => `${fmtHeure(e.quand)} ${e.pipi ? "💧" : ""}${e.caca ? "💩" : ""}`, "Pas encore de couche");

    rendreSommeil(dodos);
    contenuChange();
  }

  function rendreSommeil(dodos = evenements.filter((e) => e.type === "sommeil")) {
    const total = dodos.reduce((t, e) => t + ((e.fin ? new Date(e.fin) : new Date()) - new Date(e.quand)), 0);
    $("g-sleep-sum").textContent = dodos.length ? fmtMinutes(total) : "0";
    remplir(
      "g-sleep-list",
      dodos,
      (e) => `${fmtHeure(e.quand)} → ${e.fin ? fmtHeure(e.fin) : "en cours"}`,
      "Pas encore de dodo"
    );
    const btn = $("g-sleep-btn");
    if (dodoEnCours) {
      btn.textContent = `☀️ Il se réveille · ${fmtDuree(Date.now() - new Date(dodoEnCours.quand).getTime())}`;
      btn.classList.add("on");
    } else {
      btn.textContent = "🌙 Il s'endort";
      btn.classList.remove("on");
    }
  }

  // Pastilles : un appui affiche « effacer ? », un second efface
  function remplir(id, liste, texte, vide) {
    const el = $(id);
    if (!liste.length) {
      el.innerHTML = `<span class="pill empty">${vide}</span>`;
      return;
    }
    el.replaceChildren(
      ...liste.map((e) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "pill" + (e.type === "sommeil" && !e.fin ? " live" : "");
        b.textContent = texte(e);
        b.addEventListener("click", () => {
          if (b.classList.contains("confirm")) return supprimer(e.id);
          b.classList.add("confirm");
          b.textContent = "Effacer ?";
          setTimeout(() => {
            if (!b.isConnected) return;
            b.classList.remove("confirm");
            b.textContent = texte(e);
          }, 3000);
        });
        return b;
      })
    );
  }

  let rendreGardiens = () => {};
  rendreGardiens = rendreChips(
    "chips-gardien",
    GARDIENS,
    () => gardien,
    (v) => {
      gardien = v;
      noteModifiee = true;
      $("g-note-saved").textContent = "Pense à enregistrer 👇";
    },
    (v) => `${GARDIEN_EMOJI[v]} ${v}`,
    false
  );

  // ---------- Actions ----------
  async function enregistrerNote() {
    const btn = $("g-note-btn");
    btn.disabled = true;
    try {
      await api("garde_jours", "?on_conflict=jour", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          jour: isoJour(jour),
          gardien,
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
    try {
      await api("garde_evenements", "", { method: "POST", body: JSON.stringify({ quand: new Date().toISOString(), ...ligne }) });
      toast(msg);
      afficherErreur(null);
      await charger();
    } catch (e) {
      afficherErreur(e.status === 409 ? "Un dodo est déjà en cours." : "Impossible d'enregistrer. Réessaie.");
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
    if (dodoEnCours) $("g-sleep-btn").textContent = `☀️ Il se réveille · ${fmtDuree(Date.now() - new Date(dodoEnCours.quand).getTime())}`;
  }

  enregistrerRubrique({ charger, tick });
})();
