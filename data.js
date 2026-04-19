// WorkSpace.kz - Data Utils & Static Fallback
// Used by main.js for search/filtering/display

// Static fallback rooms (if DB unavailable)
const STATIC_ROOMS = [
  { id: 1, title: 'Психологический кабинет', city: 'Алматы', district: 'Алмалинский', category: 'психолог', price: 1200, amenities: ['Wi-Fi', 'Проектор'], rating: 4.9, img: 'https://images.unsplash.com/photo-1574637605482-66bce731df2f?w=400&h=240&fit=crop' },
  { id: 2, title: 'Репетиторская', city: 'Астана', district: 'Есильский', category: 'репетитор', price: 900, amenities: ['Wi-Fi'], rating: 4.7, img: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=240&fit=crop' },
  { id: 3, title: 'Совещательная', city: 'Алматы', district: 'Бостандыкский', category: 'совещание', price: 1500, amenities: ['Wi-Fi', 'Проектор', 'Парковка'], rating: 4.8, img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=240&fit=crop' },
  { id: 4, title: 'IT-студия', city: 'Шымкент', district: 'центр', category: 'IT', price: 1100, amenities: ['Wi-Fi', 'Кофе'], rating: 4.6, img: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&h=240&fit=crop' },
  { id: 5, title: 'Юридическая консультация', city: 'Алматы', district: 'Ауэзовский', category: 'юрист', price: 1300, amenities: ['Wi-Fi', 'Парковка'], rating: 5.0, img: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=240&fit=crop' }
  // More can be added...
];

let currentRooms = [];
let activeFilters = { city: '', category: '', amenities: [] };

async function getRooms(filters = {}) {
  try {
    currentRooms = await window.api.getRooms(filters);
  } catch (e) {
    console.error('API error:', e);
    // Fallback to static
    currentRooms = STATIC_ROOMS.filter(room => {
      if (filters.city && !room.city.toLowerCase().includes(filters.city.toLowerCase())) return false;
      if (filters.category && !room.category.toLowerCase().includes(filters.category.toLowerCase())) return false;
      if (filters.amenities && !filters.amenities.every(a => room.amenities.includes(a))) return false;
      return true;
    });
  }
  return currentRooms;
}

// Filter functions for UI
function filterRooms(filters) {
  activeFilters = { ...filters };
  getRooms(activeFilters).then(displayRooms);
}

// Display rooms in grid
function displayRooms(rooms) {
  const grid = document.getElementById('cardsGrid');
  if (!grid) return;
  
  grid.innerHTML = '';
  if (rooms.length === 0) {
    grid.innerHTML = '<div class="page-card" style="grid-column: 1/-1; text-align: center; padding: 3rem;"><p style="color: var(--tx2);">Кабинеты не найдены по текущим фильтрам</p></div>';
    document.getElementById('resultLabel').textContent = 'Нет результатов';
    return;
  }
  
  document.getElementById('resultLabel').textContent = `Найдено кабинетов: ${rooms.length}`;
  
  const loader = document.getElementById('cardsLoader');
  if (loader) loader.style.display = 'none';
  grid.style.display = 'grid';
  
  rooms.forEach(room => {
    const card = document.createElement('div');
    card.className = 'space-card';
    card.onclick = () => window.open(`room.html?id=${room.id}`, '_self');
    card.innerHTML = `
      <div class="space-img-container">
        <img src="${(room.img || '').split(',')[0].trim()}" alt="${room.title}" class="space-img" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/600x400/18181C/5A5A62?text=Нет+фото';">
      </div>
      <div style="padding: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.75rem;">
          <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0;">${room.title}</h3>
          <div style="color: var(--accent); font-size: 1.3rem; font-weight: 800;">${room.price}₸/ч</div>
        </div>
        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.85rem; color: var(--ok);">
            ★ ${room.rating}
          </div>
          <div style="font-size: 0.85rem; color: var(--tx2);">${room.city}, ${room.district}</div>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          ${room.amenities.map(a => `<span class="badge">${a}</span>`).join('')}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Global window attach (no modules)
window.getRooms = getRooms;
window.filterRooms = filterRooms;
window.displayRooms = displayRooms;
window.currentRooms = currentRooms;
