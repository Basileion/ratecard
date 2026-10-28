// Ratecard client: table, finder, calculator, compare. No dependencies.
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const usd=(v,d)=>v==null||isNaN(v)?'—':'$'+(d!=null?v.toFixed(d):v>=100?Math.round(v).toLocaleString('en-US'):v>=1?v.toFixed(2):v>=0.01?v.toFixed(3):v.toFixed(4));
const money=v=>v==null||isNaN(v)?'—':'$'+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const ctx=v=>v?(v>=1e6?(v/1e6).toFixed(v%1e6?1:0)+'M':Math.round(v/1e3)+'K'):'—';
let DATA=null;const load=async()=>DATA||(DATA=await (await fetch('/api/models.json')).json()).models;
export function cost(m,{inM,outM,hit=0,batch=0}){if(m.input==null||m.output==null)return null;
 const c=m.cached??m.input,bi=m.batch_input??m.input,bo=m.batch_output??m.output,bc=m.cached!=null&&m.batch_input!=null?m.cached*m.batch_input/m.input:c;
 const std=inM*((1-hit)*m.input+hit*c)+outM*m.output, bat=inM*((1-hit)*bi+hit*bc)+outM*bo;return (1-batch)*std+batch*bat}
window.Ratecard={cost,usd,money};
// ---- price table
async function table(){const t=$('#models');if(!t)return;const ms=await load();const tb=$('tbody',t);
 const q=$('#q'),pv=$('#prov'),kd=$('#kind'),mc=$('#minctx'),st=$('#ver');let sortK='input',dir=1;
 const draw=()=>{const qq=q.value.toLowerCase(),min=+mc.value||0;let r=ms.filter(m=>(!qq||(m.model+' '+m.provider).toLowerCase().includes(qq))&&(!pv.value||m.provider===pv.value)&&(!kd.value||m.kind===kd.value)&&(!min||(m.context||0)>=min)&&(!st.checked||m.status==='verified'));
  r.sort((a,b)=>{const x=a[sortK],y=b[sortK];if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;return (typeof x==='string'?x.localeCompare(y):x-y)*dir});
  tb.innerHTML=r.map(m=>`<tr><td><a href="/models/${m.id}.html">${m.model}</a></td><td><a href="/providers/${m.provider_id}.html">${m.provider}</a></td><td><span class="tag k">${m.kind}</span></td><td class="n">${m.input!=null?usd(m.input):(m.other||'—')}</td><td class="n">${usd(m.output)}</td><td class="n">${usd(m.cached)}</td><td class="n">${usd(m.batch_input)}</td><td class="n">${ctx(m.context)}</td><td>${m.status==='verified'?'<span class="tag">Verified</span>':'<span class="tag u">Unverified</span>'}</td><td class="src"><a href="${m.source}" rel="noopener" target="_blank">source</a> · ${m.checked}</td></tr>`).join('')||'<tr><td colspan=10 class="mut">No models match these filters.</td></tr>';
  $('#count').textContent=r.length+' of '+ms.length+' rows';};
 $$('th[data-k]',t).forEach(th=>$('button',th).onclick=()=>{const k=th.dataset.k;dir=sortK===k?-dir:1;sortK=k;$$('th[data-k]',t).forEach(x=>x.removeAttribute('aria-sort'));th.setAttribute('aria-sort',dir>0?'ascending':'descending');draw()});
 [q,pv,kd,mc,st].forEach(e=>e.oninput=draw);draw();}
// ---- cheapest-that-meets finder
async function finder(){const f=$('#finder');if(!f)return;const ms=(await load()).filter(m=>m.kind==='text'&&m.input!=null&&m.context);
 const run=()=>{const need=+$('#f-ctx').value,inM=+$('#f-in').value||0,outM=+$('#f-out').value||0;
  const r=ms.filter(m=>m.context>=need).map(m=>({m,c:cost(m,{inM,outM})})).sort((a,b)=>a.c-b.c).slice(0,5);
  $('#f-out-list').innerHTML=r.length?r.map((x,i)=>`<tr><td>${i+1}</td><td><a href="/models/${x.m.id}.html">${x.m.model}</a> <span class="mut">· ${x.m.provider}</span></td><td class="n">${ctx(x.m.context)}</td><td class="n">${money(x.c)}</td></tr>`).join(''):'<tr><td colspan=4 class=mut>No model with a verified context window meets this requirement.</td></tr>'};
 $$('input,select',f).forEach(e=>e.oninput=run);run();}
