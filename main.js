// WorkSpace.kz - Main UI Logic
// Handles search, filters, modals, cards, utils for index.html

const Utils = {
  showToast(msg, type = 'default') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
    setTimeout(() => toast.classList.remove('show'), 3000);
  },

  closeModal() {
    document.getElementById('overlay').classList.remove('open');
  }
};

// Search
async function heroSearch() {
  const city = document.getElementById('heroCity').value.trim();
  const cat = document.getElementById('heroCat').value;
  const filters = { city, category: cat };
  await filterRooms(filters);
  Utils.showToast(`Ищем в ${city || 'всех городах'}...`, 'default');
}

// Category/Amenity filters
let activeCat = '', activeAmenities = [];
function toggleCat(btn, cat) {
  activeCat = cat;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterRooms({ category: cat, amenities: activeAmenities });
}
function toggleAmenity(btn, amenity) {
  const idx = activeAmenities.indexOf(amenity);
  if (idx > -1) {
    activeAmenities.splice(idx, 1);
    btn.classList.remove('on');
  } else {
    activeAmenities.push(amenity);
    btn.classList.add('on');
  }
  filterRooms({ category: activeCat, amenities: activeAmenities });
}

// Booking Modal
window.currentRoom = null;
window.selectedSlot = null;
function openBookingModal(room) {
  if (!AuthManager.isLoggedIn()) {
    Utils.showToast('Войдите для бронирования', 'warn');
    window.location.href = 'login.html?redirect=index.html';
    return;
  }
  currentRoom = room;
  showSlotStep();
  document.getElementById('overlay').classList.add('open');
}

