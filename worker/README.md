# LM Manager Pro Feedback Worker

Small Cloudflare Worker that lets LM Manager Pro users submit public feedback
without a GitHub account. The Worker creates issues in
`Sankofa06/LMManagerProFeedback` with a GitHub token stored as a Worker secret.

## Deploy

1. Install and authenticate Wrangler:

```bash
npm install -g wrangler
wrangler login
```

2. Create a fine-grained GitHub token with **Issues: Read and write** access to
   `Sankofa06/LMManagerProFeedback`.

3. Save the token as a Worker secret:

```bash
cd worker
wrangler secret put GITHUB_TOKEN
```

4. Deploy:

```bash
wrangler deploy
```

5. Copy the deployed `workers.dev` URL into LM Manager Pro's
   `FeedbackConstants.submitEndpoint`.

## Local Tests

```bash
node --test worker/index.test.mjs
```
