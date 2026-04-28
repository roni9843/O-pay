const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function getFaqs() {
  try {
    const res = await fetch(`${API_BASE}/api/landing-page/faqs`);
    if (!res.ok) throw new Error('Failed to fetch FAQs');
    return await res.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getSetting(key) {
  try {
    const res = await fetch(`${API_BASE}/api/landing-page/settings/${key}`);
    if (!res.ok) throw new Error('Failed to fetch setting');
    return await res.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}
export async function getSettings() {
  try {
    const res = await fetch(`${API_BASE}/api/landing-page/settings/all`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return await res.json();
  } catch (error) {
    console.error(error);
    return {};
  }
}

export async function getPaymentPartners() {
  try {
    const res = await fetch(`${API_BASE}/api/payment-partners`);
    if (!res.ok) throw new Error('Failed to fetch partners');
    return await res.json();
  } catch (error) {
    console.error(error);
    return [];
  }
}
// Admin Authentication
export async function login(payload) {
  const res = await fetch(`${API_BASE}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
     const data = await res.json().catch(() => null);
     throw new Error((data && data.message) || 'Login failed');
  }
  return await res.json();
}

export async function me(token) {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return await res.json();
}

// Admin Landing Page Management
export async function getAdminFAQs(token) {
  const res = await fetch(`${API_BASE}/api/landing-page/admin/faqs`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return []; // Handle error gracefully or throw
  return await res.json();
}

export async function createFAQ(token, payload) {
  const res = await fetch(`${API_BASE}/api/landing-page/faqs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to create FAQ');
  return await res.json();
}

export async function updateFAQ(token, id, payload) {
  const res = await fetch(`${API_BASE}/api/landing-page/faqs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to update FAQ');
  return await res.json();
}

export async function deleteFAQ(token, id) {
  const res = await fetch(`${API_BASE}/api/landing-page/faqs/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to delete FAQ');
  return await res.json();
}

export async function getAllLandingSettings() {
  const res = await fetch(`${API_BASE}/api/landing-page/settings/all`);
  return await res.json();
}

export async function saveBulkLandingSettings(token, settings) {
  const res = await fetch(`${API_BASE}/api/landing-page/settings/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ settings })
  });
  if (!res.ok) throw new Error('Failed to save settings');
  return await res.json();
}

export async function uploadLandingVideo(token, file) {
  const formData = new FormData();
  formData.append('video', file);
  const res = await fetch(`${API_BASE}/api/uploads/landing-video`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || 'Video upload failed');
  return data;
}

export async function uploadPaymentPageImage(token, file) {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${API_BASE}/api/uploads/payment-page-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || 'Image upload failed');
  return data;
}

// Payment Partners (Admin)
export async function getPaymentPartnersAdmin(token) {
   const res = await fetch(`${API_BASE}/api/payment-partners/admin`, {
     headers: { Authorization: `Bearer ${token}` }
   });
   if (!res.ok) return [];
   return await res.json();
}

export async function createPaymentPartner(token, payload) {
  const res = await fetch(`${API_BASE}/api/payment-partners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to create partner');
  return await res.json();
}

export async function deletePaymentPartner(token, id) {
  const res = await fetch(`${API_BASE}/api/payment-partners/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to delete partner');
  return await res.json();
}

const api = {
  getFaqs,
  getSetting,
  getSettings,
  getPaymentPartners,
  // Admin
  login,
  me,
  getAdminFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  getAllLandingSettings,
  saveBulkLandingSettings,
  uploadLandingVideo,
  uploadPaymentPageImage,
  getPaymentPartnersAdmin,
  createPaymentPartner,
  deletePaymentPartner
};

export default api;
