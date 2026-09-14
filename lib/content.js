const { db } = require('../db/init');
const seo = require('../lib/seo');

// Converts JSON columns to JS values for template use.
function decorate(q) {
  if (!q) return q;
  const out = { ...q };
  out.options = parseList(q.options);
  out.tags = parseList(q.tags);
  out.question_text = q.question_text || '';
  out.answer_text = q.answer_text || '';
  out.created = (q.created_at || '').slice(0, 10);
  return out;
}

function parseList(s) {
  try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; }
  catch (e) { return []; }
}

const CATEGORIES_SQL = `SELECT c.*, (SELECT COUNT(*) FROM questions q WHERE q.category_id = c.id AND q.published = 1) AS question_count FROM categories c`;

function listCategories() {
  return db.prepare(CATEGORIES_SQL + ' ORDER BY c.name').all();
}

function getCategoryBySlug(slug) {
  return db.prepare(CATEGORIES_SQL + ' WHERE c.slug = ?').get(slug);
}

const QUESTIONS_SQL = `SELECT q.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon, c.color AS category_color
  FROM questions q JOIN categories c ON c.id = q.category_id`;

function getQuestionBySlug(slug, publishedOnly = true) {
  const row = db.prepare(QUESTIONS_SQL + ' WHERE q.slug = ?' + (publishedOnly ? ' AND q.published = 1' : '')).get(slug);
  return row ? decorate(row) : null;
}

function getQuestionById(id) {
  const row = db.prepare(QUESTIONS_SQL + ' WHERE q.id = ?').get(id);
  return row ? decorate(row) : null;
}

function recentQuestions(limit = 10, publishedOnly = true) {
  return db.prepare(QUESTIONS_SQL + (publishedOnly ? ' WHERE q.published = 1' : '') + ' ORDER BY q.created_at DESC, q.id DESC LIMIT ?')
    .all(limit).map(decorate);
}

/** Recent IT questions for the sidebar: any question tagged "it" or in IT category. */
function recentItQuestions(limit = 8) {
  return db.prepare(QUESTIONS_SQL + `
    WHERE q.published = 1 AND (q.tags LIKE '%"it"%' OR c.slug = 'it')
    ORDER BY q.created_at DESC, q.id DESC LIMIT ?`).all(limit).map(decorate);
}

function searchQuestions(term, limit = 30) {
  const like = `%${term}%`;
  return db.prepare(QUESTIONS_SQL + `
    WHERE q.published = 1 AND (q.title LIKE ? OR q.question_text LIKE ? OR q.answer_text LIKE ? OR q.tags LIKE ? OR q.exam LIKE ?)
    ORDER BY q.views DESC LIMIT ?`).all(like, like, like, like, like, limit).map(decorate);
}

function relatedQuestions(q, limit = 5) {
  const tags = (q.tags || []).slice(0, 3).map((t) => `%${t}%`);
  const likes = tags.map(() => 'q.tags LIKE ?').join(' OR ');
  return db.prepare(QUESTIONS_SQL + `
    WHERE q.published = 1 AND q.id != ?
    AND (${likes || '0'} OR q.category_id = ?)
    ORDER BY q.views DESC LIMIT ?`)
    .all(q.id, ...tags, q.category_id, limit).map(decorate);
}

function stats() {
  return {
    questions: db.prepare('SELECT COUNT(*) c FROM questions').get().c,
    published: db.prepare('SELECT COUNT(*) c FROM questions WHERE published = 1').get().c,
    mcq: db.prepare("SELECT COUNT(*) c FROM questions WHERE qtype = 'mcq'").get().c,
    written: db.prepare("SELECT COUNT(*) c FROM questions WHERE qtype = 'written'").get().c,
    categories: db.prepare('SELECT COUNT(*) c FROM categories').get().c,
    views: db.prepare('SELECT COALESCE(SUM(views),0) v FROM questions').get().v,
    itQuestions: db.prepare(`SELECT COUNT(*) c FROM questions q JOIN categories c ON c.id = q.category_id WHERE q.tags LIKE '%"it"%' OR c.slug = 'it'`).get().c,
  };
}

module.exports = {
  decorate,
  listCategories,
  getCategoryBySlug,
  getQuestionBySlug,
  getQuestionById,
  recentQuestions,
  recentItQuestions,
  searchQuestions,
  relatedQuestions,
  stats,
  seo,
};