const CACHE_NAME='managerpro-v2';
const APP_SHELL=new Set([
  './','./index.html','./manifest.webmanifest','./icon-192.svg','./icon-512.svg','./icon-512-maskable.svg'
]);
const PRIVATE_PATH_RE=/\/(api|auth|login|logout|admin|session|sessions|token|tokens|account|profile|me)(\/|$)/i;

function isSafeRequest(request){
  if(request.method!=='GET'||request.headers.has('authorization')) return false;
  const url=new URL(request.url);
  return url.origin===self.location.origin&&!PRIVATE_PATH_RE.test(url.pathname);
}
function shellKey(request){
  const url=new URL(request.url);
  const relative='.'+url.pathname.replace(self.registration.scope.replace(url.origin,''),'./').replace(/^\.\/\//,'./');
  return relative==='.'?'./':relative;
}

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll([...APP_SHELL])));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(!isSafeRequest(request)) return;

  if(request.mode==='navigate'){
    event.respondWith(
      fetch(request,{cache:'no-store'}).catch(()=>caches.match('./index.html'))
    );
    return;
  }

  const url=new URL(request.url);
  const path='.'+url.pathname.substring(new URL(self.registration.scope).pathname.length-1);
  if(!APP_SHELL.has(path)) return;

  event.respondWith(caches.match(request).then(hit=>hit||fetch(request)));
});
