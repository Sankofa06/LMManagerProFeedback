# Repository Guidelines

## Project Structure & Module Organization
This repository contains two static web surfaces with no build step. Root files `index.html`, `privacy.html`, and `assets/` power the public GitHub Pages feedback/privacy site. The browser app lives in `web/`, with markup in `web/index.html`, styles in `web/css/`, and ordered global scripts in `web/js/`.

Keep related changes together:
- Feedback site UI: `assets/styles.css`, `assets/feedback.js`
- Web app styling: `web/css/*.css`
- Web app behavior: `web/js/*.js`

`web/js/init.js` bootstraps the app and must stay last in `web/index.html`.

## Build, Test, and Development Commands
There is no package manager, bundler, or compile step.

```bash
python3 -m http.server 8000
```

Run from the repo root to preview the public site at `http://localhost:8000/`, or from `web/` to preview the web app at `http://localhost:8000/`.

You can also open `index.html`, `privacy.html`, or `web/index.html` directly with `file://` for quick checks.

## Coding Style & Naming Conventions
Match the existing plain HTML/CSS/vanilla JS style:
- Use 2-space indentation in HTML and CSS.
- Follow existing JS formatting: semicolons, compact helpers, and `const`/`let`.
- Use `camelCase` for functions and variables (`checkAllMachines`, `renderLiveStatus`).
- Keep filenames lowercase with hyphens for multiword modules such as `status-discovery.js`.

Avoid introducing modules or frameworks unless the repo is being intentionally restructured; current scripts share the global scope and depend on load order.

## Testing Guidelines
No automated test suite is checked in. Validate changes with targeted manual smoke tests:
- Public site: load `index.html` and `privacy.html`, confirm GitHub issue fetches and links work.
- Web app: serve `web/`, exercise machine checks, roster/team edits, and localStorage-backed flows.

For regressions, verify both desktop and narrow mobile layouts.

## Commit & Pull Request Guidelines
Recent history uses short imperative subjects such as `Remove GitHub login requirement...` and `Replace icon...`. Keep commits focused and descriptive.

PRs should include:
- A brief summary of user-visible changes
- Linked issue or rationale
- Screenshots for UI updates
- Manual verification notes (`root site`, `web app`, mobile if applicable)

## Security & Configuration Tips
Do not commit secrets. This repo is intentionally static; external calls should remain limited to GitHub APIs for feedback and user-configured LM Studio or provider endpoints in `web/`.
