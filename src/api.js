const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');

async function apiRequest(path, options = {}) {
  const { method = 'GET', token, body, signal } = options;

  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }

  return payload;
}

export async function login(email, password) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export async function registerAccount(form) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: form,
  });
}

export async function fetchMe(token) {
  return apiRequest('/auth/me', { token });
}

export async function logout(token) {
  return apiRequest('/auth/logout', {
    method: 'POST',
    token,
  });
}

export async function fetchMedications(token) {
  return apiRequest('/medications', { token });
}

export async function createMedication(token, medication) {
  return apiRequest('/medications', {
    method: 'POST',
    token,
    body: medication,
  });
}

export async function deleteMedication(token, medicationId) {
  return apiRequest(`/medications/${encodeURIComponent(medicationId)}`, {
    method: 'DELETE',
    token,
  });
}

export async function fetchLogs(token) {
  return apiRequest('/logs', { token });
}

export async function fetchNotifications(token) {
  return apiRequest('/notifications', { token });
}

export async function fetchPatients(token) {
  return apiRequest('/users/patients', { token });
}

export async function markMedicationTaken(token, medicationId) {
  return apiRequest(`/medications/${encodeURIComponent(medicationId)}/taken`, {
    method: 'POST',
    token,
  });
}

export async function escalateMedication(token, medicationId) {
  return apiRequest(`/medications/${encodeURIComponent(medicationId)}/escalate`, {
    method: 'POST',
    token,
  });
}

export async function fetchHealthNews() {
  return apiRequest('/public/news');
}

export async function fetchPharmacies() {
  return apiRequest('/public/pharmacies');
}

export async function fetchDistricts() {
  return apiRequest('/public/districts');
}

export async function fetchDirectory(district, type = 'both') {
  const query = new URLSearchParams({
    district,
    type,
  });
  return apiRequest(`/public/directory?${query.toString()}`);
}
