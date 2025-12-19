const Joi = require('joi');
const { ValidationError } = require('./customErrors');

// Common validation schemas
const schemas = {
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])'))
    .required()
    .messages({
      'string.pattern.base': 'Password must contain lowercase, uppercase, number, and special character',
    }),
  name: Joi.string().min(2).max(100).required(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  address: Joi.string().min(5).max(255),
  city: Joi.string().min(2).max(100),
  price: Joi.number().positive().precision(2).required(),
  description: Joi.string().min(10).max(1000),
  imageUrl: Joi.string().uri(),
};

// Validation schemas
const validationSchemas = {
  register: Joi.object({
    name: schemas.name,
    email: schemas.email,
    password: schemas.password,
    phone: schemas.phone.optional(),
    address: schemas.address,
    city: schemas.city,
  }),

  login: Joi.object({
    email: schemas.email,
    password: Joi.string().required(),
  }),

  updateProfile: Joi.object({
    name: schemas.name.optional(),
    phone: schemas.phone.optional(),
    address: schemas.address.optional(),
    city: schemas.city.optional(),
  }).min(1),

  createRestaurant: Joi.object({
    name: schemas.name,
    description: schemas.description,
    city: schemas.city,
    address: schemas.address,
    cuisine: Joi.array().items(Joi.string()).min(1),
  }),

  updateRestaurant: Joi.object({
    name: schemas.name.optional(),
    description: schemas.description.optional(),
    city: schemas.city.optional(),
    address: schemas.address.optional(),
    cuisine: Joi.array().items(Joi.string()).optional(),
  }).min(1),

  createDish: Joi.object({
    name: schemas.name,
    description: schemas.description,
    price: schemas.price,
    available: Joi.boolean().default(true),
  }),

  updateDish: Joi.object({
    name: schemas.name.optional(),
    description: schemas.description.optional(),
    price: schemas.price.optional(),
    available: Joi.boolean().optional(),
  }).min(1),

  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),

  search: Joi.object({
    query: Joi.string().min(1).max(100),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),
};

// Validation function
const validate = (data, schema) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    throw new ValidationError('Validation failed', details);
  }

  return value;
};

module.exports = {
  validate,
  validationSchemas,
  schemas,
};
