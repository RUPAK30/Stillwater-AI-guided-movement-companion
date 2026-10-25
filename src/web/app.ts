import { Conversation } from '../shared/controller.js';
import { APP_VERSION, SCHEMA_VERSION, type Provider, type ProviderStatus, type RequestData, type Result } from '../shared/contracts.js';
import { TimerLedger, type TimerListEntry } from '../shared/openui/timer-store.js';
import { activityClientEvents, timerTransitionEvent } from '../shared/openui/activity-client-events.js';
import { createRunNav } from '../shared/openui/run-nav.js';
import { splitReply } from '../shared/openui/document.js';
import type { StatementNode } from '../shared/openui/openui-model.js';
import { redactValue } from '../shared/redact.js';
import { renderComponent, type Context } from './components.js';
import { byId,el,button } from './dom.js';
import { prefs, savePrefs, loadMemory, saveMemory, forgetMemory, applyTheme, primeChime, chime, announce, type Theme } from './prefs.js';

type Config={providers:ProviderStatus[];token:string};let config:Config|undefined;
const timers=new TimerLedger();let previousTimers=new Map<string,TimerListEntry>(),updates:(()=>void)[]=[];const earlyFinish=new Set<string>(),wasReset=new Set<string>(),safetyPaused=new Set<string>();let paused=false,pausedTimers:string[]=[],renderKey='',lastClear=0;
const countdowns=new Map<string,{n:number;handle:ReturnType<typeof setTimeout>}>();
const clock=(s:number)=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
const draft=byId<HTMLTextAreaElement>('message');
const c=new Conversation(async(request:RequestData,signal:AbortSignal):Promise<Result>=>{
  const controller=new AbortController(),abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});const timeout=setTimeout(abort,request.provider==='claude-cli'||request.provider==='claude-guided'?85000:48000);
  try{const response=await fetch('/api/turn',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':config!.token},body:JSON.stringify(request),signal:controller.signal});const data=await response.json();if(!response.ok)throw new Error(data.error??'Request failed.');return data;}
  catch(error){if(error instanceof Error && error.name==='AbortError')throw new Error('Request cancelled or timed out. Retry when ready.');throw error;}
  finally{clearTimeout(timeout);signal.removeEventListener('abort',abort);}
},render,()=>[...(paused?['Preview is currently paused.']:[]),...timers.list().map(t=>`Simulated timer ${t.id} (${t.label}): ${t.status}, ${Math.ceil(t.remaining)} of ${t.seconds} seconds remaining.`)]);
function makeNav(){return createRunNav({index:()=>c.document.screens.findIndex(s=>s.key===c.document.cursor),stepCount:()=>c.document.screens.length,isConsumed:()=>false,awaiting:()=>false,leave:()=>{if(c.pending)c.cancel('interrupted');},land:(from,to)=>{c.document.move(to);c.localEvent(to<from?activityClientEvents.wentBack(`step ${from+1}`,`step ${to+1}`):activityClientEvents.nowOnStep(`step ${to+1} of ${c.document.screens.length}`));},phase:()=>{},finish:()=>{if((c.document.current?.props.children as StatementNode[]??[]).some(n=>n.name==='Recap'))closedRun=true;c.localEvent('Reached the final screen. This is not evidence of physical completion.');}},{outMs:30,inMs:30});}
let nav=makeNav(),closedRun=false,lastStage='',lastWasWorkout=false,lastIntent='';
/** The screen after the one holding `key`: its title without the "n of N · " prefix, and whether it is the closing screen. */
function upNext(key:string){const screens=c.document.screens,i=screens.findIndex(s=>(s.props.children as StatementNode[]).some(n=>n.key===key)),next=screens[i+1];if(i<0||!next)return null;const children=next.props.children as StatementNode[],title=children.find(n=>n.name==='Text'&&n.props.variant==='title');return {label:title?String(title.props.text).replace(/^\d+ of \d+ · /,''):`step ${i+2}`,closing:children.some(n=>n.name==='Recap')};}
function advance(key:string){const holds=(c.document.current?.props.children as StatementNode[]??[]).some(n=>n.key===key);if(!holds||nav.phase()!=='idle'||paused)return;nav.next();}
/** Stillwater's ambient presence follows the activity: present at arrival, receding during movement, calm at the close. */
const hasTimer=(s:StatementNode)=>(s.props.children as StatementNode[]).some(n=>n.name==='Timer');
/** A movement screen: it has a timer and no safety notice. These render as one continuous workout stage. */
function isWorkout(s:StatementNode|undefined){const kids=s?.props.children as StatementNode[]|undefined;return !!kids&&hasTimer(s!)&&!kids.some(n=>n.name==='Alert'&&(n.props.tone==='warning'||n.props.tone==='danger'));}
/** The active workout, composed as one guided session:
 *  header (Stillwater, session, progress) → movement stage (name, instruction, dial timer, controls, cues)
 *  → up next + Stillwater companion (guidance, offers, "Tell Stillwater") → session navigation. */
