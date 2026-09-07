const CACHE_PREFIX='managerpro-';
const CACHE_NAME='managerpro-v5-private-isolated-shell';
const APP_SHELL=new Set([
  './','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-512-maskable.png'
]);
const PRIVATE_PATH_RE=/\/(api|auth|login|logout|admin|session|sessions|token|tokens|password|account|profile|me)(\/|$)/i;
const SENSITIVE_QUERY_KEYS=new Set([
  'token','access_token','refresh_token','password','passwd','secret','session','auth','authorization',
  'api_key','apikey','key','code','credential','credentials'
]);
function hasSensitiveQuery(url){for(const key of url.searchParams.keys()){if(SENSITIVE_QUERY_KEYS.has(String(key).toLowerCase())) return true;}return false;}
function isSafeRequest(request){
  if(request.method!=='GET'||request.headers.has('authorization')||request.headers.has('cookie')||request.headers.has('range')||request.headers.has('if-range')) return false;
  const url=new URL(request.url);
  return url.origin===self.location.origin&&!PRIVATE_PATH_RE.test(url.pathname)&&!hasSensitiveQuery(url);
}
function isCacheableResponse(response){
  if(!response||!response.ok||response.type!=='basic'||response.redirected||response.status===206||response.headers.has('content-range')||response.headers.has('set-cookie')) return false;
  const cc=(response.headers.get('cache-control')||'').toLowerCase();
  const vary=(response.headers.get('vary')||'').toLowerCase();
  if(cc.includes('no-store')||cc.includes('private')) return false;
  if(vary==='*'||vary.split(',').map(v=>v.trim()).some(v=>v==='cookie'||v==='authorization')) return false;
  return true;
}
async function precache(){
  const cache=await caches.open(CACHE_NAME);
  for(const path of APP_SHELL){
    try{
      const request=new Request(path,{credentials:'omit',cache:'reload',redirect:'error'});
      const response=await fetch(request);
      if(isCacheableResponse(response)) await cache.put(request,response.clone());
    }catch(_){ }
  }
}
self.addEventListener('install',event=>{event.waitUntil(precache());self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)))),
  self.clients.claim()
]));});
self.addEventListener('fetch',event=>{
  const request=event.request;if(!isSafeRequest(request)) return;
  const url=new URL(request.url);
  if(request.mode==='navigate'){
    event.respondWith(fetch(request,{cache:'no-store',redirect:'follow'}).catch(async()=>{
      const cache=await caches.open(CACHE_NAME);
      return (await cache.match(new Request('./index.html',{credentials:'omit'}))) || Response.error();
    }));
    return;
  }
  if(url.search) return;
  const scopePath=new URL(self.registration.scope).pathname;
  const relativePath=url.pathname.startsWith(scopePath)?url.pathname.slice(scopePath.length):url.pathname;
  const path=relativePath?`./${relativePath.replace(/^\//,'')}`:'./';
  if(!APP_SHELL.has(path)) return;
  event.respondWith(caches.open(CACHE_NAME).then(async cache=>{
    const cacheRequest=new Request(path,{credentials:'omit'});
    const hit=await cache.match(cacheRequest);
    if(hit) return hit;
    const response=await fetch(new Request(request,{credentials:'omit',cache:'no-store'}));
    if(isCacheableResponse(response)) event.waitUntil(cache.put(cacheRequest,response.clone()));
    return response;
  }));
});
