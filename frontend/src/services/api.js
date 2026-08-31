/**
 * Student Election Management System - Frontend API Client
 * Connects securely to Backend API v1 endpoints
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Token Storage Keys
const TOKEN_KEY = 'sems_access_token';
const REFRESH_TOKEN_KEY = 'sems_refresh_token';
const USER_KEY = 'sems_user';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser() {
  const user = localStorage.getItem(USER_KEY);
  try {
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export function setStoredAuth(accessToken, refreshToken, user) {
  if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Generic API request wrapper with automatic Bearer token injection
 */
export async function apiRequest(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = { ...options.headers };

  // If payload is not FormData, default to application/json
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers
    });

    // Check for JSON response
    const contentType = res.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else if (contentType.includes('text/csv')) {
      const text = await res.text();
      return { ok: res.ok, status: res.status, data: text, isCsv: true };
    } else {
      data = { message: await res.text() };
    }

    if (!res.ok) {
      const error = new Error(data?.message || `Request failed with status ${res.status}`);
      error.status = res.status;
      error.errorCode = data?.errorCode || 'API_ERROR';
      error.details = data?.details || null;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
      // Optional: Auto-logout on expired token
      // clearStoredAuth();
    }
    throw error;
  }
}

// ==============================================================================
// 1. AUTHENTICATION SERVICES
// ==============================================================================

export async function registerUser(userData) {
  return await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
}

export async function loginUser(email, password) {
  return await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export async function verifyOtp(email, otp) {
  return await apiRequest('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp })
  });
}

export async function requestOtp(email) {
  return await apiRequest('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export async function resendOtp(email) {
  return await apiRequest('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export async function getCurrentUser() {
  return await apiRequest('/auth/me');
}

export async function logoutUser() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } finally {
    clearStoredAuth();
  }
}

// ==============================================================================
// 2. VOTER VERIFICATION SERVICES
// ==============================================================================

export async function uploadVerificationDocument(formData) {
  return await apiRequest('/verification/upload', {
    method: 'POST',
    body: formData
  });
}

export async function getVerificationStatus() {
  return await apiRequest('/verification/status');
}

export async function listPendingVerifications(page = 1, limit = 20) {
  return await apiRequest(`/verification/pending?page=${page}&limit=${limit}`);
}

export async function reviewVerificationApplication(documentId, status, rejectionReason = '') {
  return await apiRequest(`/verification/applications/${documentId}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ status, rejectionReason })
  });
}

// ==============================================================================
// 3. CANDIDATE SERVICES
// ==============================================================================

export async function generateCandidateCodes(electionId, count = 1, issuedToEmail = '', expiresInDays = 30) {
  return await apiRequest('/candidates/codes/generate', {
    method: 'POST',
    body: JSON.stringify({ electionId, count, issuedToEmail: issuedToEmail || undefined, expiresInDays })
  });
}

export async function listCandidateCodes(electionId = '', status = '', page = 1) {
  const query = new URLSearchParams();
  if (electionId) query.append('electionId', electionId);
  if (status) query.append('status', status);
  query.append('page', page);
  return await apiRequest(`/candidates/codes?${query.toString()}`);
}

export async function revokeCandidateCode(codeId) {
  return await apiRequest(`/candidates/codes/${codeId}/revoke`, {
    method: 'PATCH'
  });
}

export async function applyForCandidacy(formData) {
  return await apiRequest('/candidates/apply', {
    method: 'POST',
    body: formData
  });
}

export async function listCandidateApplications(electionId = '', status = '', page = 1) {
  const query = new URLSearchParams();
  if (electionId) query.append('electionId', electionId);
  if (status) query.append('status', status);
  query.append('page', page);
  return await apiRequest(`/candidates/applications?${query.toString()}`);
}

export async function getCandidateApplicationDetails(id) {
  return await apiRequest(`/candidates/applications/${id}`);
}

export async function reviewCandidateApplication(applicationId, status, rejectionReason = '') {
  return await apiRequest(`/candidates/applications/${applicationId}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ status, rejectionReason })
  });
}

