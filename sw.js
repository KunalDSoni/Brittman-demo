// Service worker: fallback byte-range emulation for .framercms files.
//
// Framer requests CMS chunks as `file.framercms?range=A-B,C-D` and validates that
// the response body length equals the sum of the requested ranges. Static hosts
// (GitHub Pages) ignore the query and return the whole file, so Framer would
// reject it ("Unexpected response length"). The CMS modules have been patched to
// fetch the full file directly, so this worker is now only a safety net for any
// other range request: it returns the exact concatenation of the requested
// (inclusive) ranges. Handles both single and comma-separated multi-range.
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function(e){
  var url = e.request.url;
  if (url.indexOf('.framercms') === -1) return;             // passthrough
  var m = url.match(/[?&]range=([0-9,\-]+)/);
  if (!m) return;                                           // no range -> passthrough
  var ranges = m[1].split(',').map(function(p){
    var a = p.split('-'); return [parseInt(a[0], 10), parseInt(a[1], 10)]; // inclusive [from, to]
  });
  var full = url.replace(/([?&])range=[0-9,\-]+/, '$1').replace(/[?&]$/, '');
  e.respondWith(
    fetch(full, { cache: 'force-cache' })
      .then(function(r){ return r.arrayBuffer(); })
      .then(function(buf){
        var src = new Uint8Array(buf);
        var total = 0, i;
        for (i = 0; i < ranges.length; i++) total += ranges[i][1] - ranges[i][0] + 1;
        var out = new Uint8Array(total), off = 0;
        for (i = 0; i < ranges.length; i++){
          var a = ranges[i][0], b = ranges[i][1];
          out.set(src.subarray(a, b + 1), off);
          off += b - a + 1;
        }
        return new Response(out, {
          status: 200,
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(out.byteLength)
          }
        });
      })
      .catch(function(){ return fetch(e.request); })
  );
});
