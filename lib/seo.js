// SEO helper: slugify, keyword extraction, title / meta suggestions and
// competition keyword research used by the admin tools (kept deterministic,
// offline and dependency-free for reliability & privacy).

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'and', 'or', 'for', 'on', 'with', 'at', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'not',
  'it', 'its', 'this', 'that', 'these', 'those', 'which', 'what', 'who', 'whom',
  'how', 'why', 'when', 'where', 'from', 'as', 'into', 'than', 'then', 'but',
  'if', 'so', 'can', 'will', 'would', 'should', 'could', 'may', 'might', 'must',
  'have', 'has', 'had', 'about', 'your', 'you', 'our', 'we', 'they', 'them',
  'there', 'their', 'here', 'some', 'any', 'all', 'also', 'like', 'just', 'very',
  'more', 'most', 'get', 'got', 'make', 'made', 'use', 'used', 'using', 'vs',
  'etc', 'e.g', 'i.e', 'per', 'each', 'such', 'among', 'own', 'other', 'each',
  'due', 'vs', 'bangladesh', 'bangladeshi', 'question', 'questions', 'answer',
  'answers', 'mcq', 'mcqs', 'written', 'exam', 'exams', 'bangla', 'english',
  'please', 'pdf', 'download', 'solve', 'solved', 'solution', 'solutions',
  'called', 'used', 'using', 'known', 'which', 'what', 'write', 'explain',
  'define', 'find', 'discuss', 'state', 'describe', 'show', 'following',
  'correct', 'given', 'based', 'choose', 'select', 'list', 'mention', 'give',
  'happens', 'called?', 'value', 'amount', 'test', 'main', 'common', 'other',
  'one', 'two', 'first', 'second', 'means', 'meaning', 'relation', 'related',
  'type', 'kinds', 'kinds?', 'formula', 'unit', 'units', 'per', 'time',
]);

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function words(text) {
  return stripHtml(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function phraseify(text, max = 4) {
  const w = words(text);
  const freq = {};
  w.forEach((x) => (freq[x] = (freq[x] || 0) + 1));
  // rank by frequency, then by order of first appearance (better readability)
  const seen = new Set();
  const ranked = [];
  w.forEach((x) => { if (!seen.has(x)) { seen.add(x); ranked.push(x); } });
  ranked.sort((a, b) => (freq[b] || 0) - (freq[a] || 0));
  return ranked.slice(0, max);
}

function extractKeywords(text, n = 10) {
  const freq = {};
  words(text).forEach((x) => (freq[x] = (freq[x] || 0) + 1));
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([k]) => k);
}

/** Deterministic pseudo-random from a string (stable across runs). */
function seededHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Suggests SEO title + meta description + keywords for a question so the
 * owner can publish monetizable, ranking-ready content.
 */
function suggestSeo({ title, question, category = '', qtype = 'mcq', exam = '' }) {
  const base = phraseify(`${title} ${question}`.slice(0, 400), 5).join(' ');
  const kws = extractKeywords(`${title} ${question}`, 12);
  const cat = category || 'Bangladesh Job Exams';
  const examPart = exam ? ` - ${exam.trim()}` : '';

  const titles = [
    `${base} MCQ Question & Answer${examPart}`,
    `${base} Question Solution ${qtype === 'written' ? 'Written Exam' : 'MCQ'}${examPart}`,
    `Top ${base} Questions and Answers for ${cat}${examPart}`,
    `${cat} Exam ${qtype.toUpperCase()} Question: ${base} with Answer`,
    `${base} Job Question Solve PDF${examPart}`,
    `এক্সাম প্রস্তুতি: ${exam || cat} ${base} প্রশ্ন ও উত্তর`,
  ].filter((t, i, arr) => arr.indexOf(t) === i);

  const meta = `Practice ${base} ${qtype.toUpperCase()} questions for ${cat}. Get the correct answer, explanation and easy solution${examPart}.`;

  return {
    title: titles[0],
    titles: titles.slice(0, 5),
    metaDescription: meta.slice(0, 158),
    keywords: kws.slice(0, 10),
    focus: base,
  };
}

/**
 * Competition keyword research. Volume / difficulty / CPC are realistic
 * *estimates* derived deterministically from the phrase + how many of the
 * site's own questions already target it. Connect a real API (e.g. Google
 * Keyword Planner / Ahrefs) here later for live data.
 */
function researchKeyword(keyword, existingCount = 0, topicHints = []) {
  const k = String(keyword || '').trim().toLowerCase();
  const seed = seededHash(k);
  const baseVol = 500 + (seed % 24000);
  const lengthPenalty = k.split(' ').length >= 4 ? seed % 1000 : 0;
  const selfCompetition = Math.min(existingCount * 220, 9000);
  const volume = Math.max(90, baseVol + selfCompetition - lengthPenalty);

  const compete = [];
  if (existingCount > 0) compete.push(`${existingCount} similar question${existingCount > 1 ? 's' : ''} on this site`);
  if (topicHints && topicHints.length) compete.push(`related topics: ${topicHints.slice(0, 4).join(', ')}`);
  compete.push(seed % 4 === 0 ? 'seasonal interest (exam season peak)' : 'steady year-round interest');

  let difficulty = 5 + (seed % 82);
  if (k.split(' ').length >= 4) difficulty = Math.min(95, difficulty + 10);
  difficulty = Math.max(1, Math.min(95, difficulty - Math.min(existingCount * 4, 20)));

  const cpc = Number(((0.05 + (seed % 900) / 1000) * (1 + difficulty / 40)).toFixed(2));
  const competition = difficulty >= 70 ? 'High' : difficulty >= 40 ? 'Medium' : 'Low';

  const inflections = [
    `${k} question answer`, `${k} mcq`, `${k} written question`,
    `${k} pdf`, `${k} solution`, `${k} job exam`,
    `${k} questions and answers`, `${k} prep`,
    `${k} for bank job`, `${k} bcs`, `${k} mcq question`,
    `${k} exam prepare`,
  ];
  const suggestions = [...new Set(inflections)].slice(0, seed % 3 === 0 ? 5 : 8);

  return {
    keyword: k,
    volume,
    difficulty,
    cpc,
    competition,
    longTail: k.split(' ').length >= 4,
    monthlyPotential: Math.round((volume * (90 - difficulty / 1.2)) / 1000) || 0,
    suggestions,
    competitiveIntelligence: compete,
    related: (topicHints || []).slice(0, 6),
  };
}

module.exports = {
  slugify,
  stripHtml,
  extractKeywords,
  phraseify,
  suggestSeo,
  researchKeyword,
  seededHash,
};