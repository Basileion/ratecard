// One-off seed: writes data/models.json, data/providers.json, data/changes.json from verified official-page readings (2026-10-26).
import fs from 'node:fs';
const C='2026-10-26';
const S={openai:'https://platform.openai.com/docs/pricing',anthropic:'https://docs.anthropic.com/en/docs/about-claude/pricing',amodels:'https://docs.anthropic.com/en/docs/about-claude/models/overview',gemini:'https://ai.google.dev/gemini-api/docs/pricing',xai:'https://docs.x.ai/docs/models',deepseek:'https://api-docs.deepseek.com/quick_start/pricing',together:'https://www.together.ai/pricing',fireworks:'https://docs.fireworks.ai/serverless/pricing',groq:'https://console.groq.com/docs/models',pplx:'https://docs.perplexity.ai/getting-started/models',pplxp:'https://docs.perplexity.ai/getting-started/pricing',cohere:'https://cohere.com/pricing',azure:'https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/',bedrock:'https://aws.amazon.com/bedrock/pricing/',mistral:'https://mistral.ai/pricing#api-pricing'};
const M=[];const add=(provider,model,o)=>M.push({id:(provider+'-'+model).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-+$/,''),provider,model,kind:'text',input:null,output:null,cached:null,batch_input:null,batch_output:null,context:null,unit:'$/1M tokens',other:null,notes:'',status:'verified',checked:C,...o});
// OpenAI
for(const [m,i,o,c,bi,bo] of [['gpt-6-astra',10,50,1,5,25],['gpt-6.1-sol',2,10,.1,1,5],['gpt-6-luna',.1,.5,.01,.05,.25]]) add('OpenAI',m,{input:i,output:o,cached:c,batch_input:bi,batch_output:bo,source:S.openai,notes:'Flex/Batch tier shown as batch. Fast mode 2x, Ultrafast 6x standard. Data-residency endpoints +10%.'});
add('OpenAI','gpt-5.6-sol',{input:4,output:20,cached:.4,source:S.openai,notes:'Listed under Cyber models. Promotional pricing available at least through 2026-11-21.'});
add('OpenAI','gpt-5.3-codex',{input:1.75,output:14,cached:.175,source:S.openai,notes:'Codex. Fast tier $3.50 / $28.'});
add('OpenAI','chat-latest',{input:5,output:30,cached:.5,source:S.openai});
add('OpenAI','gpt-realtime-2.1 (audio)',{kind:'audio',input:32,output:64,cached:.4,source:S.openai,notes:'Text tokens $4 / $24.'});
add('OpenAI','gpt-realtime-2.1-mini (audio)',{kind:'audio',input:10,output:20,cached:.3,source:S.openai,notes:'Text tokens $0.60 / $2.40.'});
add('OpenAI','gpt-transcribe',{kind:'audio',unit:'per minute',other:'$0.0045 / min',source:S.openai});
add('OpenAI','gpt-4o-mini-transcribe',{kind:'audio',input:1.25,output:5,other:'≈$0.003 / min',source:S.openai});
add('OpenAI','gpt-image-2',{kind:'image',input:4,output:15,cached:1,source:S.openai,notes:'Image tokens; text input $2.50.'});
add('OpenAI','gpt-image-2.5-sunburst',{kind:'image',input:8,output:30,cached:2,batch_input:4,batch_output:15,source:S.openai,notes:'Image tokens; text input $5.'});
// Anthropic
const a=[['Claude Fable 5.1',10,50,.25,5,25,1e6],['Claude Opus 5.5',4,20,.2,2,10,1e6],['Claude Sonnet 5.5',2,10,.1,1,5,1e6],['Claude Haiku 5.5',.1,.5,.01,.05,.25,1e6],['Claude Mythos 5.1',10,50,.25,5,25],['Claude Opus 5',5,25,.5,2.5,12.5],['Claude Opus 4.8',5,25,.5,2.5,12.5],['Claude Sonnet 5',2,10,.2,1,5],['Claude Sonnet 4.6',3,15,.3,1.5,7.5],['Claude Haiku 4.5',1,5,.1,.5,2.5],['Claude Opus 4.1',15,75,1.5,7.5,37.5]];
for(const [m,i,o,c,bi,bo,ctx] of a) add('Anthropic',m,{input:i,output:o,cached:c,batch_input:bi,batch_output:bo,context:ctx||null,source:S.anthropic,notes:(m==='Claude Haiku 5.5'?'Prompts over 100K tokens: $0.50 in / $2.50 out. ':'')+'Cache writes 1.25x (5m) or 2x (1h) input. US-only inference 1.1x.'+(ctx?' Context per models overview.':'')});
// Google
const g=[['Gemini 4 Argon',2,10,.1,1,5,'Promotional: rises to $4 / $20 on 2026-12-01.'],['Gemini 3.8 Flash',.75,3.75,.075,.375,1.875,'Rises to $1.50 / $7.50 on 2027-01-01. Free tier available.'],['Gemini 3.6 Flash',.75,3.75,.075,.375,1.875,'Free tier available.'],['Gemini 3.5 Flash-Lite',.3,2.5,.03,.15,1.25,'Free tier available.'],['Gemini 3.1 Flash-Lite',.25,1.5,.025,.125,.75,'Audio input $0.50. Free tier available.'],['Gemini 3.1 Pro Preview',2,12,.2,1,6,'Prompts >200K: $4 / $18.'],['Gemini 3 Flash Preview',.5,3,.05,.25,1.5,'Audio input $1. Free tier available.']];
for(const [m,i,o,c,bi,bo,n] of g) add('Google',m,{input:i,output:o,cached:c,batch_input:bi,batch_output:bo,source:S.gemini,notes:n+' Cache storage billed per hour where listed.',free:/Free tier/.test(n)});
add('Google','Gemini Nano Banana 2.1',{kind:'image',input:1.5,output:30,batch_input:.75,batch_output:15,other:'$0.0336 per 1K image',source:S.gemini,notes:'Output priced per image tokens; text output $7.50.'});
add('Google','Gemini 3.1 Flash Image (Nano Banana 2)',{kind:'image',input:.5,output:60,batch_input:.25,batch_output:30,other:'$0.067 per 1K image',source:S.gemini});
add('Google','Gemini 3.5 Transcribe',{kind:'audio',input:2,output:12,other:'≈$0.003/min in + $0.002/min out',source:S.gemini,free:true});
add('Google','Gemini 3.8 Flash TTS',{kind:'audio',input:.5,output:9,batch_input:.25,batch_output:4.5,other:'≈$0.00225 per 10s audio',source:S.gemini,notes:'Doubles on 2027-01-01.',free:true});
// xAI
add('xAI','grok-4.7',{input:2,output:6,context:5e5,source:S.xai});
add('xAI','Grok Voice TTS',{kind:'audio',unit:'per 1M chars',other:'$15.00 / 1M chars',source:S.xai,notes:'STS $0.08/min; STT batch $0.10/hr, streaming $0.20/hr.'});
add('xAI','Grok Imagine Image 2.0',{kind:'image',unit:'per image',other:'from $0.02 / image',source:S.xai});
// DeepSeek
add('DeepSeek','deepseek-flash (V4.1 Flash)',{input:.3,output:1.2,cached:.006,context:1e6,source:S.deepseek,notes:'Peak price. Off-peak: $0.15 in / $0.003 cached / $0.60 out.'});
add('DeepSeek','deepseek-v4-pro',{input:1.32,output:3.96,cached:.044,context:1e6,source:S.deepseek,notes:'Peak price. Off-peak: $0.66 / $0.022 / $1.98.'});
// Together
for(const [m,i,c,o] of [['Kimi K3',3,.3,15],['Qwen3.8-2.4T-A95B',2,.25,6],['GLM-5.3',1.4,.26,4.4],['DeepSeek V4.1 Flash',.3,.006,1.2],['DeepSeek V4 Pro',1.32,.13,3.96],['gpt-oss-120B',.15,null,.6],['MiniMax M3',.3,.06,1.2],['Llama 3 8B Instruct Lite',.14,null,.14],['Qwen3.5-397B-A17B',.6,.35,3.6]]) add('Together',m,{input:i,output:o,cached:c,source:S.together});
add('Together','FLUX.2 [pro]',{kind:'image',unit:'per image',other:'$0.03 / image',source:S.together});
// Fireworks
for(const [m,i,c,o] of [['Kimi K3',3,.3,15],['DeepSeek V4.1 Flash',.3,.006,1.2],['GLM 5.3',1.4,.26,4.4],['OpenAI GPT OSS 120B',.15,.015,.6],['NVIDIA Nemotron 3.5 Lightning 30B A3B',.05,.01,.2],['Qwen 3.8 Max',2,.25,6]]) add('Fireworks',m,{input:i,output:o,cached:c,source:S.fireworks,notes:'Standard tier; Priority tier ~1.25x.'});
add('Fireworks','Embeddings (150M-350M params)',{kind:'embedding',input:.016,output:0,source:S.fireworks});
// Groq
add('Groq','openai/gpt-oss-120b',{input:.15,output:.6,context:131072,source:S.groq,notes:'Developer plan rate limits: 250K TPM, 1K RPM.'});
add('Groq','openai/gpt-oss-20b',{input:.075,output:.3,context:131072,source:S.groq,notes:'Developer plan: 250K TPM, 1K RPM.'});
add('Groq','whisper-large-v3-turbo',{kind:'audio',unit:'per hour',other:'$0.04 / hour',source:S.groq});
add('Groq','Llama 3.3 70B (llama-3.3-70b-versatile)',{context:131072,status:'unverified',source:S.groq,notes:'Price listed as "Contact Sales" on 2026-10-26.'});
// Perplexity
add('Perplexity','sonar',{input:.25,output:2.5,cached:.0625,source:S.pplx,notes:'Tool calls billed separately (web_search $2.50 / 1K).'});
add('Perplexity','pplx-embed-v1-4b',{kind:'embedding',input:.03,output:0,source:S.pplxp});
add('Perplexity','pplx-embed-v1-0.6b',{kind:'embedding',input:.004,output:0,source:S.pplxp});
// Cohere
add('Cohere','Command A+',{status:'unverified',source:S.cohere,notes:'First-party price not shown in fetched page text; OpenRouter lists $0.30 / $1.50.'});
add('Cohere','Command R+ 08-2024',{input:2.5,output:10,source:S.cohere,notes:'Legacy model, stated in pricing FAQ.'});
// Azure
for(const [m,i,c,o] of [['GPT-6 Astra (short context, Global)',10,1,50],['GPT-6.1 Sol (short context, Global)',2,.1,10],['GPT-6 Luna (short context, Global)',.1,.01,.5],['GPT-6 Luna (short context, Data Zone)',.11,.011,.55]]) add('Azure OpenAI',m,{input:i,output:o,cached:c,source:S.azure,notes:'Data Zone deployments ~+10%. Long-context rates higher.'});
// Bedrock
add('AWS Bedrock','DeepSeek v3.2',{input:.62,output:1.85,status:'unverified',source:S.bedrock,notes:'Rendered from regional price widget; region not confirmed.'});
add('AWS Bedrock','Mistral Large 3',{input:.5,output:1.5,status:'unverified',source:S.bedrock,notes:'Rendered from regional price widget; region not confirmed.'});
add('AWS Bedrock','Llama 4 Maverick 17B',{status:'unverified',source:S.bedrock,notes:'Price rendered client-side; not captured.'});
add('AWS Bedrock','Amazon Nova Pro',{status:'unverified',source:S.bedrock,notes:'Price rendered client-side; not captured.'});
// Mistral first-party
add('Mistral','Mistral Large 4',{status:'unverified',source:S.mistral,notes:'API price tab is client-rendered; see OpenRouter row.'});
// OpenRouter (official OpenRouter list prices from its public models API)
const or=JSON.parse(fs.readFileSync('snapshots/openrouter.json','utf8')).data;
for(const id of ['meta-llama/llama-4-maverick','meta-llama/llama-4-scout','mistralai/mistral-large-4-0','mistralai/mistral-medium-3-5','mistralai/mistral-small-2603','mistralai/codestral-2508','cohere/command-a-plus','qwen/qwen3.8-max-0902','qwen/qwen3.7-flash','moonshotai/kimi-k3.1-pro','x-ai/grok-4.7']){const m=or.find(x=>x.id===id);if(!m)continue;const p=k=>m.pricing[k]?Math.round(+m.pricing[k]*1e6*10000)/10000:null;const b=or.find(x=>x.id===id+':batch');
 add('OpenRouter',m.name.replace(/^[^:]+: /,'')+' ('+m.name.split(':')[0]+')',{input:p('prompt'),output:p('completion'),cached:p('input_cache_read'),batch_input:b?+(+b.pricing.prompt*1e6).toFixed(4):null,batch_output:b?+(+b.pricing.completion*1e6).toFixed(4):null,context:m.context_length,source:'https://openrouter.ai/'+id,notes:'OpenRouter list price from its public /api/v1/models endpoint; may route to multiple upstream hosts.'});}
