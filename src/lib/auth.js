import { getUsers, setUsers, getSession, setSession, clearSession, uid } from './storage';

function sanitize(user) {
  if (!user) return null;
  const { password: _pw, ...rest } = user;
  return rest;
}

export function login(username, password) {
  const users = getUsers();
  const user = users.find(
    (u) => u.username.toLowerCase() === String(username || '').trim().toLowerCase() && u.password === String(password || '')
  );
  if (!user) return { ok: false, message: 'Username atau kata sandi salah.' };
  if (user.disabled) return { ok: false, message: 'Akun dinonaktifkan. Hubungi admin.' };
  const session = { userId: user.id, role: user.role, loginAt: Date.now() };
  setSession(session);
  return { ok: true, user: sanitize(user) };
}

export function logout() {
  clearSession();
}

export function currentUser() {
  const session = getSession();
  if (!session) return null;
  const user = getUsers().find((u) => u.id === session.userId);
  if (!user || user.disabled) {
    clearSession();
    return null;
  }
  return sanitize(user);
}

export function registerBuyer(data) {
  const users = getUsers();
  const username = String(data.username || '').trim().toLowerCase();
  if (!data.name || !username || !data.password) return { ok: false, message: 'Nama, username, dan kata sandi wajib diisi.' };
  if (username.length < 3) return { ok: false, message: 'Username minimal 3 karakter.' };
  if (String(data.password).length < 6) return { ok: false, message: 'Kata sandi minimal 6 karakter.' };
  if (users.some((u) => u.username.toLowerCase() === username)) return { ok: false, message: 'Username sudah digunakan.' };
  const user = {
    id: uid('u'),
    name: String(data.name).trim(),
    username,
    password: String(data.password),
    role: 'buyer',
    phone: String(data.phone || '').trim(),
    address: String(data.address || '').trim(),
  };
  users.push(user);
  setUsers(users);
  setSession({ userId: user.id, role: 'buyer', loginAt: Date.now() });
  return { ok: true, user: sanitize(user) };
}
