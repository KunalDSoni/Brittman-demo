import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ORIGIN = 'https://formance.framer.website';
const OUT = path.resolve('/Users/kunal/Downloads/Agentic/Formance/capture');

const PAGES = [
  '/', '/about', '/contact', '/privacy-policy', '/404',
  '/work', '/work/orion-solutions', '/work/vertex-innovations',
  '/work/branding-strategy-for-elevatecommerce', '/work/revamping-brand-identity-for-nexatech',
  '/blog', '/blog/designing-a-visual-identity-that-clicks',
  '/blog/plan-first-win-bigger-the-pre-design-playbook',
  '/blog/why-data-driven-marketing-wins-every-time',
];

const saved = new Set();
const assetLog = [];

function urlToPath(u) {
  const url = new URL(u);
  let p = url.hostname + url.pathname;
  if (url.search) p += '@' + url.search.slice(1).replace(/\//g, '_'); // wget-style query encoding
  if (p.endsWith('/')) p += 'index.html';
  return path.join(OUT, p);
}

function save(file, buf) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const step = 400;
      const timer = setInterval(() => {
        const sh = document.body.scrollHeight;
        window.scrollBy(0, step);
        total += step;
        if (total >= sh + 2000) { clearInterval(timer); resolve(); }
      }, 120);
    });
    // scroll back to top to settle, then nudge again
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 400));
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 600));
    window.scrollTo(0, 0);
  });
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,2400'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 2 });
await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36');

page.on('response', async (resp) => {
  try {
    const u = resp.url();
    if (!/^https?:/.test(u)) return;
    if (saved.has(u)) return;
    const status = resp.status();
    if (status >= 300 && status < 400) return; // redirects
    if (resp.request().resourceType() === 'document') return; // saved as rendered DOM instead
    const host = new URL(u).hostname;
    // keep first-party + framer asset/font hosts
    if (!/(formance\.framer\.website|framerusercontent\.com|framer\.com|gstatic\.com|googleapis\.com)$/.test(host)) return;
    const buf = await resp.buffer();
    if (!buf || buf.length === 0) return;
    save(urlToPath(u), buf);
    saved.add(u);
    assetLog.push(`${status}\t${buf.length}\t${u}`);
  } catch (e) { /* ignore bodies that can't be fetched */ }
});

const discovered = new Set(PAGES);
for (const route of PAGES) {
  const full = ORIGIN + route;
  process.stdout.write(`\n[crawl] ${route} ... `);
  try {
    await page.goto(full, { waitUntil: 'networkidle2', timeout: 90000 });
    await autoScroll(page);
    await new Promise(r => setTimeout(r, 1500));
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
    // discover any same-origin links we didn't know about
    const links = await page.$$eval('a[href]', as => as.map(a => a.getAttribute('href')));
    for (let l of links) {
      if (!l) continue;
      if (l.startsWith('./')) l = l.slice(1);
      if (l.startsWith('/') && !l.startsWith('//')) discovered.add(l.split('#')[0].split('?')[0]);
    }
    // save fully-rendered DOM
    const html = await page.content();
    let p = route === '/' ? '/index' : route;
    save(path.join(OUT, new URL(ORIGIN).hostname, p + '.html'), Buffer.from(html, 'utf8'));
    process.stdout.write(`OK (rendered ${html.length} bytes)`);
  } catch (e) {
    process.stdout.write(`ERROR ${e.message}`);
  }
}

// crawl any newly discovered routes not in original list
const extra = [...discovered].filter(r => !PAGES.includes(r));
for (const route of extra) {
  const full = ORIGIN + route;
  process.stdout.write(`\n[extra] ${route} ... `);
  try {
    await page.goto(full, { waitUntil: 'networkidle2', timeout: 90000 });
    await autoScroll(page);
    await new Promise(r => setTimeout(r, 1200));
    const html = await page.content();
    save(path.join(OUT, new URL(ORIGIN).hostname, route + '.html'), Buffer.from(html, 'utf8'));
    process.stdout.write(`OK`);
  } catch (e) { process.stdout.write(`ERROR ${e.message}`); }
}

fs.writeFileSync(path.join(OUT, '_assets.log'), assetLog.sort().join('\n'));
console.log(`\n\nDONE. Unique network assets saved: ${saved.size}. Extra routes: ${extra.length ? extra.join(', ') : 'none'}`);
await browser.close();