export async function listApprovedCandidates(electionId, positionId = '') {
  const query = positionId ? `?positionId=${positionId}` : '';
  return await apiRequest(`/candidates/elections/${electionId}${query}`);
}

export async function getCandidateProfile(id) {
  return await apiRequest(`/candidates/${id}`);
}

export async function getMyCandidateApplication(electionId) {
  return await apiRequest(`/candidates/me/application?electionId=${electionId}`);
}

// ==============================================================================
// 4. ELECTION MANAGEMENT SERVICES
// ==============================================================================

export async function listElections(status = '') {
  const query = status ? `?status=${status}` : '';
  return await apiRequest(`/elections${query}`);
}

export async function getElectionDetails(id) {
  return await apiRequest(`/elections/${id}`);
}

export async function createElection(electionData) {
  return await apiRequest('/elections', {
    method: 'POST',
    body: JSON.stringify(electionData)
  });
}

export async function updateElection(id, updateData) {
  return await apiRequest(`/elections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updateData)
  });
}

export async function listAllPositions() {
  return await apiRequest('/elections/positions/all');
}

export async function assignPositionsToElection(electionId, positionIds) {
  return await apiRequest(`/elections/${electionId}/positions`, {
    method: 'POST',
    body: JSON.stringify({ positionIds })
  });
}

export async function openElection(id) {
  return await apiRequest(`/elections/${id}/open`, {
    method: 'PATCH'
  });
}

export async function closeElection(id) {
  return await apiRequest(`/elections/${id}/close`, {
    method: 'PATCH'
  });
}

export async function getElectionStats(id) {
  return await apiRequest(`/elections/${id}/stats`);
}

// ==============================================================================
// 5. VOTING SERVICES
// ==============================================================================

export async function requestVotingOtp(electionId = '') {
  return await apiRequest('/votes/request-otp', {
    method: 'POST',
    body: JSON.stringify({ electionId })
  });
}

export async function submitBallot(electionId, votes, otp = '') {
  return await apiRequest('/votes', {
    method: 'POST',
    body: JSON.stringify({ electionId, votes, otp: otp || undefined })
  });
}

export async function getVoterVotingStatus(electionId) {
  return await apiRequest(`/votes/status?electionId=${electionId}`);
}

export async function verifyBallotReceipt(receiptHash) {
  return await apiRequest(`/votes/verify/${receiptHash}`);
}

// ==============================================================================
// 6. RESULTS SERVICES (Rule 5 Enforced)
// ==============================================================================

export async function getPublicResults(electionId) {
  return await apiRequest(`/results/${electionId}`);
}

export async function calculateResults(electionId) {
  return await apiRequest(`/results/${electionId}/calculate`, {
    method: 'POST'
  });
}

export async function publishResults(electionId) {
  return await apiRequest(`/results/${electionId}/publish`, {
    method: 'POST'
  });
}

export async function getAdminResultsPreview(electionId) {
  return await apiRequest(`/results/${electionId}/admin-preview`);
}

// ==============================================================================
// 7. FEED & TRENDS SERVICES
// ==============================================================================

export async function listFeedPosts(postType = '', authorRole = '', search = '', page = 1) {
  const query = new URLSearchParams();
  if (postType) query.append('postType', postType);
  if (authorRole) query.append('authorRole', authorRole);
  if (search) query.append('search', search);
  query.append('page', page);
  return await apiRequest(`/feed?${query.toString()}`);
}

export async function createFeedPost(postData) {
  const isFormData = postData instanceof FormData;
  return await apiRequest('/feed', {
    method: 'POST',
    body: isFormData ? postData : JSON.stringify(postData)
  });
}

export async function deleteFeedPost(id) {
  return await apiRequest(`/feed/${id}`, {
    method: 'DELETE'
  });
}

export async function togglePinPost(id) {
  return await apiRequest(`/feed/${id}/pin`, {
    method: 'PATCH'
  });
}

// ==============================================================================
// ==============================================================================
// 8. AUDIT LOG & USER MANAGEMENT SERVICES (Admin Only)
// ==============================================================================

export async function listAuditLogs(filters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) query.append(k, v);
  });
  return await apiRequest(`/audit-logs?${query.toString()}`);
}

export async function getAuditSummary() {
  return await apiRequest('/audit-logs/summary');
}

export async function exportAuditLogs(format = 'json') {
  return await apiRequest(`/audit-logs/export?format=${format}`);
}

export async function listUsers(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') query.append(k, v);
  });
  return await apiRequest(`/admin/users?${query.toString()}`);
}

export async function createStaffUser(userData) {
  return await apiRequest('/admin/users/create-staff', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
}

export async function updateUserRole(id, role) {
  return await apiRequest(`/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role })
  });
}