// ---- calculator
async function calc(){const f=$('#calc');if(!f)return;const ms=(await load()).filter(m=>m.kind==='text'&&m.input!=null);
 const opts=ms.map(m=>`<option value="${m.id}">${m.provider} · ${m.model}</option>`).join('');$('#c-cur').innerHTML=opts;$$('.c-alt').forEach(s=>s.innerHTML='<option value="">—</option>'+opts);
 const p=new URLSearchParams(location.search);const set=(id,v)=>{if(v!=null&&$(id))$(id).value=v};
 set('#c-in',p.get('in'));set('#c-out',p.get('out'));set('#c-hit',p.get('hit'));set('#c-batch',p.get('batch'));
 $('#c-cur').value=p.get('cur')||'anthropic-claude-sonnet-4-6';(p.get('alt')||'anthropic-claude-sonnet-5-5,google-gemini-3-8-flash,deepseek-deepseek-flash-v4-1-flash').split(',').forEach((v,i)=>{const s=$$('.c-alt')[i];if(s)s.value=v});
 const run=()=>{const u={inM:+$('#c-in').value||0,outM:+$('#c-out').value||0,hit:(+$('#c-hit').value||0)/100,batch:(+$('#c-batch').value||0)/100};
  const cur=ms.find(m=>m.id===$('#c-cur').value),base=cost(cur,u);const rows=[cur,...$$('.c-alt').map(s=>ms.find(m=>m.id===s.value)).filter(Boolean)];
  $('#c-res').innerHTML=rows.map((m,i)=>{const c=cost(m,u),d=base-c;return `<tr><td>${i?'':'<span class="tag k">Current</span> '}<a href="/models/${m.id}.html">${m.model}</a> <span class="mut">· ${m.provider}</span></td><td class="n">${money(c)}</td><td class="n">${money(c*12)}</td><td class="n ${i?(d>=0?'pos':'neg'):''}">${i?(d>=0?money(d*12)+' saved':money(-d*12)+' more'):'—'}</td><td class="n">${i&&base?((d/base)*100).toFixed(1)+'%':'—'}</td><td class="src"><a href="${m.source}" target="_blank" rel="noopener">source</a> · ${m.checked}</td></tr>`}).join('');
  $('#c-mo').textContent=money(base);$('#c-yr').textContent=money(base*12);
  const q=new URLSearchParams({in:$('#c-in').value,out:$('#c-out').value,hit:$('#c-hit').value,batch:$('#c-batch').value,cur:$('#c-cur').value,alt:$$('.c-alt').map(s=>s.value).join(',')});history.replaceState(null,'','?'+q)};
 $$('input,select',f).forEach(e=>e.oninput=run);run();
 $('#c-csv')&&($('#c-csv').onclick=()=>{const rows=[['model','provider','monthly_usd','annual_usd','source','checked']];$$('#c-res tr').forEach(tr=>{const td=$$('td',tr);rows.push([td[0].querySelector('a').textContent,td[0].querySelector('.mut').textContent.replace('· ',''),td[1].textContent,td[2].textContent,td[5].querySelector('a').href,td[5].textContent.split('· ')[1]])});const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n')],{type:'text/csv'}));a.download='ratecard-estimate.csv';a.click()});}
// ---- compare
async function compare(){const f=$('#cmp');if(!f)return;const ms=await load();const opts='<option value="">—</option>'+ms.map(m=>`<option value="${m.id}">${m.provider} · ${m.model}</option>`).join('');
 const sels=$$('select',f);sels.forEach(s=>s.innerHTML=opts);const init=(new URLSearchParams(location.search).get('m')||'openai-gpt-6-1-sol,anthropic-claude-sonnet-5-5,google-gemini-3-8-flash').split(',');sels.forEach((s,i)=>s.value=init[i]||'');
 const F=[['Provider','provider'],['Type','kind'],['Input $/1M','input',usd],['Output $/1M','output',usd],['Cached input $/1M','cached',usd],['Batch input $/1M','batch_input',usd],['Batch output $/1M','batch_output',usd],['Other pricing','other'],['Context window','context',ctx],['Support ticket reply (3K in / 500 out)','t1'],['RAG answer (12K in / 700 out)','t2'],['Code review (40K in / 2K out)','t3'],['Notes','notes'],['Status','status'],['Checked','checked'],['Source','source']];
 const run=()=>{const sel=sels.map(s=>ms.find(m=>m.id===s.value)).filter(Boolean);const per=(m,i,o)=>{const c=cost(m,{inM:i/1e6,outM:o/1e6});return c==null?'—':usd(c*1000,2)+' per 1K'};
  $('#cmp-t').innerHTML='<thead><tr><th>Field</th>'+sel.map(m=>`<th>${m.model}</th>`).join('')+'</tr></thead><tbody>'+F.map(([l,k,fn])=>`<tr><td class="mut">${l}</td>`+sel.map(m=>{let v=k==='t1'?per(m,3000,500):k==='t2'?per(m,12000,700):k==='t3'?per(m,40000,2000):m[k];if(fn)v=fn(v);if(k==='source')v=`<a href="${v}" target="_blank" rel="noopener">official page</a>`;if(k==='status')v=v==='verified'?'<span class="tag">Verified</span>':'<span class="tag u">Unverified</span>';return `<td style="white-space:normal">${v??'—'}</td>`}).join('')+'</tr>').join('')+'</tbody>';
  history.replaceState(null,'','?m='+sels.map(s=>s.value).filter(Boolean).join(','))};sels.forEach(s=>s.oninput=run);run();}
table();finder();calc();compare();
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
