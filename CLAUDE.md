# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

LM Manager Pro public website — landing page, feedback tracker, and privacy policy for the LM Manager Pro iOS app. Pure static site; no build step, no dependencies, no backend, no analytics.

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

## Local Preview

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

`file://` URLs also work for static pages, but the feedback page's GitHub API call may behave differently.

## How the Feedback Page Works

`assets/feedback.js` calls `GET https://api.github.com/repos/sankofa06/LMManagerProFeedback/issues?state=all&per_page=100` with no auth (60 req/hr per IP). Pull requests are filtered client-side. Sort options: Top (👍), Newest, Most-discussed. Search and label filters are client-side. Responses cached in `sessionStorage` for 5 minutes. "Submit Feedback" opens GitHub in a new tab — this site never touches the GitHub write API.

## Deployment

Copy the repo contents into the root of the **public** `sankofa06/LMManagerProFeedback` GitHub repo and commit. GitHub Pages serves from `main` branch root. No CI/CD needed — push and it's live within ~1 minute.

Issue templates live in `.github/ISSUE_TEMPLATE/` (bug_report.yml, feature_request.yml, config.yml). `config.yml` disables blank issues.

## Constraints

- No external fonts, analytics scripts, or third-party JS — one outbound request only (GitHub API)
- Privacy-first: no user tracking of any kind
- Match the app's existing visual style when making design changes
