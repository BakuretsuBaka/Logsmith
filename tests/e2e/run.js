// End-to-end check in a real Chromium with the extension loaded. Needs Playwright (not a dependency of the repo):
//   NODE_PATH=/path/to/node_modules node tests/e2e/run.js
// The pages are simulations of the walls the big sites show; the real sites were not used.
const path = require("path");
const http = require("http");
const { chromium } = require("playwright");

const EXT = path.resolve(__dirname, "../..");
const pages = {};

const feed = `<main><article><h2>Post one</h2><p>Some text</p></article><article><h2>Post two</h2></article></main>`;
const header = `<header role="banner"><a href="/accounts/login/" id="hdr-login">Log in</a></header>`;

pages["instagram.com"] = (u) => u.startsWith("/p/")
  ? `<body><h1 id="post">The post</h1></body>`
  : u.startsWith("/lilbieber") ? `<body><a id="tile" href="/p/Abc123/">tile</a><button id="go2" style="position:relative;z-index:5">go</button><script>document.getElementById('go2').addEventListener('click',()=>{history.pushState(null,'','/accounts/login/');const d=document.createElement('div');d.setAttribute('role','dialog');d.id='cw';d.innerHTML='<div style="position:fixed;top:20%;left:25%;width:50%;background:#fff;padding:24px;z-index:9"><h2>Continue watching</h2><p>More photos, videos, and ways to connect with lilbieber.</p><a href="/accounts/emailsignup/">Sign up</a><a href="/accounts/login/">Log in</a></div>';document.body.append(d)});document.getElementById('tile').addEventListener('click',e=>{e.preventDefault();history.pushState(null,'','/accounts/login/');document.body.innerHTML='<div role=dialog>Log in to see this</div>'})</script></body>`
  : u.startsWith("/accounts/login")
  ? `<body>${header}<div role="dialog" id="real-login"><form>Log in<input name="username"><input type="password"><button>Log in</button></form></div></body>`
  : `<body style="margin:0">${header}<div id="app" style="filter:blur(8px)">${feed}<div style="height:3000px"></div></div>
<div id="dim" style="display:none;position:fixed;inset:0;background:#0008"></div>
<div id="wall" style="display:none" role="dialog"><div style="position:fixed;top:30%;left:30%;width:40%;background:#fff;padding:20px;z-index:10">
 <h3>Log in to continue</h3><p>See more from NASA</p><a href="/accounts/login/?next=/nasa/">Log in</a> <a href="/accounts/emailsignup/">Sign up</a></div></div>
<button id="go" style="position:relative;z-index:50" onclick="history.pushState(null,'','/accounts/login/')">Go</button>
<div id="share" role="dialog" style="display:none"><div style="position:fixed;top:30%;left:30%;width:40%;background:#fff;padding:20px;z-index:10"><h3>Share</h3><button>Copy link</button></div></div>
<script>setTimeout(()=>{document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';
 document.getElementById('dim').style.display='block';document.getElementById('wall').style.display='block';},400);
 setTimeout(()=>{document.getElementById('share').style.display='block'},300);
 setTimeout(()=>{history.pushState(null,'','/accounts/login/?next=/nasa/')},900);
 document.addEventListener('DOMContentLoaded',()=>{});</script></body>`;

pages["x.com"] = () => `<body style="margin:0"><div id="react-root">${header}${feed}<div style="height:3000px"></div></div>
<div data-testid="BottomBar" style="position:fixed;bottom:0;left:0;right:0;background:#1da1f2;color:#fff;padding:12px">Don't miss what's happening <a href="/login" data-testid="loginButton">Log in</a> <a href="/i/flow/signup" data-testid="signupButton">Sign up</a></div>
<div id="layers"></div>
<aside id="promo" style="position:fixed;bottom:0;left:20%;width:60%;background:#fff;padding:16px;z-index:15"><h2>See Clavicular Updates’s full profile</h2><a href="https://x.com/">Continue to X</a></aside>
<div id="vp" data-testid="videoPlayer" style="width:400px;height:240px;background:#222"><video muted></video><button id="fsb" aria-label="Full screen" onclick="document.getElementById('layers').innerHTML='<div role=dialog data-testid=sheetDialog>Sign in to X <a href=/i/flow/login>Log in</a></div>'">fs</button></div>
<script>setTimeout(()=>{document.getElementById('layers').innerHTML='<div><div style="position:fixed;inset:0;background:#0009"></div><div data-testid="sheetDialog" role="dialog" style="position:fixed;top:25%;left:30%;width:40%;background:#000;color:#fff;padding:24px;z-index:20"><h2>Sign in to X</h2><a href="/i/flow/login" data-testid="loginButton">Log in</a><a href="/i/flow/signup">Create account</a></div></div>';document.documentElement.style.overflow='hidden';},500);</script></body>`;