export async function updateUserStatus(id, status) {
  return await apiRequest(`/admin/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

export async function requestPasswordReset(email) {
  return await apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export async function resetPasswordWithOtp(email, otp, newPassword) {
  return await apiRequest('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, otp, newPassword })
  });
}

export async function listAllUsersAdmin(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);
  if (params.role) query.append('role', params.role);
  if (params.status) query.append('status', params.status);
  if (params.verificationStatus) query.append('verificationStatus', params.verificationStatus);
  if (params.search) query.append('search', params.search);

  const qs = query.toString() ? `?${query.toString()}` : '';
  return await apiRequest(`/admin/users${qs}`);
}

export async function createUserAdmin(userData) {
  return await apiRequest('/admin/users', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
}

export async function deleteUserAdmin(id) {
  return await apiRequest(`/admin/users/${id}`, {
    method: 'DELETE'
  });
}

export async function deleteElectionAdmin(id) {
  return await apiRequest(`/admin/elections/${id}`, {
    method: 'DELETE'
  });
}

// ==============================================================================
// 9. NOTIFICATIONS & PINGS
// ==============================================================================

export async function getNotifications() {
  return await apiRequest('/notifications');
}

export async function markNotificationRead(id) {
  return await apiRequest(`/notifications/${id}/read`, {
    method: 'PATCH'
  });
}

export async function markAllNotificationsRead() {
  return await apiRequest('/notifications/read-all', {
    method: 'PATCH'
  });
}

export async function pingVerification(type = 'voter') {
  return await apiRequest('/notifications/ping-verification', {
    method: 'POST',
    body: JSON.stringify({ type })
  });
}

// ==============================================================================
// 10. HEALTH CHECK
// ==============================================================================

export async function checkBackendHealth() {
  try {
    const res = await fetch('/api/health');
    return await res.json();
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

export default {
  registerUser,
  loginUser,
  verifyOtp,
  resendOtp,
  requestPasswordReset,
  resetPasswordWithOtp,
  getCurrentUser,
  logoutUser,
  uploadVerificationDocument,
  getVerificationStatus,
  listPendingVerifications,
  reviewVerificationApplication,
  generateCandidateCodes,
  listCandidateCodes,
  revokeCandidateCode,
  applyForCandidacy,
  listCandidateApplications,
  getCandidateApplicationDetails,
  reviewCandidateApplication,
  listApprovedCandidates,
  getCandidateProfile,
  getMyCandidateApplication,
  listElections,
  getElectionDetails,
  createElection,
  updateElection,
  deleteElectionAdmin,
  listAllPositions,
  assignPositionsToElection,
  openElection,
  closeElection,
  getElectionStats,
  submitBallot,
  getVoterVotingStatus,
  verifyBallotReceipt,
  getPublicResults,
  calculateResults,
  publishResults,
  getAdminResultsPreview,
  listFeedPosts,
  createFeedPost,
  deleteFeedPost,
  togglePinPost,
  listAuditLogs,
  getAuditSummary,
  exportAuditLogs,
  listAllUsersAdmin,
  createUserAdmin,
  deleteUserAdmin,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  pingVerification,
  checkBackendHealth
};
