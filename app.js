// Connexion Supabase (clé publique : la sécurité est gérée par les règles RLS de la table)
const SUPABASE_URL = "https://jybymeodrcjdxqxvvggm.supabase.co";
const SUPABASE_KEY = "sb_publishable_KnZB8Lh0snCPuAPphixPGw_QoNmXlrF";
const API = `${SUPABASE_URL}/rest/v1/biberons`;
const COLONNES = "id,type,pris_le,quantite_ml,cote,duree_min";

const QUANTITES = [60, 90, 120, 150, 180, 210, 240];
const COTES = ["gauche", "droite", "les deux"];
const DUREES = [5, 10, 15, 20, 30];
const DAY_MS = 24 * 60 * 60 * 1000;
// Couleur du minuteur : vert, puis orange, puis rouge
const WARN_MS = 2.5 * 60 * 60 * 1000;
const LATE_MS = 3.5 * 60 * 60 * 1000;

const MODES = {
  biberon: { emoji: "🍼", bouton: "Nouveau biberon", nom: "Biberon" },
  allaitement: { emoji: "🤱", bouton: "Nouvel allaitement", nom: "Allaitement" },
};

const $ = (id) => document.getElementById(id);

let repas = []; // dernières 24 h, du plus récent au plus ancien
let dernier = null; // le tout dernier repas, même s'il date de plus de 24 h

// Choix retenus sur ce téléphone
const choix = {
  quantite: lire("quantite", 150, (v) => v === null || QUANTITES.includes(v)),
  cote: lire("cote", null, (v) => v === null || COTES.includes(v)),
  duree: lire("duree", null, (v) => v === null || DUREES.includes(v)),
};
// La nuit (21 h – 7 h), on propose l'allaitement par défaut
const heure = new Date().getHours();
let mode = heure >= 21 || heure < 7 ? "allaitement" : "biberon";

// ---------- API ----------
async function api(path = "", options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return res.status === 204 ? null : res.json();
}

async function charger() {
  try {
    const depuis = new Date(Date.now() - DAY_MS).toISOString();
    repas = await api(`?select=${COLONNES}&pris_le=gte.${encodeURIComponent(depuis)}&order=pris_le.desc`);
    if (repas.length) {
      dernier = repas[0];
    } else {
      const [d] = await api(`?select=${COLONNES}&order=pris_le.desc&limit=1`);
      dernier = d || null;
    }
    afficherErreur(null);
  } catch (e) {
    afficherErreur("Impossible de charger les repas. Vérifie la connexion internet.");
  }
  rendre();
}

async function ajouter() {
  const btn = $("add-btn");
  btn.disabled = true;
  try {
    const ligne =
      mode === "biberon"
        ? { type: "biberon", quantite_ml: choix.quantite }
        : { type: "allaitement", cote: choix.cote, duree_min: choix.duree };
    ligne.pris_le = heureChoisie().toISOString();
    await api("", { method: "POST", body: JSON.stringify(ligne) });
    btn.classList.remove("pop");
    void btn.offsetWidth;
    btn.classList.add("pop");
    toast(`${MODES[mode].emoji} ${MODES[mode].nom} ajouté !`);
    $("when-time").value = "";
    await charger();
  } catch (e) {
    afficherErreur("Le repas n'a pas pu être enregistré. Réessaie.");
  } finally {
    btn.disabled = false;
  }
}

async function supprimer(id) {
  try {
    await api(`?id=eq.${id}`, { method: "DELETE" });
    toast("Repas supprimé");
    await charger();
  } catch (e) {
    afficherErreur("Suppression impossible. Réessaie.");
  }
}

// ---------- Heure ----------
function heureChoisie() {
  const v = $("when-time").value;
  if (!v) return new Date();
  const [h, m] = v.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  // Une heure « dans le futur » veut dire hier (ex. 23h30 saisi à 1h du matin)
  if (d.getTime() > Date.now() + 60 * 1000) d.setDate(d.getDate() - 1);
  return d;
}

const fmtHeure = (d) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const pad = (n) => String(n).padStart(2, "0");

function fmtDuree(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const j = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (j > 0) return `${j} j ${h} h`;
  return `${h}:${pad(m)}:${pad(s % 60)}`;
}

function fmtIlYa(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  return `il y a ${h} h${min % 60 ? " " + pad(min % 60) : ""}`;
}

// « 150 ml » ou « gauche · 15 min »
function details(r) {
  if (r.type === "allaitement") {
    const morceaux = [r.cote, r.duree_min && `${r.duree_min} min`].filter(Boolean);
    return morceaux.join(" · ");
  }
  return r.quantite_ml ? `${r.quantite_ml} ml` : "";
}

// ---------- Affichage ----------
function tick() {
  const el = $("timer");
  if (!dernier) {
    el.textContent = "--:--";
    el.className = "timer";
    return;
  }
  const ecart = Date.now() - new Date(dernier.pris_le).getTime();
  el.textContent = fmtDuree(ecart);
  el.className = "timer" + (ecart >= LATE_MS ? " late" : ecart >= WARN_MS ? " warn" : "");
}

