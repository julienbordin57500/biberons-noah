// Connexion Supabase (clé publique : la sécurité est gérée par les règles RLS de la table)
const SUPABASE_URL = "https://jybymeodrcjdxqxvvggm.supabase.co";
const SUPABASE_KEY = "sb_publishable_KnZB8Lh0snCPuAPphixPGw_QoNmXlrF";
const API = `${SUPABASE_URL}/rest/v1/biberons`;

const QUANTITES = [60, 90, 120, 150, 180, 210, 240];
const DAY_MS = 24 * 60 * 60 * 1000;
// Couleur du minuteur : vert, puis orange, puis rouge
const WARN_MS = 2.5 * 60 * 60 * 1000;
const LATE_MS = 3.5 * 60 * 60 * 1000;

const $ = (id) => document.getElementById(id);

let biberons = []; // dernières 24 h, du plus récent au plus ancien
let dernier = null; // le tout dernier biberon, même s'il date de plus de 24 h
let quantite = loadQuantite();

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
    biberons = await api(`?select=id,pris_le,quantite_ml&pris_le=gte.${encodeURIComponent(depuis)}&order=pris_le.desc`);
    if (biberons.length) {
      dernier = biberons[0];
    } else {
      const [d] = await api("?select=id,pris_le,quantite_ml&order=pris_le.desc&limit=1");
      dernier = d || null;
    }
    afficherErreur(null);
  } catch (e) {
    afficherErreur("Impossible de charger les biberons. Vérifie la connexion internet.");
  }
  rendre();
}

async function ajouter() {
  const btn = $("add-btn");
  btn.disabled = true;
  try {
    const pris_le = heureChoisie().toISOString();
    await api("", { method: "POST", body: JSON.stringify({ pris_le, quantite_ml: quantite }) });
    btn.classList.remove("pop");
    void btn.offsetWidth;
    btn.classList.add("pop");
    toast(quantite ? `Biberon de ${quantite} ml ajouté !` : "Biberon ajouté !");
    $("when-time").value = "";
    await charger();
  } catch (e) {
    afficherErreur("Le biberon n'a pas pu être enregistré. Réessaie.");
  } finally {
    btn.disabled = false;
  }
}

async function supprimer(id) {
  try {
    await api(`?id=eq.${id}`, { method: "DELETE" });
    toast("Biberon supprimé");
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
    const jour = d.toDateString() === new Date().toDateString() ? "" : " (" + d.toLocaleDateString("fr-FR", { weekday: "long" }) + ")";
    $("last-info").textContent = `à ${fmtHeure(d)}${jour}` + (dernier.quantite_ml ? ` · ${dernier.quantite_ml} ml` : "");
  } else {
    $("last-info").textContent = "Pas encore de biberon enregistré";
  }
  tick();

  // Totaux
  const minuit = new Date();
  minuit.setHours(0, 0, 0, 0);
  const aujourdhui = biberons.filter((b) => new Date(b.pris_le) >= minuit);
  remplirStat("today", aujourdhui);
  remplirStat("day", biberons);

  // Liste
  const ul = $("list");
  ul.replaceChildren(
    ...biberons.map((b) => {
      const li = document.createElement("li");
      const d = new Date(b.pris_le);
      li.innerHTML = `
        <span class="h-time">${fmtHeure(d)}</span>
        <span class="h-ml">${b.quantite_ml ? b.quantite_ml + " ml" : "quantité ?"}</span>
        <span class="h-ago">${fmtIlYa(Date.now() - d.getTime())}</span>`;
      const del = document.createElement("button");
      del.type = "button";
      del.className = "del";
      del.textContent = "✕";
      del.setAttribute("aria-label", `Supprimer le biberon de ${fmtHeure(d)}`);
      del.addEventListener("click", () => {
        // Deux appuis pour supprimer, pour éviter les erreurs
        if (del.classList.contains("confirm")) return supprimer(b.id);
        del.classList.add("confirm");
        del.textContent = "Supprimer ?";
        setTimeout(() => {
          del.classList.remove("confirm");
          del.textContent = "✕";
        }, 3000);
      });
      li.append(del);
      return li;
    })
  );
  $("empty").hidden = biberons.length > 0;
}

function remplirStat(prefix, liste) {
  const ml = liste.reduce((t, b) => t + (b.quantite_ml || 0), 0);
  $(`${prefix}-count`).textContent = liste.length;
  $(`${prefix}-plural`).textContent = liste.length > 1 ? "s" : "";
  $(`${prefix}-ml`).textContent = `${ml} ml bus`;
}

function rendreChips() {
  const options = [...QUANTITES, null];
  $("chips").replaceChildren(
    ...options.map((q) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(q === quantite));
      b.textContent = q ? `${q} ml` : "Je ne sais pas";
      b.addEventListener("click", () => {
        quantite = q;
        saveQuantite(q);
        rendreChips();
      });
      return b;
    })
  );
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

// La dernière quantité choisie est retenue sur ce téléphone
function loadQuantite() {
  try {
    const v = localStorage.getItem("quantite");
    if (v === "null") return null;
    if (v && QUANTITES.includes(Number(v))) return Number(v);
  } catch (e) {}
  return 150;
}
function saveQuantite(q) {
  try {
    localStorage.setItem("quantite", String(q));
  } catch (e) {}
}

// ---------- Démarrage ----------
$("add-btn").addEventListener("click", ajouter);
$("when-now").addEventListener("click", () => ($("when-time").value = ""));

rendreChips();
charger();
setInterval(tick, 1000);
setInterval(charger, 60 * 1000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) charger();
});
