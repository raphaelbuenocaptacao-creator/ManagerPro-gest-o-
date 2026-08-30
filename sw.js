const CACHE_NAME='managerpro-v3-safe-shell';
const APP_SHELL=new Set([
  './','./index.html','./manifest.webmanifest','./icon-192.svg','./icon-512.svg','./icon-512-maskable.svg'
]);
const PRIVATE_PATH_RE=/\/(api|auth|login|logout|admin|session|sessions|token|tokens|password|account|profile|me)(\/|$)/i;
const SENSITIVE_QUERY_KEYS=new Set([
  'token','access_token','refresh_token','password','passwd','secret','session','auth','authorization',
  'api_key','apikey','key','code','credential','credentials'
]);

function hasSensitiveQuery(url){
  for(const key of url.searchParams.keys()){
    if(SENSITIVE_QUERY_KEYS.has(String(key).toLowerCase())) return true;
  }
  return false;
}

function isSafeRequest(request){
  if(request.method!=='GET'||request.headers.has('authorization')||request.headers.has('cookie')) return false;
  const url=new URL(request.url);
  return url.origin===self.location.origin&&!PRIVATE_PATH_RE.test(url.pathname)&&!hasSensitiveQuery(url);
}

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll([...APP_SHELL])));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(!isSafeRequest(request)) return;

  const url=new URL(request.url);
  if(request.mode==='navigate'){
    event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>caches.match('./index.html')));
    return;
  }

  if(url.search) return;
  const scopePath=new URL(self.registration.scope).pathname;
  const relativePath=url.pathname.startsWith(scopePath)?url.pathname.slice(scopePath.length):url.pathname;
  const path=relativePath?`./${relativePath.replace(/^\//,'')}`:'./';
  if(!APP_SHELL.has(path)) return;

  event.respondWith(
    caches.match(request).then(hit=>hit||fetch(request,{cache:'no-store'}).then(response=>{
      if(!response.ok||response.type!=='basic') return response;
      const copy=response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(request,copy)));
      return response;
    }))
  );
});
