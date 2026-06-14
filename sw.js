// Service worker: emulate Framer CDN byte-range serving for .framercms files.
// Static hosts (GitHub Pages, python http.server) ignore the `?range=A-B` query
// and return the whole file, which Framer rejects ("Unexpected response length").
// We intercept those requests, fetch the full file, and return the exact byte slice.
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(e){
  var url = e.request.url;
  if (url.indexOf('.framercms') === -1) return;              // passthrough
  var m = url.match(/[?&]range=(\d+)-(\d+)/);
  if (!m) return;                                            // passthrough
  var start = +m[1], end = +m[2];                            // Framer range: inclusive [start, end]
  var full = url.replace(/([?&])range=\d+-\d+/, '$1').replace(/[?&]$/, '');
  e.respondWith(
    fetch(full, { cache: 'force-cache' })
      .then(function(r){ return r.arrayBuffer(); })
      .then(function(buf){
        var slice = buf.slice(start, end + 1);
        return new Response(slice, {
          status: 200,
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(slice.byteLength)
          }
        });
      })
      .catch(function(){ return fetch(e.request); })
  );
});
