const express = require('express');
const bcrypt = require('bcryptjs');
const { db, getSetting, setSetting, count } = require('../db/init');
const { requireAdmin } = require('../middleware/auth');
const { listCategories, getQuestionById, stats, decorate, seo } = require('../lib/content');

const router = express.Router();

// ---------------------------------------------------------------- login
router.get('/login', (req, res) => {
  if (req.session && req.session.admin) return res.redirect('/admin');
  res.render('admin/login', { title: 'Admin Login', error: '', next: req.query.next || '/admin', page: 'admin-login' });
});

router.post('/login', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(req.body.username || '').trim());
  if (user && bcrypt.compareSync(req.body.password || '', user.password)) {
    req.session.admin = { id: user.id, username: user.username, name: user.name, role: user.role };
    return res.redirect(req.body.next || '/admin');
  }
  res.status(401).render('admin/login', { title: 'Admin Login', error: 'Invalid username or password.', next: req.body.next || '/admin', page: 'admin-login' });
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// ---------------------------------------------------------------- dashboard
router.get('/', requireAdmin, (req, res) => {
  const s = stats();
  const byCat = db.prepare(`SELECT c.name, c.color, COUNT(q.id) AS n
    FROM categories c LEFT JOIN questions q ON q.category_id = c.id
    GROUP BY c.id ORDER BY n DESC`).all();
  const maxCat = Math.max(1, ...byCat.map((r) => r.n));
  const recent = db.prepare(`SELECT q.id, q.title, q.qtype, q.views, q.published, q.created_at,
      c.name AS category_name FROM questions q JOIN categories c ON c.id = q.category_id
      ORDER BY q.created_at DESC LIMIT 8`).all();
  const newMessages = count('contact_messages', 'WHERE status = \'new\'');
  const totalKws = count('keyword_tracker');
  const topQuestions = db.prepare(`SELECT q.title, q.slug, q.views, q.qtype FROM questions q
      ORDER BY q.views DESC LIMIT 5`).all();
  const viewsByDay = db.prepare(`SELECT date(created_at) AS d, COUNT(*) AS n FROM questions
      GROUP BY d ORDER BY d DESC LIMIT 7`).all().reverse();

  res.render('admin/dashboard', {
    title: 'Dashboard', page: 'admin', active: 'dashboard',
    s, byCat, maxCat, recent, newMessages, totalKws, topQuestions, viewsByDay,
  });
});
// ::A2::
// Question helpers ---------------------------------------------------------
function readQuestionForm(body, id) {
  const title = String(body.title || '').trim();
  const options = Array.isArray(body.option) ? body.option.map((o) => String(o || '').trim()) : [];
  const tags = String(body.tags || '').trim().split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  const keywords = String(body.keywords || '').trim().split(',').map((k) => k.trim()).filter(Boolean).join(', ');
  const slug = require('../lib/seo').slugify(body.slug || title);
  return {
    slug: slug || 'question-' + (id || Date.now()),
    category_id: parseInt(body.category_id, 10) || 1,
    qtype: body.qtype === 'written' ? 'written' : 'mcq',
    title,
    question_text: String(body.question_text || '').trim(),
    options: JSON.stringify(options),
    correct_answer: String(body.correct_answer || '').trim().toUpperCase(),
    answer_text: String(body.answer_text || '').trim(),
    difficulty: ['easy', 'medium', 'hard'].includes(body.difficulty) ? body.difficulty : 'medium',
    tags: JSON.stringify(tags),
    exam: String(body.exam || '').trim(),
    source: String(body.source || '').trim(),
    published: body.published === 'on' ? 1 : 0,
    featured: body.featured === 'on' ? 1 : 0,
    seo_title: String(body.seo_title || '').trim(),
    meta_description: String(body.meta_description || '').trim(),
    keywords,
  };
}