pages["tiktok.com"] = () => `<body style="margin:0"><div class="DivSideNavContainer" id="sidenav" style="position:fixed;left:0;top:0;bottom:0;width:240px;background:#fff;z-index:5"><div>For You</div><div>Following</div><div class="DivLoginBox"><p>Log in to follow creators, like videos, and view comments.</p><button id="sn-login" data-e2e="nav-login-button">Log in</button></div><div>Explore</div></div>${header}<div id="feed">${feed}<div style="height:3000px"></div></div>
<script>setTimeout(()=>{document.body.style.overflow='hidden';const m=document.createElement('div');m.className='DivLoginContainer';m.style.cssText='position:fixed;inset:0;background:#000a;z-index:30';
m.innerHTML='<div style="background:#fff;margin:15% auto;width:380px;padding:24px"><div data-e2e="modal-close-inner-button" role="button" aria-label="Close">x</div><h2>Log in to TikTok</h2><button data-e2e="channel-item">Use phone / email / username</button><button data-e2e="channel-item">Continue with Google</button></div>';document.body.append(m);},500);</script></body>`;

pages["reddit.com"] = () => `<body style="margin:0"><reddit-header-large style="display:block;position:fixed;top:0;left:0;right:0;height:56px;background:#fff;z-index:20"><form role="search"><input type="search"></form><a id="rd-signup" href="/register">Sign Up</a> <a id="rd-login" href="/login">Log In</a> <button aria-label="Expand user menu">menu</button></reddit-header-large><div style="height:60px"></div>${feed}
<div role="dialog" id="post" style="position:fixed;top:10%;left:20%;width:60%;background:#fff;z-index:10"><article><h2>A post in a dialog</h2><p>Log in to like or comment</p><a href="/login">Log in</a></article></div></body>`;

// A feed that stops loading and offers "Try again": pressing it adds posts
pages["pinterest.com"] = (u) => u.startsWith("/pin/")
  ? `<body><h1 id="pin">The pin</h1></body>`
  : u.startsWith("/boards")
  ? `<a id="pintile" href="/pin/123456/">pin</a><script>document.getElementById('pintile').addEventListener('click',e=>{e.preventDefault();document.body.insertAdjacentHTML('beforeend','<div role=dialog id=pwall>Welcome to Pinterest Log in <a href=/login>Log in</a></div>')})</script>`
  : `<body style="margin:0">${header}<div id="list">${feed}</div>
<div id="err"><p>Something went wrong</p><button id="again" onclick="document.getElementById('list').insertAdjacentHTML('beforeend','<article class=more><h2>More</h2></article>');document.getElementById('err').remove()">Try again</button></div>
<button id="login-cta" onclick="window.__cta=1">Log in</button></body>`;

const server = http.createServer((req, res) => {
  const host = (req.headers.host || "").replace(/^www\./, "").split(":")[0];
  const f = pages[host];
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(f ? `<!doctype html><html><head><meta charset="utf-8"><title>${host}</title></head>${f(req.url)}</html>` : "unknown host");
});

