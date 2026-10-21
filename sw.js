// Garde l'appli sur le téléphone pour qu'elle s'ouvre même sans réseau.
// Réseau d'abord (pour avoir les mises à jour), mémoire du téléphone si pas de réseau.
const CACHE = "carnet-noah-v15";
const FICHIERS = [
  "./",
  "index.html",
  "style.css?v=15",
  "scene.js?v=15",
  "commun.js?v=15",
  "auth.js?v=15",
  "repas.js?v=15",
  "couches.js?v=15",
  "sommeil.js?v=15",
  "medicaments.js?v=15",
  "sante.js?v=15",
  "garde.js?v=15",
  "tuto.js?v=15",
  "pages.js?v=15",
  "icon.svg",
  "icon-180.png",
  "manifest.webmanifest",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Les données (Supabase) ne passent pas par ici : l'appli gère elle-même le hors ligne
  if (url.hostname.endsWith("supabase.co")) return;

  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        // Au-delà de 4 s, on considère qu'il n'y a pas de réseau
        const res = await Promise.race([
          fetch(req),
          new Promise((_, rej) => setTimeout(() => rej(new Error("lent")), 4000)),
        ]);
        if (res.ok || res.type === "opaque") cache.put(req, res.clone());
        return res;
      } catch (err) {
        const enCache = (await cache.match(req)) || (req.mode === "navigate" ? await cache.match("index.html") : null);
        if (enCache) return enCache;
        throw err;
      }
    })()
  );
});
