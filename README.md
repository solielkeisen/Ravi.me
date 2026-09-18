# Ravi Raj — Personal Blog

This is my simple and low-effort personal portfolio+Blog website.

## How it works

Posts are written in Markdown (`posts/*.md`) and rendered into static HTML pages by `make.js` — which runs automatically on every push via the GitHub Action, so you never have to build locally.

Each push generates:

- `post/<slug>/index.html` — one crawlable page per post, with meta tags, canonical URL, and JSON-LD Article schema
- `blog.html` — the musings listing
- `sitemap.xml`, `llms.txt`, `posts.json`
- `index.html` — homepage with JSON-LD Person schema

## Adding a post

1. Create `posts/<slug>.md`:

```markdown
---
title: "My Post"
date: "2026-09-01"
description: "One-line excerpt"
slug: "my-post"   # optional; defaults to a slug derived from the title
---

Your markdown content here.
```

2. Commit and push. Nothing else needed — the GitHub Action regenerates the static site, and GitHub Pages redeploys.

Optionally build locally to preview: `node make` (requires the vendored `marked.min.js`, no extra packages).

## Auto-sync from X (@RaviRaj91HQ)

The `.github/workflows/x-sync.yml` workflow turns the latest post from X into a blog post.

Two ways it gets triggered:

1. **Webhook (recommended, near-real-time).** IFTTT (or Make.com) watches for a new tweet by `@RaviRaj91HQ` and calls GitHub's `repository_dispatch` endpoint, which fires the workflow within minutes. Workflow reads the tweet text from the payload and publishes it.
2. **Hourly poll.** As a fallback the workflow also runs hourly and tries an RSS feed of the account. Public RSSHub instances no longer serve X reliably, so treat this as best-effort — the webhook is the primary path.

Dedup: `last-x-post.json` records every synced tweet ID, so a tweet is never published twice.

### One-time setup for the webhook path

1. Create a **fine-grained personal access token** in GitHub → Settings → Developer settings → Fine-grained tokens. Select repository `Ravi.me` with **Contents: Read and write** permission. Copy the token (it starts with `github_pat_`).
2. In IFTTT, create an applet: **If "New tweet by a specific user"** (set `RaviRaj91HQ`) → **Then Webhooks "Make a web request"**:
   - URL: `https://api.github.com/repos/pacifista91/Ravi.me/dispatches`
   - Method: `POST`
   - Content-Type: `application/json`
   - Extra/bearer header: `Authorization: Bearer <your_token>` (or `token <your_token>`)
   - Body:
     ```json
     {
       "event_type": "x-post",
       "client_payload": {
         "id": "{{LinkToTweet}}",
         "text": "{{Text}}",
         "date": "{{CreatedAt}}"
       }
     }
     ```
3. Turn the applet on. The action fires within ~1 hour on IFTTT's free tier (5 min on Pro), then publishes to the blog.

Note: IFTTT's X trigger/webhooks may require a IFTTT Pro plan; if IFTTT blocks it, the same webhook call can be made from Make.com's free tier (1,000 ops/month) with the identical request.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000/blog.html
```
