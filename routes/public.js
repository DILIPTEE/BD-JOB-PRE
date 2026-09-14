const express = require('express');
const { db, getSetting, siteBaseUrl } = require('../db/init');
const { sanitizeHtml } = require('../lib/render');
const {
  listCategories, getCategoryBySlug, getQuestionBySlug, recentQuestions,
  searchQuestions, relatedQuestions, stats, decorate, seo,
} = require('../lib/content');

const router = express.Router();

const Q_COLS = `SELECT q.*, c.name AS category_name, c.slug AS category_slug,
  c.icon AS category_icon, c.color AS category_color
  FROM questions q JOIN categories c ON c.id = q.category_id`;

// Pagination helper -----------------------------------------------------
function paginate(total, page, per) {
  const pages = Math.max(1, Math.ceil(total / per));
  const p = Math.min(Math.max(1, page), pages);
  const offset = (p - 1) * per;
  const nums = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - p) <= 2) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  return { page: p, per, pages, offset, nums };
}

function buildQuestionQuery(filters = {}) {
  const where = ['q.published = 1'];
  const params = [];
  if (filters.cat) { where.push('c.slug = ?'); params.push(filters.cat); }
  if (filters.type) { where.push('q.qtype = ?'); params.push(filters.type); }
  if (filters.difficulty) { where.push('q.difficulty = ?'); params.push(filters.difficulty); }
  if (filters.tag) { where.push('q.tags LIKE ?'); params.push(`%"${filters.tag}"%`); }
  if (filters.q) {
    where.push('(q.title LIKE ? OR q.question_text LIKE ? OR q.answer_text LIKE ? OR q.tags LIKE ? OR q.exam LIKE ?)');
    const like = `%${filters.q}%`;
    params.push(like, like, like, like, like);
  }
  const order = filters.sort === 'popular' ? 'q.views DESC' : 'q.created_at DESC, q.id DESC';
  return { where: where.join(' AND '), params, order };
}

function runListQuery(filters) {
  const { where, params, order } = buildQuestionQuery(filters);
  const total = db.prepare(`SELECT COUNT(*) c FROM questions q JOIN categories c ON c.id = q.category_id WHERE ${where}`).get(...params).c;
  const pg = paginate(total, filters.page || 1, filters.per || 9);
  const items = db.prepare(`${Q_COLS} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, pg.per, pg.offset).map(decorate);
  return { items, pg, total };
}

// Home -------------------------------------------------------------------
router.get('/', (req, res) => {
  const s = stats();
  const categories = listCategories();
  const featured = db.prepare(`${Q_COLS} WHERE q.published = 1 ORDER BY q.featured DESC, q.views DESC LIMIT 4`).all().map(decorate);
  const latest = recentQuestions(8);
  const mcqPick = db.prepare(`${Q_COLS} WHERE q.published = 1 AND q.qtype = 'mcq' ORDER BY q.views DESC LIMIT 5`).all().map(decorate);
  const writtenPick = db.prepare(`${Q_COLS} WHERE q.published = 1 AND q.qtype = 'written' ORDER BY q.views DESC LIMIT 5`).all().map(decorate);

  res.render('index', {
    title: getSetting('site_name') + ' – Free MCQ, Written & IT Question Answers for Every Job Sector in Bangladesh',
    metaDescription: getSetting('tagline'),
    page: 'home', s, categories, featured, latest, mcqPick, writtenPick,
  });
});
// ::R2::
// All questions (with filters + pagination) ------------------------------
router.get('/questions', (req, res) => {
  const filters = {
    cat: req.query.cat || '', type: req.query.type || '', difficulty: req.query.difficulty || '',
    tag: req.query.tag || '', q: (req.query.q || '').trim(), sort: req.query.sort || 'new',
    page: parseInt(req.query.page, 10) || 1, per: 9,
  };
  const { items, pg, total } = runListQuery(filters);
  res.render('questions', {
    title: filters.q ? `Search: ${filters.q} – Job Question Answer` : `All Questions – MCQ & Written Job Preparation Bangladesh`,
    metaDescription: `Browse ${total} MCQ and written questions with answers for every Bangladeshi job sector.`,
    page: 'questions', filters, items, pg, total, categories: listCategories(),
  });
});

// Category page -----------------------------------------------------------
router.get('/category/:slug', (req, res) => {
  const cat = getCategoryBySlug(req.params.slug);
  if (!cat) return res.status(404).render('404', { title: 'Category not found', page: '' });
  const filters = {
    cat: cat.slug, type: req.query.type || '', difficulty: req.query.difficulty || '',
    q: (req.query.q || '').trim(), sort: req.query.sort || 'new', page: parseInt(req.query.page, 10) || 1, per: 9,
  };
  const { items, pg, total } = runListQuery(filters);
  res.render('category', {
    title: cat.meta_title || `${cat.name} MCQ & Written Question Answer`,
    metaDescription: cat.meta_description || cat.description,
    page: 'category', cat, items, pg, total, filters,
  });
});

// Tag page ----------------------------------------------------------------
router.get('/tags/:tag', (req, res) => {
  const tag = String(req.params.tag || '').toLowerCase();
  const filters = { tag, page: parseInt(req.query.page, 10) || 1, per: 12 };
  const { items, pg, total } = runListQuery(filters);
  res.render('tag', {
    title: `#${tag} questions – Question Answer`,
    metaDescription: `${total} questions tagged #${tag} with answers.`,
    page: 'tag', tag, items, pg, total,
  });
});

