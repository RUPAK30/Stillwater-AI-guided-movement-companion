import { test,expect } from '@playwright/test';
import {mkdir} from 'node:fs/promises';
// EVIDENCE_DIR lets a local check run without overwriting committed evidence screenshots.
const shots=process.env.EVIDENCE_DIR||'evidence/screenshots';
async function send(page,text){await page.locator('#message').fill(text);await page.locator('#send').click();await expect(page.locator('#pending')).toBeHidden();}
async function demo(page){await send(page,'/demo');await expect(page.locator('[data-statement="count1"]')).toContainText('8');}
async function workout(page){await send(page,'/workout');await expect(page.locator('#screen')).toContainText('Mobility Reset');}
async function openDev(page){if(await page.locator('#drawer').isHidden())await page.locator('#menu').click();await page.getByRole('tab',{name:'Developer'}).click();await page.locator('.builder').evaluate(e=>{e.open=true;});}
async function closeDrawer(page){if(await page.locator('#drawer').isVisible())await page.locator('#close-drawer').click();}
async function startOver(page){if(await page.locator('#drawer').isHidden())await page.locator('#menu').click();await page.getByRole('tab',{name:'Conversation'}).click();await page.locator('#reset').click({trial:false});await closeDrawer(page);}
// The optional 3-2-1 countdown is covered by its own test; elsewhere timers start on click.
test.beforeEach(async({page})=>{await page.addInitScript(()=>{if(!localStorage.getItem('sw.prefs'))localStorage.setItem('sw.prefs',JSON.stringify({ready:false}));});await page.goto('/');await expect(page.locator('#mode')).toHaveText('MOCK · NO MODEL CALLS');});
test('Stillwater onboarding: two questions, Next waits for replies, name from a sentence, intent picks the session',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.locator('#workout').click();await expect(page.locator('[data-statement="hey_word"]')).toContainText('HEY');await expect(page.locator('#spoken')).toContainText('No pressure');
 await expect(page.locator('#next')).toBeDisabled();await expect(page.locator('#next')).toHaveText('Answer above');await expect(page.locator('#position')).toHaveText('1 / 1');
 await expect(page.locator('#screen')).toContainText('What should I call you');
 await send(page,'Next');await expect(page.locator('#screen')).toContainText('Is “Next” your name?');await expect(page.locator('#position')).toHaveText('1 / 1');
 await send(page,"Hi, I'm Maya");await expect(page.locator('#screen')).toContainText('Good to meet you, Maya.');await expect(page.locator('.profile-chip')).toContainText('Maya');
 await page.getByRole('button',{name:'Cardio'}).click();await expect(page.locator('#screen')).toContainText('Low-impact cardio: how much today?');await expect(page.locator('#screen')).toContainText('Choose whichever suits today.');
 await page.getByRole('button',{name:'Gentle cardio'}).click();await expect(page.locator('#position')).toHaveText('2 / 6');await expect(page.locator('#screen')).toContainText('Warm-up march');
 await expect(page.locator('.workout-intent')).toContainText('Gentle cardio');await expect(page.locator('.workout-next-title')).toHaveText('Step-touch');
 await page.locator('#back').click();await expect(page.locator('#screen')).toContainText('Gentle · Low-impact cardio');await expect(page.locator('#screen')).toContainText('2:30 on the timers');await expect(page.locator('.profile-chip')).toContainText('Maya');
});
test('session recap separates a full timer, a simulated finish, an open timer and a skipped one',async({page})=>{
 await page.clock.install();await page.reload();await expect(page.locator('#mode')).toHaveText('MOCK · NO MODEL CALLS');await page.setViewportSize({width:1440,height:1000});
 await send(page,'/workout');await expect(page.locator('#screen')).toContainText('Gentle · Mobility reset');await expect(page.locator('#screen')).toContainText('2:40 on the timers');
 const timer=page.locator('.timer-status');
 await page.locator('#next').click();await expect(page.locator('#screen')).toContainText('Wake the spine');await page.getByRole('button',{name:'Start simulation',exact:true}).click();await page.getByRole('button',{name:'Simulate finish',exact:true}).click();await expect(timer).toHaveText('done');
 await page.locator('#next').click();await expect(page.locator('#screen')).toContainText('Shoulders and neck');await page.getByRole('button',{name:'Start simulation',exact:true}).click();await page.getByRole('button',{name:'Pause timer',exact:true}).click();await expect(timer).toHaveText('paused');
 await page.locator('#next').click();await expect(page.locator('#screen')).toContainText('Downshift');await page.getByRole('button',{name:'Start simulation',exact:true}).click();await page.clock.fastForward(31_000);await expect(timer).toHaveText('done');
 await page.locator('#next').click();await expect(page.locator('#screen')).toContainText('Hip hinge reach');await page.locator('#next').click();
 await expect(page.locator('#position')).toHaveText('6 / 6');await expect(page.locator('#next')).toHaveText('Finish');await expect(page.locator('#screen')).toContainText('Let that settle.');await expect(page.locator('.recap-summary')).toBeVisible();
 await expect(page.locator('.recap-summary')).toHaveText('1 of 4 timers ran to zero · 1 marked finished early · 1 still open · 1 not started.');
 await expect(page.locator('.recap')).toContainText('Easy breathing reset · ran the full 0:30');await expect(page.locator('.recap')).toContainText('marked finished with Simulate finish, not timed');await expect(page.locator('.recap')).toContainText('Hip hinge reach · not started');
});
async function toNameScreen(page){await page.locator('#workout').click();await expect(page.locator('#screen')).toContainText('What should I call you');}
test('name field: validation, Enter and Continue submit, and the name appears immediately',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await toNameScreen(page);const field=page.getByLabel('Your first name');await expect(field).toBeVisible();await expect(field).toBeFocused();
 await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('.name-error')).toContainText('Skip the name');await expect(page.locator('.message.user')).toHaveCount(1);
 await field.fill('Maya2');await field.press('Enter');await expect(page.locator('.name-error')).toContainText('first name in letters');await expect(field).toHaveAttribute('aria-invalid','true');
 await field.fill('Next');await expect(page.locator('.name-error')).toBeHidden();await field.press('Enter');await expect(page.locator('#screen')).toContainText('Good to meet you, Next.');await expect(page.locator('.message.assistant').last()).toContainText('Nice to meet you, Next.');await expect(page.locator('#position')).toHaveText('2 / 2');
 await page.locator('#back').click();await expect(page.getByLabel('Your first name')).toBeVisible();const again=page.getByLabel('Your first name');await again.fill('Mary Anne');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('#screen')).toContainText('Good to meet you, Mary Anne.');await expect(page.locator('.profile-chip')).toContainText('Mary Anne');
});
test('name field: a failed send can be resent with the same name',async({page})=>{
 await toNameScreen(page);await openDev(page);await page.locator('#fault').selectOption('request');
 const field=page.getByLabel('Your first name');await field.fill('Maya');await field.press('Enter');await expect(page.locator('#error')).toBeVisible();await expect(page.locator('#screen')).toContainText('What should I call you');
 await expect(field).toBeEnabled();await expect(field).toHaveValue('Maya');await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('#screen')).toContainText('Good to meet you, Maya.');await expect(page.locator('#error')).toBeHidden();await expect(page.locator('.message.user',{hasText:'My name is Maya'})).toHaveCount(1);
});
test('Skip keeps working and a finished timer offers the next block',async({page})=>{
 await toNameScreen(page);await page.getByRole('button',{name:'Skip the name'}).click();await expect(page.locator('.profile-chip')).toHaveCount(0);
 await send(page,'/workout cardio gentle');await page.locator('#next').click();await expect(page.locator('#screen')).toContainText('Warm-up march');
 await expect(page.locator('.timer-done')).toBeHidden();await page.getByRole('button',{name:'Start simulation',exact:true}).click();await page.getByRole('button',{name:'Simulate finish',exact:true}).click();
 await expect(page.locator('.timer-done')).toContainText('Marked done without timing.');await page.getByRole('button',{name:'Next movement →'}).click();await expect(page.locator('#screen')).toContainText('Step-touch');await expect(page.locator('#position')).toHaveText('3 / 6');
});
test('transitions vary between blocks and the ending is a calm close the reader can simply finish',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await toNameScreen(page);
 await page.getByLabel('Your first name').fill('Maya');await page.getByLabel('Your first name').press('Enter');await page.getByRole('button',{name:'Stretching'}).click();await page.getByRole('button',{name:'Gentle stretching'}).click();
 await expect(page.locator('.message.assistant').last()).toContainText('Maya');await expect(page.locator('#screen')).toContainText('Neck side stretch');
 const finishTimer=async()=>{await page.getByRole('button',{name:'Start simulation',exact:true}).click();await page.getByRole('button',{name:'Simulate finish',exact:true}).click();};
 await page.clock.install();await page.getByRole('button',{name:'Start simulation',exact:true}).click();await page.clock.fastForward(41_000);const first=await page.locator('.timer-done p').textContent();
 await page.getByRole('button',{name:'Next movement →'}).click();await page.getByRole('button',{name:'Start simulation',exact:true}).click();await page.clock.fastForward(41_000);const second=await page.locator('.timer-done p').textContent();
 expect(first).not.toEqual(second);for(const line of [first,second])expect(line).not.toMatch(/great|proud|tired|well done/i);
 await page.getByRole('button',{name:'Next movement →'}).click();await page.locator('#next').click();await finishTimer();
 await expect(page.locator('.timer-done')).toContainText('Marked done without timing.');await page.getByRole('button',{name:'Wind down →'}).click();
 await expect(page.locator('#screen')).toContainText('Stay here a moment.');await expect(page.locator('[data-statement="finish_word"]')).toBeVisible();await expect(page.locator('#screen')).toContainText('You met this in');await expect(page.locator('#spoken')).toContainText('I’m glad we made a little room for this, Maya.');
 await expect(page.locator('details.recap')).not.toHaveAttribute('open','');await expect(page.locator('.recap-summary')).toBeVisible();await expect(page.locator('.recap-list')).toBeHidden();
 await expect(page.locator('#next')).toHaveText('Finish');await expect(page.locator('#next')).toBeEnabled();await page.locator('#next').click();
 await expect(page.locator('#next')).toHaveText('Done for today');await expect(page.locator('#next')).toBeDisabled();await expect(page.locator('#spoken')).toContainText('Take care.');
 await page.locator('.recap summary').click();await expect(page.locator('.recap-list')).toBeVisible();
});
test('presence follows the activity; a timer that runs out offers one Next movement; reset is recorded',async({page})=>{
 const phase=()=>page.locator('.preview').getAttribute('data-phase');await page.clock.install();await page.reload();await expect(page.locator('#mode')).toHaveText('MOCK · NO MODEL CALLS');
 await expect(page.locator('.preview')).toHaveAttribute('data-phase','idle');await page.locator('#workout').click();await expect(page.locator('.preview')).toHaveAttribute('data-phase','arrival');
 await send(page,'/workout cardio gentle');await expect(page.locator('.preview')).toHaveAttribute('data-phase','arrival');await page.locator('#next').click();await expect(page.locator('.preview')).toHaveAttribute('data-phase','ready');
 await page.getByRole('button',{name:'Start simulation',exact:true}).click();await expect(page.locator('.preview')).toHaveAttribute('data-phase','focus');await expect(page.locator('.timer-done')).toBeHidden();
 await page.clock.fastForward(46_000);await expect(page.locator('.timer-status')).toHaveText('done');await expect(page.locator('.preview')).toHaveAttribute('data-phase','rest');
 await expect(page.locator('.timer-done')).toContainText('Up next: Step-touch.');await expect(page.locator('.event',{hasText:'The timer for Easy march in place finished.'})).toHaveCount(1);
 await page.getByRole('button',{name:'Next movement →'}).dblclick();await expect(page.locator('#screen')).toContainText('Step-touch');await page.clock.fastForward(500);await expect(page.locator('#position')).toHaveText('3 / 6');
 await page.getByRole('button',{name:'Start simulation',exact:true}).click();await page.clock.fastForward(5_000);await page.getByRole('button',{name:'Reset timer',exact:true}).click();await expect(page.locator('.timer-status')).toHaveText('stopped');
 for(let i=0;i<3;i++)await page.locator('#next').click();await expect(page.locator('.preview')).toHaveAttribute('data-phase','closing');
 await expect(page.locator('.recap-summary')).toHaveText('1 of 4 timers ran to zero · 1 reset · 2 not started.');await expect(page.locator('.recap')).toContainText('Side step-touch · reset, not run again');
 await page.locator('#next').click();await expect(page.locator('.preview')).toHaveAttribute('data-phase','closed');expect(await phase()).toBe('closed');
});
test('a need typed on the discovery screen shapes the suggestion and leads into the session',async({page})=>{
 await toNameScreen(page);await page.getByRole('button',{name:'Skip the name'}).click();
 await expect(page.locator('.preview')).toHaveAttribute('data-phase','discovery');const field=page.getByLabel('Or in your own words');await expect(field).toBeVisible();await expect(page.getByRole('button',{name:'Mobility'})).toBeVisible();
 await field.fill('I feel low on energy today.');await field.press('Enter');await expect(page.locator('#screen')).toContainText('Heard: low energy');await expect(page.locator('#screen')).toContainText('How about gentle stretching?');await expect(page.locator('.message.assistant').last()).toContainText('Low on energy, so let’s keep it light.');
 await expect(page.locator('#next')).toHaveText('Answer above');await page.getByRole('button',{name:'Gentle stretching · 2:30 (suggested)'}).click();await expect(page.locator('#screen')).toContainText('Neck side stretch');
 await expect(page.locator('.workout-intent')).toContainText('Gentle stretching · kept light');await expect(page.locator('#position')).toHaveText('2 / 6');await page.locator('#back').click();await expect(page.locator('#screen')).toContainText('Gentle · Stretch and settle');
});
test('pain changes the interface: a calm safety screen, no session choices, and a way back',async({page})=>{
 await toNameScreen(page);await page.getByRole('button',{name:'Skip the name'}).click();
 const field=page.getByLabel('Or in your own words');await field.fill('My knee hurts but I still want cardio');await field.press('Enter');
 await expect(page.locator('#screen .alert-warning')).toContainText('physiotherapist');await expect(page.locator('.preview')).toHaveAttribute('data-phase','care');
 await expect(page.getByRole('button',{name:'Cardio'})).toHaveCount(0);await expect(page.locator('#screen')).toHaveClass(/enter/);
 await page.getByRole('button',{name:'Show the session choices'}).click();await expect(page.getByRole('button',{name:'Cardio'})).toBeVisible();await expect(page.locator('#screen')).toContainText('leaves that area alone');
});
test('in session: a safety report pauses the running timer and holds; an easier/harder change keeps your place',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await send(page,'/workout mobility gentle');await page.locator('#next').click();await expect(page.locator('#screen')).toContainText('Wake the spine');
 const ask=page.getByLabel('Something changed? Tell Stillwater');await ask.fill('this is too easy');await ask.press('Enter');await expect(page.locator('#screen .alert')).toContainText('Steady adds');
 await page.getByRole('button',{name:'Switch to steady'}).click();await expect(page.locator('#screen')).toContainText('Spine CARs');await expect(page.locator('#position')).toHaveText('2 / 7');
 await page.getByRole('button',{name:'Start simulation',exact:true}).click();await expect(page.locator('.timer-status')).toHaveText('running');
 await page.getByLabel('Something changed? Tell Stillwater').fill('ouch, my shoulder hurts');await page.getByLabel('Something changed? Tell Stillwater').press('Enter');
 await expect(page.locator('#screen .alert-warning')).toContainText('I’ve paused the timer');await expect(page.locator('.preview')).toHaveAttribute('data-phase','care');
 await expect(page.locator('.timer')).toBeHidden();await expect(page.locator('#next')).toBeDisabled();await expect(page.locator('#back')).toBeDisabled();await expect(page.locator('.event',{hasText:'for safety'})).toHaveCount(0);
 await page.getByRole('button',{name:'I’ve rested and feel okay'}).click();await expect(page.locator('.timer-status')).toHaveText('paused');await expect(page.getByRole('button',{name:'Resume timer'})).toBeEnabled();await expect(page.locator('#next')).toBeEnabled();
});
test('the active workout is one stage: movement, live timer, progress, next step and Stillwater together',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await toNameScreen(page);await page.getByLabel('Your first name').fill('Maya');await page.getByLabel('Your first name').press('Enter');
 const f=page.getByLabel('Or in your own words');await f.fill('something more energetic');await f.press('Enter');await page.getByRole('button',{name:'Steady cardio · 4:00 (suggested)'}).click();
 const stage=page.locator('.workout');await expect(stage).toBeVisible();await expect(stage.locator('.workout-count')).toHaveText('Movement 1 of 5');await expect(stage.locator('.workout-intent')).toContainText('Steady cardio · with more rhythm');await expect(stage.locator('.workout-next-title')).toHaveText('Interval 1');
 await expect(stage.locator('.workout-title')).toHaveText('Warm-up march');await expect(stage.locator('.stage-timer')).toBeVisible();await expect(stage.locator('.workout-say')).toBeVisible();await expect(page.locator('.spoken')).toBeHidden();await expect(page.locator('#next')).toHaveText('Skip →');
 await page.getByRole('button',{name:'Start simulation',exact:true}).click();await expect(stage.locator('.workout-say')).toHaveCSS('opacity','0.35');await expect(stage.locator('.workout-track span').first()).toHaveClass(/open/);
 await page.getByRole('button',{name:'Simulate finish',exact:true}).click();await expect(page.locator('#next')).toHaveText('Next →');await expect(stage.locator('.workout-track span').first()).toHaveClass(/early/);
 await page.getByRole('button',{name:'Next movement →'}).click();await expect(stage.locator('.workout-count')).toHaveText('Movement 2 of 5');await expect(stage.locator('.workout-title')).toHaveText('Interval 1');await expect(page.locator('#screen')).toHaveClass(/enter-soft/);
 await expect(stage.locator('.workout-track span').nth(1)).toHaveClass(/current/);await expect(stage.locator('.workout-track span').first()).toHaveClass(/early/);
});
test('feedback during a workout adapts the stage without errors, even with an unanswered offer',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await send(page,'/workout cardio gentle');await page.locator('#next').click();
 await page.getByRole('button',{name:'Start simulation',exact:true}).click();await page.getByRole('button',{name:'Simulate finish',exact:true}).click();
 const ask=async t=>{const f=page.getByLabel('Something changed? Tell Stillwater');await f.fill(t);await f.press('Enter');await expect(page.locator('#pending')).toBeHidden();};
 await ask('too easy');await expect(page.locator('.workout-offer')).toContainText('Stillwater suggests');await page.locator('#next').click();await expect(page.locator('.workout-count')).toHaveText('Movement 2 of 4');
 await ask('make it gentler');await expect(page.locator('#error')).toBeHidden();await expect(page.locator('.workout-offer')).toContainText('already the gentlest');
 await page.getByRole('button',{name:'Keep this one'}).click();await ask('too easy');await page.getByRole('button',{name:'Switch to steady'}).click();
 await expect(page.locator('.workout-adjusted')).toHaveText('Adjusted · now steady cardio');await expect(page.locator('.workout-count')).toHaveText('Movement 2 of 5');await expect(page.locator('.workout-intent')).toContainText('Steady cardio');
 await ask('make it gentler');await page.getByRole('button',{name:'Switch to gentle'}).click();await expect(page.locator('.workout-adjusted')).toHaveText('Adjusted · now gentle cardio');await expect(page.locator('#error')).toBeHidden();
});
test('source stepper, text cues, value patch and local timer continuity',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await mkdir(shots,{recursive:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:shots+'/01-start.png',fullPage:true});await demo(page);
 await expect(page.locator('#spoken')).toContainText('current screen');await send(page,'next');await expect(page.locator('#position')).toHaveText('2 / 4');await page.getByRole('button',{name:'Start simulation',exact:true}).click();
 await page.locator('#next').click();await expect(page.locator('#position')).toHaveText('3 / 4');await page.locator('#back').click();await expect(page.locator('.timer-status')).toHaveText('running');
 await page.locator('#pause').click();await expect(page.locator('.timer-status')).toHaveText('paused');await expect(page.locator('#next')).toBeDisabled();await page.locator('#pause').click();await expect(page.locator('.timer-status')).toHaveText('running');
 await page.getByRole('button',{name:'Simulate finish',exact:true}).click();await expect(page.locator('.timer-status')).toHaveText('done');await expect(page.locator('#position')).toHaveText('2 / 4');
 await send(page,'change value to 6');await expect(page.locator('#position')).toHaveText('2 / 4');await send(page,'next');await expect(page.locator('[data-statement="count2"]')).toContainText('6');await page.screenshot({path:shots+'/02-workout-state.png',fullPage:true});expect(errors).toEqual([]);
});
test('repeated sends, interruption, reset while pending and post-reset navigation',async({page})=>{
 await openDev(page);await page.locator('#fault').selectOption('slow');await page.locator('#message').fill('/demo');await page.locator('#send').click();await page.locator('#message').fill('/demo');await page.locator('#send').click();await expect(page.locator('.message.user')).toHaveCount(1);await startOver(page);await page.waitForTimeout(2500);await expect(page.locator('#screen')).toContainText('A few good minutes of movement.');await demo(page);await page.locator('#next').click();await startOver(page);await demo(page);await page.locator('#next').click();await expect(page.locator('#position')).toHaveText('2 / 4');
 await openDev(page);await page.locator('#fault').selectOption('slow');await page.locator('#message').fill('next');await page.locator('#send').click();await send(page,'back');await expect(page.locator('#position')).toHaveText('1 / 4');
});
for(const fault of ['schema','request'])test(`${fault} failure preserves screen and retry recovers`,async({page})=>{await demo(page);await openDev(page);await page.locator('#fault').selectOption(fault);await send(page,'next');await expect(page.locator('#error')).toBeVisible();await expect(page.locator('[data-statement="count1"]')).toContainText('8');await page.locator('#retry').click();await expect(page.locator('#position')).toHaveText('2 / 4');await expect(page.locator('#error')).toBeHidden();});
test('local valid/invalid patches are data and candidate component can be registered',async({page})=>{
 await demo(page);await openDev(page);await page.locator('#patch').fill('count1 = Keyword("<img src=x onerror=alert(1)>", "inert")');await page.locator('#apply-patch').click();await expect(page.locator('[data-statement="count1"]')).toContainText('<img src=x');await expect(page.locator('#screen img')).toHaveCount(0);
 await page.locator('#patch').fill('count1 = Function("evil")');await page.locator('#apply-patch').click();await expect(page.locator('#patch-status')).toContainText('Invalid patch');
 // Trusted test code registers a candidate component in all three local seams.
 await page.evaluate(async()=>{const {OPENUI_LIBRARY}=await import('/shared/openui/openui-library.js');const {propValidators}=await import('/shared/openui/validate.js');const {renderers}=await import('/web/components.js');OPENUI_LIBRARY.StatusPill={args:['label','value'],required:2};propValidators.StatusPill=p=>typeof p.label==='string'&&typeof p.value==='string';renderers.StatusPill=({props:p})=>{const n=document.createElement('div');n.textContent=p.label+': '+p.value;return n;};});
 await page.locator('#patch').fill('page1 = Screen([heading1, custom1])\ncustom1 = StatusPill("Sample", "A")');await page.locator('#apply-patch').click();await expect(page.locator('[data-statement="custom1"]')).toHaveText('Sample: A');
});
test('manual export contains screen/events/versions and no token; mobile fits',async({page})=>{
 await page.setViewportSize({width:390,height:844});await demo(page);await openDev(page);await page.locator('#note').fill('Tested mock only. TOKEN=do-not-export');const download=page.waitForEvent('download');await page.locator('#export').click();const d=await download;const stream=await d.createReadStream();let content='';for await(const chunk of stream)content+=chunk;const json=JSON.parse(content);expect(json.state.ui_state).toContain('root = Screens');expect(json.events.find(e=>e.result).result.versions.protocolHash).toHaveLength(64);expect(content).not.toContain('do-not-export');expect(content).not.toContain('X-Local-Token');await closeDrawer(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:shots+'/03-mobile.png',fullPage:true});
});
test('runtime starts mock; Codex blocked; selecting never calls model endpoint',async({page})=>{let turns=0;page.on('request',r=>{if(r.url().includes('/api/turn'))turns++;});await openDev(page);await page.locator('#provider').selectOption('codex-cli');await expect(page.locator('#send')).toBeDisabled();await expect(page.locator('#provider-description')).toContainText('no-command/no-private-read');expect(turns).toBe(0);});
test('configured CLI needs explicit consent and records fake provider identity',async({page})=>{
 await page.route('**/api/config',async route=>{const response=await route.fetch();const cfg=await response.json();cfg.providers.find(p=>p.id==='claude-cli').enabled=true;await route.fulfill({json:cfg});});await page.reload();await openDev(page);await page.locator('#provider').selectOption('claude-cli');await expect(page.locator('#send')).toBeDisabled();await page.locator('#consent').check();await page.route('**/api/turn',route=>route.fulfill({json:{turn:{reply:'Transport fixture, not a live CLI request.'},versions:{provider:'claude-cli',mode:'live',model:'fixture-only'}}}));await send(page,'hello');await expect(page.locator('#caption')).toContainText('Transport fixture');
});

test('words from finished sessions collect on home, only with Remember me on',async({page})=>{
 for(const remember of [false,true]){
  await page.evaluate(r=>{localStorage.clear();localStorage.setItem('sw.prefs',JSON.stringify({ready:false,remember:r}));},remember);await page.reload();
  await send(page,'/workout');await expect(page.locator('#screen')).toContainText('Mobility reset',{ignoreCase:true});for(let i=0;i<5;i++)await page.locator('#next').click();await expect(page.locator('#position')).toHaveText('6 / 6');
  const word=await page.locator('[data-statement="finish_word"]').innerText();await startOver(page);
  if(remember)await expect(page.locator('.word-chip')).toHaveText([word.split('\n')[0]]);else await expect(page.locator('.word-chip')).toHaveCount(0);
 }
});
