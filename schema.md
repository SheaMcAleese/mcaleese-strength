# McAleese Strength — Program JSON Schema

Every person gets one file in `/programs` (e.g. `shea.json`, `dad.json`).
The app also reads `programs/profiles.json`, which is the list of people shown
on the profile picker.

The schema is designed so you can edit it by hand or ask Claude Code things like
*"add a fifth week to dad.json that repeats week 4 but adds one rep to every
lower body exercise"* and get a correct result.

---

## profiles.json

```json
{
  "profiles": [
    { "id": "shea", "name": "Shea", "file": "programs/shea.json", "emoji": "🏃" },
    { "id": "dad",  "name": "Dad",  "file": "programs/dad.json",  "emoji": "💪" }
  ]
}
```

- `id` — unique, lowercase, no spaces. Used as the localStorage key for history.
- `file` — path to that person's program, relative to the app root.
- `emoji` — shown on the picker button.

**To add a new person:** copy `programs/template.json` to `programs/<name>.json`,
edit it, and add an entry here. That's it — the service worker picks up new
program files automatically on the next visit.

---

## Program file (top level)

```json
{
  "profile":  { ... },   // who this is and how the app should look for them
  "settings": { ... },   // app behaviour defaults
  "weeks":    [ ... ]    // the actual programming: weeks > days > exercises
}
```

### profile

| Field | Type | Notes |
|---|---|---|
| `id` | string | Must match the id in profiles.json |
| `displayName` | string | Shown in the app header |
| `theme` | string | `"dark"`, `"light"`, or `"light-high-contrast"` |
| `largeText` | boolean | `true` bumps all font sizes ~25% and enlarges tap targets |
| `constraints` | string[] | Shown on the home screen as a reminder, e.g. "No deep knee flexion" |
| `goals` | string[] | Shown on the home screen |

### settings

| Field | Type | Notes |
|---|---|---|
| `units` | string | `"kg"` or `"lb"` — display only |
| `defaultRestSeconds` | number | Used when an exercise has no `restSeconds` |
| `showHotelVariant` | boolean | `true` shows the "Hotel gym" toggle on the home screen |

### weeks[]

Each week:

```json
{
  "label": "Week 1 — Base",
  "note": "Optional coaching note shown at the top of each session this week",
  "days": [ ... ]
}
```

Weeks are ordered — the app works through them top to bottom. "Today's
session" is simply the first session the person hasn't completed yet.

### days[] (a day = one session)

```json
{
  "name": "Lower Strength + Sled",
  "estimatedMinutes": 60,
  "warmup":  ["5 min easy row", "10 leg swings each side"],
  "exercises": [ ... ],
  "cooldown": ["5 min easy walk", "Quad + hip flexor stretch, 45s each"]
}
```

`warmup` and `cooldown` are plain strings — kept deliberately simple. The
tracked, set-by-set part of the session is `exercises`.

### exercises[]

```json
{
  "name": "Back Squat",
  "sets": 4,
  "reps": "5",
  "load": "RPE 7 (2–3 reps in reserve)",
  "restSeconds": 150,
  "cue": "Brace hard, drive the floor apart",
  "alternative": "Goblet squat if the bar feels off today",
  "stopIf": "",
  "hotel": { "name": "DB Goblet Squat", "load": "Heaviest DB available" }
}
```

| Field | Type | Notes |
|---|---|---|
| `name` | string | Required. Everything else has sensible defaults. |
| `sets` | number | How many tap-to-complete circles the app shows |
| `reps` | string | Free text: `"5"`, `"8 each side"`, `"40s"`, `"400m"`, `"20m"` |
| `load` | string | Free text: `"60kg"`, `"RPE 7"`, `"Bodyweight"`, `"Light — could do 10 more"` |
| `restSeconds` | number | Rest timer after each completed set. `0` = no timer |
| `cue` | string | One short coaching cue, shown under the exercise name |
| `alternative` | string | Regression/swap, shown behind a "Too hard today?" tap |
| `stopIf` | string | Safety line shown in a red box. Use for every knee exercise in Dad's file |
| `hotel` | object | Optional. Overrides for hotel-gym mode (dumbbells + treadmill + bodyweight only). Any field you include replaces the original; anything you leave out is inherited. Omit `hotel` entirely if the exercise already works in a hotel gym. |

**Hotel mode** only appears when `settings.showHotelVariant` is `true`. When
toggled on, every exercise renders with its `hotel` overrides applied.

---

## Session history (localStorage, exported as JSON)

You never write this by hand, but the export button produces:

```json
{
  "profileId": "dad",
  "exportedAt": "2026-07-08T09:30:00.000Z",
  "sessions": [
    {
      "date": "2026-07-08T09:12:00.000Z",
      "weekIndex": 0,
      "dayIndex": 0,
      "weekLabel": "Week 1 — Getting started",
      "sessionName": "Session A — Legs & Balance",
      "hotelMode": false,
      "rating": 4,
      "note": "Knee felt fine",
      "exercises": [
        { "name": "Sit-to-Stand", "setsCompleted": 2, "loadUsed": "Bodyweight" }
      ]
    }
  ]
}
```

History is stored per profile under the key `ms_history_<id>`, so profiles
never see each other's data.