function renderWorkout(current:StatementNode,ctx:Context){
  const kids=current.props.children as StatementNode[],screens=c.document.screens,moves=screens.filter(hasTimer),pos=moves.findIndex(s=>s.key===current.key);
  const of=(name:string)=>kids.find(n=>n.name===name),rail=of('Rail'),intent=String(rail?.props.intent??''),timerNode=of('Timer')!;
  const stage=el('section','','workout');
  // Header: who is with you, what this session is, where you are in it.
  const head=el('div','','workout-head'),mark=el('p','','workout-mark'),progress=button('',()=>toggleSheet(),'workout-progress'),track=el('div','','workout-track');
  mark.append(el('span','','sw-dot'),el('span','Stillwater','sw-name'),el('span',intent||'Session','workout-intent'));
  track.setAttribute('aria-hidden','true');const dots=moves.map(()=>{const d=el('span');track.append(d);return d;});
  progress.setAttribute('aria-expanded','false');progress.setAttribute('aria-label',`Movement ${pos+1} of ${moves.length}. Show all movements`);
  progress.append(el('span',`Movement ${pos+1} of ${moves.length}`,'workout-count'),track);head.append(mark,progress);
  // Session overview: every movement, its timer and its real state; jumping is allowed unless safety holds the session.
  const sheet=el('div','','workout-sheet');sheet.hidden=true;const items=el('ol','','sheet-list'),marks:HTMLElement[]=[];
  moves.forEach((s,i)=>{const sk=s.props.children as StatementNode[],tt=sk.find(n=>n.name==='Text'&&n.props.variant==='title'),tm=sk.find(n=>n.name==='Timer')!;
    const li=el('li'),go=button('',()=>jumpTo(s.key),'sheet-item'+(i===pos?' current':'')),st=el('span','','sheet-status');marks.push(st);
    go.append(el('span',String(i+1),'sheet-n'),el('strong',String(tt?.props.text??'').replace(/^\d+ of \d+ · /,'')),el('span',clock(Number(tm.props.seconds)),'sheet-time'),st);go.disabled=i===pos||safetyHold();li.append(go);items.append(li);});
  sheet.append(el('p','This session','sheet-title'),items);
  const toggleSheet=(open=sheet.hidden)=>{sheet.hidden=!open;progress.setAttribute('aria-expanded',String(open));};
  // Movement stage: the one thing to focus on.
  const hero=el('div','','workout-hero'),words=el('div','','workout-words');
  const title=of('Text')&&kids.find(n=>n.name==='Text'&&n.props.variant==='title'),text=kids.find(n=>n.name==='Text'&&n.props.variant==='description'),cues=of('List');
  if(title)words.append(el('h3',String(title.props.text).replace(/^\d+ of \d+ · /,''),'workout-title'));
  if(text)words.append(el('p',String(text.props.text),'workout-instruction'));
  // The existing timer component, recomposed around a dial that shows the real remaining time.
  const timer=renderComponent(timerNode,ctx);timer.classList.add('stage-timer');
  const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg'),ring=document.createElementNS(NS,'circle'),arc=document.createElementNS(NS,'circle'),C=2*Math.PI*54;
  svg.setAttribute('viewBox','0 0 120 120');svg.setAttribute('class','dial-ring');svg.setAttribute('aria-hidden','true');
  for(const circle of [ring,arc]){circle.setAttribute('cx','60');circle.setAttribute('cy','60');circle.setAttribute('r','54');}
  ring.setAttribute('class','dial-track');arc.setAttribute('class','dial-arc');arc.style.strokeDasharray=String(C);svg.append(ring,arc);
  const face=timer.querySelector('.timer-face'),dial=el('div','','dial'),count=el('span','','dial-count'),breath=el('span','','dial-breath'),breathing=/breath|exhale/i.test(String(timerNode.props.label));count.setAttribute('aria-hidden','true');if(face){face.replaceWith(dial);dial.append(svg,face,count);face.append(breath);}
  hero.append(words,timer);if(cues){const list=renderComponent(cues,ctx);list.classList.add('workout-cues');hero.append(list);}
  // Below the stage: what comes next, and Stillwater (guidance, any offer, and the way to tell it something).
  const lower=el('div','','workout-lower'),next=el('div','','workout-next'),companion=el('div','','workout-companion'),offer=el('div','','workout-offer');
  const after=screens[screens.findIndex(s=>s.key===current.key)+1],afterKids=(after?.props.children as StatementNode[]|undefined)??[];
  const afterTimer=afterKids.find(n=>n.name==='Timer'),afterTitle=afterKids.find(n=>n.name==='Text'&&n.props.variant==='title');
  next.append(el('span','Up next','workout-next-label'),el('strong',afterTimer?String(afterTitle?.props.text??'').replace(/^\d+ of \d+ · /,''):'Wind down','workout-next-title'),el('span',afterTimer?`${Math.floor(Number(afterTimer.props.seconds)/60)}:${String(Number(afterTimer.props.seconds)%60).padStart(2,'0')} on the timer`:'A calm close to the session','workout-next-meta'));
  const cue=of('Cue'),say=el('p','','workout-say');say.append(el('span','','sw-dot'),el('span',cue?String(cue.props.text):'','workout-say-text'));
  for(const node of kids)if(node.name==='Alert'||node.name==='FollowUps')offer.append(renderComponent(node,ctx));
  if(offer.childNodes.length){offer.prepend(el('span','Stillwater suggests','workout-offer-label'));stage.classList.add('has-offer');}
  companion.append(offer.childNodes.length?offer:say);const ask=of('TextInput');if(ask)companion.append(renderComponent(ask,ctx));
  lower.append(companion,next);
  // A confirmed change to the session (same run, new intensity or activity) is marked on the stage.
  const runKey=`${c.document.clearVersion}|${intent}`;if(lastIntent&&intent&&lastIntent.split('|')[0]===String(c.document.clearVersion)&&lastIntent!==runKey){stage.classList.add('adjusted');mark.append(el('span',`Adjusted · now ${intent.split(' · ')[0].toLowerCase()}`,'workout-adjusted'));}if(intent)lastIntent=runKey;
  // Session navigation lives in the stage during a workout (same buttons and handlers).
  const navSlot=el('div','','workout-nav');navSlot.append(byId('navigation'));
  stage.append(head,sheet,hero,lower,navSlot);
  // Live state from the real timer ledger: progress dots and the dial.
  const update=()=>{const list=timers.list();moves.forEach((s,i)=>{const t=(s.props.children as StatementNode[]).find(n=>n.name==='Timer')!,e=list.find(x=>x.id===t.key);dots[i].className=[i===pos?'current':'',e?.status==='done'?(earlyFinish.has(t.key)?'early':'done'):e&&e.status!=='stopped'?'open':''].join(' ').trim();});
    const e=list.find(x=>x.id===timerNode.key);if(e)arc.style.strokeDashoffset=String(C*(e.remaining/e.seconds));
    marks.forEach((m,i)=>{const cl=dots[i].classList;m.textContent=cl.contains('done')?'Done':cl.contains('early')?'Marked done':cl.contains('open')?'Started':'';});
    const cd=countdowns.get(timerNode.key)?.n??0;count.textContent=cd?String(cd):'';dial.dataset.counting=cd?'true':'';
    // The pacer follows the real timer: 4 s in, 6 s out.
    if(breathing&&e?.status==='running'){const phase=(e.seconds-e.remaining)%10<4?'in':'out';dial.dataset.breath=phase;breath.textContent=phase==='in'?'Breathe in':'Breathe out';}else{delete dial.dataset.breath;breath.textContent='';}};
  updates.push(update);update();return stage;
}
function updatePhase(){const kids=c.document.current?.props.children as StatementNode[]|undefined,timer=kids?.find(n=>n.name==='Timer'),status=timer?timers.list().find(t=>t.id===timer.key)?.status:undefined;
  const phase=!kids?'idle':kids.some(n=>n.name==='Alert'&&(n.props.tone==='warning'||n.props.tone==='danger'))?'care':kids.some(n=>n.name==='Recap')?(closedRun?'closed':'closing'):timer?(status==='running'||status==='paused'?'focus':status==='done'?'rest':'ready'):c.document.screens[0]?.key===c.document.cursor?'arrival':kids.some(n=>n.name==='TextInput')?'discovery':'present';
  const preview=document.querySelector<HTMLElement>('.preview');if(preview&&preview.dataset.phase!==phase)preview.dataset.phase=phase;if(document.body.dataset.phase!==phase)document.body.dataset.phase=phase;
  // In a movement, Next honestly says Skip until its timer has finished.
  if(isWorkout(c.document.current)&&!byId<HTMLButtonElement>('next').disabled){const label=status==='done'?'Next →':'Skip →';if(byId('next').textContent!==label)byId('next').textContent=label;}}
