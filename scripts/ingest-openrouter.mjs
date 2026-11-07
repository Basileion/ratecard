// Refresh OpenRouter rows in data/models.json from https://openrouter.ai/api/v1/models.
// Usage: node scripts/ingest-openrouter.mjs [--write]
// Matches existing OpenRouter rows by source URL path ↔ API model id. Never invents new rows.
// Writes snapshots/openrouter-models-YYYY-MM-DD.json for offline build guards.
// Ingests pricing.overrides → long_context (lowest tier) + long_context_tiers (all tiers).
import fs from 'node:fs'; import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const F=path.join(root,'data/models.json');
const API='https://openrouter.ai/api/v1/models';
const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'});
const WRITE=process.argv.includes('--write');
const round=v=>{if(v==null||Number.isNaN(+v))return null;const n=+v;const r=Math.round(n*1e12)/1e12;return Object.is(r,-0)?0:r};
const per1M=v=>v==null||v===''?null:round(+v*1e6);
const slugFromSource=src=>{
  try{const u=new URL(src);if(!u.hostname.endsWith('openrouter.ai'))return null;
    return u.pathname.replace(/^\/+|\/+$/g,'').replace(/^models\//,'')||null}catch{return null}};
const models=JSON.parse(fs.readFileSync(F,'utf8'));
const orRows=models.filter(m=>m.provider==='OpenRouter');
console.log(`fetching ${API} …`);
const res=await fetch(API,{headers:{accept:'application/json','user-agent':'ratecard-ingest'},signal:AbortSignal.timeout(60000)});
if(!res.ok)throw new Error(`OpenRouter API HTTP ${res.status}`);
const body=await res.json();
const data=body.data||body;
if(!Array.isArray(data))throw new Error('unexpected OpenRouter payload');
const byId=new Map(data.map(m=>[m.id,m]));
// also index by canonical_slug and trailing path variants
for(const m of data){
  if(m.canonical_slug)byId.set(m.canonical_slug,m);
  const short=String(m.id||'').split('/').slice(-2).join('/');
  if(short&&!byId.has(short))byId.set(short,m);
}
const snapDir=path.join(root,'snapshots');
fs.mkdirSync(snapDir,{recursive:true});
const snapName=`openrouter-models-${today}.json`;
const snapPath=path.join(snapDir,snapName);
// Keep a compact snapshot: ids we track + pricing + context + overrides
const tracked=orRows.map(m=>{
  const slug=slugFromSource(m.source);
  const api=slug&&(byId.get(slug)||[...byId.entries()].find(([k])=>k===slug||k.endsWith('/'+slug)||slug.endsWith('/'+k))?.[1]);
  return {ratecard_id:m.id,source:m.source,openrouter_id:api?.id||slug||null,pricing:api?.pricing||null,context_length:api?.context_length??null,found:!!api};
});
fs.writeFileSync(snapPath,JSON.stringify({fetched:new Date().toISOString(),source:API,models:tracked},null,2)+'\n');
// also refresh latest pointer
fs.writeFileSync(path.join(snapDir,'openrouter-models-latest.json'),JSON.stringify({fetched:new Date().toISOString(),source:API,date:today,models:tracked},null,2)+'\n');
console.log(`snapshot → snapshots/${snapName} (${tracked.filter(t=>t.found).length}/${tracked.length} matched)`);

const report=[];
for(const m of orRows){
  const slug=slugFromSource(m.source);
  let api=slug?byId.get(slug):null;
  if(!api&&slug){
    for(const [k,v] of byId){if(k===slug||k.endsWith('/'+slug.split('/').pop())||slug.endsWith('/'+k)||k.includes(slug)||slug.includes(k)){api=v;break}}
  }
  // Prefer exact path match against known source
  if(!api){
    report.push(`! ${m.id}: no OpenRouter API match for source ${m.source}`);
    continue;
  }
  const p=api.pricing||{};
  const input=per1M(p.prompt), output=per1M(p.completion);
  const cached=per1M(p.input_cache_read);
  const ctx=api.context_length!=null?+api.context_length:m.context;
  const overrides=Array.isArray(p.overrides)?p.overrides:[];
  const tiers=overrides.map(o=>{
    const thr=+(o.min_prompt_tokens??o.threshold??0);
    const t={threshold:thr,input:per1M(o.prompt),output:per1M(o.completion)};
    const cr=per1M(o.input_cache_read); if(cr!=null)t.cached=cr;
    const cw=per1M(o.input_cache_write); if(cw!=null)t.cache_write=cw;
    return t;
  }).filter(t=>t.threshold>0&&t.input!=null&&t.output!=null)
    .sort((a,b)=>a.threshold-b.threshold);
  const diffs=[];
  if(input!=null&&m.input!==input)diffs.push(`input ${m.input}→${input}`);
  if(output!=null&&m.output!==output)diffs.push(`output ${m.output}→${output}`);
  if(cached!==undefined&&m.cached!==cached)diffs.push(`cached ${m.cached}→${cached}`);
  if(ctx!=null&&m.context!==ctx)diffs.push(`context ${m.context}→${ctx}`);
  const prevTiers=JSON.stringify(m.long_context_tiers||(m.long_context?[m.long_context]:null));
  const nextTiers=tiers.length?JSON.stringify(tiers):'null';
  if(prevTiers!==nextTiers)diffs.push(`long_context_tiers ${prevTiers}→${nextTiers}`);

  if(WRITE){
    if(input!=null)m.input=input;
    if(output!=null)m.output=output;
    m.cached=cached; // may be null
    if(ctx!=null){m.context=ctx;m.context_source=m.context_source||API}
    m.checked=today; m.status='verified';
    // Base notes (preserve non-tier notes; rewrite OpenRouter + tier clause)
    const baseNote='OpenRouter list price from its public /api/v1/models endpoint; may route to multiple upstream hosts.';
    if(tiers.length){
      m.long_context=structuredClone(tiers[0]); // lowest tier for display compat
      m.long_context_tiers=tiers.map(t=>structuredClone(t));
      const tierTxt=tiers.map(t=>{
        let s=`≥${t.threshold>=1000?Math.round(t.threshold/1000)+'K':t.threshold} $${t.input}/$${t.output}`;
        if(t.cached!=null)s+=` (cached $${t.cached})`;
        if(t.cache_write!=null)s+=` (cache write $${t.cache_write})`;
        return s;
      }).join('; ');
      // Qwen-specific clarity preferred when two tiers look like 32K/256K
      if(m.id==='openrouter-qwen3-7-flash-qwen'){
        m.notes=`${baseNote} $${m.input}/$${m.output} applies only under 32K prompt tokens; ≥32K $0.10/$0.40; ≥256K $0.20/$0.80 (OpenRouter pricing.overrides). Cache write: under 32K $${per1M(p.input_cache_write)??'—'}; ≥32K $0.125; ≥256K $0.25 per 1M.`;
      }else{
        m.notes=`${baseNote} Pricing overrides (prompt tokens): ${tierTxt} (OpenRouter pricing.overrides).`;
      }
    }else{
      delete m.long_context; delete m.long_context_tiers;
      m.notes=baseNote;
    }
  }
  report.push(`= ${m.id} (${api.id}): ${diffs.length?diffs.join('; '):'unchanged'} checked→${today}`);
}
console.log(report.join('\n'));
if(WRITE){
  fs.writeFileSync(F,JSON.stringify(models,null,2)+'\n');
  console.log(`wrote ${orRows.length} OpenRouter rows → data/models.json`);
}else{
  console.log('(dry run — pass --write to persist)');
}
