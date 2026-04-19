/**
 * WorkSpace.kz — Data Layer
 * Thin wrapper over DB with a static fallback for the rare case DB hasn't seeded yet.
 */

const STATIC_ROOMS = [
  {id:'al1', city:'Алматы', district:'Алмалинский',  title:'Каб. психолога «Гармония»',   category:'Психологи',  price:1200, rating:4.9, img:'https://images.unsplash.com/photo-1576091160399-1d65cdaa8782?w=400', amenities:['Wi-Fi','Кофе','Парковка']},
  {id:'al2', city:'Алматы', district:'Алатау',        title:'Психолог Елена К.',            category:'Психологи',  price:900,  rating:4.8, img:'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=400', amenities:['Wi-Fi']},
  {id:'al3', city:'Алматы', district:'Бостандыкский', title:'Совещания «Бизнес Центр»',    category:'Совещания',  price:1500, rating:4.7, img:'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400', amenities:['Wi-Fi','Проектор','Парковка']},
  {id:'al4', city:'Алматы', district:'Алатау',        title:'IT студия «CodeHub»',          category:'IT',         price:1800, rating:4.9, img:'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400', amenities:['Wi-Fi','Проектор']},
  {id:'al5', city:'Алматы', district:'Наурызбай',     title:'Репетитор по математике',      category:'Репетиторы', price:800,  rating:4.6, img:'https://images.unsplash.com/photo-1524178232363-933d15b072d7?w=400', amenities:['Wi-Fi']},
  {id:'as1', city:'Астана', district:'Алматы',        title:'Психолог «Центр Гармонии»',   category:'Психологи',  price:1300, rating:4.8, img:'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400', amenities:['Wi-Fi','Кофе']},
  {id:'as2', city:'Астана', district:'Сарыарка',      title:'Совещательная «Executive»',    category:'Совещания',  price:1600, rating:4.7, img:'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400', amenities:['Wi-Fi','Проектор','Кофе']},
  {id:'as3', city:'Астана', district:'Есиль',         title:'IT коворкинг «Digital»',       category:'IT',         price:2000, rating:4.9, img:'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400', amenities:['Wi-Fi','Проектор','Парковка']},
  {id:'sh1', city:'Шымкент',       district:'Центр',  title:'Юридическая консультация',     category:'Юристы',     price:1100, rating:4.7, img:'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400', amenities:['Wi-Fi']},
  {id:'kg1', city:'Караганда',     district:'Центр',  title:'Репетитор английского',        category:'Репетиторы', price:700,  rating:4.8, img:'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400', amenities:['Wi-Fi']},
  {id:'p1',  city:'Павлодар',      district:'Центр',  title:'Массажный кабинет',            category:'Массаж',     price:950,  rating:4.6, img:'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400', amenities:['Парковка']},
  {id:'ak1', city:'Актобе',        district:'Центр',  title:'Тренинги «Лидер»',             category:'Тренинги',   price:1400, rating:4.9, img:'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=400', amenities:['Wi-Fi','Проектор']},
];

function applyFilters(rooms, filters = {}) {
  let result = rooms;
  if (filters.category) {
    const cats = filters.category.toLowerCase().split(',').map(c => c.trim());
    result = result.filter(r => cats.some(c => r.category.toLowerCase().includes(c)));
  }
  if (filters.city)     result = result.filter(r => r.city === filters.city);
  if (filters.amenities) {
    const amens = filters.amenities.toLowerCase().split(',').map(a => a.trim());
    result = result.filter(r => {
      const ra = (r.amenities || []).map(a => a.toLowerCase());
      return amens.every(a => ra.includes(a));
    });
  }
  if (filters.priceMin) result = result.filter(r => r.price >= +filters.priceMin);
  if (filters.priceMax) result = result.filter(r => r.price <= +filters.priceMax);
  if (filters.search)   result = result.filter(r => r.title.toLowerCase().includes((filters.search || '').toLowerCase()));
  return result;
}

async function getRooms(filters = {}) {
  try {
    await DB.ready;
    return await DB.getRooms(filters);
  } catch (e) {
    console.warn('DB.getRooms failed, using static fallback:', e);
    return applyFilters(STATIC_ROOMS, filters);
  }
}

async function getRoom(id) {
  try {
    await DB.ready;
    const room = await DB.getRoom(String(id));
    return room || STATIC_ROOMS.find(r => r.id === String(id)) || null;
  } catch {
    return STATIC_ROOMS.find(r => r.id === String(id)) || null;
  }
}

async function searchRooms(filters = {}) {
  return getRooms(filters);
}

window.Data = { getRooms, getRoom, searchRooms };
