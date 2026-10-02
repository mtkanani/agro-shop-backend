const { errorResponse } = require('../utils/response');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorDetails = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, ''),
      }));
      return errorResponse(res, 'Validation failed for request data', 400, errorDetails);
    }

    req[source] = value;
    next();
  };
}

module.exports = {
  validate,
};
