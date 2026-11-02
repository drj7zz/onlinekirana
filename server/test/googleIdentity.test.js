const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const { verifyGoogleCredential } = require('../lib/googleIdentity');

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

test('Google verification reports missing server configuration', async (t) => {
  withEnv(t, { GOOGLE_CLIENT_ID: undefined });
  await assert.rejects(verifyGoogleCredential('credential'), {
    status: 503,
    code: 'GOOGLE_SIGN_IN_NOT_CONFIGURED',
  });
});

test('Google verification rejects oversized credentials without contacting Google', async (t) => {
  withEnv(t, { GOOGLE_CLIENT_ID: 'test-client-id' });
  await assert.rejects(verifyGoogleCredential('x'.repeat(12001)), {
    status: 401,
    code: 'GOOGLE_CREDENTIAL_INVALID',
  });
});

test('Google-only accounts can be created without a password while password accounts still require one', async () => {
  await new User({
    name: 'Google Customer',
    email: 'google@example.test',
    passwordless: true,
    googleSub: 'google-subject',
  }).validate();

  await assert.rejects(new User({
    name: 'Password Customer',
    email: 'password@example.test',
  }).validate(), (error) => Boolean(error.errors.password));
});
