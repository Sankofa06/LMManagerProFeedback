# LM Manager Pro — Public Website

Static site for the LM Manager Pro landing page, privacy policy, and feedback page.
The pages are pure HTML / CSS / vanilla JS with no build step. Direct support
opens a private email draft, while the public GitHub issue board remains
available for browsing and community discussion.

## Pages

| File | Purpose | Deployed URL |
|---|---|---|
| `index.html` | Product landing page | `https://sankofa06.github.io/LMManagerProFeedback/` |
| `feedback.html` | Support email and public feedback browser | `https://sankofa06.github.io/LMManagerProFeedback/feedback.html` |
| `privacy.html` | Privacy Policy | `https://sankofa06.github.io/LMManagerProFeedback/privacy.html` |

## Current assets

The landing page mirrors the current `LMManagerPro` App Store marketing set from
`../LMManagerPro/AppStore/MarketingScreenshots/iphone-6.9-dark/`.

- `assets/icon.svg` — current LM Manager Pro brand SVG
- `assets/screenshots/onboarding-dark.png`
- `assets/screenshots/machines-dark.png`
- `assets/screenshots/models-dark.png`
- `assets/screenshots/personas-dark.png`
- `assets/screenshots/teams-dark.png`
- `assets/screenshots/episodes-dark.png`
- `assets/screenshots/chat-dark.png`
- `assets/screenshots/compare-dark.png`
- `assets/screenshots/image-studio-dark.png`
- `assets/screenshots/workspace-dark.png`

## Deployment

The main app repo (`sankofa06/LMManagerPro`) is **private**, so GitHub
Pages is hosted from a separate **public** repo:
[`sankofa06/LMManagerProFeedback`](https://github.com/sankofa06/LMManagerProFeedback).

### One-time setup

1. Make sure the `LMManagerProFeedback` repo exists and is **public** with
   **Issues enabled**.
2. In that repo: Settings → Pages → **Source: Deploy from a branch**,
   **Branch: `main` / `(root)`**.
3. Issue templates ship in `.github/ISSUE_TEMPLATE/` and are picked up
   automatically once the repo has them at the root.

### Deploy

Update the **root** of the `LMManagerProFeedback` repo and commit. The directory
structure should be:

```
LMManagerProFeedback/
├── index.html
├── feedback.html
├── privacy.html
├── worker/
│   ├── index.mjs
│   ├── index.test.mjs
│   └── wrangler.toml
├── assets/
│   ├── styles.css
│   ├── feedback.js
│   ├── icon.svg
│   └── screenshots/
│       ├── onboarding-dark.png
│       ├── machines-dark.png
│       ├── models-dark.png
│       ├── personas-dark.png
│       ├── teams-dark.png
│       ├── episodes-dark.png
│       ├── chat-dark.png
│       ├── compare-dark.png
│       ├── image-studio-dark.png
│       └── workspace-dark.png
└── .github/
    └── ISSUE_TEMPLATE/
        ├── config.yml
        ├── bug_report.yml
        └── feature_request.yml
```

The `.github/ISSUE_TEMPLATE/` files give GitHub-native issue creation a chooser
for bug reports or feature requests instead of a blank text box. `config.yml`
disables blank issues and adds quick links to the privacy policy and LM Studio
docs. The website's "Email Support" modal collects a type, title, and optional
details, then opens a private draft in the visitor's email app.

GitHub Pages will publish within a minute or two.

### Deploy the native app feedback relay

The static site does not need a write credential. The native app's optional
public-issue submission flow uses `worker/`; deploying it requires a narrowly
scoped GitHub token stored as `GITHUB_TOKEN`.

```bash
cd worker
wrangler secret put GITHUB_TOKEN
wrangler deploy
```

Use a fine-grained GitHub token with **Issues: Read and write** access to
`Sankofa06/LMManagerProFeedback`. After deploy, copy the Worker URL into LM
Manager Pro's `FeedbackConstants.submitEndpoint`.

### Verify

- Open `https://sankofa06.github.io/LMManagerProFeedback/` and confirm the
  landing page loads all 10 current screenshots and links to the web app,
  feedback, and privacy pages.
- Open `https://sankofa06.github.io/LMManagerProFeedback/feedback.html` and confirm the
  feedback page loads with the empty state (until issues exist).
- Open `…/privacy.html` and proofread.
- Create a test issue with a 👍 reaction in the repo, then reload — it should
  appear at the top under the default "Top (👍)" sort.
- Use Email Support and confirm the modal opens a private draft with the chosen
  type, title, and details.
- On `feedback.html`, DevTools → Network: reads go to
  `api.github.com/repos/sankofa06/LMManagerProFeedback/issues`. No support text
  is posted by the site, and no fonts, analytics, or third-party scripts load.

### Update App Store metadata

After deploy, edit `AppStore/submission-checklist.md` (in the main app
repo) and fill in:

- **Privacy Policy URL:** `https://sankofa06.github.io/LMManagerProFeedback/privacy.html`
- **Support URL:** `https://sankofa06.github.io/LMManagerProFeedback/feedback.html`

## How the feedback page works

- On load, `assets/feedback.js` calls
  `GET https://api.github.com/repos/sankofa06/LMManagerProFeedback/issues?state=all&per_page=100`
  with no auth (60 req/hr per IP — plenty for browsing).
- Pull requests are filtered out client-side.
- Issues are sorted by 👍 reaction count by default; users can switch to
  Newest or Most-discussed.
- Search and label filters are client-side over the fetched list.
- Successful responses are cached in `sessionStorage` for 5 minutes to
  avoid hitting the rate limit on tab switches within a session.
- "Email Support" opens a prefilled private draft in the visitor's email app;
  nothing is sent until the visitor chooses Send.
- Per-issue title and reaction links open `github.com` in a new tab for deeper
  discussion or GitHub-native reactions.

## Issue bridge

This public repo can copy feedback into the private
`Sankofa06/LMManagerPro` tracker through
`.github/workflows/public-to-private-issue-sync.yml`.

- Add the `triage-private` label to a public issue to create a private
  issue titled `[Public feedback #N] ...`.
- The public issue is then labeled `internal-tracked` and `synced`, and
  gets a neutral confirmation comment.
- The workflow needs an `ISSUE_MIRROR_TOKEN` repository secret with Issues
  read/write access to both `Sankofa06/LMManagerProFeedback` and
  `Sankofa06/LMManagerPro`.
- After adding the secret, run the manual `Setup issue bridge labels`
  workflow once to create the bridge labels in both repos.
- The workflow does not publish private repo URLs or private issue numbers
  back to the public issue.

## Local preview

Open `index.html`, `feedback.html`, or `privacy.html` directly in a browser
(`file://` URLs work fine for the static pages and the feedback API call).
For a closer-to-production preview:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```
