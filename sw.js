// Service worker: emulate Framer CDN byte-range serving for .framercms files.
// Static hosts (GitHub Pages, python http.server) ignore the `?range=A-B` query
// and return the whole file, which Framer rejects ("Unexpected response length").
// We intercept those requests, fetch the full file, and return the exact byte slice.
//
// We also swap the template's CMS card titles for Brittman ones on the fly. The
// binary .framercms files are left untouched (so their byte offsets/lengths stay
// valid); each replacement is padded with spaces to the SAME byte length as the
// original, so slicing offsets are unaffected. HTML collapses the trailing spaces.
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });

// old -> new (new is auto-padded with spaces to match old's byte length)
var TITLE_SWAPS = {
  // work collection
  'ElevateCommerce':    'Temp Staffing',
  'Orion Solutions':    'Turnkey Project',
  'NexaTech':           'Repairs',
  'Vertex Innovations': 'Regulatory',
  // blog / media collection
  'Designing a Visual Identity That Clicks':         'HT Shine HR Conclave, Mumbai',
  'Plan First, Win Bigger: The Pre-Design Playbook': 'AIESEC Ahmedabad HR Summit 2014',
  'Why Data-Driven Marketing Wins Every Time':       'Redefining Employability for Gen Y',
  'Simple Strategies to Scale Your Business Faster': 'Complete Corporate Services',
  'How a Strong Brand Builds Business Success':      'A Decade of Seamless Service'
};

var enc = new TextEncoder();
var SWAPS = Object.keys(TITLE_SWAPS).map(function(oldStr){
  var ob = enc.encode(oldStr);
  var nb = enc.encode(TITLE_SWAPS[oldStr]);
  if (nb.length > ob.length) return null;                 // safety: never grow
  var padded = new Uint8Array(ob.length);
  padded.fill(0x20);                                       // spaces
  padded.set(nb, 0);
  return { old: ob, neu: padded };
}).filter(Boolean);

function applySwaps(buf){
  var bytes = new Uint8Array(buf);
  for (var s = 0; s < SWAPS.length; s++){
    var needle = SWAPS[s].old, repl = SWAPS[s].neu, n = needle.length;
    for (var i = 0; i + n <= bytes.length; i++){
      var hit = true;
      for (var j = 0; j < n; j++){ if (bytes[i+j] !== needle[j]) { hit = false; break; } }
      if (hit){ bytes.set(repl, i); i += n - 1; }
    }
  }
  return bytes.buffer;
}

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
        var slice = applySwaps(buf).slice(start, end + 1);
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
