require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db-sqlite.js');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || 'workspace_kz_sec';

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:49842')
  .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({ credentials: true, origin(origin, callback) {
  if (!origin || ALLOWED_ORIGINS.includes(origin)) callback(null, true);
  else callback(new Error('CORS'));
}}));
app.use(express.json());

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Required' });
    const database = db.getDB();
    const user = database.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid' });
    }
    const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { email: user.email, name: user.name, phone: user.phone, role: user.role, joined: user.joined } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, phone, role } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Required' });
    if (password.length < 8) return res.status(400).json({ error: 'Short' });
    const database = db.getDB();
    const existing = database.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) return res.status(409).json({ error: 'Exists' });
    const hash = bcrypt.hashSync(password, 10);
    database.prepare('INSERT INTO users (email, password_hash, name, phone, role, joined) VALUES (?, ?, ?, ?, ?, ?)').run(email.toLowerCase(), hash, name, phone || '', role === 'landlord' ? 'landlord' : 'renter', new Date().toISOString().split('T')[0]);
    const token = jwt.sign({ email: email.toLowerCase(), role: role === 'landlord' ? 'landlord' : 'renter' }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { email: email.toLowerCase(), name, phone: phone || '', role: role === 'landlord' ? 'landlord' : 'renter', joined: new Date().toISOString().split('T')[0] } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const database = db.getDB();
    const user = database.prepare('SELECT * FROM users WHERE email = ?').get(req.user.email);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ email: user.email, name: user.name, phone: user.phone, role: user.role, joined: user.joined });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rooms', async (req, res) => {
  try {
    const database = db.getDB();
    let query = 'SELECT * FROM rooms WHERE 1=1';
    if (req.query.city) query += ` AND city LIKE '%${req.query.city}%'`;
    if (req.query.category) query += ` AND category LIKE '%${req.query.category}%'`;
    query += ' LIMIT 50';
    const rooms = database.prepare(query).all();
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rooms/:id', async (req, res) => {
  try {
    const database = db.getDB();
    const room = database.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rooms', auth, async (req, res) => {
  try {
    if (req.user.role !== 'landlord' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const database = db.getDB();
    const result = database.prepare('INSERT INTO rooms (title, city, district, category, price, capacity, description, owner_email, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(req.body.title, req.body.city, req.body.district || '', req.body.category, Number(req.body.price), req.body.capacity || 1, req.body.description || '', req.user.email, 5.0);
    res.status(201).json({ id: result.lastInsertRowid, ...req.body, owner_email: req.user.email, rating: 5.0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bookings/slots/:room_id', async (req, res) => {
  try {
    const { room_id } = req.params;
    const { date } = req.query;
    const database = db.getDB();
    const booked = database.prepare('SELECT slots FROM bookings WHERE room_id = ? AND booking_date = ? AND status IN ("PENDING", "CONFIRMED", "BLOCKED")').all(room_id, date);
    const times = [];
    for (let h = 8; h < 22; h++) times.push(`${String(h).padStart(2, '0')}:00`);
    const bookedSlots = [];
    for (const b of booked) {
      try {
        const slots = JSON.parse(b.slots || '[]');
        bookedSlots.push(...slots);
      } catch {}
    }
    const available = times.filter(t => !bookedSlots.includes(t));
    res.json({ available, booked: bookedSlots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings', auth, async (req, res) => {
  try {
    const { room_id, booking_date, slots, contact_phone, notes } = req.body;
    if (!room_id || !booking_date || !slots || slots.length === 0) {
      return res.status(400).json({ error: 'Required' });
    }
    const database = db.getDB();
    const room = database.prepare('SELECT * FROM rooms WHERE id = ?').get(room_id);
    if (!room) return res.status(404).json({ error: 'Not found' });
    const total_price = slots.length * room.price;
    const result = database.prepare('INSERT INTO bookings (booking_ref, room_id, user_email, slots, booking_date, status, total_price, contact_phone, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(`WS${Date.now()}`, room_id, req.user.email, JSON.stringify(slots), booking_date, 'PENDING', total_price, contact_phone || '', notes || '');
    res.status(201).json({ id: result.lastInsertRowid, booking_ref: `WS${Date.now()}`, room_id, user_email: req.user.email, slots, booking_date, status: 'PENDING', total_price, contact_phone: contact_phone || '', notes: notes || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bookings', auth, async (req, res) => {
  try {
    const database = db.getDB();
    const bookings = database.prepare('SELECT * FROM bookings WHERE user_email = ? ORDER BY created_at DESC').all(req.user.email);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function start() {
  await db.connect();
  db.initTables();
  db.seedAdmin();
  db.seedRooms();
  app.listen(PORT, () => {
    console.log(`✅ Backend: http://localhost:${PORT}`);
  });
}

start().catch(console.error);

module.exports = app;
