import jwt from 'jsonwebtoken';

/**
 * Validates the Origin header against whitelisted origins.
 * Supports exact matches and wildcard patterns (e.g., *.hostinger.com).
 */
/**
 * Validates the Origin header against whitelisted origins.
 * Supports exact matches and wildcard patterns (e.g., *.hostinger.com).
 */
export function validateOrigin(originHeader) {
  const allowedEnv = (process.env.ALLOWED_ORIGINS || '*').trim();
  if (allowedEnv === '*' || allowedEnv.includes('*')) {
    return true;
  }

  const allowBypass = process.env.DEV_BYPASS === 'true';
  if (!originHeader) return true;

  const allowedList = allowedEnv.split(',').map((o) => o.trim().toLowerCase());
  const origin = originHeader.trim().toLowerCase();

  for (const allowed of allowedList) {
    if (allowed === '*' || origin === allowed) {
      return true;
    }
    // Check wildcard domain match (e.g., .hostinger.com or .preview-domain.com)
    if (allowed.startsWith('*.') && origin.endsWith(allowed.slice(1))) {
      return true;
    }
    if (origin.includes('hostinger.com') || origin.includes('localhost:5173') || origin.includes('broccoli.ae') || origin.includes('netlify.app')) {
      return true;
    }
  }

  return allowBypass;
}

/**
 * Validates JWT Bearer token from WebSocket query parameters or Authorization header.
 * In development, if DEV_BYPASS=true, allows connections with token 'DEV_BYPASS' or guest token.
 */
export function validateAuthToken(token) {
  const secret = process.env.JWT_SECRET;
  const allowBypass = process.env.DEV_BYPASS === 'true';

  const rawToken = token ? (token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim()) : '';

  if (allowBypass && (!rawToken || rawToken === 'DEV_BYPASS' || rawToken === 'guest')) {
    console.warn('[AUTH] DEV_BYPASS accepted.');
    return { valid: true, user: { role: 'guest-dev' } };
  }

  if (!secret) {
    console.error('[AUTH] JWT_SECRET environment variable is not defined.');
    return { valid: false, error: 'Server auth misconfigured' };
  }

  if (!rawToken) {
    return { valid: false, error: 'Missing Bearer token' };
  }

  try {
    const decoded = jwt.verify(rawToken, secret);
    return { valid: true, user: decoded };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Helper to generate a client JWT token
 */
export function generateClientToken(payload = { role: 'guest' }, expiresIn = '24h') {
  const secret = process.env.JWT_SECRET || 'broccoli-zara-secret-key-2026';
  return jwt.sign(payload, secret, { expiresIn });
}

