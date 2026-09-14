const express = require('express');
const { db } = require('../db/init');
const { requireAdmin } = require('../middleware/auth');
const { suggestSeo, researchKeyword } = require('../lib/seo');

const router = express.Router();

// Auto SEO suggestion for a question being written in the admin form --------
router.post('/seo/suggest', requireAdmin, (req, res) => {
  const { title = '', question = '', category = '', qtype = 'mcq', exam = '' } = req.body;
  if (!title && !question) return res.status(400).json({ error: 'Enter a title or question text first.' });
  const result = suggestSeo({ title, question, category, qtype, exam });
  res.json({ ok: true, ...result });
});

// Competition keyword research ----------------------------------------------
router.get('/seo/research', requireAdmin, (req, res) => {
  const keyword = String(req.query.keyword || '').trim();
  if (keyword.length < 2) return res.status(400).json({ error: 'Type a keyword to research.' });

  // How many of our own questions already target this keyword.
  const like = `%${keyword}%`;
  const matches = db.prepare(`SELECT q.id, q.title, q.slug, q.tags, c.name AS category_name, q.views, q.published
    FROM questions q JOIN categories c ON c.id = q.category_id
    WHERE q.title LIKE ? OR q.tags LIKE ? OR q.exam LIKE ?
    ORDER BY q.views DESC LIMIT 8`).all(like, like, like);
  const existingCount = db.prepare(`SELECT COUNT(*) c FROM questions
    WHERE title LIKE ? OR tags LIKE ? OR exam LIKE ?`).get(like, like, like).c;

  const tagSet = new Set();
  matches.forEach((m) => { try { JSON.parse(m.tags || '[]').forEach((t) => tagSet.add(t)); } catch (e) {} });

  const result = researchKeyword(keyword, existingCount, [...tagSet].slice(0, 6));
  res.json({ ok: true, ...result, existingCount, matches });
});

// Track a researched keyword ------------------------------------------------
router.post('/seo/track', requireAdmin, (req, res) => {
  const { keyword, search_volume, difficulty, cpc, competition } = req.body;
  const k = String(keyword || '').trim().toLowerCase();
  if (!k) return res.status(400).json({ error: 'Keyword is required.' });
  db.prepare(`INSERT INTO keyword_tracker (keyword, search_volume, difficulty, cpc, competition)
    VALUES (?,?,?,?,?)`).run(k, parseInt(search_volume, 10) || 0, parseInt(difficulty, 10) || 0, parseFloat(cpc) || 0, String(competition || 'Low'));
  res.json({ ok: true });
});

router.get('/seo/tracked', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM keyword_tracker ORDER BY search_volume DESC').all());
});

router.delete('/seo/tracked/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM keyword_tracker WHERE id = ?').run(parseInt(req.params.id, 10));
  res.json({ ok: true });
});

// Health check ----------------------------------------------------------------
router.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

module.exports = router;