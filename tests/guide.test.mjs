import test from 'node:test';import assert from 'node:assert/strict';
import {createApp,readConfig} from '../dist/server/app.js';
import {needFrom,sessionFrom,cleanLine} from '../dist/server/guide.js';
const base={safety:'none',reply:'',path:'none',intensity:'none',heard:[],outside_scope:false,request:'none',switch_to:'none',tip:''};
const u=over=>({...base,...over});
test('model can raise safety above the keyword layer but never lower it',()=>{
  assert.equal(needFrom('my knee is being weird',u({safety:'pain'})).kind,'care');
  const kept=needFrom('my chest hurts',u({safety:'none',path:'cardio',reply:'Let’s move.'}));
  assert.equal(kept.kind,'care');assert.equal(kept.level,'urgent');
  assert.equal(needFrom('my back hurts',u({safety:'urgent'})).level,'urgent');
  assert.equal(sessionFrom('felt a bit off on that one',u({safety:'pain'})).kind,'safety');
  assert.equal(sessionFrom('my shoulder hurts',u({request:'harder'})).kind,'safety');
});
test('care copy is fixed wording, never the model’s text',()=>{
  const need=needFrom('knee weird',u({safety:'pain',reply:'Just push through it.'}));
  assert(!need.ack.includes('push through'));
});
test('model suggestion keeps real timer durations and rejects invented ones',()=>{
  const ok=needFrom('been hunched at a laptop since 8',u({path:'mobility',intensity:'gentle',heard:['sitting'],reply:'A long laptop day wants slow movement.'}));
  assert.equal(ok.kind,'suggest');assert(ok.ack.includes('(2:40)'));
  assert.equal(cleanLine('This takes 5 minutes.'),null);assert.equal(cleanLine('Let’s go!'),null);
  const fallback=needFrom('i have been sitting all day',u({path:'mobility',intensity:'gentle',reply:'Only 10 mins, promise.'}));
  assert(!fallback.ack.includes('10 mins'));
});
test('tips are offered for the current movement; empty or unsafe tips fall back',()=>{
  const tip=sessionFrom('my wrists are tired',u({request:'tip',tip:'Come onto your forearms instead, or make the movement smaller.'}));
  assert.deepEqual(tip,{kind:'tip',text:'Come onto your forearms instead, or make the movement smaller.'});
  assert.equal(sessionFrom('too easy',u({request:'tip',tip:''})).kind,'harder');
});
const config=readConfig({ALLOW_CLAUDE_API:'true',ANTHROPIC_API_KEY:'fake-test'},process.cwd());
async function app(understand){const server=createApp(config,fetch,undefined,undefined,understand);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;const cfg=await (await fetch(url+'/api/config')).json();return {url,cfg,close:()=>new Promise(r=>server.close(r))};}
const post=(a,text,ui='')=>fetch(a.url+'/api/turn',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':a.cfg.token},body:JSON.stringify({provider:'claude-guided',consent:true,fault:'none',messages:[{role:'user',content:text}],state:{ui_state:ui,client_events:[]}})});
test('HTTP guided mode: model reading drives the scripted screen; buttons skip the model',async()=>{
  const seen=[];const a=await app(async(raw,ctx)=>{seen.push([raw,ctx.phase]);return u({safety:'pain'});});
  try{const data=await (await post(a,'ugh my knee feels weird')).json();
    assert.equal(data.versions.provider,'claude-guided');assert.equal(data.versions.mode,'live');
    assert(data.turn.reply.includes('care_alert'));assert.deepEqual(seen,[['ugh my knee feels weird','need']]);
    await post(a,'/stillwater');assert.equal(seen.length,1);
  }finally{await a.close();}
});
test('HTTP guided mode falls back to the keyword layer when the model fails, and says so',async()=>{
  const a=await app(async()=>{throw new Error('network');});
  try{const data=await (await post(a,'my shoulder hurts')).json();
    assert(data.turn.reply.includes('offline reader'));assert(data.turn.reply.includes('care_alert'));
  }finally{await a.close();}
});
test('guided provider is off without opt-in and key',()=>{
  assert.equal(readConfig({},process.cwd()).guided.enabled,false);
  assert.equal(readConfig({ALLOW_CLAUDE_API:'true'},process.cwd()).guided.enabled,false);
});
test('plan login route: no tools, no settings, no API keys passed on, structured result read back',async()=>{
  const {createCliUnderstand,planEnvironment}=await import('../dist/server/guide.js');
  let seen;const transport=async(inv)=>{seen=inv;return {stdout:JSON.stringify({is_error:false,structured_output:u({safety:'pain',reply:'ok'})}),stderr:'',exitCode:0};};
  const understand=createCliUnderstand({root:process.cwd(),binary:'claude',model:'',transport});
  const result=await understand('elbow zzq feels odd',{phase:'need',style:null});assert.equal(result.safety,'pain');
  assert(seen.args.includes('--json-schema'));assert.equal(seen.args[seen.args.indexOf('--tools')+1],'');assert(seen.args.includes('--no-session-persistence'));assert(!seen.args.includes('--model'));
  assert(seen.input.includes('<message>elbow zzq feels odd</message>'));assert(!seen.args.join(' ').includes('zzq'),'the message goes through stdin, not argv');
  assert.equal(planEnvironment({ANTHROPIC_API_KEY:'x',ANTHROPIC_AUTH_TOKEN:'y',PATH:'p'}).ANTHROPIC_API_KEY,undefined);
  const broken=createCliUnderstand({root:process.cwd(),binary:'claude',model:'',transport:async()=>({stdout:JSON.stringify({is_error:true}),stderr:'',exitCode:1})});
  await assert.rejects(broken('hi',{phase:'need',style:null}));
  assert.equal(readConfig({ALLOW_CLAUDE_PLAN:'true'},process.cwd()).guided.via,'plan');
});
test('keyword floor ignores pain idioms but still catches real pain next to them',async()=>{
  const {interpretNeed}=await import('../dist/server/stillwater.js');
  assert.notEqual(interpretNeed('pain in the neck kind of day at work, need to unwind').kind,'care');
  for(const t of ['my neck pain is bad','what a pain in the neck, my back hurts','pain in my neck'])assert.equal(interpretNeed(t).kind,'care',t);
});
