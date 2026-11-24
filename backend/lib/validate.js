const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ORDER_NUMBER_PATTERN = /^DOT-[A-Z0-9]{6}$/;

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanPhone(value) {
  return str(value).replace(/[\s-]/g, '');
}

function checkLength(value, label, min, max) {
  if (value.length < min) {
    return min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`;
  }
  if (value.length > max) return `${label} must be ${max} characters or less.`;
  return null;
}

module.exports = {
  PHONE_PATTERN, EMAIL_PATTERN, DATE_PATTERN, ORDER_NUMBER_PATTERN,
  str, cleanPhone, checkLength
};
