(function () {
  'use strict';

  const GH_OWNER = 'sankofa06';
  const GH_REPO = 'LMManagerProFeedback';
  const CACHE_KEY = 'lmmp-feedback-cache-v1';
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  const REACTION_EMOJI = {
    '+1': '👍',
    '-1': '👎',
    'laugh': '😄',
    'hooray': '🎉',
    'confused': '😕',
    'heart': '❤️',
    'rocket': '🚀',
    'eyes': '👀',
  };

  let allIssues = [];

  async function loadIssues() {
    const state = document.getElementById('state-filter').value || 'open';
    const cacheKey = `${CACHE_KEY}-${state}`;

    // Try cache
    const cached = readCache(cacheKey);
    if (cached) {
      allIssues = cached;
      populateLabelOptions();
      render();
      return;
    }

    setBanner('Loading feedback…', 'info');

    try {
      const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/issues?state=${state}&per_page=100&sort=created&direction=desc`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/vnd.github+json' },
      });
      if (!resp.ok) throw new Error(`GitHub API error: ${resp.status}`);
      const data = await resp.json();
      allIssues = data.filter(i => !i.pull_request);
      writeCache(cacheKey, allIssues);
      clearBanner();
      populateLabelOptions();
      render();
    } catch (err) {
      setBanner(`Failed to load feedback: ${escapeHTML(err.message)}`, 'error');
    }
  }

  function populateLabelOptions() {
    const sel = document.getElementById('label-filter');
    const cur = sel.value;
    const labels = new Map();
    allIssues.forEach(issue => {
      (issue.labels || []).forEach(l => labels.set(l.name, l.color));
    });
    // Remove old options except first
    while (sel.options.length > 1) sel.remove(1);
    labels.forEach((color, name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
  }

  function render() {
    const q = (document.getElementById('search').value || '').toLowerCase().trim();
    const sort = document.getElementById('sort').value;
    const labelFilter = document.getElementById('label-filter').value;

    let issues = allIssues.filter(issue => {
      if (labelFilter && !issue.labels.some(l => l.name === labelFilter)) return false;
      if (!q) return true;
      return (
        (issue.title || '').toLowerCase().includes(q) ||
        (issue.body || '').toLowerCase().includes(q)
      );
    });

    if (sort === 'oldest') issues = issues.slice().reverse();
    else if (sort === 'reactions') issues = issues.slice().sort((a, b) => (b.reactions?.total_count || 0) - (a.reactions?.total_count || 0));
    else if (sort === 'comments') issues = issues.slice().sort((a, b) => (b.comments || 0) - (a.comments || 0));

    const list = document.getElementById('issue-list');
    if (issues.length === 0) {
      list.innerHTML = '<li class="empty-state">No feedback found.</li>';
      return;
    }
    list.innerHTML = issues.map(renderCard).join('');
  }

  function renderCard(issue) {
    const labels = (issue.labels || []).map(l =>
      `<span class="label-chip" style="background:#${escapeAttr(l.color)}22;border-color:#${escapeAttr(l.color)}66;color:#${escapeAttr(l.color)}">${escapeHTML(l.name)}</span>`
    ).join('');

    const reactions = issue.reactions
      ? Object.entries(REACTION_EMOJI)
          .filter(([key]) => issue.reactions[key] > 0)
          .map(([key, emoji]) => `<span class="reaction" title="${escapeAttr(key)}">${emoji} ${issue.reactions[key]}</span>`)
          .join('')
      : '';

    return `<li class="issue-card">
      <div class="issue-card-header">
        <a href="${escapeAttr(issue.html_url)}" target="_blank" rel="noopener" class="issue-title">${escapeHTML(issue.title)}</a>
        <span class="issue-number">#${issue.number}</span>
      </div>
      ${labels ? `<div class="issue-labels">${labels}</div>` : ''}
      <div class="issue-meta">
        <span class="issue-state ${issue.state}">${issue.state}</span>
        <span class="issue-date">${relativeTime(issue.created_at)}</span>
        ${issue.comments > 0 ? `<span class="issue-comments">💬 ${issue.comments}</span>` : ''}
      </div>
      ${reactions ? `<div class="issue-reactions">${reactions}</div>` : ''}
    </li>`;
  }

  // Helpers
  function setBanner(msg, type) {
    const el = document.getElementById('status-banner');
    el.textContent = msg;
    el.className = 'status-banner ' + (type || 'info');
    el.hidden = false;
  }

  function clearBanner() {
    const el = document.getElementById('status-banner');
    el.hidden = true;
  }

  function readCache(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL_MS) return null;
      return data;
    } catch { return null; }
  }

  function writeCache(key, data) {
    try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
  }

  function escapeHTML(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function escapeAttr(str) {
    return String(str || '').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function relativeTime(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    const mo = Math.floor(d / 30);
    if (mo < 12) return `${mo}mo ago`;
    return `${Math.floor(mo/12)}y ago`;
  }

  // Expose for inline handlers
  window.render = render;
  window.loadIssues = loadIssues;

  // Init
  loadIssues();
})();
