import { isTurn, type Provider, type Message, type RequestData, type Result } from './contracts.js';
import { ScreenDocument, splitReply } from './openui/document.js';
/** Recent turns sent as context. The current screen always travels in ui_state, so earlier
 *  replies are sent as their words only and long sessions never outgrow the request limits. */
const CONTEXT_TURNS = 30;
const asContext = (m: Message): Message => { if (m.role !== 'assistant') return m; let prose = ''; try { prose = splitReply(m.content).prose; } catch { prose = ''; } return { role: 'assistant', content: prose || '(Updated the screen.)' }; };
export type RunEvent = { kind: string; text?: string; result?: Result; at: string };
export class Conversation {
  messages: Message[] = []; events: RunEvent[] = []; document = new ScreenDocument(); clientEvents: string[] = [];
  pending = false; error = ''; provider: Provider = 'mock'; consent = false;
  private generation = 0; private controller?: AbortController;
  constructor(private transport: (request: RequestData, signal: AbortSignal) => Promise<Result>, private changed: () => void, private liveEvents: () => string[] = () => []) {}
  private record(event: Omit<RunEvent,'at'>) { this.events.push({ ...event, at: new Date().toISOString() }); }
  cancel(reason = 'cancelled') { this.generation++; this.controller?.abort(); if(this.pending) this.record({kind:reason}); this.pending=false; this.error=''; this.changed(); }
  reset() { this.cancel('reset'); this.messages=[]; this.events=[]; this.clientEvents=[]; this.document.reset(); this.changed(); }
  selectProvider(provider: Provider) { this.cancel('interrupted');this.provider=provider;this.consent=false;this.changed(); }
  localEvent(text: string, interrupt = true) { if (interrupt && this.pending) this.cancel('interrupted'); this.clientEvents.push(text); this.clientEvents=this.clientEvents.slice(-120); this.record({kind:'screen-event',text}); this.changed(); }
  async send(text: string, fault: RequestData['fault']='none', retry=false): Promise<void> {
    const input=text.trim(); if(!input || input.length>2000) return;
    // An identical message is a double-submit only while its reply is pending; after a
    // failed turn, sending it again is a retry rather than a silently ignored input.
    if(!retry && this.messages.at(-1)?.role==='user' && this.messages.at(-1)?.content===input) { if(this.pending) return; return this.send(input,fault,true); }
    this.cancel('interrupted');
    if(!retry) {this.messages.push({role:'user',content:input});this.record({kind:'input',text:input});}
    const generation=++this.generation;this.controller=new AbortController();this.pending=true;this.error='';this.changed();
    const eventCount=this.clientEvents.length;
    try {
      const result=await this.transport({messages:this.messages.slice(-CONTEXT_TURNS).map(asContext),state:{ui_state:this.document.echo(),client_events:[...this.clientEvents,...this.liveEvents()].slice(-120)},provider:this.provider,consent:this.consent,fault},this.controller.signal);
      if(generation!==this.generation)return;
      if(!isTurn(result.turn))throw new Error('Invalid model response schema. Retry this turn.');
      this.document.apply(result.turn.reply);
      this.messages.push({role:'assistant',content:result.turn.reply});this.record({kind:'response',result});this.clientEvents.splice(0,eventCount);
    }catch(error){if(generation!==this.generation)return;this.error=error instanceof Error?error.message:'Request failed.';const prev=this.events.at(-1);if(prev?.kind!=='error'||prev.text!==this.error)this.record({kind:'error',text:this.error});}
    finally{if(generation===this.generation){this.pending=false;this.changed();}}
  }
  retry(){const last=this.messages.at(-1);return last?.role==='user'?this.send(last.content,'none',true):Promise.resolve();}
}
