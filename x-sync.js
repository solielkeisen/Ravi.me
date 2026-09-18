const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STATE_FILE = 'last-x-post.json';
const HANDLE = process.env.X_HANDLE || 'RaviRaj91HQ';
const RSS_URL = process.env.X_RSS_URL || '';
const API_TOKEN = process.env.X_API_TOKEN || '';

const DISPATCH_TEXT = process.env.X_POST_TEXT || '';
const DISPATCH_ID = process.env.X_POST_ID || '';
const DISPATCH_DATE = process.env.X_POST_DATE || '';
const DISPATCH_IMAGES = (process.env.X_POST_IMAGES || '').split(',').map((s) => s.trim()).filter(Boolean);

const log = (...a) => console.log('[x-sync]', ...a);
const err = (...a) => console.error('[x-sync]', ...a);

const decodeEntities = (s) =>
  String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const cleanText = (s) =>
  decodeEntities(String(s))
    .replace(/<!\[CDATA\[/g, '')
    .replace(/\]\]>/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ');

const slugify = (s) =>
  (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);

const titleFromText = (text) => {
  const t = cleanText(text).replace(/\s+/g, ' ').trim();
  const noUrls = t.replace(/https?:\/\/\S+/g, '').trim();
  const first = (noUrls.match(/^(.{1,70}?)[.!?](?:\s|$)/) || [])[1];
  const title = first ? first.trim() : noUrls.slice(0, 64).trim();
  return title || 'Post from X';
};

const loadState = () => {
  if (!fs.existsSync(STATE_FILE)) return { posts: {} };
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return { posts: {} };
  }
};

const saveState = (state) => {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
};

const extractTag = (xml, tag) => {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : '';
};

const parseRss = (xml) => {
  const posts = [];
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const item of items) {
    const guid = extractTag(item, 'guid') || extractTag(item, 'link');
    const idMatch = guid.match(/(\d+)\s*$/);
    if (!idMatch) continue;
    const title = cleanText(extractTag(item, 'title'));
    const desc = extractTag(item, 'description');
    const enclosure = (item.match(/<enclosure[^>]*url="([^"]+)"/) || [])[1];
    const media = [];
    const imgTags = desc.match(/<img[^>]*src="([^"]+)"/g) || [];
    for (const t of imgTags) media.push((t.match(/src="([^"]+)"/) || [])[1]);
    media.push(...(desc.match(/https?:\/\/\S+\.(?:jpg|jpeg|png|webp)\b/g) || []));
    if (enclosure) media.push(enclosure);
    const date = extractTag(item, 'pubDate');
    posts.push({
      id: idMatch[1],
      text: title || desc,
      date: date ? new Date(date).toISOString() : '',
      images: [...new Set(media)],
    });
  }
  return posts;
};

const apiGet = async (url) => {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${API_TOKEN}` } });
  if (!res.ok) throw new Error(`X API ${res.status}: ${url}`);
  return res.json();
};

const fetchFromApi = async () => {
  const me = await apiGet(`https://api.twitter.com/2/users/by/username/${HANDLE}`);
  const id = me?.data?.id;
  if (!id) throw new Error('X API: could not resolve user id');
  const j = await apiGet(
    `https://api.twitter.com/2/users/${id}/tweets?max_results=10&tweet.fields=created_at&expansions=attachments.media_keys&media.fields=url&media.fields=media_key,type,url`
  );
  const media = (j.includes && j.includes.media) || [];
  const byKey = {};
  for (const m of media) if (m.media_key) byKey[m.media_key] = m;
  const posts = [];
  for (const t of j.data || []) {
    const imgs = [];
    for (const key of (t.attachments && t.attachments.media_keys) || []) {
      const m = byKey[key];
      if (m && m.url) imgs.push(m.url);
    }
    posts.push({ id: t.id, text: t.text, date: t.created_at, images: imgs });
  }
  return posts.sort((a, b) => new Date(b.date) - new Date(a.date));
};

const fetchFromRss = async () => {
  const res = await fetch(RSS_URL, { headers: { 'user-agent': 'Mozilla/5.0 (x-sync)' } });
  if (!res.ok) throw new Error(`RSS ${res.status}: ${RSS_URL}`);
  const xml = await res.text();
  return parseRss(xml).sort((a, b) => new Date(b.date) - new Date(a.date));
};

const downloadImages = async (post) => {
  const saved = [];
  fs.mkdirSync('images', { recursive: true });
  for (let i = 0; i < post.images.length; i++) {
    const url = post.images[i];
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = (url.match(/\.(jpg|jpeg|png|webp)(\?|$)/i) || [])[1] || 'jpg';
      const file = `x-${post.id}-${i + 1}.${ext.toLowerCase()}`;
      fs.writeFileSync(path.join('images', file), buf);
      saved.push(file);
    } catch (e) {
      err('image download failed', url, e.message);
    }
  }
  return saved;
};

const publish = async (post) => {
  const title = titleFromText(post.text);
  const slug = slugify(title) || `x-post-${post.id}`;
  const date = (post.date || new Date().toISOString()).slice(0, 10);
  const file = `posts/${date}-${slug}.md`;
  const text = cleanText(post.text).trim();
  const description = text.replace(/\s+/g, ' ').slice(0, 140);

  if (fs.existsSync(file)) {
    log('already exists locally, skipping:', file);
    return;
  }

  const images = post.images.length ? await downloadImages(post) : [];
  const imgMd = images.map((f) => `\n\n![image ${f}](../../images/${f})`).join('');
  const body = `${text}${imgMd}\n`;

  const md = `---
title: ${JSON.stringify(title.replace(/"/g, "'"))}
date: "${date}"
description: ${JSON.stringify(description.replace(/"/g, "'"))}
---

# ${title}

${body.trim()}
`;

  fs.writeFileSync(file, md);
  log('created', file);

  execSync('node make', { stdio: 'inherit' });
  return { file, slug, date };
};

const main = async () => {
  let posts = [];

  if (DISPATCH_TEXT) {
    posts = [{
      id: DISPATCH_ID || `dispatch-${Date.now()}`,
      text: DISPATCH_TEXT,
      date: DISPATCH_DATE,
      images: DISPATCH_IMAGES,
    }];
  } else {
    if (!RSS_URL && !API_TOKEN) {
      throw new Error('Set X_RSS_URL (RSS feed) or X_API_TOKEN (X API)');
    }
    posts = API_TOKEN ? await fetchFromApi() : await fetchFromRss();
  }

  if (!posts.length) throw new Error('No post to sync');

  const state = loadState();
  const newest = posts[0];
  if (state.posts[newest.id]) {
    log('no new post; latest already synced:', newest.id);
    return;
  }

  const published = await publish(newest);
  if (!published) return;

  state.posts[newest.id] = { file: published.file, slug: published.slug, date: published.date };
  saveState(state);
  log('synced post', newest.id, '->', published.file);
};

main().catch((e) => {
  err(e.message);
  process.exit(1);
});