function ensureUniqueSlugFor(desired, ignoreId) {
  let slug = desired || 'question';
  let candidate = slug;
  let i = 2;
  while (db.prepare('SELECT id FROM questions WHERE slug = ? AND id != ?').get(candidate, ignoreId || 0)) {
    candidate = `${slug}-${i++}`;
  }
  return candidate;
}
// ::A2B::
// List questions -----------------------------------------------------------
router.get('/questions', requireAdmin, (req, res) => {
  const q = String(req.query.q || '').trim();
  const type = req.query.type || '';
  const cat = req.query.cat || '';
  const published = req.query.published; // '' all, '1', '0'
  const page = parseInt(req.query.page, 10) || 1;
  const per = 15;

  const where = [];
  const params = [];
  if (q) { where.push('(q.title LIKE ? OR q.tags LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (type) { where.push('q.qtype = ?'); params.push(type); }
  if (cat) { where.push('c.slug = ?'); params.push(cat); }
  if (published === '1' || published === '0') { where.push('q.published = ?'); params.push(Number(published)); }
  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';

  const total = db.prepare(`SELECT COUNT(*) c FROM questions q JOIN categories c ON c.id = q.category_id${whereSql}`).get(...params).c;
  const pages = Math.max(1, Math.ceil(total / per));
  const p = Math.min(Math.max(1, page), pages);
  const items = db.prepare(`SELECT q.*, c.name AS category_name, c.slug AS category_slug
      FROM questions q JOIN categories c ON c.id = q.category_id${whereSql}
      ORDER BY q.created_at DESC LIMIT ? OFFSET ?`).all(...params, per, (p - 1) * per).map(decorate);

  res.render('admin/questions', {
    title: 'Manage Questions', page: 'admin', active: 'questions',
    items, q, type, cat, published, page: p, pages, total, categories: listCategories(),
  });
});

// New / edit forms -----------------------------------------------------------
const emptyQuestion = {
  id: 0, qtype: 'mcq', title: '', question_text: '', options: ['', '', '', ''],
  correct_answer: '', answer_text: '', difficulty: 'medium', tags: [],
  exam: '', source: '', published: 1, featured: 0, seo_title: '', meta_description: '', keywords: '',
};

router.get('/questions/new', requireAdmin, (req, res) => {
  res.render('admin/question-form', {
    title: 'Add Question', page: 'admin', active: 'questions',
    q: { ...emptyQuestion, category_id: listCategories()[0]?.id },
    categories: listCategories(), isEdit: false,
  });
});

router.get('/questions/:id/edit', requireAdmin, (req, res) => {
  const q = getQuestionById(parseInt(req.params.id, 10));
  if (!q) return res.redirect('/admin/questions');
  res.render('admin/question-form', {
    title: 'Edit Question', page: 'admin', active: 'questions',
    q, categories: listCategories(), isEdit: true,
  });
});
// ::A2C::
// Save question --------------------------------------------------------------
router.post('/questions', requireAdmin, (req, res) => {
  const data = readQuestionForm(req.body);
  data.slug = ensureUniqueSlugFor(data.slug, 0);
  db.prepare(`INSERT INTO questions
    (slug, category_id, qtype, title, question_text, options, correct_answer, answer_text,
     difficulty, tags, exam, source, published, featured, seo_title, meta_description, keywords)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    data.slug, data.category_id, data.qtype, data.title, data.question_text, data.options,
    data.correct_answer, data.answer_text, data.difficulty, data.tags, data.exam, data.source,
    data.published, data.featured, data.seo_title, data.meta_description, data.keywords);
  res.redirect('/admin/questions?msg=Question+added');
});

router.post('/questions/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const data = readQuestionForm(req.body, id);
  data.slug = ensureUniqueSlugFor(data.slug, id);
  db.prepare(`UPDATE questions SET slug=?, category_id=?, qtype=?, title=?, question_text=?, options=?,
    correct_answer=?, answer_text=?, difficulty=?, tags=?, exam=?, source=?, published=?, featured=?,
    seo_title=?, meta_description=?, keywords=?, updated_at=datetime('now','localtime') WHERE id=?`).run(
    data.slug, data.category_id, data.qtype, data.title, data.question_text, data.options,
    data.correct_answer, data.answer_text, data.difficulty, data.tags, data.exam, data.source,
    data.published, data.featured, data.seo_title, data.meta_description, data.keywords, id);
  res.redirect('/admin/questions?msg=Question+updated');
});

router.post('/questions/:id/delete', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM questions WHERE id = ?').run(parseInt(req.params.id, 10));
  res.redirect('/admin/questions?msg=Question+deleted');
});

router.post('/questions/:id/toggle', requireAdmin, (req, res) => {
  db.prepare('UPDATE questions SET published = 1 - published, updated_at=datetime(\'now\',\'localtime\') WHERE id = ?').run(parseInt(req.params.id, 10));
  res.redirect(req.get('referer') || '/admin/questions');
});
// ::A3::
// Categories ----------------------------------------------------------------
router.get('/categories', requireAdmin, (req, res) => {
  const items = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM questions q WHERE q.category_id = c.id) AS qcount
    FROM categories c ORDER BY c.id`).all();
  res.render('admin/categories', { title: 'Categories', page: 'admin', active: 'categories', items });
});

router.post('/categories', requireAdmin, (req, res) => {
  const slug = require('../lib/seo').slugify(req.body.slug || req.body.name);
  db.prepare(`INSERT INTO categories (slug, name, icon, color, description, meta_title, meta_description)
    VALUES (?,?,?,?,?,?,?)`).run(
    slug || 'category-' + Date.now(), String(req.body.name || '').trim(),
    String(req.body.icon || '📘').trim(), String(req.body.color || '#2563eb').trim(),
    String(req.body.description || '').trim(), String(req.body.meta_title || '').trim(),
    String(req.body.meta_description || '').trim());
  res.redirect('/admin/categories?msg=Category+added');
});

router.post('/categories/:id', requireAdmin, (req, res) => {
  const slug = require('../lib/seo').slugify(req.body.slug || req.body.name);
  db.prepare(`UPDATE categories SET slug=?, name=?, icon=?, color=?, description=?, meta_title=?, meta_description=? WHERE id=?`).run(
    slug, String(req.body.name || '').trim(), String(req.body.icon || '📘').trim(),
    String(req.body.color || '#2563eb').trim(), String(req.body.description || '').trim(),
    String(req.body.meta_title || '').trim(), String(req.body.meta_description || '').trim(),
    parseInt(req.params.id, 10));
  res.redirect('/admin/categories?msg=Category+updated');
});

router.post('/categories/:id/delete', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(parseInt(req.params.id, 10));
  res.redirect('/admin/categories?msg=Category+deleted');
});

// SEO Tools (competition keyword research + tracking) ------------------------
router.get('/seo', requireAdmin, (req, res) => {
  const tracked = db.prepare('SELECT * FROM keyword_tracker ORDER BY search_volume DESC').all();
  res.render('admin/seo-tools', { title: 'SEO Tools & Keyword Research', page: 'admin', active: 'seo', tracked });
});

router.post('/tracker/:id/delete', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM keyword_tracker WHERE id = ?').run(parseInt(req.params.id, 10));
  res.redirect('/admin/seo?msg=Keyword+removed');
});
// ::A4::
// Contact messages ------------------------------------------------------------
router.get('/messages', requireAdmin, (req, res) => {
  const items = db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 100').all();
  res.render('admin/messages', { title: 'Messages', page: 'admin', active: 'messages', items });
});

