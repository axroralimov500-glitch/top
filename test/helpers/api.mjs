export const ADMIN_SECOND_PASSWORD = process.env.ADMIN_SECOND_PASSWORD || 'devament';

export function api(baseUrl) {
  async function request(method, p, { token, body } = {}) {
    const res = await fetch(baseUrl + p, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, body: data };
  }
  return {
    get: (p, token) => request('GET', p, { token }),
    post: (p, body, token) => request('POST', p, { token, body }),
    patch: (p, body, token) => request('PATCH', p, { token, body }),
    del: (p, token) => request('DELETE', p, { token }),
  };
}

export async function register(api_, name, email, password) {
  const { status, body } = await api_.post('/auth/register', { name, email, password });
  if (status !== 201) throw new Error(`register failed: ${status} ${JSON.stringify(body)}`);
  return body.data; // { token, user }
}

export async function login(api_, email, password) {
  const { status, body } = await api_.post('/auth/login', { email, password });
  if (status !== 200) throw new Error(`login failed: ${status} ${JSON.stringify(body)}`);
  return body.data;
}

// Admin — ikki bosqichli kirish: hisob paroli, so'ng ikkinchi parol.
export async function adminLogin(api_, email, password, secondPassword = ADMIN_SECOND_PASSWORD) {
  const first = await api_.post('/auth/admin/login', { email, password });
  if (first.status !== 200) throw new Error(`admin step1 failed: ${first.status} ${JSON.stringify(first.body)}`);
  const second = await api_.post('/auth/admin/verify', {
    challenge: first.body.data.challenge,
    second_password: secondPassword,
  });
  if (second.status !== 200) throw new Error(`admin step2 failed: ${second.status} ${JSON.stringify(second.body)}`);
  return second.body.data;
}
