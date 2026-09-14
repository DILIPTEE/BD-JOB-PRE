const path = require('path');
const express = require('express');
const session = require('express-session');

const { migrate, getSetting, siteBaseUrl, count } = require('./db/init');
const { listCategories, recentItQuestions } = require('./lib/content');
const { renderAnswer } = require('./lib/render');

// Ensure schema exists before serving.
migrate();

// Fresh database (e.g. first Render deploy): seed demo content. Idempotent.
if (count('questions') === 0) {
  console.log('Empty database detected — seeding initial content…');
  require('./db/seed');
}

const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'bd-job-prep-session-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 },
}));

// Shared locals for every render (site settings, nav categories, sidebar).
app.use((req, res, next) => {
  const settings = {};
  ['site_name', 'tagline', 'base_url', 'meta_keywords', 'footer_text', 'contact_email',
   'facebook', 'youtube', 'adsense_header', 'adsense_incontent', 'adsense_sidebar', 'analytics_id']
    .forEach((k) => { settings[k] = getSetting(k); });
  // In production (Render) use the real public URL for canonical/sitemap links.
  settings.base_url = siteBaseUrl();

  res.locals.site = settings;
  res.locals.categories = listCategories();
  res.locals.recentIt = recentItQuestions(7);
  res.locals.path = req.path;
  res.locals.query = req.query || {};
  res.locals.flash = req.query.msg || '';
  res.locals.admin = req.session && req.session.admin ? req.session.admin : null;
  res.locals.jsonLd = null;
  res.locals.keywords = settings.meta_keywords;
  res.locals.renderAnswer = renderAnswer;
  next();
});

app.use('/', publicRoutes);
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

// 404 -------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page not found', metaDescription: '404', page: '' });
});

// Error handler -----------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong on the server.');
});

app.listen(PORT, () => {
  console.log(`✔ BD Job Prep running at http://localhost:${PORT}`);
  console.log(`  Admin panel → http://localhost:${PORT}/admin  (admin / admin123)`);
});