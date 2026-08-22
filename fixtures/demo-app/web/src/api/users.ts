const BASE = '/api';

export async function fetchUser(id: string) {
  const res = await fetch(`${BASE}/users/${id}`);
  return res.json();
}

export async function listUsers() {
  const res = await fetch('/api/users');
  return res.json();
}

export async function removeUser(id: string) {
  return fetch(`${BASE}/users/${id}`, { method: 'DELETE' });
}
