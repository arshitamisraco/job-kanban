// Records the demo clips, posters and stills used in the portfolio case study.
//
// Usage (from the repo root):
//   node scripts/record-demo.mjs            # everything
//   node scripts/record-demo.mjs drag ignore # only the named targets
// Targets: board sync drag detail ignore stills contract
//
// Env:
//   FFMPEG     path to an ffmpeg build with libx264 (default: the scratchpad install below)
//   PORTFOLIO  portfolio repo root the media is written into (default /home/user/my-portfolio)
//   PORT       dev server port (default 3210)
//   KEEP_RAW   set to 1 to keep the raw Playwright .webm files under .record-tmp/
//
// Every clip gets its own fresh `npm run dev:demo` server (fresh DB, 13 emails, one more
// revealed per sync) and its own browser, so state never bleeds between takes. A page load
// counts as a sync, hence the restart per take.
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const ROOT = process.cwd();
const PORT = Number(process.env.PORT ?? 3210);
const BASE_URL = `http://localhost:${PORT}`;
const FFMPEG =
  process.env.FFMPEG ??
  '/tmp/claude-0/-home-user/b795ade9-28fb-5c44-889a-ac22f15e9e2c/scratchpad/ffm/node_modules/@ffmpeg-installer/linux-x64/ffmpeg';
const PORTFOLIO = process.env.PORTFOLIO ?? '/home/user/my-portfolio';
const CHROMIUM = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium';
const VIDEO_DIR = path.join(PORTFOLIO, 'public/videos/gmail-job-tracker');
const POSTER_DIR = path.join(PORTFOLIO, 'public/images/gmail-job-tracker/posters');
const STILL_DIR = path.join(PORTFOLIO, 'public/images/gmail-job-tracker');
const TMP = path.join(ROOT, '.record-tmp');

const VIEWPORT = { width: 1440, height: 900 };
const COMPANIES = [
  'Orbital', 'Fieldnote', 'Halcyon', 'Lumen Labs', 'Nimbus Data',
  'Parallax', 'Bluepeak Analytics', 'Acme Corp', 'Initech', 'Brightwater',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- dev server

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', () => resolve(0));
    req.setTimeout(30000, () => { req.destroy(); resolve(0); });
  });
}

async function startServer() {
  if ((await ping(BASE_URL)) !== 0) throw new Error(`Port ${PORT} is already in use`);
  const child = spawn('npm', ['run', 'dev:demo'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), NEXT_TELEMETRY_DISABLED: '1' },
    detached: true, // own process group so the whole tree can be killed
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`dev server exited early:\n${log}`);
    if ((await ping(BASE_URL + '/')) === 200) break;
    await sleep(500);
  }
  // Warm up the routes so the first browser load is not stuck compiling. GET /api/sync only
  // reads state; it does not advance the demo's reveal counter (POST does).
  await ping(BASE_URL + '/api/applications');
  await ping(BASE_URL + '/api/sync');
  return child;
}

async function stopServer(child) {
  if (!child || child.pid === undefined) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  for (let i = 0; i < 40; i++) {
    if ((await ping(BASE_URL)) === 0) break;
    await sleep(250);
  }
  try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  await sleep(500);
}

// ------------------------------------------------------------ page injection

