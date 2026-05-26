# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

LM Manager Pro public website — landing page, feedback tracker, and privacy policy for the LM Manager Pro iOS app. Pure static pages with no build step, no dependencies, and no analytics. No-account feedback submission is relayed through the small Cloudflare Worker in `worker/`.

**Deployed URL:** `https://sankofa06.github.io/LMManagerProFeedback/`

## Stack

Pure HTML / CSS / vanilla JS. No frameworks, no npm, no bundler.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Product landing page |
| `feedback.html` | Browse and submit feedback (GitHub Issues integration) |
| `privacy.html` | Privacy Policy |

Assets live in `assets/` (styles.css, feedback.js, icon.svg, screenshots/).
The current screenshot set mirrors `../LMManagerPro/AppStore/MarketingScreenshots/iphone-6.9-dark/` and contains 10 App Store marketing screens: Onboarding, Machines, Models, Personas, Teams, Episodes, Chat, Compare, Image Studio, and Workspace.

## Local Preview

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

`file://` URLs also work for static pages, but the feedback page's GitHub API call may behave differently.

## How the Feedback Page Works

`assets/feedback.js` calls `GET https://api.github.com/repos/sankofa06/LMManagerProFeedback/issues?state=all&per_page=100` with no auth (60 req/hr per IP). Pull requests are filtered client-side. Sort options: Top (👍), Newest, Most-discussed. Search and label filters are client-side. Responses cached in `sessionStorage` for 5 minutes. "Submit Feedback" posts JSON to the endpoint configured by `meta[name="feedback-submit-endpoint"]` in `feedback.html`; the Worker creates GitHub issues with its secret token. Per-issue titles and reaction chips open GitHub for deeper discussion or native reactions.

## Deployment

Commit changes in the root of the **public** `sankofa06/LMManagerProFeedback` GitHub repo. GitHub Pages serves from `main` branch root. No CI/CD needed — push and it's live within ~1 minute.

Issue templates live in `.github/ISSUE_TEMPLATE/` (bug_report.yml, feature_request.yml, config.yml). `config.yml` disables blank issues.

## Constraints

- No external fonts, analytics scripts, or third-party JS on the public support pages
- Feedback reads go to GitHub's public Issues API; submissions go to the configured Cloudflare Worker
- Privacy-first: no user tracking of any kind
- Match the app's existing visual style when making design changes
