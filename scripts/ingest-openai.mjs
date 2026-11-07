// Parse OpenAI's official pricing page (+ its long-context table bundle) and per-model pages into data/models.json.
// Usage: node scripts/ingest-openai.mjs [--write]   (dry run prints the diff). No deps; Node 20+.
// Reads: developers.openai.com/api/docs/pricing (astro-island props: standard/batch/fast tables, cyber long-context rows),
//        the pricing JS bundle (long-context >272K tables), and developers.openai.com/api/docs/models/<id> ("N context window").
// Cache writes: pricing-table cell[3] = 30-minute cache-write total $/1M. 12-hour TTL absolute = 2.5× input
// (OpenAI prompt-caching guide for GPT-5.6+). Never invents numbers: a "-" or missing cell is stored as null.
import fs from 'node:fs'; import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');const F=path.join(root,'data/models.json');
const BASE='https://developers.openai.com',PRICING=BASE+'/api/docs/pricing',SOURCE='https://platform.openai.com/docs/pricing';
const CACHE_GUIDE=BASE+'/api/docs/guides/prompt-caching';
const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 ratecard-ingest';
const today=new Date(Date.now()-4*3600e3).toISOString().slice(0,10);
const TRACK=['gpt-6-astra','gpt-6.1-sol','gpt-6.1-terra','gpt-6-luna','gpt-6-sol','gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna','gpt-5.5','gpt-5.5-pro','gpt-5.4','gpt-5.4-pro','gpt-5.6-cyber','gpt-5.3-codex','chat-latest'];
const get=async u=>{const r=await fetch(u,{headers:{'user-agent':UA,'accept-language':'en-US'},redirect:'follow',signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(u+' HTTP '+r.status);return r.text()};
const unesc=s=>s.replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
const dec=v=>{if(!(Array.isArray(v)&&v.length===2&&Number.isInteger(v[0])))return v;const [t,x]=v;if(t===1)return x.map(dec);if(t===0&&x&&typeof x==='object'&&!Array.isArray(x))return Object.fromEntries(Object.entries(x).map(([k,w])=>[k,dec(w)]));return x};
const num=v=>typeof v==='number'?v:null;const base=n=>String(n).replace(/ \(.+$/,'');
const row=r=>r.length>=5?{input:num(r[1]),cached:num(r[2]),cache_write:num(r[3]),output:num(r[4])}:{input:num(r[1]),cached:num(r[2]),cache_write:null,output:num(r[3])};
const prec=v=>v==null?null:+Number(v).toPrecision(12);
const html=await get(PRICING);
const islands=[...html.matchAll(/<astro-island[^>]*?component-url="([^"]*)"[^>]*?props="([^"]*)"/g)].map(m=>({url:m[1],p:Object.fromEntries(Object.entries(JSON.parse(unesc(m[2]))).map(([k,v])=>[k,dec(v)]))}));
const tbl={};for(const {p} of islands){if(!p.tier||!Array.isArray(p.rows))continue;const key=(p.modelGroup||'main')+':'+p.tier;tbl[key]=tbl[key]||{};for(const r of p.rows)if(Array.isArray(r)&&typeof r[0]==='string'){const n=base(r[0]);if(!tbl[key][n])tbl[key][n]=row(r)}
  if(p.longContextRows){const k2=(p.modelGroup||'main')+':lc-'+p.tier;tbl[k2]=tbl[k2]||{};for(const [n,v] of Object.entries(p.longContextRows))tbl[k2][n]={input:num(v.input),cached:num(v.cachedInput),cache_write:num(v.cacheWrite),output:num(v.output)}}}
const bundleUrl=islands.find(i=>/\/pricing\.[^/]*\.js/.test(i.url))?.url;const js=await get(BASE+bundleUrl);
const at=js.search(/\{ultrafast:\{|\{standard:\{"gpt/);if(at<0)throw new Error('long-context table not found in bundle');
let d=0,end=at;for(;end<js.length;end++){if(js[end]==='{')d++;else if(js[end]==='}'&&--d===0)break}
const lit=js.slice(at,end+1);if(!/^[{}\w\s".:,`\-]+$/.test(lit))throw new Error('unexpected characters in long-context literal');
const LC=JSON.parse(lit.replace(/`/g,'"').replace(/([{,])(\w+):/g,'$1"$2":').replace(/([:\[,])\./g,'$10.'));
for(const [tier,o] of Object.entries(LC))tbl['main:lc-'+tier]=Object.fromEntries(Object.entries(o).map(([n,v])=>[n,{input:num(v.input),cached:num(v.cachedInput),cache_write:num(v.cacheWrite),output:num(v.output)}]));
let threshold=null;for(const m of js.matchAll(/from"\.\/(PricingContextSelector[^"]+)"/g)){const t=await get(BASE+'/_astro/'+m[1]);const k=t.match(/>(\d+)K input tokens/);if(k){threshold=+k[1]*1000;break}}
if(!threshold)throw new Error('long-context threshold label not found');
const ctxOf=async n=>{try{const h=await get(`${BASE}/api/docs/models/${n}`);const m=h.match(/([\d,]{5,}) context window/);return m?+m[1].replace(/,/g,''):null}catch{return null}};
const models=JSON.parse(fs.readFileSync(F,'utf8'));const out=[];const report=[];
const idOf=n=>'openai-'+n.replace(/[^a-z0-9]+/gi,'-').toLowerCase();
const cwNote=(cw30,cw12)=>cw30==null?null:`30-minute cache write $${cw30}${cw12!=null?`; 12-hour cache write $${cw12} (2.5× input per prompt-caching guide)`:''}.`;
const applyCwNotes=(notes,cw30,cw12)=>{const clause=cwNote(cw30,cw12);if(!clause)return notes||'';
  if(/30-minute cache write/.test(notes||''))return (notes||'').replace(/30-minute cache write[^.]*\./,clause);
  return ((notes||'').replace(/\s*$/,'')+(notes?' ':'')+clause).trim()};
for(const n of TRACK){
  const g=tbl['main:standard']?.[n]?'main':tbl['cyber:standard']?.[n]?'cyber':null;if(!g){const m=models.find(x=>x.id===idOf(n)),c=await ctxOf(n);if(m&&c){m.context=c;m.context_source=`${BASE}/api/docs/models/${n}`;report.push(`= ${m.id}: context ${c} (prices from specialized table, not re-parsed)`)}else report.push(`! ${n}: not on the standard table`);continue}
  const s=tbl[g+':standard'][n],b=tbl[g+':batch']?.[n]||null,f=tbl[g+':fast']?.[n];
  const lcS=tbl[g+':lc-standard']?.[n],lcB=tbl['main:lc-batch']?.[n];const hasLC=lcS&&lcS.input!=null&&lcS.output!=null;
  const context=await ctxOf(n);
  const cw30=s.cache_write,cw12=cw30!=null&&s.input!=null?prec(s.input*2.5):null;
  const lcCw30=hasLC?(lcS.cache_write??null):null,lcCw12=hasLC&&lcCw30!=null&&lcS.input!=null?prec(lcS.input*2.5):null;
  const long_context=hasLC?{threshold,input:lcS.input,output:lcS.output,cached:lcS.cached,
    ...(lcB&&lcB.input!=null?{batch_input:lcB.input,batch_output:lcB.output}:{}),
    ...(lcCw30!=null?{cache_write_30m:lcCw30}:{}),...(lcCw12!=null?{cache_write_12h:lcCw12}:{})}:null;
  const fields={input:s.input,output:s.output,cached:s.cached,batch_input:b?.input??null,batch_output:b?.output??null,context,
    context_source:context?`${BASE}/api/docs/models/${n}`:null,cache_write_30m:cw30,cache_write_12h:cw12,long_context};
  const id=idOf(n);let m=models.find(x=>x.id===id);
  if(!m){
    const notes=[b?.input!=null?'Flex/Batch tier shown as batch.':'No Batch price published.',f?.input!=null?`Fast mode $${f.input}/$${f.output}.`:null,cwNote(cw30,cw12),
      hasLC?`Long-context (>${threshold/1000}K input tokens): $${lcS.input}/$${lcS.output}${lcS.cached!=null?` (cached $${lcS.cached})`:''}${lcB&&lcB.input!=null?`; batch $${lcB.input}/$${lcB.output}`:''}.`:(lcS?'No long-context price published (shown as "-").':null),
      g==='cyber'?'Listed under OpenAI "Cyber models" (Daybreak).':null,'Data-residency endpoints +10%.'].filter(Boolean).join(' ');
    m={id,provider:'OpenAI',model:n,kind:'text',input:fields.input,output:fields.output,cached:fields.cached,batch_input:fields.batch_input,batch_output:fields.batch_output,context:fields.context,unit:'$/1M tokens',other:null,notes,status:'verified',checked:today,source:SOURCE,context_source:fields.context_source};
    if(cw30!=null){m.cache_write_30m=cw30;m.cache_write_12h=cw12}
    if(long_context)m.long_context=long_context;
    models.push(m);out.push(m);report.push(`+ ${id}: $${s.input}/$${s.output} cw30=${cw30??'-'} cw12=${cw12??'-'} ctx ${context}`);continue}
  const diffs=[];
  for(const k of ['input','output','cached','batch_input','batch_output','context','cache_write_30m','cache_write_12h']){
    const nv=fields[k];if(nv!=null&&m[k]!==nv)diffs.push(`${k} ${m[k]}→${nv}`);
  }
  if(long_context&&JSON.stringify(m.long_context||null)!==JSON.stringify(long_context))diffs.push('long_context updated');
  for(const k of ['input','output','cached','batch_input','batch_output','context','context_source'])if(fields[k]!=null)m[k]=fields[k];
  if(cw30!=null){m.cache_write_30m=cw30;m.cache_write_12h=cw12}else{delete m.cache_write_30m;delete m.cache_write_12h}
  if(long_context)m.long_context=long_context;else delete m.long_context;
  m.notes=applyCwNotes(m.notes,cw30,cw12);m.checked=today;m.source=SOURCE;
  report.push(`= ${id}: ${diffs.length?diffs.join('; '):'prices unchanged'}${fields.context?` (context ${fields.context})`:''} cw30=${cw30??'-'} cw12=${cw12??'-'}`);
}
console.log(report.join('\n'));
console.log(`(12h absolute derived as 2.5× input when 30m write is published; source ${CACHE_GUIDE})`);
if(process.argv.includes('--write')){const oi=models.findIndex(x=>x.provider==='OpenAI');const keep=models.filter(x=>!out.includes(x));const firstNonOpenAI=keep.findIndex((x,i)=>i>oi&&x.provider!=='OpenAI');
  keep.splice(firstNonOpenAI<0?keep.length:firstNonOpenAI,0,...out);fs.writeFileSync(F,JSON.stringify(keep,null,2)+'\n');console.log('wrote',out.length,'new rows + updated OpenAI cache-write fields');}
