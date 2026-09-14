# 📘 IT job-preparation— Bangladesh Job Preparation Website

A complete IT job-preparation website for Bangladesh where every student can
**read solved question & answer (MCQ + Written)** for every job sector —
**BUET & Engineering, Power sector (BPDB/PGCB/DPDC), Bank, BCS/Govt, IT,
Education, NGO/Private, Medical** — with a **full admin panel**, **auto SEO
title/keyword suggestions** and **competition keyword research** to help you
earn from AdSense & ads.

## ✨ Features

### Public website (student friendly)
- Clean, mobile-first reading view for questions & answers
- MCQ with options + correct answer highlighted; Written with model answers
- Search, filters (sector / type / difficulty / newest / popular) + pagination
- **Recent IT questions sidebar** across every sector
- Category pages, tag pages, related questions
- Print + copy-answer buttons
- SEO: unique titles, meta descriptions, keywords, FAQ JSON-LD, `sitemap.xml`, `robots.txt`
- Monetization ready: header / in-content / sidebar AdSense slots + Google Analytics (configured in admin)

### Admin panel (`/admin`)
- Login (default `admin` / `admin123`)
- Dashboard: stats, questions-per-sector chart, recent & top questions
- Full CRUD for **questions** (MCQ & written, publish/draft toggle, feature)
- Full CRUD for **categories** (emoji icon + color + SEO fields)
- **✨ Auto SEO Suggest** inside the question form — generates ranking title,
  meta description and keywords from your question text (multiple title options)
- **🔍 Competition Keyword Research** — estimated volume / difficulty / CPC /
  competition / monthly potential, related long-tail suggestions, which of your
  own questions already target the phrase, and one-click tracking
- Contact messages inbox
- Settings: site name, tagline, AdSense codes, analytics ID, social links, password change

## 🚀 Run it

```bash
npm install
npm run seed      # optional: create demo data (categories, 28 questions, admin user)
npm start         # http://localhost:3000
```

Open:
- Website → `http://localhost:3000`
- Admin   → `http://localhost:3000/admin`  (admin / admin123)

> Change the admin password after first login (Admin → Settings → Change Password).

## 🗂️ Project structure

```
bd-job-prep/
├── server.js            # Express app, session, locals, mounts routes
├── db/
│   ├── init.js          # SQLite schema + helpers (better-sqlite3)
│   └── seed.js          # demo categories, 28 questions, admin user, keywords
├── lib/
│   ├── seo.js           # keyword extraction, SEO suggestions, keyword research
│   └── content.js       # queries: categories, questions, search, related, stats
├── routes/
│   ├── public.js        # homepage, lists, question, search, sitemap, robots
│   ├── admin.js         # login, dashboard, CRUD, SEO tools, messages, settings
│   └── api.js           # AJAX: /api/seo/suggest, /api/seo/research, /api/seo/track
├── middleware/auth.js   # admin session guard
├── views/               # EJS templates (public + admin)
└── public/              # css / js / static assets
```

Data is stored in `data/bdjob.db` (SQLite — no separate database server needed).

## 💡 Monetization workflow

1. Go to **Admin → SEO & Keywords** and research a topic (e.g. “bank job math solution”).
2. Pick keywords with **high volume + low difficulty** → **📌 Track** them.
3. In **Questions → Add Question**, write the question and press **✨ Generate Suggestions** —
   it fills the SEO title, meta description and keywords automatically.
4. Publish. Google ranks it, students visit, and your **AdSense** code (Admin → Settings → Monetization)
   earns you money on those pages.




