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
        
        // 1. ساخت جداول
        await client.query(`CREATE TABLE IF NOT EXISTS menu (id SERIAL PRIMARY KEY, name TEXT, category TEXT, price NUMERIC, description TEXT, image TEXT);`);
        await client.query(`CREATE TABLE IF NOT EXISTS gallery (id SERIAL PRIMARY KEY, image TEXT, caption TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await client.query(`CREATE TABLE IF NOT EXISTS spaces (id SERIAL PRIMARY KEY, name TEXT, description TEXT, image TEXT);`);
        await client.query(`CREATE TABLE IF NOT EXISTS reservations (id SERIAL PRIMARY KEY, name TEXT, phone TEXT, date TEXT, time TEXT, guests TEXT, space TEXT, occasion TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await client.query(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB);`);
        await client.query(`CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, image TEXT);`);

        // 2. تعمیر دیتابیس (اضافه کردن ستون‌های جدید)
        await client.query(`ALTER TABLE menu ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;`);
        await client.query(`ALTER TABLE gallery ADD COLUMN IF NOT EXISTS is_home_featured BOOLEAN DEFAULT FALSE;`);
        
        // ✅ اضافه کردن ستون اولویت (Priority) به دسته‌بندی و منو
        await client.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;`);
        await client.query(`ALTER TABLE menu ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;`);

        // پر کردن دسته‌های پیش‌فرض اگر خالی بود
        const catCheck = await client.query('SELECT * FROM categories');
        if (catCheck.rowCount === 0) {
            const menuCats = await client.query('SELECT DISTINCT category FROM menu');
            for (let row of menuCats.rows) { if(row.category) await client.query("INSERT INTO categories (name, image, priority) VALUES ($1, $2, 0) ON CONFLICT DO NOTHING", [row.category, 'https://via.placeholder.com/150']); }
        }

        console.log('✅ Database Ready (V5 - Priority Added)');
        client.release();
    } catch (err) { console.error('❌ DB Error:', err); }
};
initDB();

// ================= API Routes =================

// --- Categories ---
app.get('/api/categories', async (req, res) => {
    // مرتب‌سازی بر اساس اولویت (کم به زیاد)
    const result = await pool.query('SELECT * FROM categories ORDER BY priority ASC, id ASC');
    res.json(result.rows);
});
app.post('/api/categories', async (req, res) => {
    try {
        const { name, image, priority } = req.body;
        const result = await pool.query('INSERT INTO categories (name, image, priority) VALUES ($1, $2, $3) RETURNING *', [name, image, priority || 0]);
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: 'خطا در ثبت' }); }
});
app.put('/api/categories/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const { name, image, priority } = req.body;

        const oldCat = await client.query('SELECT name FROM categories WHERE id = $1', [id]);
        if(oldCat.rows.length === 0) throw new Error('Not found');
        const oldName = oldCat.rows[0].name;

        const result = await client.query('UPDATE categories SET name=$1, image=$2, priority=$3 WHERE id=$4 RETURNING *', [name, image, priority || 0, id]);

        if(name !== oldName) await client.query('UPDATE menu SET category=$1 WHERE category=$2', [name, oldName]);

        await client.query('COMMIT');
        res.json(result.rows[0]);
    } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); } finally { client.release(); }
});
app.delete('/api/categories/:id', async (req, res) => {
    try {
        const cat = await pool.query('SELECT name FROM categories WHERE id = $1', [req.params.id]);
        if (cat.rows.length > 0) {
            await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
            await pool.query('DELETE FROM menu WHERE category = $1', [cat.rows[0].name]);
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
        if (category) { query += ' WHERE category = $1'; params.push(category); }
        // مرتب‌سازی: اول اولویت (۱, ۲, ...)، بعد ویژه‌ها، بعد جدیدترین‌ها
        query += ' ORDER BY priority ASC, is_featured DESC, id ASC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/menu', async (req, res) => {
    try {
        const { name, category, price, description, image, priority } = req.body;
        const result = await pool.query('INSERT INTO menu (name, category, price, description, image, is_featured, priority) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [name, category, price, description, image, false, priority || 0]);
        res.json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/menu/:id', async (req, res) => {
    try {
        const { name, category, price, description, image, priority } = req.body;
        const result = await pool.query('UPDATE menu SET name=$1, category=$2, price=$3, description=$4, image=$5, priority=$6 WHERE id=$7 RETURNING *', [name, category, price, description, image, priority || 0, req.params.id]);
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
    try { await pool.query('DELETE FROM menu WHERE id = $1', [req.params.id]); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Other (Gallery, Spaces, Reservations, Theme) ---
app.get('/api/gallery', async (req, res) => { const r = await pool.query('SELECT * FROM gallery ORDER BY is_home_featured DESC, created_at DESC'); res.json(r.rows); });
app.post('/api/gallery', async (req, res) => { const r = await pool.query('INSERT INTO gallery (image, caption, is_home_featured) VALUES ($1, $2, $3) RETURNING *', [req.body.image, req.body.caption, false]); res.json(r.rows[0]); });
app.patch('/api/gallery/:id/toggle-home', async (req, res) => { await pool.query('UPDATE gallery SET is_home_featured = NOT is_home_featured WHERE id = $1', [req.params.id]); res.json({success:true}); });
app.delete('/api/gallery/:id', async (req, res) => { await pool.query('DELETE FROM gallery WHERE id = $1', [req.params.id]); res.json({success:true}); });

app.get('/api/spaces', async (req, res) => { const r = await pool.query('SELECT * FROM spaces ORDER BY id ASC'); res.json(r.rows); });
app.post('/api/spaces', async (req, res) => { await pool.query('INSERT INTO spaces (name, description, image) VALUES ($1, $2, $3)', [req.body.name, req.body.description, req.body.image]); res.json({success:true}); });
app.delete('/api/spaces/:id', async (req, res) => { await pool.query('DELETE FROM spaces WHERE id = $1', [req.params.id]); res.json({success:true}); });

app.get('/api/reservations', async (req, res) => { const r = await pool.query('SELECT * FROM reservations ORDER BY created_at DESC'); res.json(r.rows); });
app.post('/api/reservations', async (req, res) => { await pool.query('INSERT INTO reservations (name, phone, date, time, guests, space, occasion) VALUES ($1, $2, $3, $4, $5, $6, $7)', [req.body.name, req.body.phone, req.body.date, req.body.time, req.body.guests, req.body.space, req.body.occasion]); res.json({success:true}); });
app.delete('/api/reservations/:id', async (req, res) => { await pool.query('DELETE FROM reservations WHERE id = $1', [req.params.id]); res.json({success:true}); });

app.get('/api/theme', async (req, res) => { const r = await pool.query("SELECT value FROM settings WHERE key = 'theme'"); res.json(r.rows.length>0 ? r.rows[0].value : {}); });
app.post('/api/theme', async (req, res) => { await pool.query("INSERT INTO settings (key, value) VALUES ('theme', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [req.body]); res.json({success:true}); });

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