function rendre() {
  // Minuteur
  if (dernier) {
    const d = new Date(dernier.pris_le);
    const m = MODES[dernier.type] || MODES.biberon;
    const jour = d.toDateString() === new Date().toDateString() ? "" : " (" + d.toLocaleDateString("fr-FR", { weekday: "long" }) + ")";
    const det = details(dernier);
    $("last-info").textContent = `${m.emoji} ${m.nom} à ${fmtHeure(d)}${jour}` + (det ? ` · ${det}` : "");
  } else {
    $("last-info").textContent = "Pas encore de repas enregistré";
  }
  tick();

  // Totaux
  const minuit = new Date();
  minuit.setHours(0, 0, 0, 0);
  remplirStat("today", repas.filter((r) => new Date(r.pris_le) >= minuit));
  remplirStat("day", repas);

  // Liste
  $("list").replaceChildren(...repas.map(ligneHistorique));
  $("empty").hidden = repas.length > 0;
}

function ligneHistorique(r) {
  const li = document.createElement("li");
  const d = new Date(r.pris_le);
  const m = MODES[r.type] || MODES.biberon;
  li.className = r.type;
  const det = details(r);
  li.innerHTML = `
    <span class="h-emoji" aria-hidden="true">${m.emoji}</span>
    <span class="h-time">${fmtHeure(d)}</span>
    <span class="h-info"><span class="h-type">${m.nom}</span>${det ? `<span class="h-det">${det}</span>` : ""}</span>
    <span class="h-ago">${fmtIlYa(Date.now() - d.getTime())}</span>`;
  const del = document.createElement("button");
  del.type = "button";
  del.className = "del";
  del.textContent = "✕";
  del.setAttribute("aria-label", `Supprimer le repas de ${fmtHeure(d)}`);
  del.addEventListener("click", () => {
    // Deux appuis pour supprimer, pour éviter les erreurs
    if (del.classList.contains("confirm")) return supprimer(r.id);
    del.classList.add("confirm");
    del.textContent = "Supprimer ?";
    setTimeout(() => {
      del.classList.remove("confirm");
      del.textContent = "✕";
    }, 3000);
  });
  li.append(del);
  return li;
}

function remplirStat(prefix, liste) {
  const bib = liste.filter((r) => r.type !== "allaitement");
  const all = liste.filter((r) => r.type === "allaitement");
  const ml = bib.reduce((t, r) => t + (r.quantite_ml || 0), 0);
  const min = all.reduce((t, r) => t + (r.duree_min || 0), 0);
  $(`${prefix}-count`).textContent = liste.length;
  $(`${prefix}-bib`).textContent = `🍼 ${bib.length}` + (ml ? ` · ${ml} ml` : "");
  $(`${prefix}-all`).textContent = `🤱 ${all.length}` + (min ? ` · ${min} min` : "");
}

// ---------- Choix ----------
function rendreChips(id, options, cle, libelle) {
  $(id).replaceChildren(
    ...[...options, null].map((v) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(v === choix[cle]));
      b.textContent = v === null ? "Je ne sais pas" : libelle(v);
      b.addEventListener("click", () => {
        choix[cle] = v;
        ecrire(cle, v);
        rendreChips(id, options, cle, libelle);
      });
      return b;
    })
  );
}

function rendreMode() {
  document.querySelectorAll(".mode-btn").forEach((b) => {
    b.setAttribute("aria-selected", String(b.dataset.mode === mode));
  });
  $("panel-biberon").hidden = mode !== "biberon";
  $("panel-allaitement").hidden = mode !== "allaitement";
  $("add-emoji").textContent = MODES[mode].emoji;
  $("add-label").textContent = MODES[mode].bouton;
  $("add-btn").dataset.mode = mode;
}

function afficherErreur(msg) {
  $("error").hidden = !msg;
  $("error").textContent = msg || "";
}

let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2200);
}

function lire(cle, defaut, valide) {
  try {
    const brut = localStorage.getItem(cle);
    if (brut !== null) {
      const v = JSON.parse(brut);
      if (valide(v)) return v;
    }
  } catch (e) {}
  return defaut;
}
function ecrire(cle, v) {
  try {
    localStorage.setItem(cle, JSON.stringify(v));
  } catch (e) {}
}

// ---------- Démarrage ----------
document.querySelectorAll(".mode-btn").forEach((b) =>
  b.addEventListener("click", () => {
    mode = b.dataset.mode;
    rendreMode();
  })
);
$("add-btn").addEventListener("click", ajouter);
$("when-now").addEventListener("click", () => ($("when-time").value = ""));

rendreChips("chips-ml", QUANTITES, "quantite", (v) => `${v} ml`);
rendreChips("chips-cote", COTES, "cote", (v) => v[0].toUpperCase() + v.slice(1));
rendreChips("chips-duree", DUREES, "duree", (v) => `${v} min`);
rendreMode();
charger();
setInterval(tick, 1000);
setInterval(charger, 60 * 1000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) charger();
});
