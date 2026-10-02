const { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, t } = require('../i18n');

/**
 * Express middleware to resolve language from query, header, or user profile,
 * and attach req.lang and req.t(key, params) to the request object.
 */
function i18nMiddleware(req, res, next) {
  let selectedLang = null;

  // 1. Check query parameter: ?lang=gu or ?lang=gujlish
  if (req.query && req.query.lang) {
    const qLang = String(req.query.lang).toLowerCase().trim();
    if (SUPPORTED_LANGUAGES.includes(qLang)) {
      selectedLang = qLang;
    }
  }

  // 2. Check X-Language header
  if (!selectedLang && req.headers['x-language']) {
    const hLang = String(req.headers['x-language']).toLowerCase().trim();
    if (SUPPORTED_LANGUAGES.includes(hLang)) {
      selectedLang = hLang;
    }
  }

  // 3. Check Accept-Language standard header
  if (!selectedLang && req.headers['accept-language']) {
    const raw = String(req.headers['accept-language']).toLowerCase();
    if (raw.includes('gujlish')) {
      selectedLang = 'gujlish';
    } else if (raw.startsWith('gu')) {
      selectedLang = 'gu';
    } else if (raw.startsWith('en')) {
      selectedLang = 'en';
    }
  }

  // 4. Check authenticated user's preferred language if set
  if (!selectedLang && req.user && req.user.preferredLanguage) {
    if (SUPPORTED_LANGUAGES.includes(req.user.preferredLanguage)) {
      selectedLang = req.user.preferredLanguage;
    }
  }

  // 5. Check authenticated shop's default language
  if (!selectedLang && req.user && req.user.shop && req.user.shop.defaultLanguage) {
    if (SUPPORTED_LANGUAGES.includes(req.user.shop.defaultLanguage)) {
      selectedLang = req.user.shop.defaultLanguage;
    }
  }

  const finalLang = selectedLang || DEFAULT_LANGUAGE;

  req.lang = finalLang;
  req.t = (key, params) => t(key, finalLang, params);

  res.setHeader('Content-Language', finalLang);
  next();
}

module.exports = {
  i18nMiddleware,
};
