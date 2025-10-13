import { apiFetch } from "./client";

const getToken = (): string => {
  if (typeof window === 'undefined') {
    throw new Error('Authentication token not available on the server');
  }

  const token = window.localStorage.getItem('authToken');

  if (!token) {
    throw new Error('Authentication token not found. Please log in again.');
  }

  return token;
};

const authHeaders = (headers: Record<string, string> = {}) => {
  const token = getToken();

  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    ...headers,
  };
};

export type UpdateUserPayload = {
  name?: string;
  email?: string;
  password?: string;
  password_confirmation?: string;
};

export async function fetchCurrentUser() {
  const res = await apiFetch("/users/auth/me", {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Failed to load user profile: ${res.status}`);
  }

  return res.json();
}

export async function updateUser(id: number, payload: UpdateUserPayload) {
  const res = await apiFetch(`/users/${id}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `User update failed: ${res.status}`);
  }

  return res.json();
}
