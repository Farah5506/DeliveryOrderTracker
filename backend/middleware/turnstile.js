const { AppError } = require('../lib/errors');

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
let warned = false;

async function verifyTurnstile(req, res, next) {
  const secret = (process.env.TURNSTILE_SECRET_KEY || '').trim();

  if (!secret) {
    if (!warned) {
      console.warn('[turnstile] TURNSTILE_SECRET_KEY is empty: bot check is OFF');
      warned = true;
    }
    return next();
  }

  const token = (req.body && req.body.turnstileToken) || req.query.turnstileToken || '';
  if (!token) {
    throw new AppError(403, 'BOT_CHECK_FAILED', 'Please complete the bot check and try again.');
  }

  let result;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({ secret, response: String(token) }),
      signal: controller.signal
    });
    clearTimeout(timer);
    result = await response.json();
  } catch (error) {
    console.warn(`[turnstile] Cloudflare could not be reached: ${error.name}`);
    throw new AppError(503, 'BOT_CHECK_UNAVAILABLE', 'The bot check could not be completed. Please try again.');
  }

  if (!result || result.success !== true) {
    throw new AppError(403, 'BOT_CHECK_FAILED', 'The bot check failed. Please try again.');
  }
  next();
}

module.exports = { verifyTurnstile };
