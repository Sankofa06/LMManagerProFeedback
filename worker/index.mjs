const DEFAULT_ALLOWED_ORIGINS = [
  "https://sankofa06.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];

const TYPE_CONFIG = {
  bug: { label: "bug", titlePrefix: "Bug Report" },
  feature: { label: "enhancement", titlePrefix: "Feature Request" },
  "feature request": { label: "enhancement", titlePrefix: "Feature Request" },
  improvement: { label: "enhancement", titlePrefix: "Improvement" },
};

const TITLE_MAX_LENGTH = 200;
const DETAILS_MAX_LENGTH = 8000;
const RATE_LIMIT_SECONDS = 60;

export default {
  async fetch(request, env = {}) {
    return handleRequest(request, env);
  },
};

export async function handleRequest(request, env = {}) {
  const cors = corsHeaders(request, env);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") {
    return json({ ok: true }, 200, cors);
  }

  if (url.pathname !== "/submit-feedback") {
    return json({ message: "Not found." }, 404, cors);
  }

  if (request.method !== "POST") {
    return json({ message: "Method not allowed." }, 405, {
      ...cors,
      Allow: "POST, OPTIONS",
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ message: "Send feedback as JSON." }, 400, cors);
  }

  const validation = validatePayload(payload);
  if (!validation.ok) {
    return json({ message: validation.message }, 400, cors);
  }

  if (isHoneypotTripped(payload)) {
    return json({ ok: true, message: "Feedback received." }, 202, cors);
  }

  const rateLimit = await checkRateLimit(request, env);
  if (!rateLimit.ok) {
    return json(
      { message: "Please wait a moment before sending more feedback." },
      429,
      { ...cors, "Retry-After": String(rateLimit.retryAfter) }
    );
  }

  if (!env.GITHUB_TOKEN) {
    return json({ message: "Feedback intake is not configured yet." }, 503, cors);
  }

  const owner = env.GITHUB_OWNER || "Sankofa06";
  const repo = env.GITHUB_REPO || "LMManagerProFeedback";
  const issue = buildGitHubIssue(payload);

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "lm-manager-pro-feedback-worker",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(issue),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("GitHub issue creation failed", response.status, data);
      return json({ message: "Feedback could not be submitted right now." }, 502, cors);
    }

    return json({
      ok: true,
      number: data.number,
      url: data.html_url,
      message: "Feedback submitted.",
    }, 201, cors);
  } catch (error) {
    console.error("Feedback relay failed", error);
    return json({ message: "Feedback could not be submitted right now." }, 502, cors);
  }
}

export function validatePayload(payload) {
  const title = clean(payload.title);
  const details = clean(payload.details || payload.body || "");
  const type = clean(payload.type || "feature").toLowerCase();

  if (!title) {
    return { ok: false, message: "Add a short title." };
  }
  if (title.length > TITLE_MAX_LENGTH) {
    return { ok: false, message: `Title must be ${TITLE_MAX_LENGTH} characters or fewer.` };
  }
  if (details.length > DETAILS_MAX_LENGTH) {
    return { ok: false, message: `Details must be ${DETAILS_MAX_LENGTH} characters or fewer.` };
  }
  if (!TYPE_CONFIG[type]) {
    return { ok: false, message: "Choose bug, feature, or improvement." };
  }

  return { ok: true };
}

export function buildGitHubIssue(payload) {
  const type = clean(payload.type || "feature").toLowerCase();
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.feature;
  const title = clean(payload.title);
  const details = clean(payload.details || payload.body || "");
  const metadata = payload.metadata && typeof payload.metadata === "object"
    ? payload.metadata
    : {};

  return {
    title: `[${config.titlePrefix}] ${title}`,
    body: buildIssueBody(details, type, metadata),
    labels: [config.label],
  };
}

function buildIssueBody(details, type, metadata) {
  const lines = [
    "Submitted through the LM Manager Pro feedback form.",
    "",
    "## Feedback",
    details || "_No additional details provided._",
    "",
    "## Context",
    `- Type: ${type}`,
  ];

  const safeMetadata = Object.entries(metadata)
    .filter(([key, value]) => key && typeof value === "string" && value.trim())
    .slice(0, 12);

  for (const [key, value] of safeMetadata) {
    lines.push(`- ${humanize(key)}: ${clean(value).slice(0, 240)}`);
  }

  return lines.join("\n");
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = allowedOrigins(env);
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (origin && allowed.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function allowedOrigins(env) {
  const configured = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
  return new Set(configured);
}

async function checkRateLimit(request, env) {
  if (env.DISABLE_RATE_LIMIT === "true") {
    return { ok: true };
  }

  const seconds = Number(env.RATE_LIMIT_SECONDS || RATE_LIMIT_SECONDS);
  if (!globalThis.caches || !globalThis.crypto?.subtle || seconds <= 0) {
    return { ok: true };
  }

  const ip = request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "unknown";
  const hash = await sha256(ip);
  const cacheKey = new Request(`https://lmmp-feedback-rate-limit.local/${hash}`);
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    return { ok: false, retryAfter: seconds };
  }

  await caches.default.put(
    cacheKey,
    new Response("1", {
      headers: {
        "Cache-Control": `public, max-age=${seconds}`,
      },
    })
  );

  return { ok: true };
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isHoneypotTripped(payload) {
  return clean(payload.website || payload.company || "").length > 0;
}

function clean(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim();
}

function humanize(key) {
  return String(key)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}
