const enLocale = require('./locales/en.json');
const guLocale = require('./locales/gu.json');
const gujlishLocale = require('./locales/gujlish.json');

const SUPPORTED_LANGUAGES = ['en', 'gu', 'gujlish'];
const DEFAULT_LANGUAGE = 'en';

const DICTIONARIES = {
  en: enLocale,
  gu: guLocale,
  gujlish: gujlishLocale,
};

const LANGUAGES_META = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    script: 'Latin',
    isRtl: false,
    description: 'Standard English commercial terminology',
  },
  {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    script: 'Gujarati',
    isRtl: false,
    description: 'Native Gujarati script for farmers, receipts, and compliance',
  },
  {
    code: 'gujlish',
    name: 'Gujlish',
    nativeName: 'Gujlish (ગુજરાતી અંગ્રેજીમાં)',
    script: 'Latin',
    isRtl: false,
    description: 'Phonetic Gujarati in English alphabet, standard on WhatsApp & SMS',
  },
];

/**
 * Resolve nested object property via dot notation (e.g., 'whatsapp.farmerStatementTitle')
 */
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((prev, curr) => (prev ? prev[curr] : undefined), obj);
}

/**
 * Interpolate template variables: e.g. "Total is {amount}" with { amount: 500 }
 */
function interpolate(template, params = {}) {
  if (typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{${key}}`;
  });
}

/**
 * Core translation helper
 * @param {string} key - Dot notation key, e.g., 'billing.totalAmount'
 * @param {string} [lang='en'] - Target language: 'en', 'gu', or 'gujlish'
 * @param {object} [params={}] - Dynamic parameters to inject
 * @returns {string} Translated and interpolated string
 */
function t(key, lang = DEFAULT_LANGUAGE, params = {}) {
  const normalizedLang = SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;

  // 1. Try target language dictionary
  let value = getNestedValue(DICTIONARIES[normalizedLang], key);

  // 2. Fallback to English dictionary if missing in target
  if (value === undefined && normalizedLang !== DEFAULT_LANGUAGE) {
    value = getNestedValue(DICTIONARIES[DEFAULT_LANGUAGE], key);
  }

  // 3. Fallback to raw key if not found anywhere
  if (value === undefined) {
    return key;
  }

  return interpolate(value, params);
}

/**
 * Returns complete dictionary for frontend hydration
 */
function getDictionary(lang = DEFAULT_LANGUAGE) {
  const normalizedLang = SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
  return DICTIONARIES[normalizedLang] || DICTIONARIES.en;
}

/**
 * Format currency with Indian grouping
 */
function formatCurrency(amount, lang = DEFAULT_LANGUAGE) {
  const num = Number(amount || 0);
  const formatted = num.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });

  if (lang === 'gu') {
    // Optionally return with ₹ symbol in Gujarati
    return `₹${formatted}`;
  }
  return `₹${formatted}`;
}

/**
 * Localized date formatter
 */
function formatDate(date, lang = DEFAULT_LANGUAGE) {
  if (!date) return 'N/A';
  const locale = lang === 'gu' ? 'gu-IN' : 'en-IN';
  try {
    return new Date(date).toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return new Date(date).toLocaleDateString('en-IN');
  }
}

module.exports = {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGES_META,
  t,
  getDictionary,
  formatCurrency,
  formatDate,
};
