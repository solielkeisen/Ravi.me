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

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000/blog.html
```
