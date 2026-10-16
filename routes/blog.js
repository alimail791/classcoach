// Blog: public pages at /blog and /blog/:slug, plus the admin editor at
// /admin/blog (same admin login as the rest of /admin).
const express = require('express');
const db = require('../lib/db');
const { requireAdminSession } = require('../lib/auth');
const { sanitizeHtml, slugify, excerptFrom, readingMinutes } = require('../lib/blogHtml');

const router = express.Router();
const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://www.classcoach.in';
const bigForm = express.urlencoded({ extended: true, limit: '2mb' });

const fmtDate = (iso) =>
  iso ? new Date(iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z')).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

function publishedPosts() {
  return db
    .prepare("SELECT * FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC")
    .all()
    .map((p) => ({ ...p, excerpt: p.meta_description || excerptFrom(p.body_html), date: fmtDate(p.published_at) }));
}

// ---------- Public ----------

router.get('/blog', (req, res) => {
  res.render('blog_index', {
    posts: publishedPosts(),
    indexable: true,
    canonicalUrl: `${SITE_ORIGIN}/blog`,
    title: 'Blog — Tips for Tutors and Coaching Teachers | ClassCoach',
    description:
      'Practical guides for tutors and coaching teachers: creating online tests, checking answers faster, tracking student progress and growing your classes.'
  });
});

router.get('/blog/:slug', (req, res, next) => {
  const post = db.prepare('SELECT * FROM blog_posts WHERE slug = ?').get(req.params.slug);
  const isAdmin = !!req.session.isAdminSession;
  if (!post || (post.status !== 'published' && !isAdmin)) return next();
  const related = publishedPosts().filter((p) => p.id !== post.id).slice(0, 3);
  res.render('blog_post', {
    post: { ...post, date: fmtDate(post.published_at), minutes: readingMinutes(post.body_html) },
    related,
    isDraftPreview: post.status !== 'published',
    indexable: post.status === 'published',
    canonicalUrl: `${SITE_ORIGIN}/blog/${post.slug}`,
    title: `${post.title} | ClassCoach`,
    description: post.meta_description || excerptFrom(post.body_html, 155),
    siteOrigin: SITE_ORIGIN
  });
});

// ---------- Admin ----------

router.get('/admin/blog', requireAdminSession, (req, res) => {
  const posts = db.prepare('SELECT id, slug, title, status, published_at, updated_at FROM blog_posts ORDER BY updated_at DESC').all();
  res.render('admin_blog', { posts: posts.map((p) => ({ ...p, date: fmtDate(p.published_at || p.updated_at) })), saved: req.query.saved || null, deleted: req.query.deleted || null });
});

router.get('/admin/blog/new', requireAdminSession, (req, res) => {
  res.render('admin_blog_edit', { post: null, error: null });
});

router.get('/admin/blog/:id/edit', requireAdminSession, (req, res) => {
  const post = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(req.params.id);
  if (!post) return res.redirect('/admin/blog');
  res.render('admin_blog_edit', { post, error: null });
});

function savePost(req, res) {
  const id = req.params.id ? Number(req.params.id) : null;
  const existing = id ? db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(id) : null;
  if (id && !existing) return res.redirect('/admin/blog');

  const title = String(req.body.title || '').trim().slice(0, 200);
  const slug = slugify(req.body.slug || title);
  const meta = String(req.body.meta_description || '').trim().slice(0, 300);
  const cover = String(req.body.cover_image_url || '').trim();
  const bodyHtml = sanitizeHtml(req.body.body_html || '');
  const publish = req.body.action === 'publish';
  const unpublish = req.body.action === 'unpublish';
  const draft = { ...(existing || {}), id, title, slug, meta_description: meta, cover_image_url: cover, body_html: bodyHtml };

  const fail = (error) => res.status(400).render('admin_blog_edit', { post: draft, error });
  if (!title) return fail('Add a title.');
  if (!bodyHtml.replace(/<[^>]+>/g, '').trim()) return fail('The post has no text yet.');
  if (cover && !/^https?:\/\//i.test(cover)) return fail('The cover image address must start with https://');
  const clash = db.prepare('SELECT id FROM blog_posts WHERE slug = ? AND id != ?').get(slug, id || 0);
  if (clash) return fail(`Another post already uses the address /blog/${slug}. Change the URL slug.`);

  let status = existing ? existing.status : 'draft';
  let publishedAt = existing ? existing.published_at : null;
  if (publish) { status = 'published'; publishedAt = publishedAt || new Date().toISOString(); }
  if (unpublish) status = 'draft';

  if (existing) {
    db.prepare(
      `UPDATE blog_posts SET title = ?, slug = ?, meta_description = ?, cover_image_url = ?, body_html = ?,
       status = ?, published_at = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(title, slug, meta, cover, bodyHtml, status, publishedAt, id);
  } else {
    db.prepare(
      `INSERT INTO blog_posts (title, slug, meta_description, cover_image_url, body_html, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(title, slug, meta, cover, bodyHtml, status, publishedAt);
  }
  const msg = publish ? 'published' : unpublish ? 'unpublished' : 'saved';
  res.redirect(`/admin/blog?saved=${encodeURIComponent(msg)}`);
}

router.post('/admin/blog', requireAdminSession, bigForm, savePost);
router.post('/admin/blog/:id', requireAdminSession, bigForm, savePost);

router.post('/admin/blog/:id/delete', requireAdminSession, (req, res) => {
  db.prepare('DELETE FROM blog_posts WHERE id = ?').run(req.params.id);
  res.redirect('/admin/blog?deleted=1');
});

router.publishedPosts = publishedPosts;
module.exports = router;
