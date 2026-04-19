// WorkSpace.kz - IndexedDB Database
// Provides WorkSpaceDB global with rooms and users tables

let WorkSpaceDB = {
  db: null,
  dbReady: null,
  init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('WorkSpaceKZ', 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        this.db = req.result;
        this.dbReady = Promise.resolve(this.db);
        this._seedData();
        resolve(this.db);
      };
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('rooms')) {
          const rooms = db.createObjectStore('rooms', { keyPath: 'id', autoIncrement: true });
          rooms.createIndex('city', 'city', { multiEntry: false });
          rooms.createIndex('category', 'category', { multiEntry: false });
          rooms.createIndex('amenities', 'amenities', { multiEntry: true });
        }
if (!db.objectStoreNames.contains('users')) {
  db.createObjectStore('users', { keyPath: 'email', autoIncrement: false });
}
if (!db.objectStoreNames.contains('bookings')) {
  const bookings = db.createObjectStore('bookings', { keyPath: 'id', autoIncrement: true });
  bookings.createIndex('user_email', 'user_email');
  bookings.createIndex('room_id', 'room_id');
}
      };
    });
  },
  async _seedData() {
    const tx = this.db.transaction('rooms', 'readwrite');
    const roomsStore = tx.objectStore('rooms');
    const countReq = roomsStore.count();
    await new Promise(r => { countReq.onsuccess = r; });
    if (countReq.result === 0) {
        const sampleRooms = [
        { id: 1, title: 'Психологический кабинет', city: 'Алматы', district: 'Алмалинский', category: 'психолог', price: 1200, amenities: ['Wi-Fi', 'Проектор'], rating: 4.9, img: 'https://images.unsplash.com/photo-1574637605482-66bce731df2f?w=400&h=240&fit=crop', description: 'Уютный кабинет для психологов' },
        { id: 2, title: 'Репетиторская', city: 'Астана', district: 'Есильский', category: 'репетитор', price: 900, amenities: ['Wi-Fi'], rating: 4.7, img: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=240&fit=crop', description: 'Для уроков и консультаций' },
        { id: 3, title: 'Совещательная', city: 'Алматы', district: 'Бостандыкский', category: 'совещание', price: 1500, amenities: ['Wi-Fi', 'Проектор', 'Парковка'], rating: 4.8, img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=240&fit=crop', description: 'Профессиональная переговорная' },
        { id: 4, title: 'IT-студия', city: 'Шымкент', district: 'центр', category: 'IT', price: 1100, amenities: ['Wi-Fi', 'Кофе'], rating: 4.6, img: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&h=240&fit=crop', description: 'Для разработчиков и дизайнеров' },
        { id: 5, title: 'Юридическая консультация', city: 'Алматы', district: 'Ауэзовский', category: 'юрист', price: 1300, amenities: ['Wi-Fi', 'Парковка'], rating: 5.0, img: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=240&fit=crop', description: 'Конфиденциальные встречи' },
        { id: 6, title: 'Бьюти кабинет', city: 'Астана', district: 'Сарыарка', category: 'бьюти', price: 1000, amenities: ['Wi-Fi', 'Кофе'], rating: 4.8, img: 'https://images.unsplash.com/photo-1574169208507-84376144848b?w=400&h=240&fit=crop', description: 'Для мастеров красоты' },
        { id: 7, title: 'Тренинг зал', city: 'Алматы', district: 'Медеуский', category: 'тренинги', price: 2000, amenities: ['Wi-Fi', 'Проектор', 'Парковка'], rating: 4.9, img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=240&fit=crop', description: 'Для групповых занятий' },
        { id: 8, title: 'Массажный кабинет', city: 'Тараз', district: 'центр', category: 'массаж', price: 950, amenities: ['Wi-Fi'], rating: 4.7, img: 'https://images.unsplash.com/photo-1556228578-bce5b2de94c2?w=400&h=240&fit=crop', description: 'Релакс и терапия' },
        { id: 9, title: 'Логопед', city: 'Караганда', district: 'Майкудук', category: 'логопед', price: 850, amenities: ['Wi-Fi'], rating: 4.9, img: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400&h=240&fit=crop', description: 'Для детей и взрослых' },
        { id: 10, title: 'Коворкинг зона', city: 'Павлодар', district: 'центр', category: 'коворкинг', price: 700, amenities: ['Wi-Fi', 'Кофе', 'Парковка'], rating: 4.5, img: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=400&h=240&fit=crop', description: 'Открытое пространство' },
        { id: 11, title: 'Психолог №2', city: 'Алматы', district: 'Алатауский', category: 'психолог', price: 1400, amenities: ['Wi-Fi', 'Проектор'], rating: 4.8, img: 'https://images.unsplash.com/photo-1613220291748-d9c3a1db4283?w=400&h=240&fit=crop', description: 'Семейная терапия' },
        { id: 12, title: 'Медицинская консультация', city: 'Костанай', district: 'Трёхсторонка', category: 'медицина', price: 1100, amenities: ['Wi-Fi', 'Парковка'], rating: 4.7, img: 'https://images.unsplash.com/photo-1598343759899-52cc1c8a885f?w=400&h=240&fit=crop', description: 'Для врачей и терапевтов' },
        { id: 13, title: 'Фото студия', city: 'Усть-Каменогорск', district: 'центр', category: 'фото', price: 1600, amenities: ['Wi-Fi', 'Проектор', 'Кофе'], rating: 4.9, img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=240&fit=crop', description: 'Освещение и оборудование' },
        { id: 14, title: 'Дизайнерская мастерская', city: 'Семей', district: 'Абайский', category: 'дизайн', price: 950, amenities: ['Wi-Fi'], rating: 4.6, img: 'https://images.unsplash.com/photo-1464822759023-fed622b1e323?w=400&h=240&fit=crop', description: 'Для творческих профессий' }
      ];
      for (const room of sampleRooms) {
        await new Promise(r => {
          const req = roomsStore.add(room);
          req.onsuccess = r;
        });
      }
    }
    // Seed demo users
    const usersTx = this.db.transaction('users', 'readwrite');
    const usersStore = usersTx.objectStore('users');
    const demoUsers = [
      { email: 'demo@renter.kz', password: 'password123', name: 'Демо Арендатор', phone: '+77778889900', role: 'renter' },
      { email: 'demo@owner.kz', password: 'password123', name: 'Демо Владелец', phone: '+77770001122', role: 'landlord' }
    ];
    for (const user of demoUsers) {
      const check = await new Promise(r => {
        const req = usersStore.get(user.email);
        req.onsuccess = () => r(req.result);
      });
      if (!check) {
        await new Promise(r => {
          const req = usersStore.add(user);
          req.onsuccess = r;
        });
      }
    }
  },
async getRooms(filters = {}) {
    const tx = this.db.transaction('rooms', 'readonly');
    const store = tx.objectStore('rooms');
    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => {
        let rooms = req.result;
        // Apply filters
        if (filters.city) rooms = rooms.filter(r => r.city.toLowerCase().includes(filters.city.toLowerCase()));
        if (filters.category) rooms = rooms.filter(r => r.category.toLowerCase().includes(filters.category.toLowerCase()));
        if (filters.amenities) {
          rooms = rooms.filter(r => filters.amenities.every(a => r.amenities.includes(a)));
        }
        resolve(rooms);
      };
    });
  },
  async getBookings(email) {
    const tx = this.db.transaction('bookings', 'readonly');
    const store = tx.objectStore('bookings');
    const index = store.index('user_email');
    const req = index.getAll(email);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result);
    });
  },
  async addBooking(booking) {
    const tx = this.db.transaction('bookings', 'readwrite');
    const store = tx.objectStore('bookings');
    return new Promise((resolve, reject) => {
      const req = store.add(booking);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async addUser(user) {
    const tx = this.db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    return new Promise((resolve, reject) => {
      const req = store.add(user);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async getUser(email) {
    const tx = this.db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    return new Promise((resolve) => {
      const req = store.get(email);
      req.onsuccess = () => resolve(req.result);
    });
  }
};

// Auto-init on load
if ('indexedDB' in window) {
  WorkSpaceDB.init().catch(console.error);
} else {
  console.warn('IndexedDB not supported - using demo mode');
}
