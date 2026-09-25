import * as Joi from 'joi';

export default Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('production'),
  PORT: Joi.number().default(3000),

  DATABASE_URL: Joi.string().required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  BCRYPT_SALT_ROUNDS: Joi.number().default(12),

  REDIS_URL: Joi.string().required(),

  RATE_LIMIT_TTL: Joi.number().default(60),
  RATE_LIMIT_MAX: Joi.number().default(20),

  ACCOUNT_LOCKOUT_MAX_ATTEMPTS: Joi.number().default(5),
  ACCOUNT_LOCKOUT_DURATION_MINUTES: Joi.number().default(30),

  CORS_ORIGIN: Joi.string().default('*'),
  COOKIE_SECRET: Joi.string().min(16).required(),
});
