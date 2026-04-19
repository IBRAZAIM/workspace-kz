const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

let db = null;
let SQL = null;
const dbPath = path.join(__dirname, 'workspace.db');

async function connect() {
  SQL = await initSqlJs();
  
  // Try to load existing database
  if (fs.existsSync(dbPath)) {
    const data = fs.readFileSync(dbPath);
    db = new SQL.Database(data);
    console.log(`✅ SQLite loaded: ${dbPath}`);
  } else {
    db = new SQL.Database();
    console.log(`✅ New SQLite database created`);
  }
}

function initTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT DEFAULT 'renter',
      joined TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      city TEXT,
      district TEXT,
      category TEXT,
      price REAL NOT NULL,
      capacity INTEGER DEFAULT 1,
      amenities TEXT,
      img TEXT,
      description TEXT,
      rating REAL DEFAULT 5.0,
      owner_email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_ref TEXT UNIQUE,
      room_id INTEGER NOT NULL,
      user_email TEXT NOT NULL,
      slots TEXT,
      booking_date TEXT,
      status TEXT DEFAULT 'PENDING',
      total_price REAL,
      contact_phone TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  saveDB();
}

function seedAdmin() {
  try {
    const result = db.exec('SELECT id FROM users WHERE email = "admin@workspace.kz"');
    if (!result || result.length === 0 || !result[0].values || result[0].values.length === 0) {
      const hash = bcrypt.hashSync('admin2024', 10);
      db.run(`
        INSERT INTO users (email, password_hash, name, phone, role, joined)
        VALUES ('admin@workspace.kz', '${hash}', 'Администратор', '+7 700 000 0001', 'admin', '${new Date().toISOString().split('T')[0]}')
      `);
      console.log('✅ Admin user created');
      saveDB();
    }
  } catch (e) {
    console.error('Admin seed error:', e.message);
  }
}

function seedRooms() {
  try {
    const result = db.exec('SELECT COUNT(*) as c FROM rooms');
    const count = result && result[0] && result[0].values && result[0].values[0] ? result[0].values[0][0] : 0;
    
    if (count === 0) {
      const rooms = [
        ['Психологический кабинет', 'Алматы', 'Алмалинский', 'Кабинет', 3000, 4, 'Современный кабинет для консультаций'],
        ['Репетиторская', 'Алматы', 'Медеуский', 'Кабинет', 2500, 2, 'Уютное помещение для занятий'],
        ['Конференц-зал', 'Алматы', 'Алмалинский', 'Конференция', 5000, 20, 'Большой зал с проектором'],
        ['IT-студия', 'Алматы', 'Турксибский', 'Студия', 4000, 10, 'Оборудованная техностудия'],
        ['Юридическая консультация', 'Алматы', 'Алмалинский', 'Кабинет', 3500, 4, 'Профессиональный кабинет'],
        ['Бьюти кабинет', 'Алматы', 'Медеуский', 'Кабинет', 2000, 2, 'Салон красоты'],
        ['Фотостудия', 'Алматы', 'Турксибский', 'Студия', 6000, 8, 'Профессиональная фотостудия'],
        ['Офисный кабинет', 'Алматы', 'Алмалинский', 'Кабинет', 2500, 6, 'Рабочий кабинет'],
        ['Переговорная', 'Алматы', 'Алмалинский', 'Конференция', 4000, 12, 'Переговорная комната'],
        ['Тренажёрный зал', 'Алматы', 'Медеуский', 'Спорт', 3000, 15, 'Спортзал'],
      ];
      
      for (const r of rooms) {
        const vals = r.map(v => typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v).join(',');
        db.run(`INSERT INTO rooms (title, city, district, category, price, capacity, description) VALUES (${vals})`);
      }
      console.log(`✅ ${rooms.length} demo rooms created`);
      saveDB();
    }
  } catch (e) {
    console.error('Rooms seed error:', e.message);
  }
}

function saveDB() {
  try {
    if (db) {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
    }
  } catch (e) {
    console.error('Save DB error:', e.message);
  }
}

function getDB() {
  return {
    prepare(sql) {
      return {
        get(...params) {
          try {
            const result = db.exec(sql.replace(/\?/g, () => {
              const val = params.shift();
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              return val;
            }));
            return result && result[0] && result[0].values && result[0].values[0] 
              ? mapRowToObject(result[0], 0) 
              : null;
          } catch (e) {
            console.error('Get error:', e.message);
            return null;
          }
        },
        all(...params) {
          try {
            const result = db.exec(sql.replace(/\?/g, () => {
              const val = params.shift();
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              return val;
            }));
            if (!result || !result[0] || !result[0].values) return [];
            return result[0].values.map((_, i) => mapRowToObject(result[0], i));
          } catch (e) {
            console.error('All error:', e.message);
            return [];
          }
        },
        run(...params) {
          try {
            db.run(sql.replace(/\?/g, () => {
              const val = params.shift();
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              return val;
            }));
            saveDB();
            return { changes: 1, lastInsertRowid: Date.now() };
          } catch (e) {
            console.error('Run error:', e.message);
            return { changes: 0, lastInsertRowid: 0 };
          }
        }
      };
    },
    run(sql) {
      db.run(sql);
      saveDB();
    }
  };
}

function mapRowToObject(result, rowIndex) {
  const obj = {};
  for (let i = 0; i < result.columns.length; i++) {
    obj[result.columns[i]] = result.values[rowIndex][i];
  }
  return obj;
}

module.exports = {
  connect,
  initTables,
  seedAdmin,
  seedRooms,
  getDB,
  saveDB
};