fs.writeFileSync('data/models.json',JSON.stringify(M,null,1));
const P=[...new Set(M.map(m=>m.provider))].map(n=>({id:n.toLowerCase().replace(/[^a-z0-9]+/g,'-'),name:n,source:M.find(m=>m.provider===n).source,checked:C}));
const meta={'OpenAI':'Batch / Flex tier at 50%. Fast mode 2x. Fine-tuning closed to new users.','Anthropic':'Batch API 50% off. Cache hits 0.025x–0.1x input depending on model.','Google':'Free tier on many Flash models (data may be used to improve products). Batch 50% off.','DeepSeek':'Off-peak pricing ~50% of peak.','Groq':'Developer plan rate limits published per model.','OpenRouter':'Reseller / gateway; list price per model.','Perplexity':'Search tool calls billed per 1K invocations.','Azure OpenAI':'Global vs Data Zone deployments priced separately.','AWS Bedrock':'Prices vary by region and cross-region inference type.'};
P.forEach(p=>p.summary=meta[p.name]||'');
fs.writeFileSync('data/providers.json',JSON.stringify(P,null,1));
fs.writeFileSync('data/changes.json',JSON.stringify([
 {date:'2026-12-01',kind:'scheduled increase',provider:'Google',summary:'Gemini 4 Argon promotional pricing ends: input $2.00→$4.00, output $10.00→$20.00, cached $0.10→$0.20 per 1M tokens.',source:S.gemini,observed:C},
 {date:'2027-01-01',kind:'scheduled increase',provider:'Google',summary:'Gemini 3.8 Flash paid tier: input $0.75→$1.50, output $3.75→$7.50 per 1M tokens. Gemini 3.8 Flash TTS doubles the same day.',source:S.gemini,observed:C},
 {date:'2026-11-21',kind:'promotion end (earliest)',provider:'OpenAI',summary:'GPT-5.6 Sol promotional pricing guaranteed "at least through November 21, 2026" ($4.00 in / $20.00 out).',source:S.openai,observed:C},
 {date:'2026-10-05',kind:'billing start',provider:'OpenAI',summary:'Billing for gpt-rosalind-research began ($5.00 in / $25.00 out per 1M tokens).',source:S.openai,observed:C},
 {date:'2026-07-30',kind:'tier renamed',provider:'OpenAI',summary:'"Priority processing" renamed "Fast mode" (2x standard token price).',source:S.openai,observed:C}
],null,1));
console.log(M.length,'models',P.length,'providers',M.filter(m=>m.status==='verified').length,'verified');
