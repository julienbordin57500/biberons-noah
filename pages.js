// Trois pages côte à côte : on glisse du doigt (ou on touche un onglet) pour passer de l'une à l'autre
(() => {
  const conteneur = $("pages");
  const pages = [...conteneur.querySelectorAll(".page")];
  const onglets = [...document.querySelectorAll(".tab")];
  let actuelle = lire("page", 0, (v) => Number.isInteger(v) && v >= 0 && v < pages.length);

  // Le conteneur prend la hauteur de la page affichée (sinon il garde celle de la plus longue)
  function ajusterHauteur() {
    conteneur.style.height = pages[actuelle].offsetHeight + "px";
  }

  function surligner(i) {
    onglets.forEach((o, j) => o.setAttribute("aria-selected", String(j === i)));
    document.body.dataset.page = String(i);
  }

  function marquer(i) {
    actuelle = i;
    surligner(i);
    ecrire("page", i);
    ajusterHauteur();
  }

  // La hauteur ne change qu'une fois arrivé : la changer pendant le glissement
  // ferait revenir le navigateur sur la page de départ
  function aller(i, smooth = true) {
    surligner(i);
    conteneur.scrollTo({ left: i * conteneur.clientWidth, behavior: smooth ? "smooth" : "auto" });
    if (!smooth) marquer(i);
  }

  let attente;
  conteneur.addEventListener("scroll", () => {
    clearTimeout(attente);
    attente = setTimeout(() => {
      const i = Math.round(conteneur.scrollLeft / conteneur.clientWidth);
      marquer(i);
    }, 60);
  });

  onglets.forEach((o, i) => o.addEventListener("click", () => aller(i)));
  window.addEventListener("contenu-change", ajusterHauteur);
  window.addEventListener("resize", () => aller(actuelle, false));
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(ajusterHauteur);
    pages.forEach((p) => ro.observe(p));
  }

  marquer(actuelle);
  requestAnimationFrame(() => aller(actuelle, false));

  demarrerRafraichissement();
})();
