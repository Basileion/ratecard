// Fetch each vendor pricing page, extract main text, diff vs saved snapshot, write report.
// Usage: node scripts/check.mjs [--baseline]   (no deps; Node 20+). Falls back to headless Chrome if CHROME_BIN set & page is JS-only.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// Weekly: snapshot each unique official source page in data/models.json, diff vs last snapshot, write reports/diff-DATE.md.
const vendors=[...new Map(JSON.parse(fs.readFileSync(path.join(root,'data/models.json'),'utf8')).map(m=>{const u=m.source.startsWith('https://openrouter.ai/')?'https://openrouter.ai/api/v1/models':m.source.replace(/#.*$/,'');return [u,{id:u.replace(/^https?:\/\//,'').replace(/[^a-z0-9]+/gi,'_').slice(0,80),name:m.provider,url:u}]})).values()];
const snapDir = path.join(root,'snapshots'); const repDir = path.join(root,'reports');
fs.mkdirSync(snapDir,{recursive:true}); fs.mkdirSync(repDir,{recursive:true});
const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 ratecard-check';
export function toText(html){
  let h=html.replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi,' ').replace(/<!--[\s\S]*?-->/g,' ');
  const m=h.match(/<main[\s\S]*?<\/main>/i); if(m && m[0].length>2000) h=m[0];
  h=h.replace(/<(nav|footer|header)[\s\S]*?<\/\1>/gi,' ');
  h=h.replace(/<\/(p|div|li|h[1-6]|tr|section|br)>|<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,' ');
  h=h.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;|&rsquo;/g,"'").replace(/&quot;/g,'"').replace(/&#x27;/g,"'");
  return h.split('\n').map(l=>l.replace(/\s+/g,' ').trim()).filter(l=>l.length>1).filter((l,i,a)=>a.indexOf(l)===i).join('\n');
}
async function get(url){
  if(url.endsWith('/api/v1/models')){const j=await (await fetch(url,{signal:AbortSignal.timeout(30000)})).json();return j.data.map(m=>`${m.id} in=${m.pricing.prompt} out=${m.pricing.completion} cache=${m.pricing.input_cache_read??''} ctx=${m.context_length}`).sort().join('\n');}
  const r=await fetch(url,{headers:{'user-agent':UA,'accept-language':'en-US'},redirect:'follow',signal:AbortSignal.timeout(30000)});
  if(!r.ok) throw new Error('HTTP '+r.status); let t=toText(await r.text());
  if(t.length<800 && process.env.CHROME_BIN){ t=toText(execFileSync(process.env.CHROME_BIN,['--headless=new','--no-sandbox','--disable-gpu','--virtual-time-budget=8000','--dump-dom',url],{maxBuffer:5e7,timeout:60000}).toString()); }
  if(t.length<300) throw new Error('too little text ('+t.length+' chars) - likely JS-rendered/blocked');
  return t;
}
function diff(a,b){ const A=new Set(a.split('\n')),B=new Set(b.split('\n'));
  return {removed:[...A].filter(x=>!B.has(x)),added:[...B].filter(x=>!A.has(x))}; }
const isMain=import.meta.url===`file://${process.argv[1]}`;
if(isMain){
const baseline=process.argv.includes('--baseline'); const today=new Date().toISOString().slice(0,10);
const results=[];
for(const v of vendors){
  const f=path.join(snapDir,v.id+'.txt');
  try{ const t=await get(v.url);
    if(!fs.existsSync(f)||baseline){ fs.writeFileSync(f,t); results.push({v,status:'baseline',chars:t.length}); }
    else { const d=diff(fs.readFileSync(f,'utf8'),t);
      if(d.added.length||d.removed.length){ results.push({v,status:'changed',d}); fs.writeFileSync(f,t);} else results.push({v,status:'unchanged'}); }
  }catch(e){ results.push({v,status:'error',err:String(e.message||e)}); }
  console.log(v.id, results.at(-1).status, results.at(-1).err||'');
}
let md=`# Pricing page diff report — ${today}\n\n`;
const c=s=>results.filter(r=>r.status===s).length;
md+=`Checked ${results.length} source pages: ${c('changed')} changed, ${c('unchanged')} unchanged, ${c('baseline')} baseline saved, ${c('error')} errors.\n\n`;
for(const r of results.filter(r=>r.status==='changed')){ md+=`## ${r.v.name} — ${r.v.url}\n\n\`\`\`diff\n`+r.d.removed.slice(0,60).map(l=>'- '+l).join('\n')+'\n'+r.d.added.slice(0,60).map(l=>'+ '+l).join('\n')+'\n```\n\n'; }
const errs=results.filter(r=>r.status==='error'); if(errs.length){ md+='## Fetch errors\n\n'+errs.map(r=>`- ${r.v.name} (${r.v.url}): ${r.err}`).join('\n')+'\n'; }
let rp=path.join(repDir,`diff-${today}.md`);if(fs.existsSync(rp))rp=path.join(repDir,`diff-${today}-${new Date().toISOString().slice(11,19).replace(/:/g,'')}.md`);fs.writeFileSync(rp,md); fs.writeFileSync(path.join(repDir,'latest.json'),JSON.stringify(results.map(r=>({id:r.v.id,status:r.status,err:r.err,added:r.d?.added.length,removed:r.d?.removed.length})),null,1));
console.log('report: '+path.relative(root,rp));
}