router.post('/messages/:id/delete', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM contact_messages WHERE id = ?').run(parseInt(req.params.id, 10));
  res.redirect('/admin/messages?msg=Message+deleted');
});

router.post('/messages/:id/read', requireAdmin, (req, res) => {
  db.prepare('UPDATE contact_messages SET status = \'read\' WHERE id = ?').run(parseInt(req.params.id, 10));
  res.redirect('/admin/messages');
});

// Settings ---------------------------------------------------------------------
router.get('/settings', requireAdmin, (req, res) => {
  const keys = [
    'site_name', 'tagline', 'base_url', 'meta_keywords', 'footer_text',
    'contact_email', 'facebook', 'youtube', 'adsense_header', 'adsense_incontent',
    'adsense_sidebar', 'analytics_id',
  ];
  const settings = {};
  keys.forEach((k) => { settings[k] = getSetting(k); });
  res.render('admin/settings', { title: 'Settings', page: 'admin', active: 'settings', settings });
});

router.post('/settings', requireAdmin, (req, res) => {
  const allow = new Set([
    'site_name', 'tagline', 'base_url', 'meta_keywords', 'footer_text',
    'contact_email', 'facebook', 'youtube', 'adsense_header', 'adsense_incontent',
    'adsense_sidebar', 'analytics_id',
  ]);
  Object.entries(req.body).forEach(([k, v]) => {
    if (allow.has(k)) setSetting(k, String(v || ''));
  });
  res.redirect('/admin/settings?msg=Settings+saved');
});

// Password -----------------------------------------------------------------------
router.post('/password', requireAdmin, (req, res) => {
  const { current, next: np } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.admin.id);
  if (!user || !bcrypt.compareSync(current || '', user.password) || !np || np.length < 6) {
    const settings = {};
    ['site_name', 'tagline', 'base_url', 'meta_keywords', 'footer_text', 'contact_email', 'facebook', 'youtube', 'adsense_header', 'adsense_incontent', 'adsense_sidebar', 'analytics_id']
      .forEach((k) => { settings[k] = getSetting(k); });
    return res.status(400).render('admin/settings', { title: 'Settings', page: 'admin', active: 'settings', settings, pwdError: 'Current password wrong or new password too short.' });
  }
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(np, 10), user.id);
  res.redirect('/admin/settings?msg=Password+changed');
});

module.exports = router;