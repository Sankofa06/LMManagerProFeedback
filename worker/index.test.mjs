import assert from "node:assert/strict";
import test from "node:test";
import worker, { buildGitHubIssue, validatePayload } from "./index.mjs";

const env = {
  GITHUB_TOKEN: "test-token",
  GITHUB_OWNER: "Sankofa06",
  GITHUB_REPO: "LMManagerProFeedback",
  DISABLE_RATE_LIMIT: "true",
};

test("valid payload builds a safe GitHub issue", () => {
  const issue = buildGitHubIssue({
    type: "bug",
    title: "Crash on launch",
    details: "Steps go here.",
    metadata: {
      source: "ios-app",
      appVersion: "1.2.3",
      ignored: "",
    },
  });

  assert.equal(issue.title, "[Bug Report] Crash on launch");
  assert.deepEqual(issue.labels, ["bug"]);
  assert.match(issue.body, /Submitted through the LM Manager Pro feedback form/);
  assert.match(issue.body, /Steps go here/);
  assert.match(issue.body, /App Version: 1.2.3/);
});

test("feature requests map to the existing enhancement label", () => {
  const issue = buildGitHubIssue({ type: "feature request", title: "Add teams", details: "" });

  assert.equal(issue.title, "[Feature Request] Add teams");
  assert.deepEqual(issue.labels, ["enhancement"]);
});

test("validation rejects missing titles", () => {
  assert.deepEqual(validatePayload({ type: "bug", title: " " }), {
    ok: false,
    message: "Add a short title.",
  });
});

test("validation rejects overlong details", () => {
  const result = validatePayload({
    type: "feature",
    title: "Reasonable",
    details: "x".repeat(8001),
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /8000/);
});

test("worker creates a GitHub issue for valid submissions", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.github.com/repos/Sankofa06/LMManagerProFeedback/issues");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    requestBody = JSON.parse(options.body);
    return Response.json({ number: 42, html_url: "https://github.com/example/issue/42" }, { status: 201 });
  };

  try {
    const response = await worker.fetch(new Request("https://worker.test/submit-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://sankofa06.github.io" },
      body: JSON.stringify({
        type: "feature",
        title: "Native feedback",
        details: "No account needed.",
      }),
    }), env);
    const data = await response.json();

    assert.equal(response.status, 201);
    assert.equal(data.number, 42);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://sankofa06.github.io");
    assert.equal(requestBody.title, "[Feature Request] Native feedback");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("worker rate limits repeat submissions from the same IP", async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  let didInstallCrypto = false;
  const store = new Map();

  if (!globalThis.crypto) {
    const { webcrypto } = await import("node:crypto");
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: webcrypto,
    });
    didInstallCrypto = true;
  }
  globalThis.caches = {
    default: {
      async match(request) {
        return store.get(request.url);
      },
      async put(request, response) {
        store.set(request.url, response);
      },
    },
  };
  globalThis.fetch = async () => Response.json({ number: 42 }, { status: 201 });

  try {
    const rateLimitedEnv = {
      ...env,
      DISABLE_RATE_LIMIT: "false",
      RATE_LIMIT_SECONDS: "30",
    };
    const first = await worker.fetch(new Request("https://worker.test/submit-feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "203.0.113.10",
      },
      body: JSON.stringify({ type: "feature", title: "First" }),
    }), rateLimitedEnv);
    const second = await worker.fetch(new Request("https://worker.test/submit-feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "203.0.113.10",
      },
      body: JSON.stringify({ type: "feature", title: "Second" }),
    }), rateLimitedEnv);

    assert.equal(first.status, 201);
    assert.equal(second.status, 429);
    assert.equal(second.headers.get("Retry-After"), "30");
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
    if (didInstallCrypto) {
      delete globalThis.crypto;
    }
  }
});

test("worker returns a safe error when GitHub creation fails", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  globalThis.fetch = async () => Response.json({ message: "Bad credentials" }, { status: 401 });
  console.error = () => {};

  try {
    const response = await worker.fetch(new Request("https://worker.test/submit-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "bug",
        title: "Relay failure",
      }),
    }), env);
    const data = await response.json();

    assert.equal(response.status, 502);
    assert.equal(data.message, "Feedback could not be submitted right now.");
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test("honeypot returns success without creating an issue", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("GitHub should not be called");
  };

  try {
    const response = await worker.fetch(new Request("https://worker.test/submit-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "bug",
        title: "Spam",
        website: "https://spam.example",
      }),
    }), env);
    const data = await response.json();

    assert.equal(response.status, 202);
    assert.equal(data.ok, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("missing GitHub token returns configuration error", async () => {
  const response = await worker.fetch(new Request("https://worker.test/submit-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "bug", title: "Missing token" }),
  }), { DISABLE_RATE_LIMIT: "true" });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.match(data.message, /not configured/);
});