// Fake cursor (Playwright videos do not draw the mouse) + a drag ghost. In headless
// Chromium the native drag image is not part of the screencast, so during a drag the
// script mirrors the dragged card under the pointer, the way a desktop browser would.
const INIT_SCRIPT = `(() => {
  const CSS = 'nextjs-portal{display:none!important}';
  function ensure() {
    const root = document.documentElement;
    if (!root) return false;
    if (!document.getElementById('__rec_style')) {
      const s = document.createElement('style');
      s.id = '__rec_style';
      s.textContent = CSS;
      root.appendChild(s);
    }
    if (!document.getElementById('__rec_cursor')) {
      const c = document.createElement('div');
      c.id = '__rec_cursor';
      c.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg"><path d="M3 2 L3 17 L7 13.2 L9.8 19.4 L12.4 18.3 L9.7 12.2 L15.2 12 Z" fill="#1d1d1f" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      c.style.cssText = 'position:fixed;left:' + (window.__recX ?? 720) + 'px;top:' + (window.__recY ?? 820) + 'px;width:22px;height:22px;pointer-events:none;z-index:2147483647;transition:scale 90ms ease-out;transform-origin:3px 2px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35));';
      root.appendChild(c);
    }
    return true;
  }
  function place(x, y) {
    window.__recX = x; window.__recY = y;
    const c = document.getElementById('__rec_cursor');
    if (c) { c.style.left = x + 'px'; c.style.top = y + 'px'; }
  }
  let ghost = null, gdx = 0, gdy = 0;
  function moveGhost(x, y) { if (ghost) { ghost.style.left = (x - gdx) + 'px'; ghost.style.top = (y - gdy) + 'px'; } }
  const track = (e) => {
    if (e.clientX === 0 && e.clientY === 0 && e.type !== 'mousemove') return; // bogus drag-end coords
    place(e.clientX, e.clientY); moveGhost(e.clientX, e.clientY);
  };
  ['mousemove', 'mousedown', 'mouseup', 'dragover', 'drag'].forEach((t) => document.addEventListener(t, track, true));
  document.addEventListener('mousedown', (e) => { window.__recDown = { x: e.clientX, y: e.clientY }; const c = document.getElementById('__rec_cursor'); if (c) c.style.scale = '0.85'; }, true);
  document.addEventListener('mouseup', () => { const c = document.getElementById('__rec_cursor'); if (c) c.style.scale = '1'; }, true);
  document.addEventListener('dragstart', (e) => {
    if (!window.__recGhost) return;
    const el = e.target && e.target.closest ? e.target.closest('[draggable="true"]') : null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    ghost = el.cloneNode(true);
    ghost.removeAttribute('draggable');
    ghost.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;margin:0;pointer-events:none;z-index:2147483646;opacity:.94;transform:scale(1.03) rotate(1.2deg);transform-origin:20% 30%;filter:drop-shadow(0 18px 24px rgba(20,30,50,.22));';
    const inner = ghost.firstElementChild;
    if (inner) { inner.style.background = '#fbfcff'; inner.style.backdropFilter = 'none'; inner.style.webkitBackdropFilter = 'none'; inner.style.opacity = '1'; inner.style.transform = 'none'; }
    // hide the native drag image so only the ghost follows the pointer
    try { const px = new Image(); px.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='; e.dataTransfer.setDragImage(px, 0, 0); } catch (_) {}
    gdx = (window.__recDown ? window.__recDown.x : e.clientX) - r.left; gdy = (window.__recDown ? window.__recDown.y : e.clientY) - r.top;
    document.documentElement.appendChild(ghost);
  }, true);
  const clear = () => { if (ghost) { ghost.remove(); ghost = null; } };
  document.addEventListener('dragend', clear, true);
  document.addEventListener('drop', clear, true);
  if (!ensure()) {
    const mo = new MutationObserver(() => { if (ensure()) { /* keep watching for removals below */ } });
    mo.observe(document, { childList: true });
  }
  // Re-attach if React hydration or HMR removes our nodes.
  setInterval(ensure, 250);
})();`;

async function newSession({ record, scale = 1, ghost = false }) {
  fs.mkdirSync(TMP, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: scale,
    ...(record ? { recordVideo: { dir: TMP, size: VIEWPORT } } : {}),
  });
  await context.addInitScript(INIT_SCRIPT);
  if (ghost) await context.addInitScript('window.__recGhost = true;');
  const page = await context.newPage();
  const t0 = Date.now(); // video time zero is (just before) page creation
  const now = () => (Date.now() - t0) / 1000;
  return { browser, context, page, now };
}

