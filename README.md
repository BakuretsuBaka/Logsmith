# Logsmith

A browser extension (Chrome and Firefox, Manifest V3) that keeps social sites usable without an account. Instagram, TikTok, X and others let you look around for a while and then put a login wall over the page, lock scrolling or send you to the login screen. Logsmith takes those obstacles away so you can keep reading.

## What it does

- **Hides login walls and sign-up pop-ups.** An overlay counts as a wall when it is a dialog or a fixed layer with a short text that asks for an account ("Log in to continue", "Sign up to see more", "Anmelden", "Se connecter", and so on in many languages) and a login or sign-up control. Its dimming layer goes with it.
- **Gives the page back.** Scrolling is unlocked, the blur over the content is removed, and content that was made unclickable works again.
- **Stops automatic jumps to the login screen.** A single-page site that pushes `/login` on its own after a while (nobody clicked anything) is ignored. Your own clicks on Log in always work, and so do real login pages.
- **Leaves everything else alone.** The Log in button in the page header, share dialogs, a post opened in a dialog: untouched.
- **Per-site switches.** One toggle in the popup for the current site, a master switch, and a list of all sites. The toolbar icon turns grey where Logsmith is off and shows a badge with the number of walls it hid.

Supported: Instagram, TikTok, X (Twitter), Threads, Facebook, Reddit, Pinterest, Quora, LinkedIn.

## What it cannot do

Logsmith only changes what your browser shows. It cannot show anything the site does not send to a logged-out visitor:

- If the server answers with a redirect to the login page, or with "Something went wrong, try again later" after too many requests, there is nothing to unlock.
- Posts, profiles or comments that are private or limited to members stay out of reach.
- Sites change their markup often. The detection is based on what a wall says and does rather than on class names, but it can still miss a new kind of wall. The popup's **Copy debug info** button copies what Logsmith saw on the page, which is what is needed to fix a miss.

The automated checks run against simulated pages that imitate these walls, not against the real sites, so expect some rough edges at first.

## Privacy

Logsmith has no network access of its own, collects nothing and stores only its on/off switches in the browser (`storage` is the only permission).

## Install

**Chrome / Edge:** open `chrome://extensions`, enable Developer mode, choose "Load unpacked" and select this folder.

**Firefox:** open `about:debugging#/runtime/this-firefox`, choose "Load Temporary Add-on" and select `manifest.json`.

## Development

No build step for development. `content.js` holds the detection, `guard.js` runs in the page and drops automatic jumps to the login screen, `background.js` sets the icon and badge, `popup.*` is the popup.

- `npm test` runs the unit tests.
- `tests/e2e/run.js` loads the extension into a real Chromium and checks it against simulated Instagram, X, TikTok and Reddit pages (needs Playwright: `NODE_PATH=/path/to/node_modules node tests/e2e/run.js`).
- `python3 tools/build.py` writes the Firefox and Chromium packages to `dist/`; `python3 tools/make_icons.py` redraws the icon.

## License

GPL-3.0-only, see [LICENSE](LICENSE).