function showSlotStep() {
  document.getElementById('modalTitle').textContent = `Бронь: ${currentRoom.title}`;
  document.getElementById('modalBody').innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">${currentRoom.price}₸/час</div>
      <div style="color: var(--tx2);">${currentRoom.city}, ${currentRoom.district}</div>
    </div>
    <div class="slots-grid" style="margin-bottom: 1.5rem;" id="modalSlots"></div>
    <div style="text-align: center;">
      <button class="btn-primary" onclick="showPaymentStep()">Продолжить к оплате</button>
    </div>
  `;
  generateSlots();
}

function showPaymentStep() {
  const slots = (window.selectedSlot) ? [window.selectedSlot] : (window.selectedSlots || []);
  if (!slots || slots.length === 0) {
    Utils.showToast('Выберите время', 'warn');
    return;
  }
  
  // Open overlay if called from room.html directly
  const overlay = document.getElementById('overlay');
  if (overlay && !overlay.classList.contains('open')) {
    overlay.classList.add('open');
  }

  document.getElementById('modalTitle').textContent = `Оплата: ${window.currentRoom.price * slots.length}₸`;
  const slotText = slots.length > 1 ? `${slots.length} слотов` : slots[0];
  document.getElementById('modalBody').innerHTML = `
    <div style="margin-bottom: 1.5rem; text-align: center;">
      <p style="color: var(--tx2); margin-bottom: 1rem;">${window.currentRoom.title}<br>${new Date().toLocaleDateString('ru-RU')} в ${slotText}</p>
      
      <div style="background: var(--bg2); border: 1px solid var(--bd); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem;">
        <div style="margin-bottom: 1rem; text-align: left;">
          <label style="font-size: 0.75rem; color: var(--tx3); text-transform: uppercase;">Номер карты</label>
          <input class="field" value="4400 0000 0000 0000" disabled style="letter-spacing: 0.1em; font-family: monospace;">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; text-align: left;">
          <div>
            <label style="font-size: 0.75rem; color: var(--tx3); text-transform: uppercase;">ММ/ГГ</label>
            <input class="field" value="12/26" disabled>
          </div>
          <div>
            <label style="font-size: 0.75rem; color: var(--tx3); text-transform: uppercase;">CVV</label>
            <input class="field" value="***" disabled>
          </div>
        </div>
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
      <button class="btn-secondary" onclick="window.location.pathname.includes('room.html') ? closeModal() : showSlotStep()">Назад</button>
      <button class="btn-primary" id="payBtn" onclick="confirmBooking()">Оплатить ${window.currentRoom.price * slots.length}₸</button>
    </div>
  `;
}

function generateSlots() {
  const slots = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  const grid = document.getElementById('modalSlots');
  grid.innerHTML = slots.map(slot => 
    `<button class="slot free" onclick="selectSlot('${slot}', this)">${slot}</button>`
  ).join('');
}

let selectedSlot = null;
function selectSlot(slot, btn) {
  window.selectedSlot = slot;
  document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
  if (btn) btn.classList.add('selected');
  else if (typeof event !== 'undefined' && event.target) event.target.classList.add('selected');
}

async function confirmBooking() {
  if (typeof AuthManager !== 'undefined' && !AuthManager.isLoggedIn()) {
    Utils.showToast('Войдите для бронирования', 'warn');
    window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
    return;
  }
  const slots = (window.selectedSlot) ? [window.selectedSlot] : (window.selectedSlots || []);
  const date = document.getElementById('bookDate')?.value || new Date().toISOString().split('T')[0];
  
  if (!slots || slots.length === 0) {
    Utils.showToast('Выберите время', 'warn');
    return;
  }

  const payBtn = document.getElementById('payBtn') || document.getElementById('bookButton');
  const originalText = payBtn ? payBtn.textContent : '';
  
  if (payBtn) {
    payBtn.disabled = true;
    payBtn.textContent = 'Обработка...';
  }
  
  try {
    // Simulate payment delay
    await new Promise(r => setTimeout(r, 1200));
    
    await window.api.addBooking({
      room_id: window.currentRoom.id,
      slots: slots,
      booking_date: date
    });
    
    Utils.showToast(`Оплачено! Бронь подтверждена.`, 'success');
    
    if (window.location.pathname.includes('room.html') || window.location.pathname.includes('dashboard.html')) {
       setTimeout(() => window.location.href = 'dashboard.html', 1500);
    } else {
       Utils.closeModal();
       if (typeof selectedSlot !== 'undefined') selectedSlot = null;
       if (window.selectedSlots) window.selectedSlots = [];
    }
  } catch (e) {
    Utils.showToast('Ошибка: ' + e.message, 'error');
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.textContent = originalText;
    }
  }
}

// Global selectedSlots for room.html
window.selectedSlots = [];
function setSelectedSlots(s) { window.selectedSlots = s; }
window.setSelectedSlots = setSelectedSlots;

// Init on load
async function initPage() {
  if (typeof AuthManager !== 'undefined' && AuthManager.ready) {
    await AuthManager.ready;
  }
  updateNavbar();
  
  const loader = document.getElementById('cardsLoader');
  const grid = document.getElementById('cardsGrid');
  
  const rooms = await getRooms();
  displayRooms(rooms);
  
  if (loader) loader.style.display = 'none';
  if (grid) grid.style.display = 'grid';
}

document.addEventListener('DOMContentLoaded', initPage);

function updateNavbar(user) {
  const navRight = document.querySelector('#navRight, .nav-right');
  if (!navRight) return;
  
  const u = user || AuthManager?.getUser?.() || null;
  if (u) {
    const dashboardLabel = u.role === 'admin' ? 'Админ-панель' : 'Дашборд';
    const dashboardUrl = u.role === 'admin' ? 'admin.html' : 'dashboard.html';
    navRight.innerHTML = `
      <div style="display: flex; align-items: center; gap: 1rem;">
        <span style="font-size: 0.85rem; color: var(--tx);">${u.name || u.email}</span>
        <a href="${dashboardUrl}" class="header-back" style="font-weight: 500;">${dashboardLabel}</a>
        <a href="profile.html" class="header-back" style="font-weight: 500;">Профиль</a>
        <a href="#" onclick="AuthManager.logout(); return false;" class="header-back">Выход</a>
      </div>
    `;
  } else {
    navRight.innerHTML = `
      <a href="login.html" class="header-back">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7L9 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Войти
      </a>
    `;
  }
}

window.updateNavbar = updateNavbar;

// Global utils
window.Utils = Utils;
window.heroSearch = heroSearch;
window.toggleCat = toggleCat;
window.toggleAmenity = toggleAmenity;
window.openBookingModal = openBookingModal;
window.showSlotStep = showSlotStep;
window.showPaymentStep = showPaymentStep;
window.confirmBooking = confirmBooking;
window.selectSlot = selectSlot;
window.closeModal = Utils.closeModal;
