import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const srv = spawn('python3', ['-m', 'http.server', '8767'], { cwd: '/Users/kunal/Downloads/Agentic/Formance/site' });
await new Promise(r => setTimeout(r, 1500));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

const external = new Set();
const failed = [];
page.on('request', req => { const h = new URL(req.url()).hostname; if (!['localhost','127.0.0.1'].includes(h) && /^https?:/.test(req.url())) external.add(h); });
page.on('requestfailed', req => failed.push(req.url()));

const pages = ['about', 'index', 'work/orion-solutions'];
for (const p of pages) {
  external.clear(); failed.length = 0;
  await page.goto(`http://localhost:8767/formance.framer.website/${p}.html`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(async () => { for (let y=0;y<document.body.scrollHeight;y+=500){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,80));} window.scrollTo(0,0); });
  await new Promise(r => setTimeout(r, 1500));
  const stats = await page.evaluate(() => {
    const imgs=[...document.images];
    const broken=imgs.filter(i=>i.complete && i.naturalWidth===0 && i.currentSrc);
    const vids=[...document.querySelectorAll('video')];
    return { totalImgs: imgs.length, broken: broken.map(i=>i.currentSrc).slice(0,8), videos: vids.length };
  });
  const whoWeAre = await page.evaluate(() => document.body.innerText.includes('Who We Are'));
  console.log(`\n[${p}]`);
  console.log(`  images on page: ${stats.totalImgs}  broken: ${stats.broken.length}  videos: ${stats.videos}`);
  console.log(`  'Who We Are' text present: ${whoWeAre}`);
  console.log(`  external hosts contacted: ${[...external].filter(h=>!/framer\.com$/.test(h)).join(', ') || '(none — fully offline)'}`);
  console.log(`  failed requests: ${failed.length}`);
  if (stats.broken.length) console.log('  BROKEN:', stats.broken);
}
await browser.close();
srv.kill();
console.log('\nverify done');
