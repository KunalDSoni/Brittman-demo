import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import fs from 'fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = '/Users/kunal/Downloads/Agentic/Formance/screenshots';
fs.mkdirSync(OUT, { recursive: true });
const srv = spawn('python3', ['-m', 'http.server', '8769'], { cwd: '/Users/kunal/Downloads/Agentic/Formance/site' });
await new Promise(r => setTimeout(r, 1500));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

const pages = ['index','about','contact','privacy-policy','404','work','work/orion-solutions',
  'work/vertex-innovations','work/branding-strategy-for-elevatecommerce','work/revamping-brand-identity-for-nexatech',
  'blog','blog/designing-a-visual-identity-that-clicks','blog/plan-first-win-bigger-the-pre-design-playbook','blog/why-data-driven-marketing-wins-every-time'];

for (const p of pages) {
  try {
    await page.goto(`http://localhost:8769/formance.framer.website/${p}.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    // scroll through to trigger every reveal animation
    await page.evaluate(async () => { for (let y=0;y<document.body.scrollHeight;y+=400){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,90));} window.scrollTo(0,0); await new Promise(r=>setTimeout(r,500)); });
    await new Promise(r => setTimeout(r, 1200));
    const name = p.replace(/\//g,'__') + '.png';
    await page.screenshot({ path: `${OUT}/${name}`, fullPage: true });
    console.log('shot', name);
  } catch (e) { console.log('ERR', p, e.message); }
}
await browser.close();
srv.kill();
console.log('done');
