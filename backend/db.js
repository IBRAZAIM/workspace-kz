const sqlite = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite(dbPath);

// ── Initialize Schema ──────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    email         TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    name          TEXT NOT NULL,
    phone         TEXT,
    role          TEXT NOT NULL DEFAULT 'user',
    joined        TEXT NOT NULL DEFAULT (date('now')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    city         TEXT    NOT NULL DEFAULT '',
    district     TEXT    NOT NULL DEFAULT '',
    category     TEXT    NOT NULL DEFAULT '',
    price        INTEGER NOT NULL DEFAULT 0,
    capacity     INTEGER,
    amenities    TEXT    NOT NULL DEFAULT '[]',
    img          TEXT    NOT NULL DEFAULT '',
    description  TEXT    NOT NULL DEFAULT '',
    status       TEXT    NOT NULL DEFAULT 'active',
    rating       REAL,
    owner_email  TEXT REFERENCES users(email)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_ref   TEXT,
    room_id       INTEGER NOT NULL REFERENCES rooms(id),
    user_email    TEXT    NOT NULL REFERENCES users(email),
    slot          TEXT    NOT NULL,
    booking_date  TEXT    NOT NULL,
    status        TEXT    NOT NULL DEFAULT 'CONFIRMED',
    total_price   INTEGER NOT NULL DEFAULT 0,
    contact_phone TEXT,
    notes         TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_bookings_room_date ON bookings(room_id, booking_date, status);
  CREATE INDEX IF NOT EXISTS idx_rooms_owner ON rooms(owner_email);
`);

// ── Seed demo data if tables are empty ────────────────────────
const roomCount = db.prepare('SELECT COUNT(*) AS n FROM rooms').get().n;
if (roomCount === 0) {
  const insertRoom = db.prepare(`
    INSERT INTO rooms (title, city, district, category, price, amenities, img, description, rating)
    VALUES (@title, @city, @district, @category, @price, @amenities, @img, @description, @rating)
  `);
  const seedRooms = db.transaction((rooms) => {
    for (const r of rooms) insertRoom.run(r);
  });
  seedRooms([
    { title: 'Психологический кабинет', city: 'Алматы',   district: 'Алмалинский',   category: 'психолог',  price: 1200, amenities: '["Wi-Fi","Проектор"]',               img: 'https://images.unsplash.com/photo-1574637605482-66bce731df2f?w=400&h=240&fit=crop', description: 'Уютный кабинет для психологов',          rating: 4.9 },
    { title: 'Репетиторская',           city: 'Астана',    district: 'Есильский',      category: 'репетитор', price: 900,  amenities: '["Wi-Fi"]',                          img: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400&h=240&fit=crop', description: 'Для уроков и консультаций',            rating: 4.7 },
    { title: 'Совещательная',           city: 'Алматы',    district: 'Бостандыкский',  category: 'совещание', price: 1500, amenities: '["Wi-Fi","Проектор","Парковка"]',     img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=240&fit=crop', description: 'Профессиональная переговорная',        rating: 4.8 },
    { title: 'IT-студия',               city: 'Шымкент',   district: 'центр',           category: 'IT',        price: 1100, amenities: '["Wi-Fi","Кофе"]',                   img: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&h=240&fit=crop', description: 'Для разработчиков и дизайнеров',      rating: 4.6 },
    { title: 'Юридическая консультация',city: 'Алматы',    district: 'Ауэзовский',     category: 'юрист',     price: 1300, amenities: '["Wi-Fi","Парковка"]',               img: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=240&fit=crop', description: 'Конфиденциальные встречи',            rating: 5.0 },
    { title: 'Бьюти кабинет',           city: 'Астана',    district: 'Сарыарка',       category: 'бьюти',     price: 1000, amenities: '["Wi-Fi","Кофе"]',                   img: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&h=240&fit=crop', description: 'Для мастеров красоты',               rating: 4.8 },
    { title: 'Тренинг зал',             city: 'Алматы',    district: 'Медеуский',      category: 'тренинги',  price: 2000, amenities: '["Wi-Fi","Проектор","Парковка"]',     img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=240&fit=crop', description: 'Для групповых занятий',              rating: 4.9 },
    { title: 'Массажный кабинет',       city: 'Тараз',     district: 'центр',           category: 'массаж',    price: 950,  amenities: '["Wi-Fi"]',                          img: 'https://images.unsplash.com/photo-1556228578-bce5b2de94c2?w=400&h=240&fit=crop', description: 'Релакс и терапия',                  rating: 4.7 },
    { title: 'Логопед',                 city: 'Караганда', district: 'Майкудук',       category: 'логопед',   price: 850,  amenities: '["Wi-Fi"]',                          img: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400&h=240&fit=crop', description: 'Для детей и взрослых',              rating: 4.9 },
    { title: 'Коворкинг зона',          city: 'Павлодар',  district: 'центр',           category: 'коворкинг', price: 700,  amenities: '["Wi-Fi","Кофе","Парковка"]',         img: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=400&h=240&fit=crop', description: 'Открытое пространство',             rating: 4.5 },
  ]);
}

// Seed admin user
const adminCount = db.prepare('SELECT COUNT(*) AS n FROM users WHERE role = ?').get('admin').n;
if (adminCount === 0) {
  const hash = bcrypt.hashSync('admin1234', 10);
  db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)').run(
    'admin@workspace.kz',
    hash,
    'Главный Админ',
    'admin'
  );
  console.log('Default admin created: admin@workspace.kz / admin1234');
}

// ── pg-compatible shim ─────────────────────────────────────────

function adaptSql(sql, params = []) {
  const usedParams = [];
  const adapted = sql.replace(/\$(\d+)/g, (m, n) => {
    const idx = parseInt(n) - 1;
    usedParams.push(params[idx]);
    return '?';
  });

  const cleaned = adapted
    .replace(/::text\[\]/gi, '')
    .replace(/::\w+/gi, '')
    .replace(/ILIKE/gi, 'LIKE')
    .replace(/NULLS LAST/gi, '')
    .replace(/TO_CHAR\([^,]+,\s*'HH24:MI'\)/gi, (m) => {
      return m.match(/TO_CHAR\(([^,]+),/i)?.[1]?.trim() || 'slot';
    })
    .replace(/@>\s*\?/gi, 'LIKE ?')
    .replace(/=\s*ANY\(\?\)/gi, 'IN (SELECT value FROM json_each(?))')
    .replace(/\bCURRENT_DATE\b/gi, "date('now')")
    .replace(/FOR UPDATE\b/gi, '');

  return { sql: cleaned, params: usedParams };
}

function runQuery(rawSql, rawParams = []) {
  const { sql: adaptedSql, params: adaptedParams } = adaptSql(rawSql, rawParams);
  const finalParams = adaptedParams.map(p => (p === undefined ? null : (Array.isArray(p) ? JSON.stringify(p) : p)));

  const trimmed = adaptedSql.trim().toUpperCase();
  try {
    if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
      const rows = db.prepare(adaptedSql).all(...finalParams);
      return { rows: rows.map(r => {
        if (r && r.amenities && typeof r.amenities === 'string') {
          try { r.amenities = JSON.parse(r.amenities); } catch {}
        }
        return r;
      })};
    } else if (trimmed.startsWith('INSERT')) {
      const sqlNoReturning = adaptedSql.replace(/RETURNING\s+.*$/si, '').trim();
      const info = db.prepare(sqlNoReturning).run(...finalParams);
      const returning = rawSql.match(/RETURNING\s+(.*?)$/si)?.[1];
      if (returning && info.lastInsertRowid) {
        const table = rawSql.match(/INTO\s+(\w+)/i)?.[1];
        if (table) {
          const row = db.prepare(`SELECT * FROM ${table} WHERE rowid = ?`).get(info.lastInsertRowid);
          if (row && row.amenities && typeof row.amenities === 'string') {
             try { row.amenities = JSON.parse(row.amenities); } catch {}
          }
          return { rows: row ? [row] : [] };
        }
      }
      return { rows: [] };
    } else if (trimmed.startsWith('UPDATE')) {
      const sqlNoReturning = adaptedSql.replace(/RETURNING\s+.*$/si, '').trim();
      db.prepare(sqlNoReturning).run(...finalParams);
      const returningMatch = rawSql.match(/WHERE\s+(.*?)(?:\s+RETURNING|$)/si);
      const table = rawSql.match(/UPDATE\s+(\w+)/i)?.[1];
      if (table && returningMatch) {
        const { sql: refetchSql, params: refetchParams } = adaptSql(`SELECT * FROM ${table} WHERE ${returningMatch[1]}`, rawParams);
        const refetchFinal = refetchParams.map(p => (p === undefined ? null : (Array.isArray(p) ? JSON.stringify(p) : p)));
        const rows = db.prepare(refetchSql).all(...refetchFinal);
        return { rows: rows.map(r => {
          if (r && r.amenities && typeof r.amenities === 'string') {
            try { r.amenities = JSON.parse(r.amenities); } catch {}
          }
          return r;
        })};
      }
      return { rows: [] };
    } else if (trimmed.startsWith('DELETE')) {
      db.prepare(adaptedSql).run(...finalParams);
      return { rows: [] };
    } else {
      db.exec(adaptedSql);
      return { rows: [] };
    }
  } catch (err) {
    console.error('[DB ERROR]', err.message, '| SQL:', adaptedSql, '| Params:', finalParams);
    throw err;
  }
}

function makeClient() {
  let inTx = false;
  return {
    async query(sql, params) {
      if (sql.trim().toUpperCase() === 'BEGIN') {
        if (!inTx) { db.prepare('BEGIN').run(); inTx = true; }
        return { rows: [] };
      }
      if (sql.trim().toUpperCase() === 'COMMIT') {
        if (inTx) { db.prepare('COMMIT').run(); inTx = false; }
        return { rows: [] };
      }
      if (sql.trim().toUpperCase() === 'ROLLBACK') {
        if (inTx) { db.prepare('ROLLBACK').run(); inTx = false; }
        return { rows: [] };
      }
      return runQuery(sql, params);
    },
    release() {},
  };
}

function getDB() {
  return db;
}

module.exports = {
  query: (sql, params) => Promise.resolve(runQuery(sql, params)),
  pool: {
    connect: () => Promise.resolve(makeClient()),
  },
  getDB
};