/** A safety notice on a screen with a timer holds the session: running timers pause at once and controls wait for the reader's decision. */
function safetyHold(){const kids=c.document.current?.props.children as StatementNode[]|undefined;return !!kids&&kids.some(n=>n.name==='Timer')&&kids.some(n=>n.name==='Alert'&&(n.props.tone==='warning'||n.props.tone==='danger'));}
function holdForSafety(){if(!safetyHold())return;syncTimers();for(const node of c.document.current!.props.children as StatementNode[]){if(node.name!=='Timer')continue;const entry=timers.list().find(t=>t.id===node.key);if(entry?.status!=='running')continue;timers.pause(node.key);safetyPaused.add(node.key);const after=timers.list().find(t=>t.id===node.key)!;previousTimers.set(node.key,{...after});c.clientEvents.push(`Paused the timer for ${after.label} for safety with ${Math.ceil(after.remaining)} seconds remaining.`);}}
function send(text:string){if(!config)return;const provider=config.providers.find(p=>p.id===c.provider)!;if(!provider.enabled||(c.provider!=='mock'&&!c.consent)){c.error='Set up this provider and agree to usage, or select Mock.';render();return;}if(paused){c.error='Resume the preview before sending.';render();return;}const f=byId<HTMLSelectElement>('fault');const fault=f.value as RequestData['fault'];f.value='none';void c.send(text,fault);}
function syncTimers(){
  if(lastClear!==c.document.clearVersion){nav.dispose();nav=makeNav();closedRun=false;timers.forget();previousTimers.clear();earlyFinish.clear();wasReset.clear();safetyPaused.clear();for(const id of [...countdowns.keys()])cancelCountdown(id);lastClear=c.document.clearVersion;}
  const ids=new Set<string>();for(const s of c.document.screens)for(const node of s.props.children as StatementNode[])if(node.name==='Timer'){ids.add(node.key);const old=timers.list().find(t=>t.id===node.key);if(old&&old.seconds!==Number(node.props.seconds)){earlyFinish.delete(node.key);wasReset.delete(node.key);safetyPaused.delete(node.key);previousTimers.delete(node.key);}timers.ensure(node.key,{label:String(node.props.label),seconds:Number(node.props.seconds)});}
  for(const t of timers.list())if(!ids.has(t.id)){timers.forget(t.id);previousTimers.delete(t.id);earlyFinish.delete(t.id);}
}
function tick(){const snapshot=timers.list();for(const entry of snapshot){const before=previousTimers.get(entry.id);previousTimers.set(entry.id,{...entry});if(before && before.status!=='done'&&entry.status==='done'){c.localEvent(activityClientEvents.finishedTimer(entry.label),false);announce(activityClientEvents.finishedTimer(entry.label));chime();}else if(before?.status==='running'&&entry.status==='running'&&before.remaining>10&&entry.remaining<=10)announce(`10 seconds left on ${entry.label}.`);}updates.forEach(fn=>fn());updatePhase();}
/** Start may be preceded by a short get-ready countdown; any timer control cancels it. Timers never start by themselves. */
function timerAction(id:string,action:'start'|'pause'|'reset'|'finish'){
  const before=timers.list().find(t=>t.id===id);if(!before||paused)return;
  if(countdowns.has(id)){cancelCountdown(id);if(action!=='finish'&&action!=='reset')return;}
  if(action==='start'&&before.status==='stopped'&&prefs.ready){
    const step=(n:number)=>{if(paused||safetyHold()||!timers.list().some(t=>t.id===id)){cancelCountdown(id);return;}
      if(n===0){countdowns.delete(id);applyTimerAction(id,'start');return;}
      countdowns.set(id,{n,handle:setTimeout(()=>step(n-1),1000)});announce(n===3?'Get ready. 3':String(n));tick();};
    step(3);return;}
  applyTimerAction(id,action);
}
function cancelCountdown(id:string){const cd=countdowns.get(id);if(!cd)return;clearTimeout(cd.handle);countdowns.delete(id);tick();}
function applyTimerAction(id:string,action:'start'|'pause'|'reset'|'finish'){
  const before=timers.list().find(t=>t.id===id);if(!before||paused)return;
  if(action==='start')timers.start(id);if(action==='pause')timers.pause(id);if(action==='reset')timers.reset(id);if(action==='finish')timers.finish(id);if(action==='finish')earlyFinish.add(id);else if(action!=='pause')earlyFinish.delete(id);if(action==='reset'&&before.status!=='stopped')wasReset.add(id);else if(action!=='pause')wasReset.delete(id);if(action!=='pause')safetyPaused.delete(id);
  const after=timers.list().find(t=>t.id===id)!;previousTimers.set(id,{...after});
  const event=action==='reset'?activityClientEvents.resetTimer(after.label,after.seconds):action==='start'&&before.status==='stopped'?activityClientEvents.startedTimer(after.label,after.seconds):timerTransitionEvent(before,after);
  c.localEvent(event??`Simulated ${action} for ${after.label}.`);announce(event??'');tick();
}
function render(){let moveFocus=false;
  if(config){const selected=config.providers.find(p=>p.id===c.provider)!;byId('mode').textContent=c.provider==='mock'?'MOCK · NO MODEL CALLS':selected.enabled?'LIVE WHEN SENT':'SETUP / BLOCKED';byId('provider-description').textContent=selected.message;byId('consent-wrap').hidden=c.provider==='mock'||!selected.enabled;byId('consent-label').textContent=c.provider==='claude-cli'?'Use my subscription quota on Send/Retry; I reviewed the host-policy limits.':'Use my API budget on Send/Retry.';byId<HTMLInputElement>('consent').checked=c.consent;byId<HTMLButtonElement>('send').disabled=!selected.enabled||(c.provider!=='mock'&&!c.consent)||paused;byId('mock-controls').hidden=c.provider!=='mock';byId('sample').hidden=c.provider!=='mock';}
  byId('send').textContent=c.pending?'Update':'Send';byId('cancel').hidden=!c.pending;byId<HTMLButtonElement>('cancel').disabled=!c.pending;byId('pending').hidden=!c.pending;byId('status').textContent=c.pending?'Thinking… type an update to interrupt':c.error?'Needs attention':'Ready when you are';byId('error').hidden=!c.error;byId('error-message').textContent=c.error;
  const transcript=byId('transcript');transcript.replaceChildren();if(!c.events.length)transcript.append(el('p','Start the scripted Stillwater demo, type /workout (optionally /workout cardio steady) for a session, or load the wiring sample. Mock makes no model calls.','micro'));
  for(const event of c.events){if(event.kind==='input'||event.kind==='response'){const n=el('div','','message '+(event.kind==='input'?'user':'assistant'));n.append(el('span',event.kind==='input'?'You':'Stillwater','who'),el('p',event.text??splitReply(event.result!.turn.reply).prose??''));transcript.append(n);}else if(event.text)transcript.append(el('p',event.text,'event'));else if(event.kind==='interrupted'||event.kind==='cancelled')transcript.append(el('p',event.kind==='interrupted'?'Previous reply interrupted. Your messages are kept.':'Reply cancelled.','event'));}
  transcript.scrollTop=transcript.scrollHeight;syncTimers();
  holdForSafety();const screens=c.document.screens,index=screens.findIndex(s=>s.key===c.document.cursor),key=c.document.echo()+String(paused);
  if(key!==renderKey || !byId('screen').childNodes.length){renderKey=key;updates=[];const surface=byId('screen');if(surface.contains(byId('navigation')))surface.after(byId('navigation'));surface.replaceChildren();const stage=`${c.document.clearVersion}:${c.document.cursor}`;const current=c.document.current,workoutNow=isWorkout(current);if(stage!==lastStage){surface.classList.remove('enter','enter-stage','enter-soft');void surface.offsetWidth;surface.classList.add(lastStage&&!lastStage.startsWith(`${c.document.clearVersion}:`)?'enter-stage':workoutNow&&lastWasWorkout?'enter-soft':'enter');lastStage=stage;moveFocus=true;}lastWasWorkout=workoutNow;surface.classList.toggle('closing',(c.document.current?.props.children as StatementNode[]??[]).some(n=>n.name==='Recap'));
    if(!current)surface.append(renderHome());
    else{const ctx:Context={send,timers,timerAction,updates,paused:paused||safetyHold(),safetyPaused,earlyFinish,busy:()=>c.pending,upNext,advance,wasReset,countdown:id=>countdowns.get(id)?.n??0,rememberedName:loadMemory().name??''};if(workoutNow)surface.append(renderWorkout(current,ctx));else for(const node of current.props.children as StatementNode[])if(node.name!=='Cue')surface.append(renderComponent(node,ctx));}
    const progress=byId('progress');progress.replaceChildren();if(screens.length>1)for(let i=0;i<screens.length;i++){const n=el('span','',''+(i===index?'active':i<index?'past':''));n.setAttribute('aria-label',`Screen ${i+1}${i===index?', current':''}`);progress.append(n);}
  }
  byId('navigation').hidden=screens.length<2;byId('position').textContent=`${index+1} / ${screens.length}`;byId<HTMLButtonElement>('back').disabled=paused||safetyHold()||index<=0;const awaitingReply=index===screens.length-1&&(c.document.current?.props.children as StatementNode[]??[]).some(n=>n.name==='FollowUps'||n.name==='NameInput'||n.name==='TextInput');const closing=index===screens.length-1&&(c.document.current?.props.children as StatementNode[]??[]).some(n=>n.name==='Recap');byId<HTMLButtonElement>('next').disabled=paused||safetyHold()||awaitingReply||(closing&&closedRun);byId('next').textContent=awaitingReply?'Answer above':closing?(closedRun?'Done for today':'Finish'):index===screens.length-1?'Finish preview':'Next →';
  byId<HTMLButtonElement>('pause').disabled=!screens.some(hasTimer);document.body.classList.toggle('stage-talk',isWorkout(c.document.current)&&(c.document.current!.props.children as StatementNode[]).some(n=>n.name==='TextInput'));byId('pause').textContent=paused?'Resume':'Pause';byId('paused').hidden=!paused;
  const cues=(c.document.current?.props.children as StatementNode[]??[]).filter(n=>n.name==='Cue').map(n=>String(n.props.text));byId('spoken').textContent=(closedRun&&index===screens.length-1?'Take care. Whenever you feel like another few minutes, I’ll be here with something that fits.':'')||cues.join(' ')||'';
  byId('state-json').textContent=JSON.stringify({ui_state:c.document.echo(),client_events:c.clientEvents,timers:timers.list()},null,2);byId<HTMLButtonElement>('export').disabled=c.pending||!c.events.length;updatePhase();renderCaption();rememberSession();if(moveFocus)focusSession();
}
byId<HTMLFormElement>('composer').addEventListener('submit',event=>{event.preventDefault();const text=draft.value.trim();if(text){draft.value='';send(text);}});
draft.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();byId<HTMLFormElement>('composer').requestSubmit();}});
byId('sample').addEventListener('click',()=>send('Load wiring sample'));byId('cancel').addEventListener('click',()=>c.cancel());byId('retry').addEventListener('click',()=>{if(!paused)void c.retry();});
byId('reset').addEventListener('click',()=>{nav.dispose();closedRun=false;wasReset.clear();safetyPaused.clear();paused=false;pausedTimers=[];timers.forget();previousTimers.clear();earlyFinish.clear();draft.value='';c.reset();});
byId('back').addEventListener('click',()=>nav.back());byId('next').addEventListener('click',()=>nav.next());
byId('pause').addEventListener('click',()=>{paused=!paused;if(paused){pausedTimers=timers.list().filter(t=>t.status==='running').map(t=>t.id);for(const id of pausedTimers)timers.pause(id);}else{for(const id of pausedTimers)timers.start(id);pausedTimers=[];}c.localEvent(paused?'User paused the preview.':'User resumed the preview.');tick();});
byId<HTMLSelectElement>('provider').addEventListener('change',event=>c.selectProvider((event.target as HTMLSelectElement).value as Provider));
byId<HTMLInputElement>('consent').addEventListener('change',event=>{c.consent=(event.target as HTMLInputElement).checked;if(!c.consent)c.cancel();render();});
byId('apply-patch').addEventListener('click',()=>{try{const raw=byId<HTMLTextAreaElement>('patch').value;c.document.apply(raw.includes('```')?raw:'```openui\n'+raw+'\n```');c.localEvent('Builder applied local OpenUI data: '+raw);byId('patch-status').textContent='Patch accepted. This is local fixture evidence, not a model run.';}catch{byId('patch-status').textContent='Invalid patch. Previous screen kept. Check names, arguments and catalog.';}});
byId('export').addEventListener('click',()=>{const label=byId<HTMLSelectElement>('run-label').value;const payload={format:'stillwater-workout-run-v1',label,appVersion:APP_VERSION,schemaVersion:SCHEMA_VERSION,selectedProvider:c.provider,note:byId<HTMLTextAreaElement>('note').value,events:c.events,state:{ui_state:c.document.echo(),client_events:c.clientEvents},timers:timers.list()};const url=URL.createObjectURL(new Blob([JSON.stringify(redactValue(payload),null,2)],{type:'application/json'}));const link=el('a');link.href=url;link.download=label+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);byId('export-status').textContent=`Downloaded ${label}.json. Review and move it into runs/.`;});
async function start(){render();try{const response=await fetch('/api/config');if(!response.ok)throw new Error();config=await response.json();const select=byId<HTMLSelectElement>('provider');select.replaceChildren();for(const p of config!.providers){const option=el('option',p.label+(p.enabled?'':' · setup / blocked'));option.value=p.id;select.append(option);}select.value='mock';select.disabled=false;render();}catch{byId('status').textContent='Could not connect. Restart the local server and reload.';}}
/** Jump to a movement from the session overview (never while safety holds the session). */
function jumpTo(key:string){if(safetyHold()||nav.phase()!=='idle'||paused)return;const screens=c.document.screens,i=screens.findIndex(s=>s.key===key),from=screens.findIndex(s=>s.key===c.document.cursor);if(i<0||i===from)return;c.document.move(i);c.localEvent(i<from?activityClientEvents.wentBack(`step ${from+1}`,`step ${i+1}`):activityClientEvents.nowOnStep(`step ${i+1} of ${screens.length}`));}
const QUICK=[{label:'Loosen up',detail:'Gentle mobility · 2:40',cmd:'/workout mobility gentle'},{label:'Stretch',detail:'Gentle stretching · 2:30',cmd:'/workout stretching gentle'},{label:'Get moving',detail:'Steady low-impact cardio · 4:00',cmd:'/workout cardio steady'}];
/** Home: a greeting, one clear way in, quick picks, and (if remembered) the last session. */
function renderHome(){
  const mem=loadMemory(),hour=new Date().getHours(),hello=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
  const n=el('div','','home');n.append(el('p',`${hello}${mem.name?`, ${mem.name}`:''}`,'home-hello'),el('h2','A few good minutes of movement.','home-title'),el('p','Tell me what today needs in the box below, or pick something quick. I’ll shape the session and stay quiet while you move.','home-lede'));
  const begin=button('Start with Stillwater',()=>send('Start Stillwater'),'primary home-start');begin.id='workout';
  const quick=el('div','','home-quick');
  if(mem.last){const again=button('',()=>send(`/workout ${mem.last!.path} ${mem.last!.intensity}`),'quick again');again.append(el('strong','Same as last time'),el('span',mem.last.title));quick.append(again);}
  for(const q of QUICK){const b=button('',()=>send(q.cmd),'quick');b.append(el('strong',q.label),el('span',q.detail));quick.append(b);}
  const shelf=mem.words?.length?[el('p',`Words you’ve picked up · ${mem.words.length}`,'home-label'),(()=>{const row=el('div','','home-words');for(const w of mem.words!)row.append(el('span',w,'word-chip'));return row;})()]:[];
  n.append(begin,el('p','Or pick something quick','home-label'),quick,...shelf,el('p','Simulated and text-only: Stillwater can’t see you. Stop anything that doesn’t feel right.','micro home-note'));
  return n;
}
/** Stillwater's latest words, shown as a caption outside the workout (where the stage speaks for itself). */
function renderCaption(){const reply=[...c.events].reverse().find(e=>e.kind==='response'),prose=reply?.result?splitReply(reply.result.turn.reply).prose:'';const kids=c.document.current?.props.children as StatementNode[]|undefined;const quiet=isWorkout(c.document.current)||(kids??[]).some(n=>n.name==='Recap')||c.pending;const cap=byId('caption');if(cap.textContent!==prose)cap.textContent=prose;const onScreen=(kids??[]).some(n=>typeof n.props.text==='string'&&prose.includes(String(n.props.text)));cap.hidden=quiet||!prose||onScreen;}
const PATH_OF:Record<string,string>={'Mobility reset':'mobility','Stretch and settle':'stretching','Low-impact cardio':'cardio'};
/** Opt-in memory: name, style and last session, kept in this browser only. */
function rememberSession(){if(!prefs.remember)return;const nodes=c.document.screens.flatMap(s=>s.props.children as StatementNode[]),you=[...nodes].reverse().find(n=>n.name==='Profile'),title=nodes.find(n=>n.key==='intro_title');
  const update:Parameters<typeof saveMemory>[0]={};if(typeof you?.props.name==='string'&&you.props.name)update.name=you.props.name;if(typeof you?.props.style==='string')update.style=you.props.style;
  if(title){const [level,name]=String(title.props.text).split(' · ');const path=PATH_OF[name??''];if(path&&level)update.last={path,intensity:level.toLowerCase(),title:`${level} ${name.toLowerCase()}`};}
  // The word from today joins the shelf only once the session's ending is reached.
  const word=nodes.find(n=>n.key==='finish_word');if(word&&c.document.cursor==='finish'&&typeof word.props.text==='string'){const words=loadMemory().words??[];if(!words.includes(word.props.text))update.words=[...words,word.props.text].slice(-30);}
  if(Object.keys(update).length)saveMemory(update);}
