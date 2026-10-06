# Ravi Raj — Personal Portfolio and Blog

This repository contains the website renderer and static portfolio pages. Blog
content lives in [Ravi.me-content](https://github.com/solielkeisen/Ravi.me-content),
so posts and attachments can be uploaded without changing the website code.

## How updates work

The GitHub Actions workflow checks out the content repository's `main` branch,
then `make.js` generates the crawlable post pages and site indexes. A push to
this repository's `main` branch also triggers a build. Generated files are
committed back to `main` for GitHub Pages to publish.

The content repository's notification workflow dispatches a build here after
each content push. The website is then regenerated and published automatically.

## Publishing content

In `Ravi.me-content`:

- Add Markdown posts as `posts/<slug>.md`.
- Upload images and other files to `attachments/`.
- Link an attachment from a post using a path relative to `posts/`, for example
  `![Alt text](../attachments/photo.jpg)`.
- Commit changes to `main`; the website rebuild and GitHub Pages publish happen
  automatically.

Post front matter supports `title`, `date` (`YYYY-MM-DD`), `description`, and
an optional `slug`. If omitted, the slug is generated from the title.

## Local preview

Clone the public content repository into `content/` next to `make.js`, then run:

```bash
git clone https://github.com/solielkeisen/Ravi.me-content.git content
CONTENT_DIR=content node make.js
python3 -m http.server 8000
```

Open <http://localhost:8000/> to preview the homepage or
<http://localhost:8000/blog.html> to preview the post list. `marked.min.js` is
vendored, so no package installation is needed.