async function hideDevIndicator(page) {
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  const visible = await page.evaluate(() => {
    const el = document.querySelector('nextjs-portal');
    return !!el && getComputedStyle(el).display !== 'none';
  });
  if (visible) throw new Error('Next.js dev indicator is still visible');
}

/** Load the board and wait until it is fully painted, then settle 800 ms. */
async function openBoard(page, { expect = COMPANIES } = {}) {
  await page.goto(BASE_URL, { waitUntil: 'load' });
  await hideDevIndicator(page);
  for (const name of expect) {
    await page.locator('main div[draggable] p', { hasText: new RegExp(`^${name}$`) }).first()
      .waitFor({ state: 'visible', timeout: 60_000 });
  }
  await page.locator('.animate-pulse').first().waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});
  await hideDevIndicator(page);
  await page.mouse.move(720, 820); // sync the fake cursor with the real pointer
  await page.waitForFunction(() => document.getElementById('__rec_cursor') !== null);
  await sleep(800);
}

// -------------------------------------------------------------- mouse helpers

let pointer = { x: 720, y: 820 };

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2); // ease in-out

/** Move the pointer along a slightly curved path in `ms` milliseconds (wall-clock, so pacing
 *  does not depend on how fast the machine services each mouse.move call). */
async function glide(page, x, y, { ms = 800, bow: bowMax = 28, arc = 0 } = {}) {
  const from = pointer;
  const dx = x - from.x, dy = y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.min(bowMax, len * 0.06);
  const t0 = Date.now();
  for (;;) {
    const t = Math.min(1, (Date.now() - t0) / ms);
    const e = ease(t);
    const off = Math.sin(Math.PI * e) * bow;
    await page.mouse.move(
      from.x + dx * e + (-dy / len) * off,
      from.y + dy * e + (dx / len) * off - Math.sin(Math.PI * e) * arc,
    );
    if (t >= 1) break;
    await sleep(8);
  }
  await page.mouse.move(x, y);
  pointer = { x, y };
}

async function centerOf(locator, { fx = 0.5, fy = 0.5 } = {}) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('no bounding box');
  return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}

async function glideTo(page, locator, opts = {}) {
  const { fx, fy, ...rest } = opts;
  const { x, y } = await centerOf(locator, { fx, fy });
  await glide(page, x, y, rest);
}

const card = (page, company) =>
  page.locator('main div[draggable]', { has: page.locator('p', { hasText: new RegExp(`^${company}$`) }) }).first();
const columnOf = (page, title) =>
  page.locator('h2', { hasText: new RegExp(`^${title}$`) }).locator('xpath=ancestor::div[contains(@class,"glass")][1]');
const syncButton = (page) => page.getByRole('button', { name: /Sync now/ });

// ------------------------------------------------------------- ffmpeg output

