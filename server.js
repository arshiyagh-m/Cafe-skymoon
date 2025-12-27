const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const app = express();

// --- تنظیمات ---
app.use(express.json());
app.use(cors());
app.use(express.static('public')); // پوشه public را به عنوان سایت نمایش بده

// --- اتصال به دیتابیس لیارا ---
// نکته: در لیارا این آدرس را از متغیر محیطی می‌خوانیم
const MONGO_URI = process.env.MONGO_URI || 'mongodb://... (آدرس لوکال برای تست)';

mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to Liara MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

// --- تعریف مدل‌ها (Schema) ---

// مدل منو
const MenuSchema = new mongoose.Schema({
    name: String,
    category: String,
    price: Number,
    description: String,
    image: String
});
const Menu = mongoose.model('Menu', MenuSchema);

// مدل رزرو
const ReservationSchema = new mongoose.Schema({
    name: String,
    phone: String,
    date: String,
    time: String,
    guests: String,
    createdAt: { type: Date, default: Date.now }
});
const Reservation = mongoose.model('Reservation', ReservationSchema);

// مدل تنظیمات تم
const SettingsSchema = new mongoose.Schema({
    key: String, // مثلا 'theme'
    value: Object // مثلا { primary: '#...', bg: '#...' }
});
const Settings = mongoose.model('Settings', SettingsSchema);


// --- API Routes (مسیرهای ارتباطی) ---

// 1. دریافت منو
app.get('/api/menu', async (req, res) => {
    const items = await Menu.find();
    res.json(items);
});

// 2. افزودن به منو (فقط ادمین)
app.post('/api/menu', async (req, res) => {
    const newItem = new Menu(req.body);
    await newItem.save();
    res.json(newItem);
});

// 3. حذف از منو
app.delete('/api/menu/:id', async (req, res) => {
    await Menu.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
});

// 4. ثبت رزرو
app.post('/api/reservations', async (req, res) => {
    const newRes = new Reservation(req.body);
    await newRes.save();
    res.json(newRes);
});

// 5. دریافت رزروها (ادمین)
app.get('/api/reservations', async (req, res) => {
    const list = await Reservation.find().sort({ createdAt: -1 });
    res.json(list);
});

// 6. حذف رزرو
app.delete('/api/reservations/:id', async (req, res) => {
    await Reservation.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
});

// 7. تنظیمات تم
app.get('/api/theme', async (req, res) => {
    const theme = await Settings.findOne({ key: 'theme' });
    res.json(theme ? theme.value : { primary: '#d4af37', bg: '#0f0f0f' });
});

app.post('/api/theme', async (req, res) => {
    await Settings.findOneAndUpdate(
        { key: 'theme' }, 
        { key: 'theme', value: req.body }, 
        { upsert: true } // اگر نبود بساز، اگر بود آپدیت کن
    );
    res.json({ success: true });
});

// --- اجرای سرور ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
