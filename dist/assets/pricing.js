// Ratecard pricing core (pure, no DOM): shared by the browser calculator and the build guards.
/** All published long-context tiers for a model (multi-tier preferred; single long_context as fallback). */
export function longContextTiers(m){
  if(Array.isArray(m.long_context_tiers)&&m.long_context_tiers.length)return m.long_context_tiers.filter(t=>t&&t.threshold>0&&t.input!=null&&t.output!=null);
  if(m.long_context&&m.long_context.threshold>0)return [m.long_context];
  return [];
}
/** Highest long-context tier whose threshold the prompt exceeds (promptTokens > threshold). Null = standard rates. */
export function pickLongContext(m,promptTokens=0){
  const hit=longContextTiers(m).filter(t=>promptTokens>t.threshold);
  if(!hit.length)return null;
  return hit.reduce((a,b)=>a.threshold>=b.threshold?a:b);
}
/** Resolve standard vs long-context rates. promptTokens = typical prompt size (tokens). Supports long_context_tiers[]. */
export function rates(m,promptTokens=0){
  const lc=pickLongContext(m,promptTokens), use=!!lc;
  const input=use?lc.input:m.input, output=use?lc.output:m.output;
  const cached=use?(lc.cached??lc.input):(m.cached??m.input);
  const bi=use?(lc.batch_input??lc.input):(m.batch_input??m.input);
  const bo=use?(lc.batch_output??lc.output):(m.batch_output??m.output);
  const baseIn=use?lc.input:m.input, baseCached=use?lc.cached:m.cached, baseBi=use?lc.batch_input:m.batch_input;
  const bc=baseCached!=null&&baseBi!=null&&baseIn?baseCached*baseBi/baseIn:cached;
  // Cache-write totals ($/1M). OpenAI: 30m / 12h. Anthropic: 5m / 1h. Prefer long-context fields when tiered.
  const pick=(short,long)=>{const v=use&&lc&&lc[long]!=null?lc[long]:m[short];return v??null};
  return {input,output,cached,bi,bo,bc,tiered:use,lc_threshold:use?lc.threshold:null,
    cache_write_30m:pick('cache_write_30m','cache_write_30m'),
    cache_write_12h:pick('cache_write_12h','cache_write_12h'),
    cache_write_5m:pick('cache_write_5m','cache_write_5m'),
    cache_write_1h:pick('cache_write_1h','cache_write_1h')};
}
/** Resolve which published cache-write rate to use. ttl: '30m'|'12h'|'5m'|'1h'|'auto'. Returns {rate,ttl,label} or null. */
export function cacheWriteRate(m,promptTokens=0,ttl='auto'){
  const r=rates(m,promptTokens);
  const oa=[['30m',r.cache_write_30m],['12h',r.cache_write_12h]].filter(([,v])=>v!=null);
  const an=[['5m',r.cache_write_5m],['1h',r.cache_write_1h]].filter(([,v])=>v!=null);
  if(!oa.length&&!an.length)return null;
  const want=ttl==='auto'?(oa.length?'30m':an.length?'5m':null):ttl;
  const all=[...oa,...an];
  const hit=all.find(([k])=>k===want)||all[0];
  if(!hit)return null;
  return {rate:hit[1],ttl:hit[0],label:hit[0]==='30m'?'30-minute write':hit[0]==='12h'?'12-hour write':hit[0]==='5m'?'5-minute write':'1-hour write'};
}
export function cacheWriteCost(m,{writeM=0,promptTokens=0,ttl='auto'}={}){
  if(!(writeM>0))return 0;
  const w=cacheWriteRate(m,promptTokens,ttl);
  return w?writeM*w.rate:0;
}
function tokenCost(m,{inM,outM,hit=0,batch=0,promptTokens=0}){
  const r=rates(m,promptTokens);
  const std=inM*((1-hit)*r.input+hit*r.cached)+outM*r.output, bat=inM*((1-hit)*r.bi+hit*r.bc)+outM*r.bo;
  return (1-batch)*std+batch*bat}
/** offpeak = share (0-1) of tokens billed at a published off-peak rate (DeepSeek); tools = Search/Fetch requests per month (billed only where the provider publishes a per-request fee). */
export function toolFee(m,tools=0){return (m.tool_fees&&tools>0)?tools/1000*m.tool_fees[0].usd_per_1k:0}
/** writeM = MTok/mo billed at the published cache-write rate (OpenAI/Anthropic total write rate, not a surcharge on top of input). Enter only tokens you expect billed as writes; do not also count them in uncached input. ttl selects 30m/12h (OpenAI) or 5m/1h (Anthropic); missing fields → write cost 0 (UI shows N/A). */
export function cost(m,{inM,outM,hit=0,batch=0,promptTokens=0,offpeak=0,tools=0,writeM=0,ttl='auto'}={}){if(m.input==null||m.output==null)return null;
  const u={inM,outM,hit,batch,promptTokens},op=m.offpeak?Math.min(Math.max(offpeak,0),1):0;
  const t=op?(1-op)*tokenCost(m,u)+op*tokenCost({...m,...m.offpeak,batch_input:null,batch_output:null,long_context:null,long_context_tiers:null},u):tokenCost(m,u);
  return t+toolFee(m,tools)+cacheWriteCost(m,{writeM,promptTokens,ttl})}