function ffmpeg(args) {
  const r = spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`);
}

function probe(file) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const out = r.stderr;
  const dur = /Duration: (\d+):(\d+):([\d.]+)/.exec(out);
  const size = /Video:.*?, (\d{2,5})x(\d{2,5})/.exec(out);
  return {
    seconds: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : null,
    width: size ? Number(size[1]) : null,
    height: size ? Number(size[2]) : null,
  };
}

async function finishClip({ browser, context, page, name, start, end }) {
  const video = page.video();
  await context.close(); // flushes the webm
  const raw = await video.path();
  await browser.close();
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  fs.mkdirSync(POSTER_DIR, { recursive: true });
  const mp4 = path.join(VIDEO_DIR, `${name}.mp4`);
  ffmpeg([
    '-i', raw, '-ss', start.toFixed(3), '-t', (end - start).toFixed(3),
    '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-an', mp4,
  ]);
  ffmpeg(['-i', mp4, '-frames:v', '1', '-q:v', '3', path.join(POSTER_DIR, `${name}.jpg`)]);
  if (process.env.KEEP_RAW === '1') fs.copyFileSync(raw, path.join(TMP, `${name}.webm`));
  const info = probe(mp4);
  console.log(`  ${name}.mp4  ${info.width}x${info.height}  ${info.seconds?.toFixed(2)}s`);
}

// -------------------------------------------------------------------- clips

async function withClip(name, body, { ghost = false } = {}) {
  console.log(`clip: ${name}`);
  const server = await startServer();
  let session;
  try {
    session = await newSession({ record: true, ghost });
    pointer = { x: 720, y: 820 };
    const { page, now } = session;
    await openBoard(page);
    const start = now();
    await body(page);
    const end = now() + 0.3;
    await finishClip({ ...session, name, start, end });
    session = null;
  } finally {
    if (session) await session.browser.close().catch(() => {});
    await stopServer(server);
  }
}

const CLIPS = {
  // Untouched board: gentle drift across the columns, hover two cards. No clicks.
  async board(page) {
    await glideTo(page, columnOf(page, 'Applied'), { fx: 0.5, fy: 0.9, ms: 800 });
    await glideTo(page, card(page, 'Orbital'), { fx: 0.6, fy: 0.5, ms: 800 });
    await sleep(900);
    await glideTo(page, card(page, 'Parallax'), { fx: 0.5, fy: 0.45, ms: 1000 });
    await sleep(900);
    await glideTo(page, columnOf(page, 'Rejected'), { fx: 0.5, fy: 0.85, ms: 900 });
    await sleep(200);
    await glide(page, 720, 820, { ms: 900 });
    await sleep(400);
  },

  // Sync twice: a new card lands in Applied, then a card moves to Interviewing.
  async sync(page) {
    await glideTo(page, syncButton(page), { ms: 900 });
    await sleep(700);
    await syncButton(page).click();
    await card(page, 'Sundial').waitFor({ state: 'visible', timeout: 15_000 });
    await sleep(2300);
    await syncButton(page).click();
    await columnOf(page, 'Interviewing').locator('p', { hasText: /^Halcyon$/ }).waitFor({ state: 'visible', timeout: 15_000 });
    await sleep(2400);
  },

  // Drag Orbital from Applied to Interviewing, holding over the column so it highlights.
  async drag(page) {
    const src = card(page, 'Orbital');
    await glideTo(page, src, { fx: 0.5, fy: 0.4, ms: 800 });
    await sleep(700);
    await page.mouse.down();
    await sleep(150);
    const target = await centerOf(columnOf(page, 'Interviewing'), { fy: 0.55 });
    await glide(page, target.x, target.y, { ms: 1100, arc: 26 });
    // small wiggles over the column keep dragover firing while the highlight is on camera
    for (let i = 0; i < 5; i++) {
      await glide(page, target.x + (i % 2 ? 8 : -8), target.y + i * 3, { ms: 160, bow: 0 });
    }
    await sleep(250);
    await page.mouse.up();
    await columnOf(page, 'Interviewing').locator('p', { hasText: /^Orbital$/ }).waitFor({ state: 'visible', timeout: 10_000 });
    await sleep(500);
    await glide(page, target.x + 140, target.y + 230, { ms: 700 });
    await sleep(1200);
  },

  // Open Halcyon, retype its role, save, close.
  async detail(page) {
    await glideTo(page, card(page, 'Halcyon'), { ms: 800 });
    await sleep(600);
    await card(page, 'Halcyon').click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    await sleep(800);
    const role = page.locator('label:has-text("Role") input');
    await glideTo(page, role, { ms: 700 });
    await sleep(300);
    await role.click();
    await page.keyboard.press('Control+A');
    await sleep(200);
    await page.keyboard.type('Design Technologist', { delay: 60 });
    await sleep(500);
    const save = page.getByRole('button', { name: /^Save$/ });
    await glideTo(page, save, { ms: 600 });
    await sleep(350);
    await save.click();
    await page.getByText('Saved', { exact: true }).waitFor({ state: 'visible', timeout: 5000 });
    await sleep(800);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await sleep(1200); // let the edited card sit on screen
  },

  // Mark Nimbus Data not job-related, then reveal it under "Show ignored".
  async ignore(page) {
    await glideTo(page, card(page, 'Nimbus Data'), { ms: 800 });
    await sleep(600);
    await card(page, 'Nimbus Data').click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    await sleep(700);
    const mark = page.getByRole('button', { name: 'Mark not job-related' });
    await glideTo(page, mark, { ms: 700 });
    await sleep(500);
    await mark.click();
    await card(page, 'Nimbus Data').waitFor({ state: 'detached', timeout: 8000 });
    await sleep(800);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await sleep(200);
    const toggle = page.locator('label', { hasText: /Show ignored/ });
    await glideTo(page, toggle, { ms: 800 });
    await sleep(500);
    await toggle.click();
    await columnOf(page, 'Ignored').locator('p', { hasText: /^Nimbus Data$/ }).waitFor({ state: 'visible', timeout: 8000 });
    await sleep(1400);
  },
};

// -------------------------------------------------------------------- stills

async function clipShot(page, locator, file, pad = 0) {
  const box = await locator.boundingBox();
  const clip = {
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
    width: Math.min(VIEWPORT.width, box.x + box.width + pad) - Math.max(0, box.x - pad),
    height: Math.min(VIEWPORT.height, box.y + box.height + pad) - Math.max(0, box.y - pad),
  };
  await page.screenshot({ path: path.join(STILL_DIR, file), clip });
}

async function recordStills() {
  console.log('stills');
  fs.mkdirSync(STILL_DIR, { recursive: true });
  const server = await startServer();
  let session;
  try {
    session = await newSession({ record: false, scale: 2 });
    const { page } = session;
    await openBoard(page);
    await page.addStyleTag({ content: '#__rec_cursor { display: none !important; }' }); // stills carry no fake cursor
    // Toast from the initial sync is still on screen for a few seconds: header + full board first.
    await page.locator('header').screenshot({ path: path.join(STILL_DIR, 'header.png') });
    await page.screenshot({ path: path.join(STILL_DIR, 'board-full.png') });
    await clipShotPage(page, card(page, 'Acme Corp').locator('> div').first(), 'card.png', 6);
    await clipShotPage(page, columnOf(page, 'Interviewing'), 'column.png', 14);
    // Detail panel for Acme Corp (2 emails). Taller viewport so the full email list fits without a cut-off card.
    await page.setViewportSize({ width: VIEWPORT.width, height: 1040 });
    await sleep(500);
    await card(page, 'Acme Corp').click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    await sleep(1600); // sheet spring + list stagger settle
    await page.mouse.move(300, 450); // over the scrim, away from anything hoverable
    await sleep(400);
    await dialog.screenshot({ path: path.join(STILL_DIR, 'detail-panel.png') });
  } finally {
    if (session) await session.browser.close().catch(() => {});
    await stopServer(server);
  }
}

async function clipShotPage(page, locator, file, pad) {
  await page.mouse.move(700, 880); // park the pointer on empty canvas so no hover lift shows
  await sleep(500);
  await clipShot(page, locator, file, pad);
}

// ------------------------------------------------------------------ contract

function extractSql() {
  const md = fs.readFileSync(path.join(ROOT, 'PROJECT.md'), 'utf8');
  const at = md.indexOf('Data model (SQLite)');
  if (at < 0) throw new Error('data model heading not found in PROJECT.md');
  const m = /```sql\n([\s\S]*?)```/.exec(md.slice(at));
  if (!m) throw new Error('sql block not found in PROJECT.md');
  return m[1].trimEnd();
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function highlight(line) {
  // Deliberately quiet: keywords a touch heavier, comments in the muted ink, no rainbow.
  const cm = /^(.*?)(--.*)$/.exec(line);
  const code = cm ? cm[1] : line;
  const comment = cm ? cm[2] : '';
  const kw = /\b(CREATE TABLE IF NOT EXISTS|CREATE TABLE|PRIMARY KEY|AUTOINCREMENT|NOT NULL|DEFAULT|CHECK|IN|REFERENCES|ON DELETE SET NULL|INTEGER|TEXT|datetime)\b/g;
  const html = esc(code).replace(kw, '<b>$1</b>').replace(/'[^']*'/g, (s) => `<i>${s}</i>`);
  return html + (comment ? `<em>${esc(comment)}</em>` : '');
}

async function recordContract() {
  console.log('contract');
  const lines = extractSql().split('\n').map((l) => {
    const indent = /^ */.exec(l)[0].length;
    return `<div class="l" style="padding-left:${indent + 4}ch">${highlight(l.trimStart()) || '&nbsp;'}</div>`;
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
:root{--canvas:#eef2f9;--orb-1:#cfdff5;--orb-2:#e3e8f5;--ink:#1d1d1f;--ink-2:#515154;--ink-3:#86868b;--line:rgba(29,29,31,.08);
--font-sans:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display",Inter,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
*{box-sizing:border-box}
body{margin:0;padding:56px;background:var(--canvas);font-family:var(--font-sans);min-width:1072px;position:relative;overflow:hidden}
body::before,body::after{content:"";position:absolute;border-radius:50%;filter:blur(90px);z-index:0}
body::before{width:520px;height:520px;left:-120px;top:-140px;background:radial-gradient(circle,var(--orb-1),transparent 70%)}
body::after{width:600px;height:600px;right:-160px;bottom:-200px;background:radial-gradient(circle,var(--orb-2),transparent 70%)}
#card{position:relative;z-index:1;width:960px;padding:32px 36px 34px;border-radius:20px;background:rgba(255,255,255,.74);
backdrop-filter:blur(32px);border:1px solid rgba(255,255,255,.7);box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 1px 2px rgba(20,30,50,.04),0 10px 30px -10px rgba(20,30,50,.12);color:var(--ink)}
.head{display:flex;align-items:baseline;justify-content:space-between;padding-bottom:18px;margin-bottom:20px;border-bottom:1px solid var(--line)}
h1{margin:0;font-size:17px;line-height:24px;font-weight:600;letter-spacing:-.01em}
.tag{font-size:11px;line-height:16px;color:var(--ink-3);letter-spacing:.06em;text-transform:uppercase;font-weight:600}
pre{margin:0;font-family:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,"Liberation Mono","DejaVu Sans Mono",monospace;font-size:14px;line-height:22px;color:var(--ink)}
.l{white-space:pre-wrap;text-indent:-4ch}
b{font-weight:700}i{font-style:normal;color:var(--ink-2)}em{font-style:normal;color:var(--ink-3)}
</style></head><body><div id="card"><div class="head"><h1>Data model (SQLite)</h1><span class="tag">Contract</span></div><pre>${lines.join('')}</pre></div></body></html>`;
  fs.mkdirSync(TMP, { recursive: true });
  const file = path.join(TMP, 'contract.html');
  fs.writeFileSync(file, html);
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 })).newPage();
    await page.goto('file://' + file);
    await sleep(300);
    fs.mkdirSync(STILL_DIR, { recursive: true });
    await page.locator('#card').screenshot({ path: path.join(STILL_DIR, 'contract.png') });
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------- main

const ALL = ['board', 'sync', 'drag', 'detail', 'ignore', 'stills', 'contract'];
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
for (const w of wanted) if (!ALL.includes(w)) throw new Error(`unknown target ${w}`);

for (const target of wanted) {
  if (target === 'stills') await recordStills();
  else if (target === 'contract') await recordContract();
  else await withClip(target, CLIPS[target], { ghost: target === 'drag' && process.env.GHOST !== '0' });
}
console.log('done');
