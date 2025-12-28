const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// اتصال به دیتابیس
const connectionString = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/skymoon';
const pool = new Pool({ connectionString, ssl: false });

// --- تابع ساخت و تعمیر دیتابیس ---
const initDB = async () => {
    try {
        const client = await pool.connect();
        
        // 1. ساخت جداول
        await client.query(`CREATE TABLE IF NOT EXISTS menu (id SERIAL PRIMARY KEY, name TEXT, category TEXT, price NUMERIC, description TEXT, image TEXT);`);
        await client.query(`CREATE TABLE IF NOT EXISTS gallery (id SERIAL PRIMARY KEY, image TEXT, caption TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await client.query(`CREATE TABLE IF NOT EXISTS spaces (id SERIAL PRIMARY KEY, name TEXT, description TEXT, image TEXT);`);
        await client.query(`CREATE TABLE IF NOT EXISTS reservations (id SERIAL PRIMARY KEY, name TEXT, phone TEXT, date TEXT, time TEXT, guests TEXT, space TEXT, occasion TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await client.query(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB);`);
        
        // ✅ جدول جدید برای دسته‌بندی‌ها (لازم برای داشبورد جدید)
        await client.query(`CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, image TEXT);`);

        // 2. تعمیر دیتابیس (اضافه کردن ستون‌های گمشده)
        await client.query(`ALTER TABLE menu ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;`);
        
        // ✅ حل مشکل ارور گالری
        await client.query(`ALTER TABLE gallery ADD COLUMN IF NOT EXISTS is_home_featured BOOLEAN DEFAULT FALSE;`);

        // پر کردن دسته‌بندی‌ها از روی منوی فعلی (اگر جدول خالی باشد)
        const catCheck = await client.query('SELECT * FROM categories');
        if (catCheck.rowCount === 0) {
            const menuCats = await client.query('SELECT DISTINCT category FROM menu');
            for (let row of menuCats.rows) {
                if(row.category) await client.query("INSERT INTO categories (name, image) VALUES ($1, $2) ON CONFLICT DO NOTHING", [row.category, 'https://via.placeholder.com/150']);
            }
        }

        console.log('✅ Database verified & Updated successfully (V3)'); // پیام جدید برای اطمینان از آپدیت
        client.release();
    } catch (err) {
        console.error('❌ Database Error:', err);
    }
};

initDB();


// ================= API Routes =================

// --- Categories (جدید - برای داشبورد) ---
app.get('/api/categories', async (req, res) => {
    const result = await pool.query('SELECT * FROM categories ORDER BY id ASC');
    res.json(result.rows);
});
app.post('/api/categories', async (req, res) => {
    try {
        const { name, image } = req.body;
        const result = await pool.query('INSERT INTO categories (name, image) VALUES ($1, $2) RETURNING *', [name, image]);
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: 'خطا در ثبت دسته' }); }
});
app.delete('/api/categories/:id', async (req, res) => {
    try {
        const cat = await pool.query('SELECT name FROM categories WHERE id = $1', [req.params.id]);
        if (cat.rows.length > 0) {
            await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
            await pool.query('DELETE FROM menu WHERE category = $1', [cat.rows[0].name]); // حذف آیتم‌های آن دسته
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Menu ---
app.get('/api/menu', async (req, res) => {
    try {
        const { category } = req.query;
        let query = 'SELECT * FROM menu';
        let params = [];
        if (category) {
            query += ' WHERE category = $1';
            params.push(category);
        }
        query += ' ORDER BY is_featured DESC, id ASC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/menu', async (req, res) => {
    try {
        const { name, category, price, description, image } = req.body;
        const result = await pool.query('INSERT INTO menu (name, category, price, description, image, is_featured) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [name, category, price, description, image, false]);
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/menu/:id', async (req, res) => {
    try {
        const { name, category, price, description, image } = req.body;
        const result = await pool.query('UPDATE menu SET name=$1, category=$2, price=$3, description=$4, image=$5 WHERE id=$6 RETURNING *', [name, category, price, description, image, req.params.id]);
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/menu/:id/toggle-feature', async (req, res) => {
    try {
        const result = await pool.query('UPDATE menu SET is_featured = NOT is_featured WHERE id = $1 RETURNING *', [req.params.id]);
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/menu/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM menu WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Gallery ---
app.get('/api/gallery', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM gallery ORDER BY is_home_featured DESC, created_at DESC');
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gallery', async (req, res) => {
    try {
        const { image, caption } = req.body;
        const result = await pool.query('INSERT INTO gallery (image, caption, is_home_featured) VALUES ($1, $2, $3) RETURNING *', [image, caption, false]);
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/gallery/:id/toggle-home', async (req, res) => {
    try {
        const result = await pool.query('UPDATE gallery SET is_home_featured = NOT is_home_featured WHERE id = $1 RETURNING *', [req.params.id]);
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/gallery/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM gallery WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Spaces ---
app.get('/api/spaces', async (req, res) => {
    const result = await pool.query('SELECT * FROM spaces ORDER BY id ASC');
    res.json(result.rows);
});
app.post('/api/spaces', async (req, res) => {
    const { name, description, image } = req.body;
    const result = await pool.query('INSERT INTO spaces (name, description, image) VALUES ($1, $2, $3) RETURNING *', [name, description, image]);
    res.json(result.rows[0]);
});
app.delete('/api/spaces/:id', async (req, res) => {
    await pool.query('DELETE FROM spaces WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

// --- Reservations ---
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

// --- Theme ---
app.get('/api/theme', async (req, res) => {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'theme'");
    res.json(result.rows.length > 0 ? result.rows[0].value : { primary: '#d4af37', bg: '#0f0f0f', occasion: 'none' });
});
app.post('/api/theme', async (req, res) => {
    const value = req.body;
    await pool.query("INSERT INTO settings (key, value) VALUES ('theme', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [value]);
    res.json({ success: true });
});

// مسیر پیش‌فرض
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// شروع سرور
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
