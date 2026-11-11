/* ── AppNest · Cloudflare Pages fix (Oct 2026) ──
Cloudflare redirects *.html to clean URLs (/index.html -> /). Chrome refuses a
"redirected" response that a Service Worker hands to a page load (ERR_FAILED).
This strips the redirect flag from every response the SW fetches or reads from cache. */
(function(){
var NB={101:1,204:1,205:1,304:1};
function clean(r){
if(!r||!r.redirected||NB[r.status])return r;
return r.blob().then(function(b){return new Response(b,{status:r.status,statusText:r.statusText,headers:r.headers});});
}
var _fetch=self.fetch.bind(self);
self.fetch=function(input,init){
if(input&&typeof input==='object'&&input.mode==='navigate')input=input.url;
return _fetch(input,init).then(clean);
};
var cm=Cache.prototype.match;
Cache.prototype.match=function(){return cm.apply(this,arguments).then(clean);};
var sm=CacheStorage.prototype.match;
CacheStorage.prototype.match=function(){return sm.apply(this,arguments).then(clean);};
})();

/* SnakeNest service worker — cache name comes from the app version (set by build.py) */
var VERSION = 'snakenest-0.4.2';
var SHELL = ['./', './manifest.json', './icon-192.png', './icon-512.png', './privacy_policy.html', './img/home-bg.jpg'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request; if (req.method !== 'GET') return;
  var url = new URL(req.url); if (url.origin !== location.origin || /\.(ogg|mp3)$/.test(url.pathname)) return;
  if (req.mode === 'navigate') {
    // network-first for the app page, cache fallback offline
    e.respondWith(fetch(req).then(function (r) {
      if (r && r.ok && (url.pathname === '/' || /\/(index\.html)?$/.test(url.pathname))) { var cp = r.clone(); caches.open(VERSION).then(function (c) { c.put('./', cp); }); }
      return r;
    }).catch(function () { return caches.match('./'); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (r) { if (r && r.ok) { var cp = r.clone(); caches.open(VERSION).then(function (c) { c.put(req, cp); }); } return r; });
  }));
});
