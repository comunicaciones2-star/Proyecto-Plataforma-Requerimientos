// API Configuration
const API_BASE_URL = `${window.location.origin}/api`;
const TOKEN_KEY = 'token';
const USER_KEY = 'user';

// Helper function to get token
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// Helper function to get user
export function getUser() {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
}

// Helper function to set token
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

// Helper function to set user
export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Helper function to logout
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = '/login.html';
}

// Fetch helper with authorization
export async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    logout();
    throw new Error('Sesión expirada');
  }

  if (!response.ok) {
    throw new Error(`Error: ${response.statusText}`);
  }

  return response.json();
}

// Alpine.js Store
document.addEventListener('alpine:init', () => {
  Alpine.store('app', {
    user: getUser(),
    theme: localStorage.getItem('theme') || 'light',
    sidebarOpen: true,

    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', this.theme);
      document.documentElement.setAttribute('data-mode', this.theme);
    },

    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
    },

    isAdmin() {
      return this.user?.role === 'admin';
    },

    isManager() {
      return this.user?.role === 'manager' || this.user?.role === 'admin';
    },

    async logout() {
      logout();
    },
  });
});

// Apply theme on load
const theme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-mode', theme);

// Initialize tooltips and other plugins
document.addEventListener('DOMContentLoaded', () => {
  // Add any additional initialization here
  console.log('Fenalco Platform initialized');
});
