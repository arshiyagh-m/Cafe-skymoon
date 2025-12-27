const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

const connectionString = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/skymoon';
const pool = new Pool({ connectionString, ssl: false });

const initDB = async () => {
    try {
        const client = await pool.connect();
        
        // جداول اصلی
        await client.query(`CREATE TABLE IF NOT EXISTS menu (id SERIAL PRIMARY KEY, name TEXT, category TEXT, price NUMERIC, description TEXT, image TEXT);`);
        await client.query(`CREATE TABLE IF NOT EXISTS gallery (id SERIAL PRIMARY KEY, image TEXT, caption TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await client.query(`CREATE TABLE IF NOT EXISTS reservations (id SERIAL PRIMARY KEY, name TEXT, phone TEXT, date TEXT, time TEXT, guests TEXT, space TEXT, occasion TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await client.query(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB);`);

        // --- تعمیر و آپدیت خودکار دیتابیس ---
        
        // 1. اضافه کردن ستون ویژه به منو
        await client.query(`ALTER TABLE menu ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;`);
        
        // 2. اضافه کردن ستون ویژه به گالری (جدید)
        await client.query(`ALTER TABLE gallery ADD COLUMN IF NOT EXISTS is_home_featured BOOLEAN DEFAULT FALSE;`);

        console.log('✅ Database verified and patched');
        client.release();
    } catch (err) { console.error('❌ DB Error:', err); }
};
initDB();

// --- API Routes ---

// Menu
app.get('/api/menu', async (req, res) => {
    const result = await pool.query('SELECT * FROM menu ORDER BY is_featured DESC, id ASC');
    res.json(result.rows);
});
app.post('/api/menu', async (req, res) => {
    const { name, category, price, description, image } = req.body;
    const result = await pool.query('INSERT INTO menu (name, category, price, description, image, is_featured) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [name, category, price, description, image, false]);
    res.json(result.rows[0]);
});
app.put('/api/menu/:id', async (req, res) => {
    const { name, category, price, description, image } = req.body;
    const result = await pool.query('UPDATE menu SET name=$1, category=$2, price=$3, description=$4, image=$5 WHERE id=$6 RETURNING *', [name, category, price, description, image, req.params.id]);
    res.json(result.rows[0]);
});
app.patch('/api/menu/:id/toggle-feature', async (req, res) => {
    const result = await pool.query('UPDATE menu SET is_featured = NOT is_featured WHERE id = $1 RETURNING *', [req.params.id]);
    res.json(result.rows[0]);
});
app.delete('/api/menu/:id', async (req, res) => {
    await pool.query('DELETE FROM menu WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

// Gallery (آپدیت شده)
app.get('/api/gallery', async (req, res) => {
    // اول عکس‌های ویژه صفحه اصلی، بعد بقیه بر اساس تاریخ
    const result = await pool.query('SELECT * FROM gallery ORDER BY is_home_featured DESC, created_at DESC');
    res.json(result.rows);
});
app.post('/api/gallery', async (req, res) => {
    const { image, caption } = req.body;
    // پیش‌فرض false
    const result = await pool.query('INSERT INTO gallery (image, caption, is_home_featured) VALUES ($1, $2, $3) RETURNING *', [image, caption, false]);
    res.json(result.rows[0]);
});
// ** روت جدید: تغییر وضعیت نمایش در صفحه اصلی **
app.patch('/api/gallery/:id/toggle-home', async (req, res) => {
    const result = await pool.query('UPDATE gallery SET is_home_featured = NOT is_home_featured WHERE id = $1 RETURNING *', [req.params.id]);
    res.json(result.rows[0]);
});
app.delete('/api/gallery/:id', async (req, res) => {
    await pool.query('DELETE FROM gallery WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

// Reservations
app.get('/api/reservations', async (req, res) => {
    const result = await pool.query('SELECT * FROM reservations ORDER BY created_at DESC');
    res.json(result.rows);
});
app.post('/api/reservations', async (req, res) => {
    const { name, phone, date, time, guests, space, occasion } = req.body;
    const result = await pool.query('INSERT INTO reservations (name, phone, date, time, guests, space, occasion) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [name, phone, date, time, guests, space, occasion]);
    res.json(result.rows[0]);
});
app.delete('/api/reservations/:id', async (req, res) => {
    await pool.query('DELETE FROM reservations WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

// Theme
app.get('/api/theme', async (req, res) => {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'theme'");
    res.json(result.rows.length > 0 ? result.rows[0].value : { primary: '#d4af37', bg: '#0f0f0f', occasion: 'none' });
});
app.post('/api/theme', async (req, res) => {
    await pool.query("INSERT INTO settings (key, value) VALUES ('theme', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [req.body]);
    res.json({ success: true });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
