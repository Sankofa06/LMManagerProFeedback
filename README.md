# LM Manager Pro — Public Website

Static site for the LM Manager Pro landing page, privacy policy, and feedback page.
Pure HTML / CSS / vanilla JS — no build step, no dependencies, no backend,
no analytics. Matches the app's privacy-first stance.

## Pages

| File | Purpose | Deployed URL |
|---|---|---|
| `index.html` | Product landing page | `https://sankofa06.github.io/LMManagerProFeedback/` |
| `feedback.html` | Feedback page (browse + submit GitHub issues) | `https://sankofa06.github.io/LMManagerProFeedback/feedback.html` |
| `privacy.html` | Privacy Policy | `https://sankofa06.github.io/LMManagerProFeedback/privacy.html` |

## Deployment

The main app repo (`sankofa06/LMManagerPro`) is **private**, so GitHub
Pages is hosted from a separate **public** repo:
[`sankofa06/LMManagerProFeedback`](https://github.com/sankofa06/LMManagerProFeedback).

### One-time setup

1. Make sure the `LMManagerProFeedback` repo exists and is **public** with
   **Issues enabled**.
2. In that repo: Settings → Pages → **Source: Deploy from a branch**,
   **Branch: `main` / `(root)`**.
3. Issue templates ship in `.github/ISSUE_TEMPLATE/` — they're picked up
   automatically once the repo has them at the root.

### Deploy

Copy the contents of this `website/` directory into the **root** of the
`LMManagerProFeedback` repo and commit. The directory structure should be:

```
LMManagerProFeedback/
├── index.html
├── feedback.html
├── privacy.html
├── assets/
│   ├── styles.css
│   ├── feedback.js
│   ├── icon.svg
│   └── screenshots/
└── .github/
    └── ISSUE_TEMPLATE/
        ├── config.yml
        ├── bug_report.yml
        └── feature_request.yml
```

The `.github/ISSUE_TEMPLATE/` files give users a chooser when they click
"Submit Feedback" — bug report or feature request — instead of a blank
text box. `config.yml` disables blank issues and adds quick links to the
privacy policy and LM Studio docs.

GitHub Pages will publish within a minute or two.

### Verify

- Open `https://sankofa06.github.io/LMManagerProFeedback/` and confirm the
  landing page loads with screenshots and links to the web app, feedback, and privacy pages.
- Open `https://sankofa06.github.io/LMManagerProFeedback/feedback.html` and confirm the
  feedback page loads with the empty state (until issues exist).
- Open `…/privacy.html` and proofread.
- Create a test issue with a 👍 reaction in the repo, then reload — it
  should appear at the top under the default "Top (👍)" sort.
- On `feedback.html`, DevTools → Network: only one outbound request, to
  `api.github.com/repos/sankofa06/LMManagerProFeedback/issues`. No fonts,
  no analytics, no third-party scripts.

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
- "Submit Feedback" and per-issue title links open `github.com` in a new
  tab. Reactions and comments happen on GitHub with the user's own
  account — the static site never touches authentication or write APIs.

## Local preview

Open `index.html`, `feedback.html`, or `privacy.html` directly in a browser
(`file://` URLs work fine for the static pages and the feedback API call).
For a closer-to-production preview:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```
