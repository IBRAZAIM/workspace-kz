// WorkSpace.kz - API Client
// All frontend-to-backend communication goes through this module.

const API_BASE = 'http://localhost:3001/api';

// Token is stored as a plain string (just the JWT), not as JSON.
// Legacy: older code stored the whole user object as JSON under 'workspace_token'.
// We handle both below.
function _readToken() {
  const raw = localStorage.getItem('workspace_token');
  if (!raw || raw === 'null' || raw === 'undefined') return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && parsed.token) {
      return parsed.token;
    }
    if (typeof parsed === 'string') {
      return parsed;
    }
    return null;
  } catch {
    // If not JSON, it's a raw string (new format)
    return raw;
  }
}

async function apiCall(path, options = {}) {
  const token = _readToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  const resp = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Ошибка сети' }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

// ── Auth ───────────────────────────────────────────────────────
async function login(email, password) {
  const data = await apiCall('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem('workspace_token', data.token);
  localStorage.setItem('workspace_user', JSON.stringify(data.user));
  return data.user;
}

async function register({ name, phone, email, password, role }) {
  const data = await apiCall('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, phone, email, password, role }),
  });
  localStorage.setItem('workspace_token', data.token);
  localStorage.setItem('workspace_user', JSON.stringify(data.user));
  return data.user;
}

function logout() {
  localStorage.removeItem('workspace_token');
  localStorage.removeItem('workspace_user');
}

async function getProfile() {
  return apiCall('/auth/me');
}

async function updateProfile({ name, phone }) {
  const updated = await apiCall('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify({ name, phone }),
  });
  const cached = getCachedUser();
  if (cached) {
    localStorage.setItem('workspace_user', JSON.stringify({ ...cached, name: updated.name, phone: updated.phone }));
  }
  return updated;
}

function getCachedUser() {
  try {
    return JSON.parse(localStorage.getItem('workspace_user'));
  } catch {
    return null;
  }
}

async function initAuth() {
  if (!_readToken()) return null;
  try {
    const user = await apiCall('/auth/me');
    localStorage.setItem('workspace_user', JSON.stringify(user));
    return user;
  } catch {
    logout();
    return null;
  }
}

// ── Rooms ──────────────────────────────────────────────────────
async function getRooms(filters = {}) {
  try {
    const cleaned = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== '' && v != null)
    );
    const params = new URLSearchParams(cleaned).toString();
    return await apiCall(`/rooms${params ? '?' + params : ''}`);
  } catch (err) {
    console.warn('Backend unavailable, using static rooms:', err.message);
    return window.STATIC_ROOMS || [];
  }
}

async function getRoom(id) {
  try {
    return await apiCall(`/rooms/${id}`);
  } catch (err) {
    console.warn('Backend unavailable, finding in static rooms:', err.message);
    const rooms = window.STATIC_ROOMS || [];
    return rooms.find(r => String(r.id) === String(id)) || rooms[0] || null;
  }
}

async function getAvailability(roomId, date) {
  return apiCall(`/rooms/${roomId}/availability?date=${date}`);
}

// ── Bookings ───────────────────────────────────────────────────
async function getBookings() {
  return apiCall('/bookings');
}

async function addBooking({ room_id, slots, booking_date }) {
  return apiCall('/bookings', {
    method: 'POST',
    body: JSON.stringify({ room_id, slots, booking_date }),
  });
}

async function cancelBooking(id) {
  return apiCall(`/bookings/${id}/cancel`, { method: 'PATCH' });
}

// ── Host tools ─────────────────────────────────────────────────
async function getHostRooms() {
  return apiCall('/host/rooms');
}

async function getHostBookings() {
  return apiCall('/host/bookings');
}

async function createRoom(roomData) {
  return apiCall('/rooms', {
    method: 'POST',
    body: JSON.stringify(roomData),
  });
}

async function updateRoom(id, roomData) {
  return apiCall(`/rooms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(roomData),
  });
}

async function deleteRoom(id) {
  return apiCall(`/rooms/${id}`, { method: 'DELETE' });
}

async function blockSlots({ room_id, booking_date, slots }) {
  return apiCall(`/host/rooms/${room_id}/block`, {
    method: 'POST',
    body: JSON.stringify({ booking_date, slots }),
  });
}

// ── Admin ──────────────────────────────────────────────────────
// All admin endpoints require role === 'admin' on the backend (JWT-verified).

// Users
async function adminGetUsers() {
  return apiCall('/admin/users');
}

async function adminCreateUser({ name, email, phone, password, role }) {
  return apiCall('/admin/users', {
    method: 'POST',
    body: JSON.stringify({ name, email, phone, password, role }),
  });
}

async function adminUpdateUser(id, { name, email, phone, role }) {
  return apiCall(`/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, email, phone, role }),
  });
}

async function adminDeleteUser(id) {
  return apiCall(`/admin/users/${id}`, { method: 'DELETE' });
}

// Rooms (admin sees all, not just own)
async function adminGetRooms() {
  return apiCall('/admin/rooms');
}

async function adminCreateRoom(roomData) {
  return apiCall('/admin/rooms', {
    method: 'POST',
    body: JSON.stringify(roomData),
  });
}

async function adminUpdateRoom(id, roomData) {
  return apiCall(`/admin/rooms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(roomData),
  });
}

async function adminDeleteRoom(id) {
  return apiCall(`/admin/rooms/${id}`, { method: 'DELETE' });
}

// Bookings (admin sees all)
async function adminGetBookings() {
  return apiCall('/admin/bookings');
}

async function adminCreateBooking(payload) {
  return apiCall('/admin/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function adminUpdateBooking(id, payload) {
  return apiCall(`/admin/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

async function adminDeleteBooking(id) {
  return apiCall(`/admin/bookings/${id}`, { method: 'DELETE' });
}

// Stats summary
async function adminGetStats() {
  return apiCall('/admin/stats');
}

// ── Export ─────────────────────────────────────────────────────
window.api = {
  // auth
  login, register, logout, initAuth,
  getProfile, updateProfile, getCachedUser,
  // rooms
  getRooms, getRoom, getAvailability,
  // bookings
  getBookings, addBooking, cancelBooking,
  // host
  getHostRooms, getHostBookings, createRoom, updateRoom, deleteRoom, blockSlots,
  // admin
  adminGetUsers, adminCreateUser, adminUpdateUser, adminDeleteUser,
  adminGetRooms, adminCreateRoom, adminUpdateRoom, adminDeleteRoom,
  adminGetBookings, adminCreateBooking, adminUpdateBooking, adminDeleteBooking,
  adminGetStats,
  // util
  getToken: () => _readToken(),
};