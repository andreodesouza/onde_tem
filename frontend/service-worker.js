// service-worker.js

const CACHE_NAME = "ondetem-cache-v2";
const urlsToCache = [
  "./",
  "./app.html",
  "./user_dashboard.html",
  "./css/user_dashboard.css",
  "./js/user_dashboard.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  // Pré-cachear arquivos importantes na instalação
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Cache aberto e ficheiros essenciais guardados");
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Limpar caches antigos se houver atualizações
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("A remover cache antigo:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Responder com cache se estiver offline, ou buscar na rede
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request);
    })
  );
});

self.addEventListener("push", (event) => {
  const dados = event.data?.json() ?? {
    title: "Onde Tem? - Lembrete",
    body: "Você tem um agendamento próximo!",
    icon: "assets/img/icon-192.png",
  };

  event.waitUntil(
    self.registration.showNotification(dados.title, {
      body: dados.body,
      icon: dados.icon,
      badge: "assets/img/icon-72.png",
      vibrate: [200, 100, 200]
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Quando o cliente clica na notificação, abre diretamente o dashboard do utilizador
  event.waitUntil(
    clients.openWindow("/user_dashboard.html")
  );
});