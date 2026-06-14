import puppeteer from 'puppeteer-core';
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b=await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox']});
const p=await b.newPage();
await p.setViewport({width:1440,height:1000});
const logs=[],errs=[];
p.on('console',m=>{const t=m.text();if(/error|fail|route|match|404|not found|hydrat/i.test(t))logs.push(m.type()[0]+':'+t.slice(0,120));});
p.on('pageerror',e=>errs.push(e.message.slice(0,140)));
await p.goto('https://kunaldsoni.github.io/Brittman-demo/',{waitUntil:'domcontentloaded',timeout:60000});
for(const t of [500,1000,1500,2000,3000]){
  await new Promise(r=>setTimeout(r,t));
  const s=await p.evaluate(()=>({
    textLen:document.body.innerText.replace(/\s+/g,' ').trim().length,
    nodes:document.body.querySelectorAll('*').length,
    visImgs:[...document.images].filter(i=>i.offsetParent!==null).length,
    pathname:location.pathname,
    rootChildren:(document.getElementById('main')||document.body).children.length,
    sample:document.body.innerText.replace(/\s+/g,' ').trim().slice(0,60)
  }));
  console.log(`t=${t}ms`,JSON.stringify(s));
}
console.log('\nROUTER-RELEVANT CONSOLE:',logs.length?logs.join('\n  '):'(none)');
console.log('PAGE ERRORS:',errs.length?errs.join('\n  '):'(none)');
// what routes does framer know about?
const routes=await p.evaluate(()=>{
  try{const w=window;const keys=Object.keys(w).filter(k=>/framer|route|__/i.test(k));
    return {globals:keys.slice(0,20)};}catch(e){return {err:e.message}}
});
console.log('GLOBALS:',JSON.stringify(routes));
await b.close();
