# McAleese Strength

A personal gym-programming PWA for the McAleese family. One app, multiple
people, each with their own program, constraints, and session history.
Installs to the home screen, works fully offline, no accounts, no backend.

- **Shea** — HYROX block: strength, stations, run intervals, plus a hotel-gym
  toggle (dumbbells + treadmill + bodyweight versions of every session).
- **Dad** — 3 × 30–40 min sessions/week: knee-friendly leg strength, balance
  and fall prevention, pulling/pressing, grip, gentle conditioning. Light
  high-contrast theme, large text, plain-language cues, "stop if" guidance
  on every lower-body exercise.

Everything is plain HTML/CSS/JS — no build step. Deploying is just pushing
files.

## Folder layout

```
index.html            app shell
styles.css            all styling incl. the three themes
app.js                all app logic
manifest.json         PWA install metadata
sw.js                 service worker (offline caching)
icons/                app icons
programs/
  profiles.json       the list of people shown on the picker
  shea.json           Shea's program (4 weeks)
  dad.json            Dad's program (4 weeks)
  template.json       annotated starting point for new people
schema.md             full schema documentation
```

## Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `mcaleese-strength`).
2. From this folder:
   ```bash
   git init
   git add .
   git commit -m "McAleese Strength v1"
   git branch -M main
   git remote add origin git@github.com:<you>/mcaleese-strength.git
   git push -u origin main
   ```
3. In the repo: **Settings → Pages → Source: Deploy from a branch →
   Branch: `main` / `/ (root)` → Save.**
4. A minute later the app is live at
   `https://<you>.github.io/mcaleese-strength/`.
   (All paths in the app are relative, so it works fine from a subpath.)

### Install on a phone

- **iPhone:** open the URL in Safari → Share → **Add to Home Screen**.
- **Android:** open in Chrome → menu → **Add to Home screen** / Install.

After the first visit it works completely offline — programs included.

## Editing a program

Programs live in `/programs` as human-readable JSON. Edit by hand or ask
Claude Code, e.g.:

> "In programs/dad.json, week 3, Session B — drop the shoulder press to
> 2 sets and add a note that his shoulder was cranky."

> "Add a week 5 to shea.json that repeats week 3 but with 5% heavier sleds."

The full field reference is in [schema.md](schema.md). The short version:
`weeks[] → days[] → exercises[]`, where each exercise has `name`, `sets`,
`reps`, `load`, `restSeconds`, `cue`, `alternative`, `stopIf`, and an
optional `hotel` override object for hotel-gym mode.

**After any edit, bump `CACHE_VERSION` in `sw.js`** (e.g. `ms-v1` → `ms-v2`)
and push. Installed phones pick up the new content on their next visit.
(Program files are fetched network-first, so online phones usually see edits
even without a bump — the bump guarantees it, including the offline cache.)

## Adding a new person

1. Copy `programs/template.json` → `programs/<name>.json` and write their
   program (or ask Claude Code to draft it from a description — the template
   has inline `_comments` explaining every field).
2. Add them to `programs/profiles.json`:
   ```json
   { "id": "mum", "name": "Mum", "file": "programs/mum.json", "emoji": "🚴" }
   ```
3. Bump `CACHE_VERSION` in `sw.js`, push. The service worker caches new
   program files automatically based on `profiles.json`.

Profile-level switches worth knowing: `theme` (`dark`, `light`,
`light-high-contrast`), `largeText` (bigger fonts + tap targets), and
`settings.showHotelVariant` (shows the hotel-gym toggle).

## Session history

Completed sessions (sets done, loads used, 1–5 rating, notes) save to
`localStorage` on the phone, keyed per profile. **History → Export history
(JSON)** downloads a backup at any time. Since history lives on each device,
Dad's phone keeps Dad's history — nothing is shared or uploaded anywhere.

## Local development

Any static file server works:

```bash
cd mcaleese-strength
python3 -m http.server 8080
# open http://localhost:8080
```

(Opening index.html directly via file:// won't work — fetch() and the
service worker need http.)
