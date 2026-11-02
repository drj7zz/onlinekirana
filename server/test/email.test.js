const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sendEmail,
  sendVerificationEmail,
  checkEmailProvider,
} = require('../lib/email');
const { hashVerificationToken, issueVerificationToken } = require('../lib/emailVerification');

function withEnv(t, values) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('email sender requires both a Resend API key and a verified sender setting', async (t) => {
  withEnv(t, { RESEND_API_KEY: '', EMAIL_FROM: '' });
  await assert.rejects(sendEmail({
    to: 'partner@example.test',
    subject: 'Test',
    text: 'Test',
    html: '<p>Test</p>',
  }), { code: 'EMAIL_NOT_CONFIGURED' });
});

test('email sender posts a transactional message to Resend without exposing provider errors', async (t) => {
  withEnv(t, { RESEND_API_KEY: 'test-key', EMAIL_FROM: 'OnlineKirana <no-reply@example.test>', EMAIL_REPLY_TO: '' });
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  let request;
  global.fetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return { ok: true, status: 200, json: async () => ({ id: 'test-email-id' }) };
  };

  const response = await sendEmail({
    to: 'partner@example.test',
    subject: 'Test',
    text: 'Text',
    html: '<p>HTML</p>',
  });
  assert.equal(response.id, 'test-email-id');
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.options.headers.Authorization, 'Bearer test-key');
  assert.deepEqual(request.body.to, ['partner@example.test']);
  assert.equal(request.body.from, 'OnlineKirana <no-reply@example.test>');
});

test('verification email safely escapes user content and creates a partner link', async (t) => {
  withEnv(t, {
    RESEND_API_KEY: 'test-key',
    EMAIL_FROM: 'no-reply@example.test',
    EMAIL_REPLY_TO: '',
    PARTNER_PORTAL_URL: 'https://partners.example.test',
    NODE_ENV: 'production',
  });
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  let message;
  global.fetch = async (_url, options) => {
    message = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({}) };
  };

  await sendVerificationEmail({ email: 'partner@example.test', name: '<img src=x>', role: 'merchant' }, 'a'.repeat(43));
  assert.match(message.text, /https:\/\/partners\.example\.test\/verify-email\?token=/);
  assert.match(message.html, /&lt;img src=x&gt;/);
  assert.doesNotMatch(message.html, /<img src=x>/);
});

test('Resend health check reports sender-domain verification without returning account data', async (t) => {
  withEnv(t, {
    RESEND_API_KEY: 'test-key',
    EMAIL_FROM: 'OnlineKirana <no-reply@example.test>',
  });
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ data: [{ name: 'example.test', status: 'verified' }] }),
  });
  assert.deepEqual(await checkEmailProvider(), { status: 'ok' });
});

test('verification tokens are stored as a hash and expire after one day', async () => {
  const user = { save: async () => {} };
  const token = await issueVerificationToken(user);
  assert.notEqual(user.emailVerificationTokenHash, token);
  assert.equal(user.emailVerificationTokenHash, hashVerificationToken(token));
  assert.ok(user.emailVerificationExpires.getTime() > Date.now());
  assert.ok(user.emailVerificationExpires.getTime() <= Date.now() + 24 * 60 * 60 * 1000);
});
