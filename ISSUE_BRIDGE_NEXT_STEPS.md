# Issue Bridge Next Steps

The issue bridge workflows are committed in both repos. Complete these GitHub
settings steps to turn the bridge on.

## 1. Create the token

Create a fine-grained GitHub personal access token named something like
`LM Manager Pro Issue Bridge`.

Required repository access:

- `Sankofa06/LMManagerPro`
- `Sankofa06/LMManagerProFeedback`

Required permissions:

- Issues: Read and write
- Metadata: Read

## 2. Add the secret in both repos

Add the same token as a repository secret named `ISSUE_MIRROR_TOKEN` in:

- `Sankofa06/LMManagerPro`
- `Sankofa06/LMManagerProFeedback`

GitHub path:

`Settings -> Secrets and variables -> Actions -> New repository secret`

## 3. Create the bridge labels

In `Sankofa06/LMManagerProFeedback`, run the manual workflow:

`Actions -> Setup issue bridge labels -> Run workflow`

That creates the required bridge labels in both repos.

## 4. Use the bridge

Private to public:

- In `Sankofa06/LMManagerPro`, add `public-feedback` to a private issue.
- Add public-safe text between:

```md
<!-- public-summary:start -->
Public-safe summary goes here.
<!-- public-summary:end -->
```

Public to private:

- In `Sankofa06/LMManagerProFeedback`, add `triage-private` to a public issue.
- The workflow copies it into the private tracker and leaves a neutral public
  comment.

## 5. Smoke test

- Create one private test issue with `public-feedback` and a public summary.
- Confirm a public mirror appears in `LMManagerProFeedback`.
- Create one public test issue and label it `triage-private`.
- Confirm a private issue appears in `LMManagerPro`.
- Delete or close the test issues after verification.