function focusSession(){const a=document.activeElement as HTMLElement|null;if(a&&a.closest('.talk,#drawer')&&a!==document.body)return;byId('screen').focus({preventScroll:true});}
// Drawer: conversation history, settings and developer tools.
function selectTab(tab:string){for(const t of document.querySelectorAll<HTMLElement>('[role=tab]')){const on=t.dataset.tab===tab;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;}for(const panel of document.querySelectorAll<HTMLElement>('.drawer-panel'))panel.hidden=panel.dataset.panel!==tab;}
function openDrawer(tab?:string){if(tab)selectTab(tab);byId('drawer').hidden=false;byId('scrim').hidden=false;document.body.classList.add('drawer-open');byId('menu').setAttribute('aria-expanded','true');document.querySelector<HTMLElement>('[role=tab][aria-selected=true]')?.focus();}
function closeDrawer(){byId('drawer').hidden=true;byId('scrim').hidden=true;document.body.classList.remove('drawer-open');byId('menu').setAttribute('aria-expanded','false');byId('menu').focus();}
byId('menu').addEventListener('click',()=>byId('drawer').hidden?openDrawer():closeDrawer());byId('close-drawer').addEventListener('click',closeDrawer);byId('scrim').addEventListener('click',closeDrawer);
for(const t of document.querySelectorAll<HTMLElement>('[role=tab]'))t.addEventListener('click',()=>selectTab(t.dataset.tab!));
document.querySelector('[role=tablist]')!.addEventListener('keydown',e=>{const ev=e as KeyboardEvent;if(ev.key!=='ArrowRight'&&ev.key!=='ArrowLeft')return;const tabs=[...document.querySelectorAll<HTMLElement>('[role=tab]')],i=tabs.findIndex(t=>t.getAttribute('aria-selected')==='true'),next=tabs[(i+(ev.key==='ArrowRight'?1:tabs.length-1))%tabs.length];selectTab(next.dataset.tab!);next.focus();});
// Settings.
const THEMES:Theme[]=['auto','light','dark'],THEME_LABEL:Record<Theme,string>={auto:'automatic',light:'day',dark:'evening'};
function syncSettings(){byId<HTMLInputElement>('pref-ready').checked=prefs.ready;byId<HTMLInputElement>('pref-chime').checked=prefs.chime;byId<HTMLInputElement>('pref-remember').checked=prefs.remember;for(const r of document.querySelectorAll<HTMLInputElement>('input[name=theme]'))r.checked=r.value===prefs.theme;byId('theme').setAttribute('aria-label',`Theme: ${THEME_LABEL[prefs.theme]}`);byId('theme').textContent=prefs.theme==='dark'?'☾':prefs.theme==='light'?'☀':'◐';applyTheme();}
function setTheme(theme:Theme){prefs.theme=theme;savePrefs();syncSettings();}
byId('theme').addEventListener('click',()=>setTheme(THEMES[(THEMES.indexOf(prefs.theme)+1)%THEMES.length]));
for(const r of document.querySelectorAll<HTMLInputElement>('input[name=theme]'))r.addEventListener('change',()=>setTheme(r.value as Theme));
byId('pref-ready').addEventListener('change',e=>{prefs.ready=(e.target as HTMLInputElement).checked;savePrefs();});
byId('pref-chime').addEventListener('change',e=>{prefs.chime=(e.target as HTMLInputElement).checked;savePrefs();if(prefs.chime){primeChime();chime();}});
byId('pref-remember').addEventListener('change',e=>{prefs.remember=(e.target as HTMLInputElement).checked;savePrefs();if(prefs.remember)rememberSession();else forgetMemory();renderKey='';render();});
byId('forget').addEventListener('click',()=>{forgetMemory();prefs.remember=false;savePrefs();syncSettings();renderKey='';render();announce('Forgotten on this device.');});
// Keyboard: Space starts or pauses the current timer; arrows move between steps; Escape closes the menu.
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!byId('drawer').hidden){closeDrawer();return;}
  const target=e.target as HTMLElement;if(e.metaKey||e.ctrlKey||e.altKey||!byId('drawer').hidden||target.closest('input,textarea,select,button,a,summary,[contenteditable]'))return;
  if(e.key===' '&&isWorkout(c.document.current)){const tm=(c.document.current!.props.children as StatementNode[]).find(n=>n.name==='Timer')!,st=timers.list().find(x=>x.id===tm.key)?.status;e.preventDefault();timerAction(tm.key,st==='running'||st==='paused'?'pause':'start');}
  else if(e.key==='ArrowRight'&&!byId('navigation').hidden&&!byId<HTMLButtonElement>('next').disabled){e.preventDefault();nav.next();}
  else if(e.key==='ArrowLeft'&&!byId('navigation').hidden&&!byId<HTMLButtonElement>('back').disabled){e.preventDefault();nav.back();}
});
// The talk box grows with its text, up to a few lines.
draft.addEventListener('input',()=>{draft.style.height='auto';draft.style.height=`${Math.min(draft.scrollHeight,140)}px`;});
syncSettings();
if('serviceWorker' in navigator)navigator.serviceWorker.register('/web/sw.js',{scope:'/'}).catch(()=>{/* installable only where supported */});
setInterval(tick,250);void start();
