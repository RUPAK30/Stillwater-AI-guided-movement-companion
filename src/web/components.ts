import { el, button } from './dom.js';
import type { StatementNode } from '../shared/openui/openui-model.js';
import type { TimerLedger } from '../shared/openui/timer-store.js';
import { recapLine, recapSummary } from '../shared/openui/recap.js';
import { validateName, nameMessage } from '../shared/openui/name-input.js';
export type Context = { send: (text:string)=>void; timers: TimerLedger; timerAction: (id:string, action:'start'|'pause'|'reset'|'finish')=>void; updates: (()=>void)[]; paused: boolean; earlyFinish: Set<string>; busy: ()=>boolean; upNext: (key:string)=>{label:string;closing:boolean}|null; advance: (key:string)=>void; wasReset: Set<string>; safetyPaused: Set<string>; countdown: (key:string)=>number; rememberedName: string };
const afterBlock=['Done. Take whatever pause you need.','That one is done. No rush into the next.','Good. Shake it out if you like, then carry on.'];
// Drafts and focus survive re-renders, so a reply arriving mid-sentence never wipes what someone is typing.
const drafts=new Map<string,string>();let typingIn='';
const styleLabels: Record<string,string> = { beginner:'Beginner tone', regular:'Regular tone', challenge:'Challenge-seeker tone', exploring:'Exploring tone' };
// Trusted DOM ports of the source component signatures; no model-generated code.
export const renderers: Record<string,(node:StatementNode,context:Context)=>HTMLElement> = {
  Text: ({props:p}) => el(p.variant==='title'?'h3':p.variant==='subtitle'?'h4':'p',String(p.text),'block block-'+String(p.variant??'body')),
  Keyword: ({props:p}) => {const n=el('div','','keyword');n.append(el('strong',String(p.text)));if(p.caption)n.append(el('p',String(p.caption)));return n;},
  Alert: ({props:p}) => el('aside',String(p.text),'block alert alert-'+String(p.tone)),
  List: ({props:p},c) => {const n=el('ul','','block');for(const row of p.items as StatementNode[])n.append(renderComponent(row,c));return n;},
  ListItem: ({props:p}) => el('li',String(p.text)),
  FollowUps: ({props:p},c) => {const n=el('div','','row choices');for(const text of p.prompts as string[])n.append(button(text,()=>c.send(text)));return n;},
  Timer: ({key,props:p},c) => {
    const n=el('section','','timer');n.setAttribute('aria-label',String(p.label));
    n.append(el('p','TIMER · SIMULATED','eyebrow'),el('h3',String(p.label)));
    const value=el('strong','','timer-clock'),status=el('span','','micro timer-status'),face=el('div','','timer-face'),bar=el('div','','timer-bar'),fill=el('span');bar.append(fill);face.append(value,status);
    const row=el('div','','row timer-controls'),done=el('div','','timer-done'),doneText=el('p','','');
    const start=button('Start simulation',()=>c.timerAction(key,'start'),'primary'),pause=button('Pause timer',()=>c.timerAction(key,'pause')),reset=button('Reset timer',()=>c.timerAction(key,'reset'),'quiet'),finish=button('Simulate finish',()=>c.timerAction(key,'finish'),'quiet');
    const next=button('',()=>{next.disabled=true;c.advance(key);},'primary');done.append(doneText,next);
    row.append(start,pause,reset,finish);n.append(face,bar,row,done);
    const update=()=>{const entry=c.timers.list().find(t=>t.id===key);if(!entry)return;const seconds=Math.ceil(entry.remaining);value.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;status.textContent=entry.status;n.dataset.status=entry.status;
      fill.style.width=`${Math.min(100,Math.max(0,100*(1-entry.remaining/entry.seconds)))}%`;
      const counting=entry.status==='stopped'?c.countdown(key):0;n.dataset.countdown=counting?String(counting):'';start.hidden=entry.status==='running'||entry.status==='paused';start.textContent=counting?'Cancel countdown':entry.status==='done'?'Restart simulation':'Start simulation';start.className=entry.status==='done'||counting?'':'primary';pause.hidden=entry.status==='stopped'||entry.status==='done';pause.textContent=entry.status==='paused'?'Resume timer':'Pause timer';finish.hidden=entry.status==='done';
      const upNext=c.upNext(key),position=c.timers.list().findIndex(t=>t.id===key);done.hidden=entry.status!=='done';doneText.textContent=c.earlyFinish.has(key)?'Marked done without timing.':upNext?.closing?'That was the last block.':afterBlock[Math.max(0,position)%afterBlock.length];next.hidden=!upNext;next.textContent=!upNext?'':upNext.closing?'Wind down →':'Next movement →';next.title=upNext?.closing?'':upNext?`Up next: ${upNext.label}`:'';if(upNext&&!upNext.closing&&!c.earlyFinish.has(key))doneText.textContent+=` Up next: ${upNext.label}.`;
      for(const b of [start,pause,reset,finish,next])b.disabled=c.paused;};
    c.updates.push(update);update();return n;
  },
  Rail: ({props:p}) => {const n=el('p','','rail');n.append(el('span',String(p.intent),'rail-intent'));if(typeof p.next==='string'&&p.next)n.append(el('span',`Next: ${p.next}`,'rail-next'));return n;},
  TextInput: ({key,props:p},c) => {
    // Free text sent as the reader's own message; optional next to any quick choices.
    const form=el('form','','name-input text-input');form.noValidate=true;const id='field-'+key;
    const label=el('label',typeof p.label==='string'?p.label:'In your own words');label.htmlFor=id;
    const input=el('input');input.type='text';input.id=id;input.maxLength=200;input.autocomplete='off';input.placeholder=typeof p.placeholder==='string'?p.placeholder:'';input.setAttribute('enterkeyhint','send');input.value=drafts.get(key)??'';input.addEventListener('input',()=>drafts.set(key,input.value));input.addEventListener('focus',()=>{typingIn=key;});input.addEventListener('blur',()=>{if(input.isConnected&&typingIn===key)typingIn='';});if(typingIn===key)setTimeout(()=>{if(input.isConnected&&!input.disabled)input.focus({preventScroll:true});},0);
    const go=el('button','Tell Stillwater','primary');go.type='submit';const line=el('div','','name-line');line.append(input,go);form.append(label,line);
    form.addEventListener('submit',event=>{event.preventDefault();const text=input.value.trim();if(!text){input.focus();return;}drafts.delete(key);input.value='';c.send(text);});
    const update=()=>{const off=c.paused||c.busy();input.disabled=off;go.disabled=off;};c.updates.push(update);update();return form;
  },
  NameInput: ({key,props:p},c) => {
    const form=el('form','','name-input');form.noValidate=true;const id='field-'+key;
    const label=el('label',typeof p.label==='string'?p.label:'Your first name');label.htmlFor=id;
    const input=el('input');input.type='text';input.id=id;input.name='name';input.maxLength=24;input.autocomplete='given-name';input.spellcheck=false;input.placeholder=typeof p.placeholder==='string'?p.placeholder:'First name';input.setAttribute('enterkeyhint','done');if(c.rememberedName)input.value=c.rememberedName;
    const go=el('button','Continue','primary');go.type='submit';const error=el('p','','name-error');error.id=id+'-error';error.hidden=true;input.setAttribute('aria-describedby',error.id);
    const line=el('div','','name-line');line.append(input,go);form.append(label,line,error);
    form.addEventListener('submit',event=>{event.preventDefault();const check=validateName(input.value);
      if(!check.ok){error.textContent=check.message;error.hidden=false;input.setAttribute('aria-invalid','true');input.focus();return;}
      error.hidden=true;input.removeAttribute('aria-invalid');input.value=check.name;c.send(nameMessage(check.name));});
    input.addEventListener('input',()=>{if(!error.hidden){error.hidden=true;input.removeAttribute('aria-invalid');}});
    const update=()=>{const off=c.paused||c.busy();input.disabled=off;go.disabled=off;};c.updates.push(update);update();
    // Focus for pointer devices only, so a phone keyboard never opens unasked.
    if(window.matchMedia('(pointer: fine)').matches)setTimeout(()=>{if(input.isConnected&&!input.disabled)input.focus({preventScroll:true});},0);
    return form;
  },
  Profile: ({props:p}) => {if(!p.name&&!p.style){const none=el('span');none.hidden=true;return none;}const n=el('p','','profile-chip');n.append(el('span','THIS RUN ONLY','eyebrow'),el('span',[String(p.name)||'Name not shared',...(typeof p.style==='string'?[styleLabels[p.style]]:[])].join(' · ')));return n;},
  Recap: ({props:p},c) => {
    const n=el('details','','recap'),head=el('summary');head.append(el('span',typeof p.title==='string'?p.title:'What the timers recorded','recap-title'));
    const summary=el('span','','recap-summary'),rows=el('ul','','block recap-list');head.append(summary);n.append(head,rows,el('p','Simulated, local timers: they measure time on this page, not movement.','micro'));
    const update=()=>{const entries=c.timers.list().map(t=>({...t,early:c.earlyFinish.has(t.id),reset:c.wasReset.has(t.id),safety:c.safetyPaused.has(t.id)&&t.status==='paused'}));summary.textContent=recapSummary(entries);rows.replaceChildren(...entries.map(t=>{const li=el('li');li.dataset.status=t.status==='done'&&t.early?'early':t.reset&&t.status==='stopped'?'reset':t.status;li.append(el('strong',t.label),el('span',' · '+recapLine(t)));return li;}));};
    c.updates.push(update);update();return n;
  },
};
export function renderComponent(node:StatementNode,context:Context):HTMLElement {
  if(!Object.hasOwn(renderers,node.name))throw new Error('No renderer for '+node.name);
  const n=renderers[node.name](node,context);n.dataset.statement=node.key;
  if(typeof node.props.color==='string' && /^#[0-9a-fA-F]{6}$/.test(node.props.color))n.style.color=node.props.color;
  return n;
}
