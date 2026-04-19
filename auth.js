// WorkSpace.kz - Authentication Manager
// Uses backend API via window.api; no direct DB access.

const AuthManager = {
  currentUser: null,

  async login(email, password) {
    const user = await window.api.login(email, password);
    this.currentUser = user;
    Utils?.showToast(`Добро пожаловать, ${user.name}!`, 'success');
    return user;
  },

  async register({ name, phone, email, password, role }) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Некорректный email');
    }
    if (String(password).length < 8) {
      throw new Error('Пароль минимум 8 символов');
    }
    const user = await window.api.register({ name, phone, email, password, role });
    this.currentUser = user;
    Utils?.showToast('Регистрация успешна!', 'success');
    return user;
  },

  logout() {
    this.currentUser = null;
    window.api.logout();
    Utils?.showToast('Вы вышли из аккаунта', 'default');
    window.location.href = 'index.html';
  },

  _readyResolve: null,
  ready: null,

  // Called on every page load: tries to validate stored token, then falls back to cache.
  async init() {
    // If not already initialized, the promise is created at the bottom of the script.
    // We just need to make sure we resolve it.
    
    // First try: validate with the server (requires backend to be running)
    try {
      const user = await window.api.initAuth();
      if (user) {
        this.currentUser = user;
        this._readyResolve(user);
        return;
      }
    } catch {
      // Backend unreachable — fall back to cached user so UI doesn't break
    }

    // Fallback: use locally cached user from last login
    const cached = window.api.getCachedUser();
    if (cached) {
      this.currentUser = cached;
    }
    this._readyResolve(this.currentUser);
  },

  isLoggedIn() {
    return !!this.currentUser;
  },

  getUser() {
    return this.currentUser;
  },
};

// Initial promise
AuthManager.ready = new Promise(resolve => {
  AuthManager._readyResolve = resolve;
});

// Auto-init on every page
document.addEventListener('DOMContentLoaded', () => AuthManager.init());

window.AuthManager = AuthManager;
