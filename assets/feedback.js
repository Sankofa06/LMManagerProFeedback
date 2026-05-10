(function () {
  "use strict";

  const GH_OWNER = "sankofa06";
  const GH_REPO = "LMManagerProFeedback";
  // Fine-grained PAT with Issues: Read+Write on this repo only.
  // WARNING: this token is visible in page source — use a repo-scoped token.
  const GH_API_TOKEN = "YOUR_GITHUB_PAT_HERE";
  const NEW_ISSUE_URL = `https://github.com/${GH_OWNER}/${GH_REPO}/issues/new/choose`;
  const REPO_URL = `https://github.com/${GH_OWNER}/${GH_REPO}`;
  const CACHE_KEY = `lmmp-feedback-cache-v1`;
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const UPVOTES_KEY = `lmmp-upvoted-v1`;

  const REACTION_EMOJI = {
    "+1": "👍",
    "-1": "👎",
    laugh: "😄",
    hooray: "🎉",
    confused: "😕",
    heart: "❤️",
    rocket: "🚀",
    eyes: "👀",
  };

  const els = {
    list: document.getElementById("issue-list"),
    banner: document.getElementById("status-banner"),
    sort: document.getElementById("sort-select"),
    label: document.getElementById("label-select"),
    state: document.getElementById("state-select"),
    search: document.getElementById("search-input"),
    submit: document.getElementById("submit-btn"),
    repoLink: document.getElementById("repo-link"),
    modal: document.getElementById("submit-modal"),
    form: document.getElementById("submit-form"),
    issueType: document.getElementById("issue-type"),
    issueTitle: document.getElementById("issue-title"),
    issueBody: document.getElementById("issue-body"),
    modalCancel: document.getElementById("modal-cancel"),
    modalSubmitBtn: document.getElementById("modal-submit"),
    modalError: document.getElementById("modal-error"),
    summaryVisible: document.getElementById("summary-visible"),
    summaryOpen: document.getElementById("summary-open"),
    summaryClosed: document.getElementById("summary-closed"),
    summaryLabels: document.getElementById("summary-labels"),
    summaryState: document.getElementById("summary-state"),
    resultsCopy: document.getElementById("results-copy"),
  };

  let allIssues = [];

  function ghHeaders() {
    const h = { Accept: "application/vnd.github+json" };
    if (GH_API_TOKEN && GH_API_TOKEN !== "YOUR_GITHUB_PAT_HERE") {
      h["Authorization"] = `Bearer ${GH_API_TOKEN}`;
    }
    return h;
  }

  function readUpvoted() {
    try {
      const raw = localStorage.getItem(UPVOTES_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  }

  function saveUpvoted(set) {
    try {
      localStorage.setItem(UPVOTES_KEY, JSON.stringify([...set]));
    } catch { /* quota */ }
  }

  if (els.repoLink) els.repoLink.href = REPO_URL;

  els.submit.addEventListener("click", openSubmitModal);
  els.modalCancel.addEventListener("click", closeModal);
  els.modal.addEventListener("click", (e) => { if (e.target === els.modal) closeModal(); });
  els.form.addEventListener("submit", handleSubmit);

  loadIssues();
  ["sort", "label", "state", "search"].forEach((k) => {
    els[k].addEventListener("input", render);
    els[k].addEventListener("change", render);
  });

  async function loadIssues() {
    const cached = readCache();
    if (cached) {
      allIssues = cached;
      populateLabelOptions();
      render();
      setBanner("Showing cached results. Refreshing…");
    } else {
      setBanner("Loading feedback…");
    }

    try {
      const res = await fetch(
        `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/issues?state=all&per_page=100`,
        { headers: ghHeaders() }
      );

      if (res.status === 403) {
        if (cached) {
          setBanner("Rate limit reached. Showing cached results.", true);
          return;
        }
        throw new Error("API rate limit reached. Please try again in a few minutes.");
      }
      if (res.status === 404) {
        throw new Error(`Repository ${GH_OWNER}/${GH_REPO} not found or private.`);
      }
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();
      allIssues = data.filter((i) => !i.pull_request);
      writeCache(allIssues);
      populateLabelOptions();
      render();
      clearBanner();
    } catch (err) {
      if (allIssues.length === 0) {
        setBanner(err.message || "Failed to load issues.", true);
      } else {
        setBanner(`Couldn't refresh: ${err.message}. Showing previously loaded results.`, true);
      }
    }
  }

  function populateLabelOptions() {
    const labels = new Set();
    allIssues.forEach((i) => i.labels.forEach((l) => labels.add(l.name)));
    const current = els.label.value;
    els.label.innerHTML =
      `<option value="">All labels</option>` +
      [...labels].sort().map((l) => `<option value="${escapeAttr(l)}">${escapeHTML(l)}</option>`).join("");
    if ([...labels].includes(current)) els.label.value = current;
  }

  function render() {
    const sort = els.sort.value;
    const labelFilter = els.label.value;
    const stateFilter = els.state.value;
    const q = els.search.value.trim().toLowerCase();

    let filtered = allIssues.filter((i) => {
      if (stateFilter !== "all" && i.state !== stateFilter) return false;
      if (labelFilter && !i.labels.some((l) => l.name === labelFilter)) return false;
      if (q) {
        const hay = (i.title + " " + (i.body || "")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    updateSummary(filtered, labelFilter, stateFilter, q);

    filtered.sort((a, b) => {
      switch (sort) {
        case "newest":
          return new Date(b.created_at) - new Date(a.created_at);
        case "comments":
          return b.comments - a.comments;
        case "top":
        default: {
          const ua = (a.reactions && a.reactions["+1"]) || 0;
          const ub = (b.reactions && b.reactions["+1"]) || 0;
          if (ub !== ua) return ub - ua;
          return new Date(b.created_at) - new Date(a.created_at);
        }
      }
    });

    if (filtered.length === 0) {
      els.list.innerHTML = "";
      els.list.insertAdjacentHTML(
        "beforeend",
        `<li class="empty-state" style="grid-column: 1 / -1;">
          <h2>No matching feedback</h2>
          <p>Try a different filter, or open a new request if this hasn't been reported yet.</p>
          <p><button class="btn primary" onclick="document.getElementById('submit-btn').click()">Submit Feedback</button></p>
        </li>`
      );
      return;
    }

    els.list.innerHTML = filtered.map(renderCard).join("");
  }

  function renderCard(issue) {
    const upvoted = readUpvoted();
    const hasVoted = upvoted.has(issue.number);
    const upvotes = (issue.reactions && issue.reactions["+1"]) || 0;

    const labelChips = issue.labels
      .map((l) => `<span class="label-chip">${escapeHTML(l.name)}</span>`)
      .join("");

    const reactionStrip = Object.entries(REACTION_EMOJI)
      .filter(([k]) => k !== "+1" && issue.reactions && issue.reactions[k] > 0)
      .map(([k, emoji]) => `<span class="reaction" title="${k}">${emoji} ${issue.reactions[k]}</span>`)
      .join("");

    const excerpt = (issue.body || "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/[#*_`>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);

    const stateBadge = issue.state === "closed"
      ? `<span class="issue-state closed" title="Closed">Closed</span>`
      : `<span class="issue-state" title="Open">Open</span>`;

    const commentsLabel = issue.comments === 1 ? "1 comment" : `${issue.comments} comments`;
    const excerptSuffix = excerpt.length >= 220 ? "…" : "";

    return `
      <li class="issue-card">
        <div class="issue-topline">
          <div>
            <div class="issue-number">Issue #${issue.number}</div>
            <a class="issue-link" href="${issue.html_url}" target="_blank" rel="noopener">
              ${escapeHTML(issue.title)}
            </a>
          </div>
          ${stateBadge}
        </div>
        <div class="issue-meta">
          <span>Opened ${relativeTime(issue.created_at)}</span>
          <span>by ${escapeHTML(issue.user.login)}</span>
          <span>${commentsLabel}</span>
        </div>
        ${excerpt ? `<p class="issue-body">${escapeHTML(excerpt)}${excerptSuffix}</p>` : ""}
        <div class="label-row">
          ${labelChips || `<span class="label-chip">unlabeled</span>`}
        </div>
        <div class="reaction-row">
          <button
            class="upvote-btn${hasVoted ? " voted" : ""}"
            onclick="window.__lmmpUpvote(${issue.number})"
            title="${hasVoted ? "You upvoted this" : "Upvote"}"
            ${hasVoted ? 'aria-pressed="true"' : 'aria-pressed="false"'}
          >👍 ${upvotes}</button>
          <div class="reaction-tray">${reactionStrip}</div>
        </div>
      </li>`;
  }

  function updateSummary(filtered, labelFilter, stateFilter, q) {
    const openCount = filtered.filter((issue) => issue.state === "open").length;
    const closedCount = filtered.filter((issue) => issue.state === "closed").length;
    const visibleLabels = new Set();
    filtered.forEach((issue) => issue.labels.forEach((label) => visibleLabels.add(label.name)));

    if (els.summaryVisible) els.summaryVisible.textContent = String(filtered.length);
    if (els.summaryOpen) els.summaryOpen.textContent = String(openCount);
    if (els.summaryClosed) els.summaryClosed.textContent = String(closedCount);
    if (els.summaryLabels) els.summaryLabels.textContent = String(visibleLabels.size);

    const scope = [
      stateFilter === "all" ? "all states" : stateFilter,
      labelFilter ? `label: ${labelFilter}` : "",
      q ? `search: “${q}”` : "",
    ].filter(Boolean).join(" · ");

    if (els.summaryState) {
      els.summaryState.textContent = scope || "Showing the full feedback queue";
    }

    if (els.resultsCopy) {
      els.resultsCopy.textContent = filtered.length
        ? `${filtered.length} issue${filtered.length === 1 ? "" : "s"} visible${scope ? ` for ${scope}` : ""}.`
        : `No issues match the current filters${scope ? ` (${scope})` : ""}.`;
    }
  }

  window.__lmmpUpvote = async function (issueNumber) {
    const upvoted = readUpvoted();
    if (upvoted.has(issueNumber)) return;

    const btn = els.list.querySelector(`button[onclick="window.__lmmpUpvote(${issueNumber})"]`);
    if (btn) btn.disabled = true;

    try {
      const res = await fetch(
        `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/issues/${issueNumber}/reactions`,
        {
          method: "POST",
          headers: { ...ghHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ content: "+1" }),
        }
      );
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      upvoted.add(issueNumber);
      saveUpvoted(upvoted);

      const issue = allIssues.find((i) => i.number === issueNumber);
      if (issue) {
        issue.reactions = issue.reactions || {};
        issue.reactions["+1"] = (issue.reactions["+1"] || 0) + 1;
        writeCache(allIssues);
      }
      render();
    } catch (err) {
      if (btn) btn.disabled = false;
      setBanner(`Couldn't upvote: ${err.message}`, true);
      setTimeout(clearBanner, 4000);
    }
  };

  function openSubmitModal() {
    els.form.reset();
    els.modalError.hidden = true;
    els.modalSubmitBtn.disabled = false;
    els.modal.showModal();
    els.issueTitle.focus();
  }

  function closeModal() {
    els.modal.close();
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const title = els.issueTitle.value.trim();
    const body = els.issueBody.value.trim();
    const labelName = els.issueType.value;

    if (!title) return;

    els.modalSubmitBtn.disabled = true;
    els.modalSubmitBtn.textContent = "Submitting…";
    els.modalError.hidden = true;

    try {
      const res = await fetch(
        `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/issues`,
        {
          method: "POST",
          headers: { ...ghHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ title, body: body || undefined, labels: [labelName] }),
        }
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `API error: ${res.status}`);
      }

      closeModal();
      sessionStorage.removeItem(CACHE_KEY);
      setBanner("Feedback submitted! Refreshing list…");
      await loadIssues();
    } catch (err) {
      els.modalError.textContent = `Failed to submit: ${err.message}`;
      els.modalError.hidden = false;
      els.modalSubmitBtn.disabled = false;
      els.modalSubmitBtn.textContent = "Submit";
    }
  }

  /* ---------- helpers ---------- */
  function setBanner(text, isError) {
    els.banner.textContent = text;
    els.banner.hidden = false;
    els.banner.classList.toggle("error", !!isError);
  }
  function clearBanner() {
    els.banner.hidden = true;
    els.banner.textContent = "";
    els.banner.classList.remove("error");
  }
  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL_MS) return null;
      return data;
    } catch { return null; }
  }
  function writeCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch { /* quota exceeded */ }
  }
  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function escapeAttr(s) { return escapeHTML(s); }
  function relativeTime(iso) {
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    const mo = Math.floor(d / 30);
    if (mo < 12) return `${mo}mo ago`;
    const y = Math.floor(d / 365);
    return `${y}y ago`;
  }
})();
