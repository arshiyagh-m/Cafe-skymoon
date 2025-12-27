const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const app = express();

// --- تنظیمات اولیه ---
app.use(express.json());
app.use(cors());
// سرو کردن فایل‌های استاتیک (HTML, CSS, JS) از پوشه public
app.use(express.static('public'));

// --- اتصال به دیتابیس (MongoDB) ---
// در لوکال هاست از آدرس پیش‌فرض استفاده می‌کند، در لیارا از متغیر محیطی
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/skymoon';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ Could not connect to MongoDB:', err));

// =========================================================
// تعریف مدل‌ها (Schemas)
// =========================================================

// 1. مدل منو (Menu)
const MenuSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    description: String,
    image: String // لینک عکس (URL) اینجا ذخیره می‌شود
});
const Menu = mongoose.model('Menu', MenuSchema);

// 2. مدل گالری (Gallery) - جدید
const GallerySchema = new mongoose.Schema({
    image: { type: String, required: true }, // لینک عکس (URL)
    caption: String,
    createdAt: { type: Date, default: Date.now }
});
const Gallery = mongoose.model('Gallery', GallerySchema);

// 3. مدل رزرو (Reservation)
const ReservationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    guests: { type: String, required: true },
    space: String,    // نوع فضا (اضافه شده طبق فرم)
    occasion: String, // مناسبت (اضافه شده طبق فرم)
    createdAt: { type: Date, default: Date.now }
});
const Reservation = mongoose.model('Reservation', ReservationSchema);

// 4. مدل تنظیمات تم (Settings)
const SettingsSchema = new mongoose.Schema({
    key: String, // مثلا 'theme'
    value: Object // مثلا { primary: '#...', bg: '#...' }
});
const Settings = mongoose.model('Settings', SettingsSchema);


// =========================================================
// API Routes (مسیرهای ارتباطی)
// =========================================================

// --- مدیریت منو ---
app.get('/api/menu', async (req, res) => {
    try {
        const items = await Menu.find();
        res.json(items);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/menu', async (req, res) => {
    try {
        // req.body شامل name, category, price, description, image (لینک) است
        const newItem = new Menu(req.body);
        await newItem.save();
        res.json(newItem);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/menu/:id', async (req, res) => {
    try {
        await Menu.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- مدیریت گالری ---
app.get('/api/gallery', async (req, res) => {
    try {
        const images = await Gallery.find().sort({ createdAt: -1 });
        res.json(images);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gallery', async (req, res) => {
    try {
        // req.body شامل image (لینک) و caption است
        const newImage = new Gallery(req.body);
        await newImage.save();
        res.json({ success: true, id: newImage._id });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/gallery/:id', async (req, res) => {
    try {
        await Gallery.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- مدیریت رزروها ---
app.get('/api/reservations', async (req, res) => {
    try {
        const list = await Reservation.find().sort({ createdAt: -1 });
        res.json(list);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reservations', async (req, res) => {
    try {
        const newRes = new Reservation(req.body);
        await newRes.save();
        res.json(newRes);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/reservations/:id', async (req, res) => {
    try {
        await Reservation.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- تنظیمات تم ---
app.get('/api/theme', async (req, res) => {
    try {
        const theme = await Settings.findOne({ key: 'theme' });
        res.json(theme ? theme.value : { primary: '#d4af37', bg: '#0f0f0f' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/theme', async (req, res) => {
    try {
        await Settings.findOneAndUpdate(
            { key: 'theme' }, 
            { key: 'theme', value: req.body }, 
            { upsert: true }
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// مسیر پیش‌فرض برای تمام درخواست‌های دیگر (برای اینکه رفرش صفحه کار کند)
// این خط اختیاری است اما برای SPA ها مفید است
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- اجرای سرور ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
