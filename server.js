const express = require('express');
const { Pool } = require('pg'); // درایور پستگرس
const cors = require('cors');
const path = require('path');
const app = express();

// --- تنظیمات اولیه ---
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// --- اتصال به دیتابیس PostgreSQL ---
const connectionString = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/skymoon';

const pool = new Pool({
  connectionString: connectionString,
  ssl: false // غیرفعال کردن SSL برای اتصال درون‌شبکه‌ای لیارا
});

// --- ایجاد جدول‌ها (اگر وجود نداشته باشند) ---
const initDB = async () => {
    try {
        const client = await pool.connect();
        
        // 1. جدول منو (با فیلد ویژه is_featured)
        await client.query(`
            CREATE TABLE IF NOT EXISTS menu (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                price NUMERIC NOT NULL,
                description TEXT,
                image TEXT,
                is_featured BOOLEAN DEFAULT FALSE
            );
        `);

        // 2. جدول گالری
        await client.query(`
            CREATE TABLE IF NOT EXISTS gallery (
                id SERIAL PRIMARY KEY,
                image TEXT NOT NULL,
                caption TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 3. جدول رزرو
        await client.query(`
            CREATE TABLE IF NOT EXISTS reservations (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                guests TEXT NOT NULL,
                space TEXT,
                occasion TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. جدول تنظیمات
        await client.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value JSONB
            );
        `);

        console.log('✅ PostgreSQL Tables checked/created successfully');
        client.release();
    } catch (err) {
        console.error('❌ Error initializing database:', err);
    }
};

initDB();


// =========================================================
// API Routes
// =========================================================

// --- مدیریت منو ---

// دریافت منو (آیتم‌های ویژه اول می‌آیند)
app.get('/api/menu', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM menu ORDER BY is_featured DESC, id ASC');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// افزودن آیتم
app.post('/api/menu', async (req, res) => {
    try {
        const { name, category, price, description, image } = req.body;
        const result = await pool.query(
            'INSERT INTO menu (name, category, price, description, image, is_featured) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, category, price, description, image, false]
        );
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ویرایش کامل آیتم
app.put('/api/menu/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, price, description, image } = req.body;
        
        const result = await pool.query(
            'UPDATE menu SET name=$1, category=$2, price=$3, description=$4, image=$5 WHERE id=$6 RETURNING *',
            [name, category, price, description, image, id]
        );
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ** جدید: تغییر وضعیت ستاره (Toggle Featured) **
app.patch('/api/menu/:id/toggle-feature', async (req, res) => {
    try {
        const { id } = req.params;
        // مقدار is_featured را برعکس می‌کند (true -> false و برعکس)
        const result = await pool.query(
            'UPDATE menu SET is_featured = NOT is_featured WHERE id = $1 RETURNING *',
            [id]
        );
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// حذف آیتم
app.delete('/api/menu/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM menu WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- مدیریت گالری ---
app.get('/api/gallery', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM gallery ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gallery', async (req, res) => {
    try {
        const { image, caption } = req.body;
        const result = await pool.query(
            'INSERT INTO gallery (image, caption) VALUES ($1, $2) RETURNING *',
            [image, caption]
        );
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/gallery/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM gallery WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- مدیریت رزروها ---
app.get('/api/reservations', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM reservations ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reservations', async (req, res) => {
    try {
        const { name, phone, date, time, guests, space, occasion } = req.body;
        const result = await pool.query(
            'INSERT INTO reservations (name, phone, date, time, guests, space, occasion) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [name, phone, date, time, guests, space, occasion]
        );
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/reservations/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM reservations WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- تنظیمات تم ---
app.get('/api/theme', async (req, res) => {
    try {
        const result = await pool.query("SELECT value FROM settings WHERE key = 'theme'");
        if (result.rows.length > 0) {
            res.json(result.rows[0].value);
        } else {
            // مقادیر پیش‌فرض کامل
            res.json({ primary: '#d4af37', bg: '#0f0f0f', occasion: 'none' });
        }
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/theme', async (req, res) => {
    try {
        const value = req.body;
        // Upsert برای Postgres
        await pool.query(
            `INSERT INTO settings (key, value) VALUES ('theme', $1) 
             ON CONFLICT (key) DO UPDATE SET value = $1`,
            [value]
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// مسیر پیش‌فرض
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- اجرا ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
