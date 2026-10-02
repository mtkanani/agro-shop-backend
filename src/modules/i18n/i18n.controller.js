const { LANGUAGES_META, getDictionary, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } = require('../../i18n');
const { successResponse } = require('../../utils/response');

/**
 * 1. Get supported languages metadata
 */
async function handleGetLanguages(req, res, next) {
  try {
    return successResponse(res, {
      languages: LANGUAGES_META,
      currentLanguage: req.lang || DEFAULT_LANGUAGE,
      defaultLanguage: DEFAULT_LANGUAGE,
    }, 'Supported languages retrieved successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * 2. Get full dictionary translations for requested language
 */
async function handleGetTranslations(req, res, next) {
  try {
    const lang = req.query.lang || req.lang || DEFAULT_LANGUAGE;
    const dictionary = getDictionary(lang);
    const resolvedLang = SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;

    return successResponse(res, {
      language: resolvedLang,
      translations: dictionary,
    }, `Translations for '${resolvedLang}' retrieved successfully`);
  } catch (error) {
    next(error);
  }
}

/**
 * 3. Get section translations (e.g. 'whatsapp', 'billing', 'categories')
 */
async function handleGetSectionTranslations(req, res, next) {
  try {
    const { section } = req.params;
    const lang = req.query.lang || req.lang || DEFAULT_LANGUAGE;
    const dictionary = getDictionary(lang);
    const resolvedLang = SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;

    const sectionData = dictionary[section];
    if (!sectionData) {
      const err = new Error(`Translation section '${section}' not found`);
      err.statusCode = 404;
      throw err;
    }

    return successResponse(res, {
      language: resolvedLang,
      section,
      translations: sectionData,
    }, `Translations for section '${section}' retrieved successfully`);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleGetLanguages,
  handleGetTranslations,
  handleGetSectionTranslations,
};
