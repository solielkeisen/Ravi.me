const fs = require('fs');
const path = require('path');
const marked = require('./marked.min.js');

const CNAME = fs.existsSync('./CNAME') ? fs.readFileSync('./CNAME', 'utf-8').trim() : '';
const SITE_URL = (
  process.env.SITE_URL ||
  (CNAME ? `https://${CNAME}` : 'https://solielkeisen.github.io/Ravi.me')
).replace(/\/$/, '');
const SITE_TITLE = 'Ravi Raj';
const SITE_TAGLINE = 'Politics, Culture & Calculated Contradictions';
const SITE_DESCRIPTION = 'An assorted collection of thoughts on technology, business, and life.';
const BLOG_BYLINE = 'My unapologetic thoughts on Politics, Law, and Lies.';
const AUTHOR = 'Ravi Raj';
const POSTS_DIR = './posts';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parseFrontMatter = (content) => {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const meta = {};
  let body = content;

  if (match) {
    body = content.slice(match[0].length);
    match[1].split('\n').forEach((line) => {
      const parts = line.match(/^([\w-]+):\s*["']?(.*?)["']?\s*$/);
      if (parts) meta[parts[1]] = parts[2];
    });
  }

  return { meta, body };
};

const slugify = (s) =>
  (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatYear = (iso) => {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

const formatFullDate = (iso) => {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

/* Table of contents -------------------------------------------------- */

const TOC_MIN_ENTRIES = 2;
const TOC_MAX_DEPTH = 4;

const stripTags = (s) => String(s).replace(/<[^>]+>/g, '');

const NAMED_ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

// Single pass so an already-escaped entity is never decoded twice.
const decodeEntities = (s) =>
  String(s).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? match : named;
  });

const htmlToText = (s) => decodeEntities(stripTags(s)).trim();

// Unicode-aware so non-Latin headings (the Hindi ones) keep readable anchors.
// \p{M} keeps Devanagari vowel signs attached to their consonants; without it
// "दोगलापन" would shatter into "द-गल-पन".
const slugifyHeading = (s) =>
  (s || '')
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, '-')
    .replace(/(^-+|-+$)/g, '') || 'section';

// Walk the *rendered* HTML so the ids we inject and the ids we link to come
// from the same pass and can never drift apart. Fenced code is already escaped
// by marked, so a literal "<h2>" inside a code block can't match here.
const buildToc = (html) => {
  const seen = {};
  const entries = [];

  const out = html.replace(
    /<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/g,
    (match, level, attrs, inner) => {
      const text = htmlToText(inner);
      if (!text) return match;

      const base = slugifyHeading(text);
      seen[base] = (seen[base] || 0) + 1;
      const id = seen[base] > 1 ? `${base}-${seen[base]}` : base;

      entries.push({ id, text, depth: Number(level) });
      return `<h${level}${attrs || ''} id="${id}">${inner}</h${level}>`;
    }
  );

  return { html: out, entries };
};

const buildTocTree = (items) => {
  const root = [];
  const stack = [{ depth: 0, children: root }];

  for (const item of items) {
    while (stack.length > 1 && stack[stack.length - 1].depth >= item.depth) stack.pop();
    const node = { ...item, children: [] };
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  return root;
};

const renderTocList = (nodes) =>
  `<ul>${nodes
    .map(
      (node) =>
        `<li><a href="#${node.id}">${escapeHtml(node.text)}</a>${
          node.children.length ? renderTocList(node.children) : ''
        }</li>`
    )
    .join('')}</ul>`;

const renderToc = (entries) => {
  const items = entries.filter((e) => e.depth >= 2 && e.depth <= TOC_MAX_DEPTH);
  if (items.length < TOC_MIN_ENTRIES) return '';

  // Rendered outside the container: on wide screens it sits in the left margin
  // beside the article, on narrow screens it becomes a drawer behind a
  // hamburger button.
  return `
    <nav class="toc" id="toc" aria-labelledby="toc-heading">
        <div class="toc-header">
            <h2 class="toc-title" id="toc-heading">Contents</h2>
            <button type="button" class="toc-close" aria-label="Hide contents">&times;</button>
        </div>
        <div class="toc-list" id="toc-list">${renderTocList(buildTocTree(items))}</div>
    </nav>
    <button type="button" class="toc-fab" id="toc-fab" aria-label="Show contents" aria-expanded="false" aria-controls="toc">
        <span></span><span></span><span></span>
    </button>
    <div class="toc-scrim" id="toc-scrim" hidden></div>
`;
};

const shell = ({ cssPath, homePath, blogPath, imgPath, faviconPath, title, description, activeNav, canonical, jsonLd, tocBlock = '', script = '' }) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${canonical}">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${canonical}">
    ${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ''}
    <link rel="stylesheet" href="${cssPath}">
    <link rel="icon" type="image/jpeg" href="${faviconPath}">${script ? `
    <script src="${script}" defer></script>` : ''}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>${tocBlock ? `
    ${tocBlock.trim()}` : ''}
    <section class="container wrap">
        <div class="header">
            <div class="logo">
                <a href="${homePath}"><img src="${imgPath}" alt="Ravi Raj" class="photo"></a>
                <div>
                    <h1><a href="${homePath}">${SITE_TITLE}</a></h1>
                    <p class="tagline">${SITE_TAGLINE}</p>
                </div>
            </div>
            <nav class="nav">
                <a href="${homePath}" ${activeNav === 'home' ? 'class="active"' : ''}>Home</a>
                <a href="${blogPath}" ${activeNav === 'musings' ? 'class="active"' : ''}>Dualities</a>
            </nav>
        </div>
        <div class="content">
            {{BODY}}
        </div>
    </section>
    <footer class="footer">
        ${SITE_TITLE} © 2026
    </footer>
</body>
</html>
`;

const homeUrl = `${SITE_URL}/`;
const blogUrl = `${SITE_URL}/blog.html`;

const readPosts = () => {
  const posts = [];
  for (const file of fs.readdirSync(POSTS_DIR)) {
    if (!file.endsWith('.md')) continue;
    const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8');
    const { meta, body } = parseFrontMatter(content);
    const slug = slugify(meta.slug || meta.title || file.replace(/\.md$/, ''));
    posts.push({
      slug,
      title: meta.title || slug,
      date: meta.date || fs.statSync(path.join(POSTS_DIR, file)).mtime.toISOString().slice(0, 10),
      description: meta.description || '',
      body,
    });
  }
  return posts.sort((a, b) => new Date(b.date) - new Date(a.date));
};

const articleJsonLd = (post) =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description || SITE_DESCRIPTION,
    author: { '@type': 'Person', name: AUTHOR, url: homeUrl },
    publisher: { '@type': 'Person', name: AUTHOR, url: homeUrl },
    datePublished: post.date,
    dateModified: post.date,
    mainEntityOfPage: `${SITE_URL}/post/${post.slug}/`,
  });

const renderListing = (posts) => {
  const items = posts
    .map((post) => {
      const d = new Date(post.date);
      return `
            <div class="post">
                <div class="date">
                    <span class="day">${d.getDate()}</span>
                    <span class="year">${formatYear(post.date)}</span>
                </div>
                <div class="body">
                    <h4 class="title"><a href="post/${post.slug}/">${escapeHtml(post.title)}</a></h4>
                    ${post.description ? `<div class="description">${escapeHtml(post.description)}</div>` : ''}
                </div>
            </div>`;
    })
    .join('\n');

  return shell({
    cssPath: 'css/style.css',
    homePath: 'index.html',
    blogPath: 'blog.html',
    imgPath: 'images/ravi.jpeg',
    faviconPath: 'images/favicon.jpeg',
    title: `Dualities - ${SITE_TITLE}`,
    description: SITE_DESCRIPTION,
    activeNav: 'musings',
    canonical: blogUrl,
    jsonLd: '',
  }).replace(
    '{{BODY}}',
    `
            <section class="page">
                <h3 class="title kind-section">Dualities</h3>
                <p>${BLOG_BYLINE}</p>
                <div class="posts">${items}
                </div>
            </section>
    `
  );
};

const renderPost = (post) => {
  const url = `${SITE_URL}/post/${post.slug}/`;
  const { html, entries } = buildToc(marked.parse(post.body.replace(/^# .+\n+/, '')));
  const toc = renderToc(entries);

  const body = `
            <article class="post">
                <div class="post-header">
                    <h1 class="title">${escapeHtml(post.title)}</h1>
                    <div class="meta"><span class="date">${formatFullDate(post.date)}</span></div>
                </div>
                <div class="body">${html}</div>
            </article>
    `;

  return shell({
    cssPath: '../../css/style.css',
    homePath: '../../index.html',
    blogPath: '../../blog.html',
    imgPath: '../../images/ravi.jpeg',
    faviconPath: '../../images/favicon.jpeg',
    // Only ship the script when there is actually a contents panel to drive.
    script: toc ? '../../js/toc.js' : '',
    title: `${post.title} - ${SITE_TITLE}`,
    description: escapeHtml(post.description || post.title),
    activeNav: 'musings',
    canonical: url,
    jsonLd: articleJsonLd(post),
    tocBlock: toc,
  }).replace('{{BODY}}', body);
};

const renderSitemap = (posts) => {
  const urls = [
    { loc: homeUrl, lastmod: posts[0] ? posts[0].date : '' },
    { loc: blogUrl, lastmod: posts[0] ? posts[0].date : '' },
    ...posts.map((p) => ({ loc: `${SITE_URL}/post/${p.slug}/`, lastmod: p.date })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}\n  </url>`).join('\n')}
</urlset>
`;
};

const renderLlms = (posts) => `# ${SITE_TITLE}

> ${SITE_TAGLINE}

## About

Personal homepage of ${SITE_TITLE}. "Dualities" — ${BLOG_BYLINE}

## Posts

${posts.map((p) => `- [${p.title}](${SITE_URL}/post/${p.slug}/)${p.description ? `: ${p.description}` : ''}`).join('\n')}
`;

const main = () => {
  const posts = readPosts();

  const listing = renderListing(posts);
  const sitemap = renderSitemap(posts);
  const llms = renderLlms(posts);

  const postsJson = posts.reduce((acc, p) => {
    acc[p.slug] = {
      title: p.title,
      date: p.date,
      description: p.description,
      url: `${SITE_URL}/post/${p.slug}/`,
      size: p.body.length,
      content: p.body,
    };
    return acc;
  }, {});

  fs.writeFileSync('blog.html', listing);
  fs.writeFileSync('sitemap.xml', sitemap);
  fs.writeFileSync('llms.txt', llms);
  fs.writeFileSync('posts.json', JSON.stringify(postsJson));

  fs.rmSync('./post', { recursive: true, force: true });
  fs.mkdirSync('./post', { recursive: true });
  for (const post of posts) {
    fs.mkdirSync(`./post/${post.slug}`, { recursive: true });
    fs.writeFileSync(`./post/${post.slug}/index.html`, renderPost(post));
  }

  console.log(`Generated static site (${SITE_URL}): ${posts.length} posts -> blog.html, sitemap.xml, llms.txt, posts.json`);
};

main();