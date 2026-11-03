const { OAuth2Client } = require('google-auth-library');
const { cleanStr } = require('../middleware/validate');

async function verifyGoogleCredential(credential) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    const error = new Error('Google sign-in is not configured.');
    error.status = 503;
    error.code = 'GOOGLE_SIGN_IN_NOT_CONFIGURED';
    throw error;
  }
  if (typeof credential !== 'string' || credential.length > 12000) {
    const error = new Error('Google sign-in could not be verified.');
    error.status = 401;
    error.code = 'GOOGLE_CREDENTIAL_INVALID';
    throw error;
  }

  let payload;
  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    const error = new Error('Google sign-in could not be verified. Please try again.');
    error.status = 401;
    error.code = 'GOOGLE_CREDENTIAL_INVALID';
    throw error;
  }

  const email = String(payload?.email || '').trim().toLowerCase();
  if (!payload?.sub || !payload.email_verified || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    const error = new Error('Use a Google account with a verified email address.');
    error.status = 401;
    error.code = 'GOOGLE_EMAIL_UNVERIFIED';
    throw error;
  }

  return {
    sub: payload.sub,
    email,
    name: cleanStr(payload.name || email.split('@')[0], 60),
    picture: typeof payload.picture === 'string' && payload.picture.startsWith('https://')
      ? payload.picture
      : '',
  };
}

module.exports = { verifyGoogleCredential };
