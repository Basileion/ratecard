// Submit every sitemap URL to IndexNow (Bing, Yandex, etc.). Usage: node scripts/indexnow.mjs [https://site.example]
// Run after the deploy is live: the key file must already be served at /<key>.txt.
import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const BASE=(process.argv[2]||'https://ratecardai.pages.dev').replace(/\/$/,'');
const key=fs.readFileSync(path.join(root,'indexnow.key'),'utf8').trim();
const host=new URL(BASE).host,keyLocation=`${BASE}/${key}.txt`;
const kr=await fetch(keyLocation);const kt=(await kr.text()).trim();
if(kr.status!==200||kt!==key){console.error(`key file not live at ${keyLocation} (status ${kr.status})`);process.exit(1)}
const xml=await (await fetch(`${BASE}/sitemap.xml`)).text();
const urlList=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
console.log(`submitting ${urlList.length} URLs for ${host}`);
const r=await fetch('https://api.indexnow.org/indexnow',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({host,key,keyLocation,urlList})});
console.log('IndexNow response:',r.status,r.statusText,(await r.text()).slice(0,300));
process.exit(r.status===200||r.status===202?0:1);
