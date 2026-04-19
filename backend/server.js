require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');

const db = require('./db-mongo.js');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || 'workspace_kz_supersecret_mongodb_2024';

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ||
  'http://localhost:3000,http://localhost:5173,http://127.0.0.1:5500,http://localhost:5500,http://localhost:49842')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  }
}));
app.use(express.json());

// Auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── AUTH ───────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const users = db.getDB().collection('users');
    const user = await users.findOne({ email: email.toLowerCase() });
    
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        joined: user.joined
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, phone, role } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be 8+ characters' });
    }

    const users = db.getDB().collection('users');
    const existing = await users.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const newUser = {
      email: email.toLowerCase(),
      password_hash: hash,
      name,
      phone: phone || '',
      role: role === 'landlord' ? 'landlord' : 'renter',
      joined: new Date(),
      created_at: new Date()
    };

    await users.insertOne(newUser);
    
    const token = jwt.sign(
      { email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        email: newUser.email,
        name: newUser.name,
        phone: newUser.phone,
        role: newUser.role,
        joined: newUser.joined
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const users = db.getDB().collection('users');
    const user = await users.findOne({ email: req.user.email });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      joined: user.joined
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ROOMS ──────────────────────────────────────
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = db.getDB().collection('rooms');
    const query = {};
    
    if (req.query.city) {
      query.city = { $regex: req.query.city, $options: 'i' };
    }
    if (req.query.category) {
      query.category = { $regex: req.query.category, $options: 'i' };
    }

    const result = await rooms.find(query).limit(50).toArray();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rooms/:id', async (req, res) => {
  try {
    const rooms = db.getDB().collection('rooms');
    const room = await rooms.findOne({ 
      _id: new ObjectId(req.params.id) 
    });
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rooms', auth, async (req, res) => {
  try {
    if (req.user.role !== 'landlord' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only landlords can create rooms' });
    }

    const rooms = db.getDB().collection('rooms');
    const newRoom = {
      title: req.body.title,
      city: req.body.city,
      district: req.body.district || '',
      category: req.body.category,
      price: Number(req.body.price),
      capacity: req.body.capacity || 1,
      amenities: req.body.amenities || [],
      img: req.body.img || '',
      description: req.body.description || '',
      rating: 5.0,
      owner_email: req.user.email,
      created_at: new Date()
    };

    const result = await rooms.insertOne(newRoom);
    res.status(201).json({ ...newRoom, _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── BOOKINGS ───────────────────────────────────
app.get('/api/bookings/slots/:room_id', async (req, res) => {
  try {
    const { room_id, date } = req.query;
    
    const bookings = db.getDB().collection('bookings');
    const booked = await bookings.find({
      room_id: new ObjectId(room_id),
      booking_date: date,
      status: { $in: ['PENDING', 'CONFIRMED', 'BLOCKED'] }
    }).toArray();

    const times = [];
    for (let h = 8; h < 22; h++) {
      times.push(`${String(h).padStart(2, '0')}:00`);
    }

    const bookedSlots = booked.map(b => b.slot);
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
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get room for price
    const rooms = db.getDB().collection('rooms');
    const room = await rooms.findOne({ _id: new ObjectId(room_id) });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Calculate total price
    const total_price = slots.length * room.price;

    // Create booking
    const bookings = db.getDB().collection('bookings');
    const booking = {
      booking_ref: `WS${Date.now()}`,
      room_id: new ObjectId(room_id),
      user_email: req.user.email,
      slots: slots,
      booking_date: booking_date,
      status: 'PENDING',
      total_price: total_price,
      contact_phone: contact_phone || '',
      notes: notes || '',
      created_at: new Date()
    };

    const result = await bookings.insertOne(booking);
    
    res.status(201).json({
      ...booking,
      _id: result.insertedId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bookings', auth, async (req, res) => {
  try {
    const bookings = db.getDB().collection('bookings');
    const userBookings = await bookings.find({ 
      user_email: req.user.email 
    }).sort({ created_at: -1 }).toArray();

    res.json(userBookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── STARTUP ────────────────────────────────────
async function start() {
  await db.connect();
  await db.seedAdmin();

  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);

module.exports = app;
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const db = require('./db.js');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || 'workspace_kz_supersecret2024_change_this';
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS ||
  'http://localhost:3000,http://localhost:5173,http://127.0.0.1:5500,http://localhost:5500')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const ACTIVE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'BLOCKED'];
const SLOT_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);
app.use(express.json());

function normalizeRole(role) {
  if (role === 'admin') return 'admin';
  if (role === 'landlord' || role === 'host') return 'landlord';
  return 'renter';
}

function parseDateOrToday(dateInput) {
  if (!dateInput) return new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(dateInput)) return null;
  return dateInput;
}

function sanitizeSlots(slotsInput) {
  const source = Array.isArray(slotsInput) ? slotsInput : [slotsInput];
  const cleaned = source
    .map((slot) => String(slot || '').trim())
    .filter((slot) => SLOT_RE.test(slot));
  return [...new Set(cleaned)].sort();
}

async function ensureSchema() {
  // Schema is auto-created in db.js for SQLite.
  // This function is kept as a no-op so server startup doesn't break.
}

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'No token' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    const role = normalizeRole(req.user?.role);
    if (!allowedRoles.includes(role)) {
      res.status(403).json({ error: 'Forbidden for this role' });
      return;
    }
    next();
  };
}

async function ensureRoomOwner(roomId, ownerEmail) {
  const ownerCheck = await db.query('SELECT id FROM rooms WHERE id = $1 AND owner_email = $2', [
    roomId,
    ownerEmail,
  ]);
  return ownerCheck.rows.length > 0;
}

// Auth
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const result = await db.query('SELECT email, password_hash, name, phone, role, joined FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const role = normalizeRole(user.role);
    const token = jwt.sign({ email: user.email, role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        email: user.email,
        name: user.name,
        phone: user.phone,
        role,
        joined: user.joined,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, phone, role } = req.body;
  if (!email || !password || !name) {
    res.status(400).json({ error: 'Name, email and password are required' });
    return;
  }
  if (String(password).length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  const normalizedRole = normalizeRole(role);
  try {
    const hash = bcrypt.hashSync(password, 10);
    const insert = await db.query(
      'INSERT INTO users (email, password_hash, name, phone, role) VALUES ($1, $2, $3, $4, $5) RETURNING email, name, phone, role, joined',
      [email, hash, name, phone || null, normalizedRole]
    );
    const user = insert.rows[0];
    const token = jwt.sign({ email: user.email, role: normalizedRole }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { ...user, role: normalizedRole } });
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'User already exists' });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT email, name, phone, role, joined FROM users WHERE email = $1',
      [req.user.email]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const user = result.rows[0];
    res.json({ ...user, role: normalizeRole(user.role) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/auth/profile', auth, async (req, res) => {
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  try {
    const updated = await db.query(
      'UPDATE users SET name = $1, phone = $2 WHERE email = $3 RETURNING email, name, phone, role, joined',
      [name, phone || null, req.user.email]
    );
    const user = updated.rows[0];
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ ...user, role: normalizeRole(user.role) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rooms (catalog)
app.get('/api/rooms', async (req, res) => {
  const { city, category, amenities, priceMin, priceMax } = req.query;
  const amenityList = String(amenities || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  let query = 'SELECT * FROM rooms WHERE 1=1';
  const params = [];
  let idx = 1;

  if (city) {
    query += ` AND city ILIKE $${idx++}`;
    params.push(`%${city}%`);
  }
  if (category) {
    query += ` AND category ILIKE $${idx++}`;
    params.push(`%${category}%`);
  }
  if (priceMin) {
    query += ` AND price >= $${idx++}`;
    params.push(Number(priceMin));
  }
  if (priceMax) {
    query += ` AND price <= $${idx++}`;
    params.push(Number(priceMax));
  }
  if (amenityList.length > 0) {
    query += ` AND amenities @> $${idx++}::text[]`;
    params.push(amenityList);
  }

  query += ' ORDER BY rating DESC NULLS LAST, id DESC';

  try {
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rooms/:id', async (req, res) => {
  const roomId = Number(req.params.id);
  if (!Number.isFinite(roomId)) {
    res.status(400).json({ error: 'Invalid room id' });
    return;
  }

  try {
    const result = await db.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/rooms/:id/availability', async (req, res) => {
  const roomId = Number(req.params.id);
  const bookingDate = parseDateOrToday(req.query.date);
  if (!Number.isFinite(roomId) || !bookingDate) {
    res.status(400).json({ error: 'Invalid room id or date format (YYYY-MM-DD)' });
    return;
  }

  try {
    const taken = await db.query(
      `
      SELECT TO_CHAR(slot, 'HH24:MI') AS slot, status
      FROM bookings
      WHERE room_id = $1
        AND booking_date = $2::date
        AND status = ANY($3::text[])
      ORDER BY slot ASC
      `,
      [roomId, bookingDate, ACTIVE_BOOKING_STATUSES]
    );

    const bookedSlots = [];
    const blockedSlots = [];
    const pendingSlots = [];
    for (const row of taken.rows) {
      if (row.status === 'BLOCKED') blockedSlots.push(row.slot);
      else if (row.status === 'PENDING') pendingSlots.push(row.slot);
      else bookedSlots.push(row.slot);
    }

    res.json({
      room_id: roomId,
      date: bookingDate,
      bookedSlots,
      blockedSlots,
      pendingSlots,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rooms', auth, requireRole(['landlord']), async (req, res) => {
  const { title, city, district, category, price, amenities, img, description } = req.body;
  if (!title || !city || !category || !price) {
    res.status(400).json({ error: 'title, city, category and price are required' });
    return;
  }

  const amenityList = Array.isArray(amenities) ? amenities.filter(Boolean) : [];
  try {
    const created = await db.query(
      `
      INSERT INTO rooms (title, city, district, category, price, amenities, img, description, owner_email)
      VALUES (?,?,?,?,?,?,?,?,?)
      `,
      [
        title,
        city,
        district || '',
        category,
        Number(price),
        JSON.stringify(amenityList),
        img || '',
        description || '',
        req.user.email,
      ]
    );
    res.status(201).json(created.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/rooms/:id', auth, requireRole(['landlord']), async (req, res) => {
  const roomId = Number(req.params.id);
  if (!Number.isFinite(roomId)) {
    res.status(400).json({ error: 'Invalid room id' });
    return;
  }

  try {
    const ownsRoom = await ensureRoomOwner(roomId, req.user.email);
    if (!ownsRoom) {
      res.status(403).json({ error: 'You can edit only your own room' });
      return;
    }

    const current = await db.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
    const room = current.rows[0];
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const payload = {
      title: req.body.title ?? room.title,
      city: req.body.city ?? room.city,
      district: req.body.district ?? room.district,
      category: req.body.category ?? room.category,
      price: req.body.price ?? room.price,
      amenities: Array.isArray(req.body.amenities) ? req.body.amenities : room.amenities,
      img: req.body.img ?? room.img,
      description: req.body.description ?? room.description,
    };

    const updated = await db.query(
      `
      UPDATE rooms
      SET title = ?, city = ?, district = ?, category = ?, price = ?, amenities = ?, img = ?, description = ?
      WHERE id = ?
      `,
      [
        payload.title,
        payload.city,
        payload.district,
        payload.category,
        Number(payload.price),
        JSON.stringify(Array.isArray(payload.amenities) ? payload.amenities : []),
        payload.img,
        payload.description,
        roomId,
      ]
    );
    // Re-fetch the updated row
    const refetch = await db.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
    res.json(refetch.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/rooms/:id', auth, requireRole(['landlord']), async (req, res) => {
  const roomId = Number(req.params.id);
  if (!Number.isFinite(roomId)) {
    res.status(400).json({ error: 'Invalid room id' });
    return;
  }

  try {
    const ownsRoom = await ensureRoomOwner(roomId, req.user.email);
    if (!ownsRoom) {
      res.status(403).json({ error: 'You can delete only your own room' });
      return;
    }

    const futureBookings = await db.query(
      `
      SELECT id
      FROM bookings
      WHERE room_id = $1
        AND booking_date >= CURRENT_DATE
        AND status = ANY($2::text[])
      LIMIT 1
      `,
      [roomId, ACTIVE_BOOKING_STATUSES]
    );
    if (futureBookings.rows.length > 0) {
      res.status(409).json({ error: 'Room has active bookings and cannot be deleted' });
      return;
    }

    await db.query('DELETE FROM rooms WHERE id = $1', [roomId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tenant bookings
app.get('/api/bookings', auth, async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT
        b.id,
        b.booking_ref,
        b.room_id,
        b.user_email,
        TO_CHAR(b.slot, 'HH24:MI') AS slot,
        b.booking_date,
        b.status,
        b.total_price,
        b.created_at,
        r.title AS room_title,
        r.city AS room_city,
        r.district AS room_district,
        r.img AS room_img
      FROM bookings b
      JOIN rooms r ON r.id = b.room_id
      WHERE b.user_email = $1 AND b.status <> 'BLOCKED'
      ORDER BY b.booking_date DESC, b.slot DESC
      `,
      [req.user.email]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings', auth, async (req, res) => {
  const roomId = Number(req.body.room_id);
  const bookingDate = parseDateOrToday(req.body.booking_date);
  const slots = sanitizeSlots(req.body.slots || req.body.slot);

  if (!Number.isFinite(roomId) || !bookingDate || slots.length === 0) {
    res.status(400).json({ error: 'room_id, booking_date and slots are required' });
    return;
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const roomResult = await client.query('SELECT id, title, price FROM rooms WHERE id = $1', [roomId]);
    const room = roomResult.rows[0];
    if (!room) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const busySlots = await client.query(
      `
      SELECT TO_CHAR(slot, 'HH24:MI') AS slot
      FROM bookings
      WHERE room_id = $1
        AND booking_date = $2::date
        AND TO_CHAR(slot, 'HH24:MI') = ANY($3::text[])
        AND status = ANY($4::text[])
      FOR UPDATE
      `,
      [roomId, bookingDate, slots, ACTIVE_BOOKING_STATUSES]
    );
    if (busySlots.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: 'Some selected slots are no longer available',
        takenSlots: busySlots.rows.map((row) => row.slot),
      });
      return;
    }

    const bookingRef = randomUUID();
    const singleSlotPrice = Number(room.price || 0);
    const totalPrice = singleSlotPrice * slots.length;
    const status = 'CONFIRMED';

    const createdRows = [];
    for (const slot of slots) {
      const created = await client.query(
        `
        INSERT INTO bookings (booking_ref, room_id, user_email, slot, booking_date, status, total_price)
        VALUES ($1, $2, $3, $4::time, $5::date, $6, $7)
        RETURNING id, booking_ref, room_id, user_email, TO_CHAR(slot, 'HH24:MI') AS slot, booking_date, status, total_price, created_at
        `,
        [bookingRef, roomId, req.user.email, slot, bookingDate, status, singleSlotPrice]
      );
      createdRows.push(created.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({
      booking_ref: bookingRef,
      room_id: roomId,
      room_title: room.title,
      booking_date: bookingDate,
      slots,
      slots_count: slots.length,
      slot_price: singleSlotPrice,
      total_price: totalPrice,
      status,
      items: createdRows,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.patch('/api/bookings/:id/cancel', auth, async (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isFinite(bookingId)) {
    res.status(400).json({ error: 'Invalid booking id' });
    return;
  }

  try {
    const cancelled = await db.query(
      `
      UPDATE bookings
      SET status = 'CANCELLED'
      WHERE id = $1
        AND user_email = $2
        AND status IN ('PENDING', 'CONFIRMED')
      RETURNING id, status
      `,
      [bookingId, req.user.email]
    );
    if (!cancelled.rows[0]) {
      res.status(404).json({ error: 'Active booking not found for this user' });
      return;
    }
    res.json(cancelled.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Host tools
app.get('/api/host/rooms', auth, requireRole(['landlord']), async (req, res) => {
  try {
    const rooms = await db.query(
      'SELECT * FROM rooms WHERE owner_email = $1 ORDER BY id DESC',
      [req.user.email]
    );
    res.json(rooms.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/host/bookings', auth, requireRole(['landlord']), async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT
        b.id,
        b.booking_ref,
        b.room_id,
        r.title AS room_title,
        TO_CHAR(b.slot, 'HH24:MI') AS slot,
        b.booking_date,
        b.status,
        b.total_price,
        b.user_email,
        u.name AS tenant_name,
        u.phone AS tenant_phone,
        b.created_at
      FROM bookings b
      JOIN rooms r ON r.id = b.room_id
      LEFT JOIN users u ON u.email = b.user_email
      WHERE r.owner_email = $1
      ORDER BY b.booking_date DESC, b.slot DESC
      `,
      [req.user.email]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/host/rooms/:id/block', auth, requireRole(['landlord']), async (req, res) => {
  const roomId = Number(req.params.id);
  const bookingDate = parseDateOrToday(req.body.booking_date);
  const slots = sanitizeSlots(req.body.slots || req.body.slot);

  if (!Number.isFinite(roomId) || !bookingDate || slots.length === 0) {
    res.status(400).json({ error: 'room id, booking_date and slots are required' });
    return;
  }

  try {
    const ownsRoom = await ensureRoomOwner(roomId, req.user.email);
    if (!ownsRoom) {
      res.status(403).json({ error: 'You can block slots only in your own room' });
      return;
    }

    const bookingRef = randomUUID();
    const created = [];
    for (const slot of slots) {
      const row = await db.query(
        `
        INSERT INTO bookings (booking_ref, room_id, user_email, slot, booking_date, status, total_price, notes)
        VALUES ($1, $2, $3, $4::time, $5::date, 'BLOCKED', 0, 'Blocked by host')
        RETURNING id, booking_ref, room_id, TO_CHAR(slot, 'HH24:MI') AS slot, booking_date, status
        `,
        [bookingRef, roomId, req.user.email, slot, bookingDate]
      );
      created.push(row.rows[0]);
    }

    res.status(201).json({
      booking_ref: bookingRef,
      room_id: roomId,
      booking_date: bookingDate,
      status: 'BLOCKED',
      slots,
      items: created,
    });
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Some slots are already blocked or booked' });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

// Admin tools
app.get('/api/admin/stats', auth, requireRole(['admin']), async (req, res) => {
  try {
    const users = await db.query('SELECT COUNT(*) as count FROM users');
    const rooms = await db.query('SELECT COUNT(*) as count FROM rooms');
    const bookings = await db.query('SELECT COUNT(*) as count FROM bookings');
    const pending = await db.query("SELECT COUNT(*) as count FROM bookings WHERE status = 'PENDING'");
    res.json({
      users: users.rows[0].count,
      rooms: rooms.rows[0].count,
      bookings: bookings.rows[0].count,
      pending: pending.rows[0].count
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', auth, requireRole(['admin']), async (req, res) => {
  try {
    const result = await db.query('SELECT email, name, phone, role, joined FROM users ORDER BY joined DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', auth, requireRole(['admin']), async (req, res) => {
  const { email, password, name, phone, role } = req.body;
  if (!email || !password || !name) {
    res.status(400).json({ error: 'Name, email and password are required' });
    return;
  }
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = await db.query(
      'INSERT INTO users (email, password_hash, name, phone, role) VALUES ($1, $2, $3, $4, $5) RETURNING email, name, phone, role, joined',
      [email, hash, name, phone || null, role || 'renter']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/users/:email', auth, requireRole(['admin']), async (req, res) => {
  const { email } = req.params;
  const { name, phone, role } = req.body;
  try {
    const result = await db.query(
      'UPDATE users SET name = $1, phone = $2, role = $3 WHERE email = $4 RETURNING email, name, phone, role, joined',
      [name, phone, role, email]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:email', auth, requireRole(['admin']), async (req, res) => {
  const { email } = req.params;
  try {
    await db.query('DELETE FROM users WHERE email = $1', [email]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/rooms', auth, requireRole(['admin']), async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM rooms ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/rooms', auth, requireRole(['admin']), async (req, res) => {
  const { title, city, district, category, price, amenities, img, description, owner_email } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO rooms (title, city, district, category, price, amenities, img, description, owner_email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [title, city, district, category, price, JSON.stringify(amenities || []), img, description, owner_email]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/rooms/:id', auth, requireRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { title, city, district, category, price, amenities, img, description, owner_email } = req.body;
  try {
    const result = await db.query(
      'UPDATE rooms SET title=$1, city=$2, district=$3, category=$4, price=$5, amenities=$6, img=$7, description=$8, owner_email=$9 WHERE id=$10 RETURNING *',
      [title, city, district, category, price, JSON.stringify(amenities || []), img, description, owner_email, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Room not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/rooms/:id', auth, requireRole(['admin']), async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM rooms WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/bookings', auth, requireRole(['admin']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT b.*, r.title as room_title, u.name as user_name 
      FROM bookings b 
      JOIN rooms r ON b.room_id = r.id 
      JOIN users u ON b.user_email = u.email 
      ORDER BY b.booking_date DESC, b.slot DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/bookings', auth, requireRole(['admin']), async (req, res) => {
  const { user_email, room_id, booking_date, slot, status, total_price } = req.body;
  const bookingRef = randomUUID();
  try {
    const result = await db.query(
      'INSERT INTO bookings (booking_ref, user_email, room_id, booking_date, slot, status, total_price) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [bookingRef, user_email, room_id, booking_date, slot, status || 'CONFIRMED', total_price || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/bookings/:id', auth, requireRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { user_email, room_id, booking_date, slots, status, total_price } = req.body;
  
  // Ensure slot is string or null (avoid undefined)
  let slot = null;
  if (Array.isArray(slots) && slots.length > 0) slot = slots[0];
  else if (typeof req.body.slot === 'string') slot = req.body.slot;

  try {
    const result = await db.query(
      'UPDATE bookings SET user_email=COALESCE($1, user_email), room_id=COALESCE($2, room_id), booking_date=COALESCE($3, booking_date), slot=COALESCE($4, slot), status=COALESCE($5, status), total_price=COALESCE($6, total_price) WHERE id=$7 RETURNING *',
      [user_email || null, room_id || null, booking_date || null, slot, status || null, total_price || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/bookings/:id', auth, requireRole(['admin']), async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM bookings WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Boot
ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`WorkSpace.kz API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to prepare schema:', err.message);
    process.exit(1);
  });
