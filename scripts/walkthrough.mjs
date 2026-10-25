// Records the product walkthrough and the documentation screenshots against the real app,
// with Claude (guided) live. Requires Claude to be enabled in .env (ALLOW_CLAUDE_PLAN or the API).
// Usage: npm run build && node scripts/walkthrough.mjs   (set PLAYWRIGHT_CHROME_PATH to use installed Chrome)
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url)), port = 5191, url = `http://127.0.0.1:${port}`;
const shots = join(root, 'docs/images'), videoDir = join(root, 'output/video');
const server = spawn(process.execPath, ['--env-file-if-exists=.env', 'dist/server/main.js'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
const executablePath = process.env.PLAYWRIGHT_CHROME_PATH || undefined;
let browser;
try {
  for (let i = 0; i < 40; i++) { try { await fetch(url + '/api/config'); break; } catch { await wait(250); } }
  const config = await (await fetch(url + '/api/config')).json();
  if (!config.providers.find(p => p.id === 'claude-guided')?.enabled) throw new Error('Enable Claude (guided) in .env first.');
  await rm(videoDir, { recursive: true, force: true }); await mkdir(videoDir, { recursive: true });
  browser = await chromium.launch({ executablePath });
  const size = { width: 1440, height: 900 };
  const context = await browser.newContext({ viewport: size, recordVideo: { dir: videoDir, size } });
  await context.addInitScript(() => { try { localStorage.setItem('sw.prefs', JSON.stringify({ ready: false, remember: true })); } catch {} });
  const page = await context.newPage();
  page.setDefaultTimeout(90_000);

  // A caption bar for viewers, drawn through the DOM (no inline markup, so the page's CSP is untouched).
  const caption = async text => {
    await page.evaluate(t => {
      let n = document.getElementById('walkthrough-caption');
      if (!n) { n = document.createElement('div'); n.id = 'walkthrough-caption'; document.body.append(n);
        Object.assign(n.style, { position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', maxWidth: '880px', padding: '12px 22px', borderRadius: '14px', background: 'rgba(29,36,31,.92)', color: '#fbf7ee', font: '500 17px/1.4 "Segoe UI", sans-serif', zIndex: '9999', boxShadow: '0 10px 30px rgba(0,0,0,.25)', textAlign: 'center', pointerEvents: 'none' }); }
      n.textContent = t; n.style.display = t ? 'block' : 'none';
    }, text);
  };
  const settle = () => page.locator('#pending').waitFor({ state: 'hidden' });
  const shot = async name => { await caption(''); await wait(400); await page.screenshot({ path: join(shots, name) }); };
  const say = async (label, text) => { const box = page.getByLabel(label); await box.click(); await box.pressSequentially(text, { delay: 45 }); await wait(500); await box.press('Enter'); await page.locator('#pending').waitFor({ state: 'visible' }).catch(() => {}); await settle(); };
  const finishTimer = async () => { await page.getByRole('button', { name: 'Start simulation', exact: true }).click(); await wait(1200); await page.getByRole('button', { name: 'Simulate finish', exact: true }).click(); await wait(600); };

  await page.goto(url); await wait(1500);
  await caption('Stillwater: a calm movement companion. Today it runs with Claude reading what you type.'); await wait(4000);

  // Switch the run to Claude (guided).
  await caption('Menu → Developer → Run with "Claude (guided)", and agree to usage.');
  await page.locator('#menu').click(); await wait(800);
  await page.getByRole('tab', { name: 'Developer' }).click(); await wait(800);
  await page.locator('#provider').selectOption('claude-guided'); await wait(1200);
  await page.locator('#consent').check(); await wait(1800);
  await page.locator('#close-drawer').click(); await wait(800);
  await caption('The badge now says LIVE WHEN SENT. Taps never call the model; only free text does.'); await wait(3500);

  // Two questions, then movement.
  await page.locator('#workout').click(); await settle(); await wait(800);
  await caption('Question 1 of 2: an optional first name.'); await wait(2500);
  await shot('01-arrival.png');
  const name = page.getByLabel('Your first name'); await name.pressSequentially('Maya', { delay: 90 }); await name.press('Enter'); await settle(); await wait(800);
  await caption('Question 2 of 2: what does today need? Tap a choice, or say it in your own words.'); await wait(3000);
  await shot('03-discovery.png');
  await caption('Typed the way people actually talk. Claude reads it.');
  await say('Or in your own words', 'been hunched over my laptop since 8am');
  await caption('Claude picks the closest session and says why. The app adds the real timer length: 2:40.'); await wait(5000);
  await shot('04-decision.png');
  await page.getByRole('button', { name: /^Gentle mobility · 2:40/ }).click(); await settle(); await wait(1000);

  // The session.
  await caption('One calm stage: the movement, a dial showing real time left, and what comes next.'); await wait(2500);
  await page.getByRole('button', { name: 'Start simulation', exact: true }).click(); await wait(3500);
  await shot('02-stage-running.png');
  await caption('Mid-movement, say what is going on. Here: tired wrists.');
  await say('Something changed? Tell Stillwater', 'my wrists are tired');
  await page.mouse.wheel(0, 320); await wait(800);
  await caption('Claude suggests one small change to this exact movement. It is only an offer.'); await wait(5500);
  await shot('05-offer.png');
  await page.mouse.wheel(0, -320); await wait(500);
  await page.getByRole('button', { name: 'Keep going', exact: true }).click(); await settle(); await wait(1000);
  await page.getByRole('button', { name: 'Simulate finish', exact: true }).click().catch(() => {}); await wait(800);
  await page.locator('#next').click(); await wait(1200);

  await caption('Something that is not quite a request still counts.');
  await say('Something changed? Tell Stillwater', 'easy peasy');
  await caption('Claude reads it as "this is too easy" and offers the steadier version, keeping your place.'); await wait(4500);
  await page.getByRole('button', { name: 'Switch to steady', exact: true }).click(); await settle(); await wait(1200);
  await caption('Switched in place: same movement, longer timers, nothing restarted.'); await wait(3500);
  await shot('06-adjusted.png');

  // Safety.
  await caption('Now the moment that matters most. A body concern, said casually.');
  await say('Something changed? Tell Stillwater', 'ooh that pinched');
  await caption('A keyword list would miss "that pinched". Claude catches it: the timer pauses and the session holds.'); await wait(5500);
  await shot('07-safety.png');
  await caption('Claude can only add caution, never remove it. The safety wording is always Stillwater’s own.'); await wait(4500);
  await page.getByRole('button', { name: 'I’ve rested and feel okay' }).click(); await settle(); await wait(1500);

  // To the end.
  await caption('Carrying on to the end.');
  for (let i = 0; i < 6 && !(await page.locator('[data-statement="finish_title"]').isVisible()); i++) {
    if (await page.getByRole('button', { name: 'Start simulation', exact: true }).isVisible()) await finishTimer();
    await page.locator('#next').click(); await wait(1200);
  }
  await caption('A calm close, then one word for something you actually did in this session.'); await wait(4500);
  await shot('08-ending.png');
  await page.locator('[data-statement="finish_word"]').scrollIntoViewIfNeeded(); await wait(1500);
  await page.locator('.recap summary').click().catch(() => {}); await wait(1500);
  await caption('An honest record of what the timers did. It never claims you exercised.'); await wait(4000);
  await shot('08b-ending-record.png');
  await page.screenshot({ path: join(shots, '09-full-desktop.png'), fullPage: true });

  // Home, with the word kept (Remember me is on).
  await page.locator('#menu').click(); await wait(600);
  await page.getByRole('tab', { name: 'Conversation' }).click(); await page.locator('#reset').click(); await wait(600);
  await page.locator('#close-drawer').click().catch(() => {}); await wait(1200);
  await caption('Back home: with Remember me on, the words you pick up collect here. A small reason to come back.'); await wait(4500);
  await shot('11-word-shelf.png');
  await caption('Stillwater: Claude understands, trusted code draws, and safety has a floor.'); await wait(4000);
  await context.close();

  // Phone view of the stage, for the case study.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.addInitScript(() => { try { localStorage.setItem('sw.prefs', JSON.stringify({ ready: false })); } catch {} });
  const mobile = await phone.newPage(); await mobile.goto(url);
  await mobile.locator('#message').fill('/workout mobility gentle'); await mobile.locator('#send').click(); await mobile.locator('#pending').waitFor({ state: 'hidden' });
  await mobile.locator('#next').click(); await mobile.getByRole('button', { name: 'Start simulation', exact: true }).click(); await wait(2500);
  await mobile.screenshot({ path: join(shots, '10-mobile-stage.png') }); await phone.close();

  const [video] = (await readdir(videoDir)).filter(f => f.endsWith('.webm'));
  await rename(join(videoDir, video), join(root, 'Stillwater - Walkthrough.webm'));
  console.log('Walkthrough and screenshots written.');
} finally { await browser?.close(); server.kill(); }
