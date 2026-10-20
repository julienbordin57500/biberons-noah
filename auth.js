// Connexion par profil + mot de passe (comptes Supabase « parents » et « famille »)
// Les droits sont vérifiés par le serveur (règles RLS) : l'écran ne fait que guider.

const PROFILS = [
  { nom: "Papa", emoji: "👨", role: "parents" },
  { nom: "Maman", emoji: "👩", role: "parents" },
  { nom: "Mamita", emoji: "👩‍🦰", role: "famille" },
  { nom: "Mamou", emoji: "👵", role: "famille" },
  { nom: "Mamie Domi", emoji: "👵", role: "famille" },
  { nom: "Papou", emoji: "👴", role: "famille" },
  { nom: "Papi Éric", emoji: "👴", role: "famille" },
  { nom: "Autre", emoji: "🙂", role: "famille", prenom: true },
];
const COMPTES = { parents: "parents.noah@example.com", famille: "famille.noah@example.com" };

// Profil connecté sur ce téléphone : { nom, emoji, role }
let profil = null;
const estParent = () => profil?.role === "parents";
// Les pages Repas, Couches, Sommeil et Santé ne sont modifiables que par les parents
const peutModifier = () => estParent();

let resoudreConnexion;
const connexionPrete = new Promise((r) => (resoudreConnexion = r));

(() => {
  const sb = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "carnet-noah-auth" },
  });
  let choix = lire("dernier-profil", null, (v) => PROFILS.some((p) => p.nom === v));

  obtenirJeton = async () => {
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session?.access_token || null;
  };

  // ---------- Écran de connexion ----------
  function rendreProfils() {
    $("login-profils").replaceChildren(
      ...PROFILS.map((p) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "who-btn";
        b.setAttribute("aria-pressed", String(p.nom === choix));
        b.innerHTML = `<span class="emoji" aria-hidden="true">${p.emoji}</span><span>${esc(p.nom)}</span>`;
        b.addEventListener("click", () => {
          choix = p.nom;
          rendreProfils();
          $("login-mdp").focus();
        });
        return b;
      })
    );
    const p = PROFILS.find((x) => x.nom === choix);
    $("login-prenom-box").hidden = !p?.prenom;
    $("login-suite").hidden = !p;
  }

  function montrerConnexion() {
    document.body.classList.add("verrouille");
    $("login").hidden = false;
    $("login-erreur").textContent = "";
    $("login-mdp").value = "";
    rendreProfils();
  }

  async function seConnecter(e) {
    e.preventDefault();
    const p = PROFILS.find((x) => x.nom === choix);
    if (!p) return;
    const mdp = $("login-mdp").value;
    let nom = p.nom;
    if (p.prenom) {
      nom = $("login-prenom").value.trim().slice(0, 30);
      if (!nom) {
        $("login-erreur").textContent = "Écris ton prénom.";
        return;
      }
    }
    if (!mdp) {
      $("login-erreur").textContent = "Tape le mot de passe.";
      return;
    }
    const btn = $("login-btn");
    btn.disabled = true;
    $("login-erreur").textContent = "";
    try {
      if (!sb) throw new Error("hors ligne");
      const { error } = await sb.auth.signInWithPassword({ email: COMPTES[p.role], password: mdp });
      if (error) {
        $("login-erreur").textContent = error.status === 400 ? "Mot de passe incorrect." : "Connexion impossible, réessaie.";
        return;
      }
      ecrire("dernier-profil", p.nom);
      activer({ nom, emoji: p.emoji, role: p.role }, true);
    } catch (err) {
      $("login-erreur").textContent = "Pas de réseau : il faut internet pour la première connexion.";
    } finally {
      btn.disabled = false;
      $("login-mdp").value = "";
    }
  }

  function activer(pr, premiere) {
    profil = pr;
    ecrire("profil", pr);
    document.body.classList.remove("verrouille");
    document.body.classList.toggle("lecture-seule", !estParent());
    $("login").hidden = true;
    $("moi-nom").textContent = `${pr.emoji} ${pr.nom}`;
    $("moi").hidden = false;
    window.dispatchEvent(new CustomEvent("connecte", { detail: { premiere } }));
    resoudreConnexion();
    if (premiere) rechargerTout();
  }

  async function seDeconnecter() {
    if (!confirm("Changer de profil ? Il faudra retaper le mot de passe.")) return;
    try {
      await sb?.auth.signOut();
    } catch (e) {}
    profil = null;
    ecrire("profil", null);
    $("moi").hidden = true;
    montrerConnexion();
  }

  // Le serveur refuse (jeton expiré ou supprimé) : on redemande la connexion
  surNonConnecte = () => {
    if (!$("login").hidden) return;
    profil = null;
    ecrire("profil", null);
    montrerConnexion();
  };

  $("login-form").addEventListener("submit", seConnecter);
  $("moi-changer").addEventListener("click", seDeconnecter);

  // ---------- Démarrage ----------
  (async () => {
    // Test en local uniquement : ?dev=parents ou ?dev=famille saute la connexion
    const dev = location.hostname === "localhost" && new URLSearchParams(location.search).get("dev");
    if (dev === "parents" || dev === "famille") {
      const p = PROFILS.find((x) => x.role === dev);
      return activer({ nom: p.nom, emoji: p.emoji, role: p.role }, false);
    }
    const memo = lire("profil", null, (v) => v && PROFILS.some((p) => p.role === v.role) && typeof v.nom === "string");
    let session = null;
    try {
      session = sb ? (await sb.auth.getSession()).data.session : null;
    } catch (e) {}
    // Hors ligne avec un profil déjà connecté : on ouvre quand même (les données en cache s'affichent)
    if (memo && (session || (!navigator.onLine && localStorage.getItem("carnet-noah-auth")))) return activer(memo, false);
    montrerConnexion();
  })();
})();
