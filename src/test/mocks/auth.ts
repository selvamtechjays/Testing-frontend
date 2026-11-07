import { http, HttpResponse } from 'msw';

export const USER = { id: '665f1c0e9b1d8a3f4c2e7a10', username: 'selvam' };

/** Backend refusal bodies exactly as the API sends them (plan section 3). */
export const unauthenticatedBody = {
  error: { code: 'UNAUTHENTICATED', message: 'Not signed in.' },
};
export const invalidCredentialsBody = {
  error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect username or password.' },
};
export const validationBody = {
  error: {
    code: 'VALIDATION',
    message: 'Validation failed',
    fields: {
      username: 'Enter a username and password.',
      password: 'Enter a username and password.',
    },
  },
};

export const meUnauthenticated = http.get('/api/auth/me', () =>
  HttpResponse.json(unauthenticatedBody, { status: 401 }),
);
export const meSignedIn = http.get('/api/auth/me', () => HttpResponse.json({ user: USER }));