let failed = 0;
const check = (name, ok, extra = "") => {
  console.log((ok ? "ok   " : "FAIL ") + name + (ok ? "" : "  " + extra));
  if (!ok) failed++;
};

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const rules = ["instagram.com", "www.instagram.com", "x.com", "www.x.com", "tiktok.com", "www.tiktok.com", "reddit.com", "www.reddit.com", "pinterest.com", "www.pinterest.com"]
    .map((h) => `MAP ${h} 127.0.0.1:${port}`).join(", ");
  const ctx = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, `--host-resolver-rules=${rules}`]
  });
  const visible = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== "none" && r.width > 0 && r.height > 0; }, sel);

  // Instagram
  let page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto("http://www.instagram.com/nasa/");
  await page.waitForTimeout(2800);
  check("instagram: login dialog hidden", !(await visible(page, "#wall > div")));
  check("instagram: dimming layer hidden", !(await visible(page, "#dim")));
  check("instagram: unrelated dialog (Share) kept", await visible(page, "#share > div"));
  check("instagram: header Log in button kept", await visible(page, "#hdr-login"));
  check("instagram: page scrolls again", await page.evaluate(() => getComputedStyle(document.documentElement).overflowY !== "hidden" && getComputedStyle(document.body).overflowY !== "hidden"));
  check("instagram: blur removed", await page.evaluate(() => getComputedStyle(document.getElementById("app")).filter === "none"));
  check("instagram: automatic jump to the login route dropped", await page.evaluate(() => location.pathname === "/nasa/"));
  const sw = ctx.serviceWorkers()[0];
  const badge = await sw.evaluate(async () => { const tabs = await chrome.tabs.query({}); const texts = await Promise.all(tabs.map((t) => chrome.action.getBadgeText({ tabId: t.id }))); return texts.join(","); });
  check("instagram: badge shows the hidden wall", badge.split(",").includes("1"), "badge=" + badge);
  await page.click("#go");
  check("instagram: a click on a login link still works", await page.evaluate(() => location.pathname === "/accounts/login/"));
  await page.goto("http://www.instagram.com/nasa/");
  await page.waitForTimeout(1800);
  await sw.evaluate(() => chrome.storage.local.set({ sites: { instagram: false } }));
  await page.waitForTimeout(600);
  check("instagram: switched off for the site, the wall comes back", await visible(page, "#wall > div"));
  await sw.evaluate(() => chrome.storage.local.set({ sites: {} }));
  await page.waitForTimeout(1500);
  check("instagram: switched on again, the wall is hidden again", !(await visible(page, "#wall > div")));
  await page.goto("http://www.instagram.com/accounts/login/");
  await page.waitForTimeout(1500);
  check("instagram: the real login page is untouched", await visible(page, "#real-login"));
  await page.close();

  // X
  page = await ctx.newPage();
  await page.goto("http://x.com/home");
  await page.waitForTimeout(2500);
  check("x: bottom bar hidden", !(await visible(page, '[data-testid="BottomBar"]')));
  check("x: full-profile promo hidden", !(await visible(page, "#promo")));
  check("x: sign-in sheet hidden", !(await visible(page, '[data-testid="sheetDialog"]')));
  check("x: header login kept", await visible(page, "#hdr-login"));
  check("x: page scrolls again", await page.evaluate(() => getComputedStyle(document.documentElement).overflowY !== "hidden" && getComputedStyle(document.body).overflowY !== "hidden"));
  await page.click("#fsb");
  await page.waitForTimeout(900);
  check("x: video goes full screen", await page.evaluate(() => !!document.fullscreenElement));
  await page.click("#fsb");
  await page.waitForTimeout(900);
  check("x: exit full screen button works", await page.evaluate(() => !document.fullscreenElement));
  await page.close();

  // TikTok
  page = await ctx.newPage();
  await page.goto("http://www.tiktok.com/@user");
  await page.waitForTimeout(2500);
  check("tiktok: sidebar kept", await visible(page, "#sidenav") && await visible(page, "#sn-login"));
  check("tiktok: login modal hidden", !(await visible(page, ".DivLoginContainer")));
  check("tiktok: page scrolls again", await page.evaluate(() => getComputedStyle(document.documentElement).overflowY !== "hidden" && getComputedStyle(document.body).overflowY !== "hidden"));
  await page.close();

  // Reddit: a post opened in a dialog mentions logging in, but it is content
  page = await ctx.newPage();
  await page.goto("http://www.reddit.com/r/test");
  await page.waitForTimeout(2000);
  check("reddit: post dialog with article text kept", await visible(page, "#post"));
  check("reddit: custom-element header with Log In kept", await visible(page, "reddit-header-large") && await visible(page, "#rd-login"));
  await page.close();

  // A stalled feed: Logsmith presses "Try again" (and never the log-in button)
  page = await ctx.newPage();
  await page.goto("http://www.pinterest.com/");
  await page.waitForTimeout(6500);
  check("pinterest: retry pressed, more posts loaded", (await page.locator("article.more").count()) === 1);
  check("pinterest: log-in button not pressed", await page.evaluate(() => !window.__cta));
  await page.close();

  // Instagram: a click on a post tile becomes a normal page load
  page = await ctx.newPage();
  await page.goto("http://www.instagram.com/lilbieber/");
  await page.waitForTimeout(800);
  await page.click("#tile");
  await page.waitForTimeout(1200);
  check("instagram: post tile opens the post", (await page.locator("#post").count()) === 1 && page.url().includes("/p/Abc123"));
  await page.close();

  // A pop-up added later must be gone by the first frame that gets painted
  page = await ctx.newPage();
  await page.goto("http://www.instagram.com/lilbieber/");
  await page.waitForTimeout(800);
  const flashed = await page.evaluate(async () => {
    const d = document.createElement("div");
    d.setAttribute("role", "dialog");
    d.id = "late";
    d.innerHTML = '<div style="position:fixed;top:30%;left:30%;width:40%;background:#fff;padding:20px;z-index:10"><h3>Log in to continue</h3><a href="/accounts/login/">Log in</a> <a href="/accounts/emailsignup/">Sign up</a></div>';
    document.body.append(d);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    const r = d.firstElementChild.getBoundingClientRect();
    return getComputedStyle(d).display !== "none" && r.width > 0;
  });
  check("instagram: late pop-up gone before the first paint", !flashed);
  await page.close();

  // The dimming layer that arrives before its pop-up must not be painted either
  page = await ctx.newPage();
  await page.goto("http://www.instagram.com/lilbieber/");
  await page.waitForTimeout(800);
  const dimFlash = await page.evaluate(async () => {
    const dim = document.createElement("div");
    dim.id = "earlydim";
    dim.style.cssText = "position:fixed;inset:0;background:#000b;z-index:5";
    document.body.append(dim);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    const gone = getComputedStyle(dim).clipPath !== "none" || getComputedStyle(dim).display === "none";
    await new Promise((r) => setTimeout(r, 3600));
    const back = getComputedStyle(dim).clipPath === "none" && getComputedStyle(dim).display !== "none";
    return { gone, back, attrs: dim.getAttributeNames().join(","), cp: getComputedStyle(dim).clipPath, d: getComputedStyle(dim).display };
  });
  check("instagram: early dimming layer not painted", dimFlash.gone);
  check("instagram: unrelated dimming layer released after a while", dimFlash.back, JSON.stringify(dimFlash));
  await page.close();

  // The address switched to a log-in route by itself while the profile stays: still a wall
  page = await ctx.newPage();
  await page.goto("http://www.instagram.com/lilbieber/");
  await page.waitForTimeout(800);
  await page.click("#go2");
  await page.waitForTimeout(1200);
  check("instagram: prompt over the profile with a login address hidden", !(await visible(page, "#cw")), page.url());
  await page.close();

  page = await ctx.newPage();
  await page.goto("http://www.pinterest.com/boards/");
  await page.waitForTimeout(600);
  await page.click("#pintile");
  await page.waitForTimeout(1200);
  check("pinterest: pin tile opens the pin", (await page.locator("#pin").count()) === 1 && page.url().includes("/pin/123456"));
  await page.close();

  await ctx.close();
  server.close();
  console.log(failed ? `${failed} check(s) failed` : "all checks passed");
  process.exit(failed ? 1 : 0);
})();
