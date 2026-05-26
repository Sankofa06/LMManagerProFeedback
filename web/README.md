# LM Manager Pro Web

Standalone web companion to the LM Manager Pro Swift app. Manage local LM Studio
inference servers and cloud model providers across multiple machines from any
browser — no install, no build step, no npm.

## Run it locally

The app talks directly to LM Studio's REST API on each machine, so it has to be
served from an origin browsers will let connect to `http://…:1234`.

```bash
cd web
python3 -m http.server 8000
# open http://localhost:8000/
```

You can also open `web/index.html` directly via `file://` — `file://` origins are
allowed to talk to `localhost`, so the in-app banners that mention this still
work.

## Deploying as a static site

Zero dependencies. Drop the `web/` folder onto any static host (Netlify, Vercel,
GitHub Pages, S3+CloudFront, nginx). The only network calls the bundle makes are:

- Google Fonts (Inter + JetBrains Mono) at the top of `index.html` — feel free
  to self-host or remove if you prefer no third-party font CDN.
- Whatever LM Studio / cloud-provider hostnames the user configures inside the
  app at runtime — these are saved to `localStorage`, not baked in.

Browsers will block mixed content, so if you serve over `https://`, every
machine the user adds must also be reachable over `https://` (or accessed via a
Tailscale-style VPN that gives each machine a routable name).

## Layout

```
web/
├── index.html          # markup + script/link tags
├── css/                # 6 stylesheets, split by section
│   ├── tokens.css
│   ├── base.css
│   ├── panels.css
│   ├── responsive.css
│   ├── modals.css
│   └── refresh.css
└── js/                 # 19 classic <script> files, loaded in order
    ├── constants.js    # emoji sets, palette, role system, app defaults
    ├── data.js         # default machines/roster/teams
    ├── state.js        # app state + roster machine reassignment
    ├── chat.js         # streaming + interview presets
    ├── nav-machines.js # sidebar nav + machines panel render
    ├── roster.js
    ├── teams.js
    ├── chat-panel.js
    ├── settings-interview-builder.js
    ├── scoring.js
    ├── survivor-utils.js
    ├── theme-compare.js
    ├── interview-solo.js
    ├── machine-crud.js
    ├── lmlink.js
    ├── admin.js
    ├── status-discovery.js
    ├── episodes-branding.js
    └── init.js         # bootstrap; loaded last
```

The JS uses inline `onclick="…"` handlers throughout, so every file's contents
sit on the global scope (no ES modules, no IIFEs). Load order matches the order
in `index.html` — `init.js` must stay last.

## Local storage

All persisted state lives under the `lmmp_*` key prefix. To wipe everything,
either use **Settings → Wipe all data** in-app or run `localStorage.clear()` in
DevTools.

| Key | Holds |
|---|---|
| `lmmp_app_settings` | global app settings (brand, scoring weights, etc.) |
| `lmmp_v5_machines` | machine list |
| `lmmp_v5_roster` | model/persona roster |
| `lmmp_v5_teams` | team definitions |
| `lmmp_v5_presets` | saved presets |
| `lmmp_v5_timeline` | recent activity timeline (last 500) |
| `lmmp_v5_criteria` | scoring criteria |
| `lmmp_v5_ep` | episode counter |
| `lmmp_v5_theme` | dark / light |
| `lmmp_v5_iv_prompt` | interview prompt template |
| `lmmp_v7_archived` | archived chat sessions (last 50) |
| `lmmp_v7_episodes` | episode runs (last 100) |
| `lmmp_v7_brand` | legacy brand-name override |
| `lmmp_v82_oneonone` | 1:1 chat history per model |
| `lmmp_custom_roles` | user-defined roles |

## Brand

The visible brand name is **LM Manager Pro Web** and is editable in-app at
**Settings → Brand name**. Export filenames use the `lmmp-` prefix
(`lmmp-roster-*.json`, `lmmp-full-*.json`, etc.).
