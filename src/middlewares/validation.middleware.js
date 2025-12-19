const { validate, validationSchemas } = require('../utils/validators');
const { ValidationError } = require('../utils/customErrors');

const validationMiddleware = (schemaName) => {
  return (req, res, next) => {
    try {
      const schema = validationSchemas[schemaName];
      
      if (!schema) {
        throw new Error(`Validation schema '${schemaName}' not found`);
      }

      const dataToValidate = {
        ...req.body,
        ...req.query,
      };

      const validatedData = validate(dataToValidate, schema);
      req.validatedData = validatedData;
      
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      next(error);
    }
  };
};

module.exports = validationMiddleware;
