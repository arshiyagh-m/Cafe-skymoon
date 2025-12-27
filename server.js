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
        
        // جداول قبلی
        await client.query(`CREATE TABLE IF NOT EXISTS menu (id SERIAL PRIMARY KEY, name TEXT, category TEXT, price NUMERIC, description TEXT, image TEXT, is_featured BOOLEAN DEFAULT FALSE);`);
        await client.query(`CREATE TABLE IF NOT EXISTS gallery (id SERIAL PRIMARY KEY, image TEXT, caption TEXT, is_home_featured BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await client.query(`CREATE TABLE IF NOT EXISTS reservations (id SERIAL PRIMARY KEY, name TEXT, phone TEXT, date TEXT, time TEXT, guests TEXT, space TEXT, occasion TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);
        await client.query(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB);`);

        // ✅ جدول جدید: فضاهای کافه
        await client.query(`
            CREATE TABLE IF NOT EXISTS spaces (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                image TEXT
            );
        `);

        // اضافه کردن یک فضای پیش‌فرض اگر جدول خالی بود
        const checkSpaces = await client.query('SELECT * FROM spaces');
        if (checkSpaces.rowCount === 0) {
            await client.query("INSERT INTO spaces (name, description, image) VALUES ('سالن اصلی', 'فضای عمومی و پرانرژی کافه', 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=300')");
        }

        console.log('✅ Database verified');
        client.release();
    } catch (err) { console.error('❌ DB Error:', err); }
};
initDB();

// ================= API Routes =================

// --- Spaces (جدید) ---
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

// --- Menu ---
app.get('/api/menu', async (req, res) => { const r = await pool.query('SELECT * FROM menu ORDER BY is_featured DESC, id ASC'); res.json(r.rows); });
app.post('/api/menu', async (req, res) => { const {n,c,p,d,i} = req.body; const r = await pool.query('INSERT INTO menu (name, category, price, description, image, is_featured) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [req.body.name, req.body.category, req.body.price, req.body.description, req.body.image, false]); res.json(r.rows[0]); });
app.put('/api/menu/:id', async (req, res) => { const r = await pool.query('UPDATE menu SET name=$1, category=$2, price=$3, description=$4, image=$5 WHERE id=$6 RETURNING *', [req.body.name, req.body.category, req.body.price, req.body.description, req.body.image, req.params.id]); res.json(r.rows[0]); });
app.patch('/api/menu/:id/toggle-feature', async (req, res) => { const r = await pool.query('UPDATE menu SET is_featured = NOT is_featured WHERE id = $1 RETURNING *', [req.params.id]); res.json(r.rows[0]); });
app.delete('/api/menu/:id', async (req, res) => { await pool.query('DELETE FROM menu WHERE id = $1', [req.params.id]); res.json({ success: true }); });

// --- Gallery ---
app.get('/api/gallery', async (req, res) => { const r = await pool.query('SELECT * FROM gallery ORDER BY is_home_featured DESC, created_at DESC'); res.json(r.rows); });
app.post('/api/gallery', async (req, res) => { const r = await pool.query('INSERT INTO gallery (image, caption, is_home_featured) VALUES ($1, $2, $3) RETURNING *', [req.body.image, req.body.caption, false]); res.json(r.rows[0]); });
app.patch('/api/gallery/:id/toggle-home', async (req, res) => { const r = await pool.query('UPDATE gallery SET is_home_featured = NOT is_home_featured WHERE id = $1 RETURNING *', [req.params.id]); res.json(r.rows[0]); });
app.delete('/api/gallery/:id', async (req, res) => { await pool.query('DELETE FROM gallery WHERE id = $1', [req.params.id]); res.json({ success: true }); });

// --- Reservations ---
app.get('/api/reservations', async (req, res) => { const r = await pool.query('SELECT * FROM reservations ORDER BY created_at DESC'); res.json(r.rows); });
app.post('/api/reservations', async (req, res) => { const r = await pool.query('INSERT INTO reservations (name, phone, date, time, guests, space, occasion) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [req.body.name, req.body.phone, req.body.date, req.body.time, req.body.guests, req.body.space, req.body.occasion]); res.json(r.rows[0]); });
app.delete('/api/reservations/:id', async (req, res) => { await pool.query('DELETE FROM reservations WHERE id = $1', [req.params.id]); res.json({ success: true }); });

// --- Theme ---
app.get('/api/theme', async (req, res) => { const r = await pool.query("SELECT value FROM settings WHERE key = 'theme'"); res.json(r.rows.length > 0 ? r.rows[0].value : {}); });
app.post('/api/theme', async (req, res) => { await pool.query("INSERT INTO settings (key, value) VALUES ('theme', $1) ON CONFLICT (key) DO UPDATE SET value = $1", [req.body]); res.json({ success: true }); });

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(process.env.PORT || 3000, () => console.log(`🚀 Server Started`));
