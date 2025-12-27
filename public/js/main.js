document.addEventListener('DOMContentLoaded', () => {
    
    // --------------------------------------------------
    // 1. دریافت و اعمال تم (Theme Engine)
    // --------------------------------------------------
    async function loadTheme() {
        try {
            const res = await fetch('/api/theme');
            if (!res.ok) throw new Error('Theme fetch failed');
            const theme = await res.json();
            
            // اعمال رنگ‌ها
            document.documentElement.style.setProperty('--primary-color', theme.primary);
            
            // تغییر بک‌گراند (با حفظ کلاس‌های Tailwind در صورت نیاز)
            // ما متغیر CSS می‌سازیم تا Tailwind خراب نشود
            document.documentElement.style.setProperty('--bg-color', theme.bg);
            document.body.style.backgroundColor = theme.bg;

            // پیدا کردن المنت‌های تکست طلایی و تغییر رنگ آن‌ها بصورت دستی (اختیاری)
            const goldElements = document.querySelectorAll('.text-gold-500');
            goldElements.forEach(el => el.style.color = theme.primary);

        } catch(e) { 
            console.warn("استفاده از تم پیش‌فرض (ارتباط با سرور برقرار نشد)"); 
        }
    }
    loadTheme();

    // --------------------------------------------------
    // 2. دریافت منو و راه‌اندازی تب‌ها
    // --------------------------------------------------
    const menuContainer = document.getElementById('menu-grid');
    
    if (menuContainer) {
        // نمایش لودینگ قبل از دریافت
        menuContainer.innerHTML = '<div class="col-span-full text-center text-white py-10">در حال بارگذاری منو...</div>';

        fetch('/api/menu')
            .then(res => {
                if (!res.ok) throw new Error('Network response was not ok');
                return res.json();
            })
            .then(items => {
                menuContainer.innerHTML = ''; // پاک کردن لودینگ

                if (items.length === 0) {
                    menuContainer.innerHTML = '<div class="col-span-full text-center text-gray-400">آیتمی در منو وجود ندارد.</div>';
                    return;
                }

                items.forEach(item => {
                    // فرمت قیمت
                    const price = Number(item.price).toLocaleString();
                    
                    const html = `
                    <div class="menu-item flex flex-col justify-between bg-gray-800 p-4 rounded-lg border border-white/10 hover:border-gold-500/50 transition duration-300" data-category="${item.category}">
                        <div>
                            <div class="flex justify-between items-start mb-2">
                                <h3 class="text-white font-bold text-lg">${item.name}</h3>
                                <span class="text-xs bg-white/10 text-gray-300 px-2 py-1 rounded">${item.category}</span>
                            </div>
                            <p class="text-gray-400 text-sm leading-relaxed">${item.description || ''}</p>
                        </div>
                        <span class="text-gold-500 font-bold text-xl block mt-4 text-left">${price} تومان</span>
                    </div>`;
                    menuContainer.innerHTML += html;
                });

                // **مهم:** بعد از اینکه آیتم‌ها ساخته شدند، باید سیستم تب‌ها را فعال کنیم
                setupMenuTabs();
            })
            .catch(err => {
                console.error(err);
                menuContainer.innerHTML = '<div class="col-span-full text-center text-red-400">خطا در دریافت منو. لطفا مجددا تلاش کنید.</div>';
            });
    }

    // تابع مدیریت تب‌ها (فیلتر کردن)
    function setupMenuTabs() {
        const tabs = document.querySelectorAll('.menu-tab');
        const items = document.querySelectorAll('.menu-item');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // استایل دکمه‌ها
                tabs.forEach(t => {
                    t.classList.remove('bg-gold-500', 'text-black'); // تغییر رنگ فعال
                    t.classList.add('bg-gray-800', 'text-white');    // رنگ غیرفعال
                });
                tab.classList.remove('bg-gray-800', 'text-white');
                tab.classList.add('bg-gold-500', 'text-black');

                // فیلتر آیتم‌ها
                const target = tab.getAttribute('data-target');
                items.forEach(item => {
                    if (target === 'all' || item.getAttribute('data-category') === target) {
                        item.classList.remove('hidden');
                        item.classList.add('flex'); // چون display:flex دارند
                    } else {
                        item.classList.add('hidden');
                        item.classList.remove('flex');
                    }
                });
            });
        });
    }

    // --------------------------------------------------
    // 3. ثبت رزرو (با اعتبارسنجی و لودینگ)
    // --------------------------------------------------
    const resForm = document.getElementById('reservation-form');
    
    if (resForm) {
        resForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // دکمه ثبت
            const submitBtn = resForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            
            // تغییر وضعیت دکمه به "در حال ارسال"
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ثبت...';
            submitBtn.classList.add('opacity-70', 'cursor-not-allowed');

            // جمع‌آوری داده‌ها (با استفاده از ID هایی که در HTML باید باشند)
            // نکته: در HTML حتما باید id="..." را به اینپوت‌ها اضافه کنید
            const data = {
                name: document.getElementById('name')?.value || '',
                phone: document.getElementById('phone')?.value || '',
                date: document.getElementById('date')?.value || '',
                time: document.getElementById('time')?.value || '',
                guests: document.getElementById('guests')?.value || ''
            };

            try {
                const response = await fetch('/api/reservations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    alert('رزرو شما با موفقیت ثبت شد! همکاران ما برای تایید با شما تماس می‌گیرند.');
                    resForm.reset();
                } else {
                    alert('مشکلی در ثبت رزرو پیش آمد. لطفا دوباره تلاش کنید.');
                }
            } catch (error) {
                console.error('Reservation Error:', error);
                alert('خطای ارتباط با سرور. لطفا اتصال اینترنت را بررسی کنید.');
            } finally {
                // بازگرداندن دکمه به حالت اول
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
                submitBtn.classList.remove('opacity-70', 'cursor-not-allowed');
            }
        });
    }
});
