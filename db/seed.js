// Seed database with demo data: categories, questions (MCQ & written) for
// every Bangladeshi job sector, admin user, settings and tracked keywords.
// Run: npm run seed  (safe to run repeatedly — it skips existing data).
const bcrypt = require('bcryptjs');
const { db, migrate, setSetting } = require('./init');
const { slugify } = require('../lib/seo');

migrate();

// ---------------------------------------------------------------- helpers
function ensureUniqueSlug(slug, used) {
  let s = slug || 'question';
  let i = 2;
  while (used.has(s)) { s = `${slug || 'question'}-${i++}`; }
  used.add(s);
  return s;
}

function addQuestion(q, usedSlugs) {
  const slug = ensureUniqueSlug(slugify(q.title), usedSlugs);
  db.prepare(`INSERT INTO questions
    (slug, category_id, qtype, title, question_text, options, correct_answer,
     answer_text, difficulty, tags, exam, source, views, published, featured,
     seo_title, meta_description, keywords, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    slug,
    q.categoryId,
    q.qtype,
    q.title,
    q.question_text,
    JSON.stringify(q.options || []),
    q.correct_answer || '',
    q.answer_text,
    q.difficulty || 'medium',
    JSON.stringify(q.tags || []),
    q.exam || '',
    q.source || '',
    q.views || 0,
    q.published === undefined ? 1 : q.published,
    q.featured || 0,
    q.seo_title || '',
    q.meta_description || '',
    q.keywords || '',
    q.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19)
  );
}

// ---------------------------------------------------------------- categories
const CATEGORIES = [
  ['bank', 'Bank Jobs', '🏦', '#0ea5e9', 'Bank job MCQ, written and IT questions for Bangladesh Bank, Sonali, Agrani, Janata, Pubali and private banks (BKB, DBBL, Islami Bank).'],
  ['bcs-govt', 'BCS & Govt Jobs', '🏛️', '#ef4444', 'BCS prelims & written, PSC, ministry and government office job questions with answers.'],
  ['power', 'Power Sector (BPDB/PGCB/DPDC)', '⚡', '#f59e0b', 'BPDB, PGCB, DPDC, WZPDCL, DESCO, REB electrical & IT exam questions and solutions.'],
  ['engineering-buet', 'Engineering & BUET', '🏗️', '#8b5cf6', 'BUET admission and engineering (civil, mechanical, EEE, CSE) model questions with solutions.'],
  ['it', 'IT & Software Jobs', '💻', '#10b981', 'Programming, networking, database, web development and common IT job exam questions.'],
  ['education', 'Education & Teacher Jobs', '🍎', '#ec4899', 'NTRCA, government and private school/college teacher job preparation questions.'],
  ['ngo-private', 'NGO & Private Jobs', '🤝', '#14b8a6', 'BRAC, ASA, bKash, Grameenphone and top private company job questions & answers.'],
  ['medical', 'Medical & Health Jobs', '🏥', '#f43f5e', 'Medical admission, DGHS and health sector job preparation questions.'],
];

const categoryIds = {};
const insertCat = db.prepare(`INSERT INTO categories
  (slug, name, icon, color, description, meta_title, meta_description)
  VALUES (?,?,?,?,?,?,?)`);

CATEGORIES.forEach((c) => {
  const existing = db.prepare('SELECT id FROM categories WHERE slug = ?').get(c[0]);
  let id;
  if (existing) id = existing.id;
  else {
    const info = insertCat.run(
      c[0], c[1], c[2], c[3], c[4],
      `${c[1]} MCQ & Written Question Answer`,
      `${c[1]} question answer for Bangladesh job exams – MCQ, written and IT questions with solutions.`
    );
    id = info.lastInsertRowid;
  }
  categoryIds[c[0]] = id;
});

// ---------------------------------------------------------------- admin user
const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existingUser) {
  db.prepare('INSERT INTO users (username, password, name, role) VALUES (?,?,?,?)')
    .run('admin', bcrypt.hashSync('admin123', 10), 'Site Administrator', 'admin');
}

// ---------------------------------------------------------------- settings
const DEFAULTS = {
  site_name: 'BD Job Prep',
  tagline: 'Bangladesh Job Preparation – MCQ, Written & IT Question Answers for every sector',
  base_url: 'http://localhost:3000',
  meta_keywords: 'bangladesh job question answer, bcs mcq, bank job math, power sector jobs, buet admission, IT question answer bd',
  footer_text: 'BD Job Prep helps every student prepare for Bangladeshi job exams with free MCQ, written and IT question answers.',
  contact_email: 'contact@bdjobprep.com',
  facebook: 'https://facebook.com/yourpage',
  youtube: 'https://youtube.com/@yourchannel',
  adsense_header: '',
  adsense_incontent: '',
  adsense_sidebar: '',
  analytics_id: '',
};
Object.entries(DEFAULTS).forEach(([k, v]) => {
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(k);
  if (!row) setSetting(k, v);
});

const usedSlugs = new Set(db.prepare('SELECT slug FROM questions').all().map((r) => r.slug));
// ::PART2::
const QUESTIONS_A = [
  // ===== BANK =====
  {
    categoryId: categoryIds.bank, qtype: 'mcq',
    title: 'Which of the following is not a primary function of a commercial bank?',
    question_text: 'Which of the following is not a primary function of a commercial bank in Bangladesh?',
    options: ['Accepting deposits', 'Granting loans', 'Issuing currency notes', 'Discounting bills of exchange'],
    correct_answer: 'C', answer_text: 'Issuing currency notes is the function of the central bank (Bangladesh Bank). Commercial banks accept deposits, grant loans and discount bills, but they cannot issue currency.',
    difficulty: 'easy', tags: ['bank', 'it', 'finance'], exam: 'Sonali Bank SO', views: 1240,
  },
  {
    categoryId: categoryIds.bank, qtype: 'mcq',
    title: 'SWIFT code is mainly used for which purpose?',
    question_text: 'In international banking, SWIFT code is used for —',
    options: ['Domestic cash withdrawal', 'International fund transfer', 'Accessing ATM booth', 'Resetting internet banking password'],
    correct_answer: 'B', answer_text: 'SWIFT (Society for Worldwide Interbank Financial Telecommunication) code securely identifies a bank for international fund transfers.',
    difficulty: 'easy', tags: ['bank', 'it'], exam: 'Agrani Bank PO', views: 880,
  },
  {
    categoryId: categoryIds.bank, qtype: 'mcq',
    title: 'In banking terminology KYC stands for —',
    question_text: 'KYC is a mandatory document-checking process for opening bank accounts. Its full form is —',
    options: ['Know Your Customer', 'Keep Your Cash', 'Know Your Credit', 'Key Your Credentials'],
    correct_answer: 'A', answer_text: 'KYC = Know Your Customer. It is used by banks to verify customer identity and prevent money laundering.',
    difficulty: 'easy', tags: ['bank', 'it'], exam: 'Janata Bank SO', views: 1502,
  },
  {
    categoryId: categoryIds.bank, qtype: 'written',
    title: 'Write down the differences between Debit Card and Credit Card.',
    question_text: 'As a bank written exam question, compare debit card and credit card considering fund source, interest and usage.',
    answer_text: 'Key differences:\n\n• Fund source – Debit card uses your own deposited money; credit card uses the bank\u2019s borrowed money up to a limit.\n• Interest – Debit card attracts no interest; credit card charges interest on unpaid balance after the due date.\n• Eligibility – Debit card is issued with any savings/current account; credit card needs income proof and credit check.\n• Return/cashback – Credit cards usually offer more rewards and cashback.\n• Risk – Credit card misuse can create debt; debit card limits loss to account balance.',
    difficulty: 'medium', tags: ['bank', 'written'], exam: 'Pubali Bank Written', views: 665,
  },
  {
    categoryId: categoryIds.bank, qtype: 'written',
    title: 'Explain the role of Bangladesh Bank (Central Bank) in the economy.',
    question_text: 'Write an answer describing the functions of Bangladesh Bank as the central bank.',
    answer_text: 'Bangladesh Bank (established 1971, BB Ordinance 1972) is the central bank. Functions:\n\n1. Issuing currency notes and coins.\n2. Acting as banker, agent and adviser to the government.\n3. Regulating and supervising scheduled banks and financial institutions.\n4. Formulating and implementing monetary policy (repo, reverse repo, CRR, SLR).\n5. Managing foreign exchange reserves and exchange rate policy.\n6. Lender of last resort for commercial banks.\n7. Promoting payment systems (BACH, RTGS, mobile financial services).',
    difficulty: 'hard', tags: ['bank', 'written'], exam: 'Bangladesh Bank Assistant Director', views: 2031,
  },
];
// ::PART3::
const QUESTIONS_B = [
  // ===== BCS / GOVT =====
  {
    categoryId: categoryIds['bcs-govt'], qtype: 'mcq',
    title: 'Who is called the father of the computer?',
    question_text: 'The person known as the father of the computer —',
    options: ['Alan Turing', 'Charles Babbage', 'John von Neumann', 'Blaise Pascal'],
    correct_answer: 'B', answer_text: 'Charles Babbage is called the father of the computer for designing the Analytical Engine in the 1830s.',
    difficulty: 'easy', tags: ['bcs', 'it', 'gk'], exam: 'BCS Preliminary', views: 3310,
  },
  {
    categoryId: categoryIds['bcs-govt'], qtype: 'mcq',
    title: 'Which one is not a network protocol?',
    question_text: 'Find the odd one out:',
    options: ['HTTP', 'SMTP', 'DHCP', 'HTML'],
    correct_answer: 'D', answer_text: 'HTML (HyperText Markup Language) is a markup language, not a network protocol. HTTP, SMTP and DHCP are protocols.',
    difficulty: 'medium', tags: ['bcs', 'it', 'networking'], exam: 'BCS Preliminary', views: 1890,
  },
  {
    categoryId: categoryIds['bcs-govt'], qtype: 'mcq',
    title: 'Article 1 of the Constitution of Bangladesh declares Bangladesh as —',
    question_text: 'According to the Constitution of Bangladesh, Article 1 states that Bangladesh is a —',
    options: ['Republic', 'Unitary independent sovereign Republic', 'Federal Republic', 'Islamic Republic'],
    correct_answer: 'B', answer_text: 'Article 1: "Bangladesh is a unitary, independent, sovereign Republic to be known as the People\u2019s Republic of Bangladesh."',
    difficulty: 'easy', tags: ['bcs', 'gk', 'bangladesh'], exam: 'BCS Preliminary', views: 2750,
  },
  {
    categoryId: categoryIds['bcs-govt'], qtype: 'written',
    title: 'Discuss the causes of inflation in Bangladesh.',
    question_text: 'BCS written question: analyse the main causes of inflation in the context of Bangladesh.',
    answer_text: 'Causes of inflation in Bangladesh:\n\n1. Demand-pull factors – rising remittance income, export earnings and government spending push aggregate demand above supply.\n2. Cost-push factors – higher import prices of fuel, food and raw materials raise production cost.\n3. Supply-side bottlenecks – natural disasters (floods, cyclones) cut food production.\n4. Fiscal causes – deficit financing / borrowing from Bangladesh Bank increases money supply.\n5. Structural factors – high dependence on imported essentials, weak market competition.\n6. Global factors – international commodity price hikes and exchange rate depreciation of Taka.',
    difficulty: 'hard', tags: ['bcs', 'written', 'economics'], exam: 'BCS Written', views: 1422,
  },

  // ===== POWER SECTOR =====
  {
    categoryId: categoryIds.power, qtype: 'mcq',
    title: '1 kWh is the unit of —',
    question_text: 'In electrical engineering, 1 kilowatt-hour (kWh) measures —',
    options: ['Power', 'Energy', 'Voltage', 'Current'],
    correct_answer: 'B', answer_text: 'kWh is the commercial unit of electrical energy. Energy (work) = Power × Time, so kWh = kilowatt × hour.',
    difficulty: 'easy', tags: ['power', 'electrical'], exam: 'BPDB Assistant Engineer', views: 940,
  },
  {
    categoryId: categoryIds.power, qtype: 'mcq',
    title: 'The SI unit of electric power is —',
    question_text: 'Electric power is measured in —',
    options: ['Volt', 'Ampere', 'Watt', 'Ohm'],
    correct_answer: 'C', answer_text: 'The SI unit of power is the Watt (W). 1 Watt = 1 Joule per second.',
    difficulty: 'easy', tags: ['power', 'electrical'], exam: 'DPDC Assistant Engineer', views: 1105,
  },
  {
    categoryId: categoryIds.power, qtype: 'written',
    title: 'Explain the difference between single-phase and three-phase power supply.',
    question_text: 'PGCB written question: compare single phase and three phase AC supply.',
    answer_text: 'Single-phase vs three-phase supply:\n\n• Conductors – Single phase uses 2 wires (phase + neutral); three phase uses 3 or 4 wires (R, Y, B + neutral).\n• Voltage – Single phase is 230 V; line-to-line three phase is 400 V in Bangladesh.\n• Efficiency – Three phase transmits more power with less conductor material.\n• Applications – Single phase for homes/light loads; three phase for industry, motors and power stations.\n• Power delivery – Three phase gives constant power; single phase pulsates.\n• Failure – A single-phase motor needs starting aid; three-phase motors self-start.',
    difficulty: 'medium', tags: ['power', 'written', 'electrical'], exam: 'PGCB Sub-Assistant Engineer', views: 1287,
  },
  {
    categoryId: categoryIds.power, qtype: 'mcq',
    title: 'Which organisation distributes electricity in Dhaka city?',
    question_text: 'Electricity distribution in Dhaka (South area) is mainly handled by —',
    options: ['REB', 'DPDC', 'BPDB', 'WZPDCL'],
    correct_answer: 'B', answer_text: 'DPDC (Dhaka Power Distribution Company) distributes electricity in the southern part of Dhaka; DESCO/NESCO cover other areas. BPDB is the generation/transmission body, WZPDCL covers western zones.',
    difficulty: 'medium', tags: ['power', 'gk'], exam: 'DPDC Assistant Engineer', views: 861,
  },
];
// ::PART4::
const QUESTIONS_C = [
  // ===== ENGINEERING & BUET =====
  {
    categoryId: categoryIds['engineering-buet'], qtype: 'mcq',
    title: "Newton's second law of motion is expressed as —",
    question_text: 'The mathematical relation of Newton\u2019s second law of motion is —',
    options: ['F = ma', 'F = mv', 'F = m/a', 'W = mg'],
    correct_answer: 'A', answer_text: "Newton's second law: F = m × a. Force equals mass times acceleration.",
    difficulty: 'easy', tags: ['engineering', 'physics'], exam: 'BUET Admission', views: 1520,
  },
  {
    categoryId: categoryIds['engineering-buet'], qtype: 'mcq',
    title: 'The first law of thermodynamics deals with —',
    question_text: 'The law of conservation of energy in thermodynamic form is known as —',
    options: ['Zeroth law', 'First law', 'Second law', 'Third law'],
    correct_answer: 'B', answer_text: 'The first law of thermodynamics states ΔQ = ΔU + ΔW — energy can neither be created nor destroyed, only converted.',
    difficulty: 'medium', tags: ['engineering', 'physics', 'thermodynamics'], exam: 'RUET Admission', views: 990,
  },
  {
    categoryId: categoryIds['engineering-buet'], qtype: 'written',
    title: 'Two forces of 3 N and 4 N act at right angles. Find the resultant force.',
    question_text: 'Two forces 3 N and 4 N act perpendicular to each other on a body. Calculate the magnitude of the resultant.',
    answer_text: 'Resultant of two perpendicular forces R = √(P² + Q²).\n\nR = √(3² + 4²) = √(9 + 16) = √25 = 5 N.\n\nDirection: tan θ = Q/P = 4/3 ⇒ θ ≈ 53.13° with the 3 N force.\n\nAnswer: 5 N.',
    difficulty: 'medium', tags: ['engineering', 'written', 'math'], exam: 'CUET Admission', views: 1338,
  },
  {
    categoryId: categoryIds['engineering-buet'], qtype: 'written',
    title: 'Define Young’s modulus and write its formula.',
    question_text: 'Engineering written question: define Young’s modulus of elasticity.',
    answer_text: "Young's modulus (E) is the ratio of longitudinal stress to longitudinal strain within the elastic limit.\n\nE = stress / strain = (F/A) / (ΔL/L)\n\nWhere: F = applied force, A = cross-sectional area, ΔL = change in length, L = original length.\nUnit: N/m² (Pascal). Steel ≈ 200 GPa, copper ≈ 120 GPa.",
    difficulty: 'medium', tags: ['engineering', 'written', 'mechanics'], exam: 'KUET Admission', views: 745,
  },

  // ===== IT & SOFTWARE =====
  {
    categoryId: categoryIds.it, qtype: 'mcq',
    title: 'Which protocol is used to send email over the internet?',
    question_text: 'Email sending uses which application-layer protocol?',
    options: ['IMAP', 'SMTP', 'POP3', 'FTP'],
    correct_answer: 'B', answer_text: 'SMTP (Simple Mail Transfer Protocol) is used for sending/relaying email. POP3/IMAP are used for receiving. FTP is for file transfer.',
    difficulty: 'easy', tags: ['it', 'networking'], exam: 'IT Job MCQ', views: 2210,
  },
  {
    categoryId: categoryIds.it, qtype: 'mcq',
    title: 'SQL stands for —',
    question_text: 'The full form of SQL is —',
    options: ['Structured Query Language', 'Simple Query Language', 'Standard Question Language', 'System Query Logic'],
    correct_answer: 'A', answer_text: 'SQL = Structured Query Language, used to manage and query relational databases.',
    difficulty: 'easy', tags: ['it', 'database'], exam: 'Software Company Test', views: 2645,
  },
  {
    categoryId: categoryIds.it, qtype: 'mcq',
    title: 'Which data structure follows the FIFO principle?',
    question_text: 'First In First Out (FIFO) is the property of —',
    options: ['Stack', 'Queue', 'Tree', 'Graph'],
    correct_answer: 'B', answer_text: 'A queue is a FIFO data structure (like a ticket line). A stack is LIFO.',
    difficulty: 'easy', tags: ['it', 'programming'], exam: 'IT Job MCQ', views: 1370,
  },
  {
    categoryId: categoryIds.it, qtype: 'written',
    title: 'Write an SQL query to find the second highest salary from an employee table.',
    question_text: 'You have a table employee(id, name, salary). Write SQL to return the second highest salary.',
    answer_text: 'Using LIMIT/OFFSET:\n\nSELECT DISTINCT salary FROM employee ORDER BY salary DESC LIMIT 1 OFFSET 1;\n\nPortable subquery version:\n\nSELECT MAX(salary) FROM employee\nWHERE salary < (SELECT MAX(salary) FROM employee);\n\nBoth return the second-highest distinct salary and handle duplicates correctly.',
    difficulty: 'medium', tags: ['it', 'written', 'database'], exam: 'Software Company Written Test', views: 1899,
  },
  {
    categoryId: categoryIds.it, qtype: 'written',
    title: 'Explain HTTP GET vs POST with examples.',
    question_text: 'IT written question: differentiate between GET and POST HTTP methods.',
    answer_text: 'GET vs POST:\n\n• Purpose – GET retrieves data; POST submits data (create/update).\n• Data location – GET sends parameters in the URL query string; POST sends them in the request body.\n• Visibility – GET data is visible in the address bar & history; POST data is not.\n• Length limit – GET is limited (URL length); POST supports large payloads.\n• Caching – GET can be cached/bookmarked; POST cannot.\n• Security – POST is safer for passwords; GET should never carry sensitive data.\nExample: GET /search?q=job – fetching results; POST /login – submitting credentials.',
    difficulty: 'medium', tags: ['it', 'written', 'web'], exam: 'Software Company Written Test', views: 1476,
  },
  {
    categoryId: categoryIds.it, qtype: 'mcq',
    title: 'In the OSI model, in which layer does HTTP operate?',
    question_text: 'HTTP protocol works at which layer of the OSI model?',
    options: ['Transport', 'Network', 'Application', 'Session'],
    correct_answer: 'C', answer_text: 'HTTP is an application-layer (Layer 7) protocol. TCP (transport) and IP (network) support it beneath.',
    difficulty: 'medium', tags: ['it', 'networking'], exam: 'IT Job MCQ', views: 1102,
  },
];
// ::PART5::
const QUESTIONS_D = [
  // ===== EDUCATION =====
  {
    categoryId: categoryIds.education, qtype: 'mcq',
    title: 'PISA (student assessment test) is conducted by —',
    question_text: 'The Programme for International Student Assessment (PISA) is organised by —',
    options: ['UNESCO', 'OECD', 'World Bank', 'UNDP'],
    correct_answer: 'B', answer_text: 'PISA is conducted by the OECD to evaluate 15-year-old students\u2019 reading, mathematics and science skills.',
    difficulty: 'medium', tags: ['education', 'gk'], exam: 'NTRCA', views: 690,
  },
  {
    categoryId: categoryIds.education, qtype: 'written',
    title: 'Discuss the importance of ICT in modern education.',
    question_text: 'NTRCA written question: explain the role of information technology in education.',
    answer_text: 'Importance of ICT in education:\n\n1. Access – virtual classrooms and e-learning reach remote students.\n2. Engagement – multimedia lessons improve understanding and attention.\n3. Skills – digital literacy prepares students for modern jobs.\n4. Teachers – online training and open resources upgrade teaching quality.\n5. Assessment – MCQ/e-assessment speeds up evaluation and feedback.\n6. Administration – result publishing, admission and record-keeping become transparent.\nChallenges remain: electricity, connectivity and teacher training.',
    difficulty: 'medium', tags: ['education', 'written', 'it'], exam: 'NTRCA Written', views: 804,
  },

  // ===== NGO & PRIVATE =====
  {
    categoryId: categoryIds['ngo-private'], qtype: 'mcq',
    title: 'Which one of the following is not an NGO?',
    question_text: 'Identify the organisation that is not a non-governmental organisation (NGO):',
    options: ['BRAC', 'ASA', 'UNICEF', 'Jagorani Chakra Foundation'],
    correct_answer: 'C', answer_text: 'UNICEF is an intergovernmental agency of the United Nations, not an NGO. BRAC, ASA and JCF are non-governmental organisations.',
    difficulty: 'easy', tags: ['ngo', 'gk'], exam: 'BRAC Job Test', views: 512,
  },
  {
    categoryId: categoryIds['ngo-private'], qtype: 'written',
    title: 'Write the key features of a professional job application letter.',
    question_text: 'Private/NGO job written question: what should a good job application letter contain?',
    answer_text: 'Features of a professional application letter:\n\n1. Sender details, date and recipient address.\n2. Subject line mentioning the applied position and circular reference.\n3. Formal salutation (Dear Sir/Madam).\n4. Introduction – who you are and where the vacancy was seen.\n5. Body – your qualification, experience and suitability.\n6. Enclosures list (CV, certificates, photo, ID).\n7. Politeness note – availability for interview.\n8. Complimentary close (Yours faithfully) and signature.\nKeep it within one page, error-free and specific to the job.',
    difficulty: 'easy', tags: ['ngo', 'written'], exam: 'bKash Job Written', views: 935,
  },

  // ===== MEDICAL =====
  {
    categoryId: categoryIds.medical, qtype: 'mcq',
    title: 'The normal human body temperature is approximately —',
    question_text: 'A healthy human body temperature is about —',
    options: ['36 °C', '37 °C', '38 °C', '39 °C'],
    correct_answer: 'B', answer_text: 'Normal body temperature is about 37 °C (98.6 °F). Above 38.3 °C is considered fever.',
    difficulty: 'easy', tags: ['medical', 'gk'], exam: 'Medical Admission', views: 1010,
  },
];

const QUESTIONS = [...QUESTIONS_A, ...QUESTIONS_B, ...QUESTIONS_C, ...QUESTIONS_D];

if (db.prepare('SELECT COUNT(*) AS c FROM questions').get().c === 0) {
  QUESTIONS.forEach((q) => addQuestion(q, usedSlugs));
  console.log(`Seeded ${QUESTIONS.length} questions.`);
} else {
  console.log('Questions already exist — skipping question seed.');
}

// ---------------------------------------------------------------- keyword tracker demo
const trackingCount = db.prepare('SELECT COUNT(*) AS c FROM keyword_tracker').get().c;
if (trackingCount === 0) {
  const kw = db.prepare('INSERT INTO keyword_tracker (keyword, search_volume, difficulty, cpc, competition) VALUES (?,?,?,?,?)');
  [
    ['bank job math solution', 8800, 42, 0.35, 'Medium'],
    ['bcs preliminary it questions', 5400, 38, 0.20, 'Low'],
    ['pgcb assistant engineer question', 3600, 51, 0.15, 'Medium'],
    ['buet admission question solve', 12200, 66, 0.25, 'High'],
  ].forEach((r) => kw.run(...r));
  console.log('Seeded 4 tracked keywords.');
}

if (require.main === module) {
  console.log('Seed complete ✔');
  console.log('Admin login  →  username: admin  ●  password: admin123');
  process.exit(0);
}

// Also usable as a module (server auto-seeds on first run) — never exits here.
module.exports = { runSeed: () => { /* body above already ran on require */ } };