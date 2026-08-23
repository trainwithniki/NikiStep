const CACHE_NAME='niki-apps-v8';
const APP_SHELL=[
  './',
  './index.html',
  './public.webmanifest',
  './public-pwa-install.js?v=20260822-4',
  './admin.html',
  './admin.webmanifest',
  './modal-scroll-lock.js?v=20260822-1',
  './config.js',
  './supabase-sync.js?v=20260822-5',
  './admin-pwa-install.js?v=20260823-2',
  './assets/admin-icons/admin-icon-192.png',
  './assets/admin-icons/admin-icon-512.png',
  './assets/admin-icons/admin-icon-maskable-512.png',
  './assets/admin-icons/admin-apple-touch-icon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/hero-niki-portrait.jpg',
  './assets/hero-niki-text-mask.png',
  './assets/multisport-card.webp',
  './assets/fit-body-center-map.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.mode==='navigate'){
    event.respondWith(
      fetch(request)
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
          return response;
        })
        .catch(()=>caches.match(request).then(cached=>cached||caches.match(url.pathname.endsWith('/admin.html')||url.pathname.endsWith('/admin')?'./admin.html':'./index.html')))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response=>{
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
        }
        return response;
      })
      .catch(()=>caches.match(request))
  );
});
