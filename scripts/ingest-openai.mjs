// Parse OpenAI's official pricing page (+ its long-context table bundle) and per-model pages into data/models.json.
// Usage: node scripts/ingest-openai.mjs [--write]   (dry run prints the diff). No deps; Node 20+.
// Reads: developers.openai.com/api/docs/pricing (astro-island props: standard/batch/fast tables, cyber long-context rows),
//        the pricing JS bundle (long-context >272K tables), and developers.openai.com/api/docs/models/<id> ("N context window").
// Never invents numbers: a "-" or missing cell is stored as null.
import fs from 'node:fs'; import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');const F=path.join(root,'data/models.json');
const BASE='https://developers.openai.com',PRICING=BASE+'/api/docs/pricing',SOURCE='https://platform.openai.com/docs/pricing';
const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 ratecard-ingest';
const today=new Date(Date.now()-4*3600e3).toISOString().slice(0,10);
// Text models Ratecard tracks from the OpenAI table (id on Ratecard -> OpenAI model name).
const TRACK=['gpt-6-astra','gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna','gpt-6-sol','gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna','gpt-5.5','gpt-5.5-pro','gpt-5.4','gpt-5.4-pro','gpt-5.6-cyber','gpt-5.3-codex','chat-latest'];
const get=async u=>{const r=await fetch(u,{headers:{'user-agent':UA,'accept-language':'en-US'},redirect:'follow',signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(u+' HTTP '+r.status);return r.text()};
const unesc=s=>s.replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
const dec=v=>{if(!(Array.isArray(v)&&v.length===2&&Number.isInteger(v[0])))return v;const [t,x]=v;if(t===1)return x.map(dec);if(t===0&&x&&typeof x==='object'&&!Array.isArray(x))return Object.fromEntries(Object.entries(x).map(([k,w])=>[k,dec(w)]));return x};
const num=v=>typeof v==='number'?v:null;const base=n=>String(n).replace(/ \(.+$/,'');
const row=r=>r.length>=5?{input:num(r[1]),cached:num(r[2]),cache_write:num(r[3]),output:num(r[4])}:{input:num(r[1]),cached:num(r[2]),cache_write:null,output:num(r[3])};
const html=await get(PRICING);
const islands=[...html.matchAll(/<astro-island[^>]*?component-url="([^"]*)"[^>]*?props="([^"]*)"/g)].map(m=>({url:m[1],p:Object.fromEntries(Object.entries(JSON.parse(unesc(m[2]))).map(([k,v])=>[k,dec(v)]))}));
const tbl={};for(const {p} of islands){if(!p.tier||!Array.isArray(p.rows))continue;const key=(p.modelGroup||'main')+':'+p.tier;tbl[key]=tbl[key]||{};for(const r of p.rows)if(Array.isArray(r)&&typeof r[0]==='string'){const n=base(r[0]);if(!tbl[key][n])tbl[key][n]=row(r)}
  if(p.longContextRows){const k2=(p.modelGroup||'main')+':lc-'+p.tier;tbl[k2]=tbl[k2]||{};for(const [n,v] of Object.entries(p.longContextRows))tbl[k2][n]={input:num(v.input),cached:num(v.cachedInput),cache_write:num(v.cacheWrite),output:num(v.output)}}}
// Long-context tables live in the pricing bundle as an object literal {ultrafast:{...},standard:{...},fast:{...},batch:{...},flex:{...}}.
const bundleUrl=islands.find(i=>/\/pricing\.[^/]*\.js/.test(i.url))?.url;const js=await get(BASE+bundleUrl);
const at=js.search(/\{ultrafast:\{|\{standard:\{"gpt/);if(at<0)throw new Error('long-context table not found in bundle');
let d=0,end=at;for(;end<js.length;end++){if(js[end]==='{')d++;else if(js[end]==='}'&&--d===0)break}
const lit=js.slice(at,end+1);if(!/^[{}\w\s".:,`\-]+$/.test(lit))throw new Error('unexpected characters in long-context literal');
const LC=JSON.parse(lit.replace(/`/g,'"').replace(/([{,])(\w+):/g,'$1"$2":').replace(/([:\[,])\./g,'$10.'));
for(const [tier,o] of Object.entries(LC))tbl['main:lc-'+tier]=Object.fromEntries(Object.entries(o).map(([n,v])=>[n,{input:num(v.input),cached:num(v.cachedInput),cache_write:num(v.cacheWrite),output:num(v.output)}]));
// Threshold label lives in the shared i18n bundle (">272K input tokens").
let threshold=null;for(const m of js.matchAll(/from"\.\/(PricingContextSelector[^"]+)"/g)){const t=await get(BASE+'/_astro/'+m[1]);const k=t.match(/>(\d+)K input tokens/);if(k){threshold=+k[1]*1000;break}}
if(!threshold)throw new Error('long-context threshold label not found');
const ctxOf=async n=>{try{const h=await get(`${BASE}/api/docs/models/${n}`);const m=h.match(/([\d,]{5,}) context window/);return m?+m[1].replace(/,/g,''):null}catch{return null}};
const models=JSON.parse(fs.readFileSync(F,'utf8'));const out=[];const report=[];
const idOf=n=>'openai-'+n.replace(/[^a-z0-9]+/gi,'-').toLowerCase();
for(const n of TRACK){
  const g=tbl['main:standard']?.[n]?'main':tbl['cyber:standard']?.[n]?'cyber':null;if(!g){const m=models.find(x=>x.id===idOf(n)),c=await ctxOf(n);if(m&&c){m.context=c;m.context_source=`${BASE}/api/docs/models/${n}`;report.push(`= ${m.id}: context ${c} (prices from specialized table, not re-parsed)`)}else report.push(`! ${n}: not on the standard table`);continue}
  const s=tbl[g+':standard'][n],b=tbl[g+':batch']?.[n]||(g==='main'?null:null),f=tbl[g+':fast']?.[n];
  const lcS=tbl[g+':lc-standard']?.[n],lcB=tbl['main:lc-batch']?.[n];const hasLC=lcS&&lcS.input!=null&&lcS.output!=null;
  const context=await ctxOf(n);
  const fields={input:s.input,output:s.output,cached:s.cached,batch_input:b?.input??null,batch_output:b?.output??null,context,context_source:context?`${BASE}/api/docs/models/${n}`:null,
    long_context:hasLC?{threshold,input:lcS.input,output:lcS.output,cached:lcS.cached,...(lcB&&lcB.input!=null?{batch_input:lcB.input,batch_output:lcB.output}:{})}:null};
  const id=idOf(n);let m=models.find(x=>x.id===id);
  if(!m){const notes=[b?.input!=null?'Flex/Batch tier shown as batch.':'No Batch price published.',f?.input!=null?`Fast mode $${f.input}/$${f.output}.`:null,s.cache_write!=null?`30-minute cache write $${s.cache_write}.`:null,
      hasLC?`Long-context (>${threshold/1000}K input tokens): $${lcS.input}/$${lcS.output}${lcS.cached!=null?` (cached $${lcS.cached})`:''}${lcB&&lcB.input!=null?`; batch $${lcB.input}/$${lcB.output}`:''}.`:(lcS?'No long-context price published (shown as "-").':null),
      g==='cyber'?'Listed under OpenAI "Cyber models" (Daybreak).':null,'Data-residency endpoints +10%.'].filter(Boolean).join(' ');
    m={id,provider:'OpenAI',model:n,kind:'text',...fields,unit:'$/1M tokens',other:null,notes,status:'verified',checked:today,source:SOURCE};
    if(!m.long_context)delete m.long_context;models.push(m);out.push(m);report.push(`+ ${id}: $${s.input}/$${s.output} cached ${s.cached} batch ${b?.input??'-'}/${b?.output??'-'} ctx ${context} ${hasLC?`LC>${threshold}: $${lcS.input}/$${lcS.output}`:''}`);continue}
  const diffs=[];for(const k of ['input','output','cached','batch_input','batch_output','context'])if(fields[k]!=null&&m[k]!==fields[k])diffs.push(`${k} ${m[k]}→${fields[k]}`);
  if(fields.long_context&&JSON.stringify(m.long_context)!==JSON.stringify({...m.long_context,...fields.long_context}))diffs.push('long_context '+JSON.stringify(m.long_context)+'→'+JSON.stringify(fields.long_context));
  for(const k of ['input','output','cached','batch_input','batch_output','context','context_source'])if(fields[k]!=null)m[k]=fields[k];
  if(fields.long_context)m.long_context={...m.long_context,...fields.long_context};m.checked=today;
  report.push(`= ${id}: ${diffs.length?diffs.join('; '):'prices unchanged'}${fields.context?` (context ${fields.context})`:''}`);
}
console.log(report.join('\n'));
if(process.argv.includes('--write')){const oi=models.findIndex(x=>x.provider==='OpenAI');const keep=models.filter(x=>!out.includes(x));const firstNonOpenAI=keep.findIndex((x,i)=>i>oi&&x.provider!=='OpenAI');
  keep.splice(firstNonOpenAI<0?keep.length:firstNonOpenAI,0,...out);fs.writeFileSync(F,JSON.stringify(keep,null,2)+'\n');console.log('wrote',out.length,'new rows');}
