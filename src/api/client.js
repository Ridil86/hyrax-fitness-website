const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';

async function request(method, path, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = token;
  }

  const opts = { method, headers };
  if (body) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_URL}${path}`, opts);
  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data.error || `Request failed: ${res.status}`);
    error.status = res.status;
    throw error;
  }

  return data;
}

export function apiGet(path, token) {
  return request('GET', path, { token });
}

export function apiPost(path, body, token) {
  return request('POST', path, { body, token });
}

export function apiPut(path, body, token) {
  return request('PUT', path, { body, token });
}

export function apiDelete(path, token) {
  return request('DELETE', path, { token });
}