// ---- Next-12-months forecast (RT-20261031-98): apply officially scheduled list-price changes month by month.
// Window rule: the 12 full calendar months starting with the first month that begins on or after today
// (on 2026-10-31 that is Nov 2026–Oct 2027). A change effective on the 1st applies to that whole month;
// a mid-month change is prorated by day. Changes effective on or before today are assumed already in the current price.
export const DIM={'input':'input','output':'output','cached input':'cached','batch input':'batch_input','batch output':'batch_output'};
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const pad=n=>String(n).padStart(2,'0');
export const fmtDate=s=>{const [y,m,d]=s.split('-').map(Number);return `${MON[m-1]} ${d}, ${y}`};
export const fmtMonth=ym=>{const [y,m]=ym.split('-').map(Number);return `${MON[m-1]} ${y}`};
export function windowStart(today){const [y,m,d]=today.split('-').map(Number);const n=d===1?{y,m}:(m===12?{y:y+1,m:1}:{y,m:m+1});return `${n.y}-${pad(n.m)}`}
const addMonths=(ym,k)=>{const [y,m]=ym.split('-').map(Number);const t=y*12+(m-1)+k;return `${Math.floor(t/12)}-${pad(t%12+1)}`};
const dim=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();
/** Future scheduled changes for model m (m.scheduled_changes: [{dimension,old,new,effective,source}]), grouped by effective date, with a dated note. */
export function pendingChanges(m,today){
  const rows=(m.scheduled_changes||[]).filter(r=>r.effective>today),by={};
  for(const r of rows)(by[r.effective]=by[r.effective]||[]).push(r);
  return Object.keys(by).sort().map(eff=>{const rs=by[eff],std=rs.filter(r=>!/batch|cached/.test(r.dimension)),ratios=[...new Set(rs.map(r=>Math.round(r.new/r.old*100)/100))];
    const verb=ratios.length===1?(ratios[0]===2?'doubles':(ratios[0]>1?'+':'')+Math.round((ratios[0]-1)*100)+'%'):'changes';
    const what=std.length&&std.every(r=>['input','output'].includes(r.dimension))&&std.length===2?'price':(std[0]||rs[0]).dimension;
    const d$=v=>'$'+(v>=0.1?v.toFixed(2):String(v)),detail=rs.map(r=>`${r.dimension} ${d$(r.old)}→${d$(r.new)}`).join(', ');
    return {effective:eff,rows:rs,unmapped:rs.filter(r=>!DIM[r.dimension]).map(r=>r.dimension),
      short:`${what} ${verb} ${fmtDate(eff)}`,text:`${fmtDate(eff)}: ${detail} per 1M tokens (scheduled, official page)`}});
}
/** Price model m as of ISO date (applies every pending change effective on or before that date). */
export function priceAt(m,date,today){let x=m;for(const r of (m.scheduled_changes||[]))if(r.effective>today&&r.effective<=date&&DIM[r.dimension]&&x[DIM[r.dimension]]!=null)x={...x,[DIM[r.dimension]]:r.new};return x}
export function forecast(m,u,{today,start,months=12}={}){
  const base=cost(m,u);if(base==null)return null;start=start||windowStart(today);
  const pend=pendingChanges(m,today),out=[];let total=0;
  for(let k=0;k<months;k++){const ym=addMonths(start,k),[y,mo]=ym.split('-').map(Number),n=dim(y,mo);
    const cuts=[...new Set(pend.map(p=>p.effective).filter(e=>e.startsWith(ym+'-')&&+e.slice(8)>1).map(e=>+e.slice(8)))].sort((a,b)=>a-b);
    let c=0,prev=1;for(const d of [...cuts,n+1]){const days=d-prev;if(days>0)c+=days/n*cost(priceAt(m,`${ym}-${pad(prev)}`,today),u);prev=d}
    out.push({month:ym,cost:c});total+=c}
  const end=addMonths(start,months-1);
  return {start,end,label:`${fmtMonth(start)}–${fmtMonth(end)}`,monthly:base,runRate:base*12,total,months:out,
    notes:pend.map(p=>({...p,inWindow:p.effective<=`${end}-31`}))};
}
/** Build guard: every calculator model with a scheduled change must carry a dated note, map every dimension, and match the current price. Returns error strings. */
export function scheduleGuard(models,today,fc=forecast){
  const errs=[],u={inM:1,outM:1};
  for(const m of models.filter(m=>m.kind==='text'&&m.input!=null&&m.output!=null&&(m.scheduled_changes||[]).some(r=>r.effective>today))){
    const f=fc(m,u,{today});if(!f){errs.push(m.id+': no forecast');continue}
    for(const r of m.scheduled_changes.filter(r=>r.effective>today)){
      const n=(f.notes||[]).find(x=>x.effective===r.effective);
      if(!n||!String(n.short).includes(fmtDate(r.effective))||!String(n.text).includes(fmtDate(r.effective)))errs.push(`${m.id}: no dated note for ${r.dimension} change on ${r.effective}`);
      if(!DIM[r.dimension])errs.push(`${m.id}: unmapped dimension "${r.dimension}"`);
      else if(m[DIM[r.dimension]]!=null&&Math.abs(m[DIM[r.dimension]]-r.old)>1e-9)errs.push(`${m.id}: ${r.dimension} current ${m[DIM[r.dimension]]} != scheduled old ${r.old}`);
    }
    if(f.notes.some(n=>n.inWindow)&&!(f.total>f.runRate||f.total<f.runRate))errs.push(m.id+': in-window change did not move the 12-month total');
  }
  return errs;
}
