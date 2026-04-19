/**
 * WorkSpace.kz — Main Logic
 * Depends on: db.js (window.DB), auth.js (window.Auth = window.AuthManager), data.js (window.Data)
 */

/* ── Toast ───────────────────────────────────────────────── */
window.Utils = {
  showToast(msg, type = 'default') {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    clearTimeout(toast._timer);
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
    toast._timer = setTimeout(() => toast.classList.remove('show'), 3200);
  }
};

/* ── Navbar ──────────────────────────────────────────────── */
function updateNavbar(user) {
  const navRight = document.getElementById('navRight') || document.querySelector('.nav-right');
  if (!navRight) return;

  if (user) {
    const name = user.name ? user.name.split(' ')[0] : (user.email || '').split('@')[0];
    const dest = (user.role === 'admin') ? 'admin.html' : 'dashboard.html';
    navRight.innerHTML = `
      <span style="font-size:0.85rem;color:var(--tx2);">${name}</span>
      <a href="${dest}" class="header-back">Кабинет</a>
      <a href="#" onclick="Auth.logout();window.location.href='index.html';" class="header-back">Выход</a>
    `;
  } else {
    navRight.innerHTML = '<a href="login.html" class="header-back">Войти</a>';
  }
}

/* ── Hero search ─────────────────────────────────────────── */
async function heroSearch() {
  const city = document.getElementById('heroCity')?.value || '';
  const cat  = document.getElementById('heroCat')?.value  || '';
  if (!city && !cat) { Utils.showToast('Выберите город или категорию'); return; }
  window.location.href = `catalog.html?city=${encodeURIComponent(city)}&cat=${encodeURIComponent(cat)}`;
}

/* ── Filters toggle ──────────────────────────────────────── */
function toggleFilters() {
  document.getElementById('filtersSidebar')?.classList.toggle('open');
}

/* ── Modal ───────────────────────────────────────────────── */
function closeModal(e) {
  if (e && e.target !== document.getElementById('overlay')) return;
  document.getElementById('overlay')?.classList.remove('open');
}

/* ── Filter tabs (index page) ────────────────────────────── */
window.toggleCat = function (btn, cat) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (typeof loadIndexCards === 'function') loadIndexCards(cat);
};

window.toggleAmenity = function (btn) {
  btn.classList.toggle('on');
};

/* ── Index: load room cards ──────────────────────────────── */
async function loadIndexCards(categoryFilter = '') {
  const loader = document.getElementById('cardsLoader');
  const grid   = document.getElementById('cardsGrid');
  const label  = document.getElementById('resultLabel');
  if (!loader || !grid) return;

  loader.style.display = 'flex';
  grid.style.display   = 'none';

  try {
    await DB.ready;
    const filters = categoryFilter ? { category: categoryFilter } : {};
    const rooms   = await Data.getRooms(filters);

    grid.innerHTML = rooms.map(room => `
      <div class="space-card" onclick="window.location.href='room.html?id=${room.id}'" style="cursor:pointer;">
        <div class="space-img-container">
          <img src="${room.img}" alt="${room.title}" class="space-img" loading="lazy"
               onerror="this.src='https://placehold.co/400x300/18181C/5A5A62?text=Фото';">
          <div class="card-label">${room.category}</div>
        </div>
        <div style="padding:1.5rem;">
          <h3 style="font-size:1.1rem;margin-bottom:0.5rem;">${room.title}</h3>
          <div style="font-size:1.3rem;font-weight:800;color:var(--accent);margin-bottom:0.6rem;">${room.price}₸/ч</div>
          <div style="display:flex;gap:1rem;margin-bottom:0.75rem;font-size:0.88rem;">
            <div style="color:var(--ok);">★ ${room.rating || '4.7'}</div>
            <div style="color:var(--tx2);">${room.city}${room.district ? ', ' + room.district : ''}</div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
            ${(room.amenities || []).slice(0, 3).map(a => `<span class="badge">${a}</span>`).join('')}
            ${(room.amenities || []).length > 3 ? '<span class="badge">+ещё</span>' : ''}
          </div>
        </div>
      </div>
    `).join('');

    loader.style.display = 'none';
    grid.style.display   = 'grid';
    if (label) label.textContent = `Доступные кабинеты (${rooms.length})`;
  } catch (e) {
    loader.innerHTML = `<span style="color:var(--err);">Ошибка загрузки: ${e.message}</span>`;
    console.error('loadIndexCards error:', e);
  }
}

/* ── Page init ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Navbar shows instantly from localStorage cache
  updateNavbar(Auth.currentUser);

  // Wait for DB, then re-render navbar (catches async auth state)
  try {
    await DB.ready;
  } catch (e) {
    console.warn('DB init error:', e);
  }
  updateNavbar(Auth.currentUser);

  // Page-specific initialization
  const page = document.body.dataset.page || '';
  if (page === 'index') await loadIndexCards();
});