// Search ------------------------------------------------------------------
router.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.redirect('/questions');
  res.render('search', {
    title: `Search: ${q}`, metaDescription: `Search results for "${q}"`,
    page: 'search', q, results: searchQuestions(q),
  });
});
// ::R3::
// Question detail ----------------------------------------------------------
router.get('/question/:slug', (req, res) => {
  const q = getQuestionBySlug(req.params.slug);
  if (!q) return res.status(404).render('404', { title: 'Question not found', page: '' });

  db.prepare('UPDATE questions SET views = views + 1 WHERE id = ?').run(q.id);
  q.views = (q.views || 0) + 1;

  const related = relatedQuestions(q);
  const seoTitle = q.seo_title || `${q.title} – ${q.category_name} Question Answer | ${getSetting('site_name')}`;
  const meta = q.meta_description || `Solved ${q.qtype.toUpperCase()} question: ${q.title} with answer and explanation for ${q.category_name}.`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [{ '@type': 'Question', name: q.title, acceptedAnswer: { '@type': 'Answer', text: seo.stripHtml(sanitizeHtml(q.answer_text)).slice(0, 300) } }],
  };

  res.render('question', {
    title: seoTitle, metaDescription: meta, page: 'question', q, related, jsonLd,
    keywords: q.keywords || seo.extractKeywords(`${q.title} ${q.question_text} ${q.answer_text}`, 8).join(', '),
  });
});

// Static pages -------------------------------------------------------------
router.get('/about', (req, res) => res.render('about', { title: 'About Us', metaDescription: getSetting('tagline'), page: 'about' }));
router.get('/privacy', (req, res) => res.render('privacy', { title: 'Privacy Policy', metaDescription: 'Privacy policy', page: 'privacy' }));
router.get('/contact', (req, res) => res.render('contact', { title: 'Contact Us', metaDescription: 'Contact BD Job Prep', page: 'contact', flash: '' }));
router.post('/contact', (req, res) => {
  db.prepare('INSERT INTO contact_messages (name, email, subject, message) VALUES (?,?,?,?)')
    .run(req.body.name || '', req.body.email || '', req.body.subject || '', req.body.message || '');
  res.render('contact', { title: 'Contact Us', metaDescription: 'Contact BD Job Prep', page: 'contact', flash: 'Thank you! Your message has been sent.' });
});

// sitemap.xml ----------------------------------------------------------------
router.get('/sitemap.xml', (req, res) => {
  const base = siteBaseUrl();
  const urls = [
    { loc: base + '/', freq: 'daily', pri: '1.0' },
    { loc: base + '/questions', freq: 'daily', pri: '0.9' },
  ];
  listCategories().forEach((c) => urls.push({ loc: `${base}/category/${c.slug}`, freq: 'weekly', pri: '0.8' }));
  db.prepare('SELECT slug, updated_at FROM questions WHERE published = 1 ORDER BY updated_at DESC').all()
    .forEach((q) => urls.push({ loc: `${base}/question/${q.slug}`, freq: 'weekly', pri: '0.7', lastmod: (q.updated_at || '').replace(' ', 'T') + '+06:00' }));

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  urls.forEach((u) => {
    xml += `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>\n`;
  });
  xml += '</urlset>';
  res.set('Content-Type', 'application/xml').send(xml);
});

// robots.txt ----------------------------------------------------------------
router.get('/robots.txt', (req, res) => {
  const base = siteBaseUrl();
  res.set('Content-Type', 'text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${base}/sitemap.xml\n`);
});

module.exports = router;