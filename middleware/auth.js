// Admin session guard.
function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  if (req.xhr || (req.headers.accept || '').includes('application/json')) {
    return res.status(401).json({ error: 'Login required' });
  }
  return res.redirect('/admin/login?next=' + encodeURIComponent(req.originalUrl));
}

module.exports = { requireAdmin };