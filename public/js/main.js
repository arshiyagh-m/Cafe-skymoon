document.addEventListener('DOMContentLoaded', () => {
    
    // =========================================================
    // 1. دریافت و اعمال تم (Theme Engine)
    // =========================================================
    async function loadTheme() {
        try {
            const res = await fetch('/api/theme');
            if (res.ok) {
                const theme = await res.json();
                
                // تغییر متغیر CSS برای رنگ اصلی
                document.documentElement.style.setProperty('--primary-color', theme.primary);
                
                // تغییر بک‌گراند (اختیاری، اگر نیاز باشد)
                // document.body.style.backgroundColor = theme.bg;
            }
        } catch(e) { 
            console.warn("استفاده از تم پیش‌فرض (عدم ارتباط با سرور)"); 
        }
    }
    loadTheme();

    // =========================================================
    // 2. دریافت منو و راه‌اندازی تب‌ها
    // =========================================================
    const menuContainer = document.getElementById('menu-grid');
    
    if (menuContainer) {
        // نمایش لودینگ
        menuContainer.innerHTML = '<div class="col-span-full text-center text-white py-10 animate-pulse">در حال دریافت منو...</div>';

        fetch('/api/menu')
            .then(res => {
                if (!res.ok) throw new Error('Network response was not ok');
                return res.json();
            })
            .then(items => {
                menuContainer.innerHTML = ''; // پاک کردن لودینگ

                if (items.length === 0) {
                    menuContainer.innerHTML = '<div class="col-span-full text-center text-gray-500">آیتمی در منو موجود نیست.</div>';
                    return;
                }

                items.forEach(item => {
                    const price = Number(item.price).toLocaleString();
                    // اگر عکس نداشت، یک عکس پیش‌فرض می‌گذاریم
                    const imgSrc = item.image || 'https://via.placeholder.com/300x200?text=No+Image';
                    
                    const html = `
                    <div class="menu-item flex flex-col bg-dark-800 rounded-lg overflow-hidden border border-white/5 hover:border-gold-500/50 transition duration-300 group" data-category="${item.category}">
                        <div class="h-40 overflow-hidden relative">
                            <img src="${imgSrc}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500" alt="${item.name}">
                            <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                        </div>
                        
                        <div class="p-4 flex flex-col flex-grow justify-between">
                            <div>
                                <div class="flex justify-between items-start mb-2">
                                    <h3 class="text-white font-bold text-lg">${item.name}</h3>
                                    <span class="text-xs bg-gold-500/10 text-gold-500 px-2 py-1 rounded border border-gold-500/20">${item.category}</span>
                                </div>
                                <p class="text-gray-400 text-sm leading-relaxed mb-4">${item.description || ''}</p>
                            </div>
                            <span class="text-gold-500 font-bold text-xl block text-left dir-ltr">${price} تومان</span>
                        </div>
                    </div>`;
                    menuContainer.innerHTML += html;
                });

                // فعال‌سازی تب‌ها بعد از ساخت آیتم‌ها
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
                    t.classList.remove('bg-gold-500', 'text-dark-900');
                    t.classList.add('bg-dark-800', 'text-gray-300');
                });
                tab.classList.remove('bg-dark-800', 'text-gray-300');
                tab.classList.add('bg-gold-500', 'text-dark-900');

                // فیلتر آیتم‌ها
                const target = tab.getAttribute('data-target');
                items.forEach(item => {
                    if (target === 'all' || item.getAttribute('data-category') === target) {
                        item.classList.remove('hidden');
                        item.classList.add('flex');
                    } else {
                        item.classList.add('hidden');
                        item.classList.remove('flex');
                    }
                });
            });
        });
    }

    // =========================================================
    // 3. ثبت رزرو (با فیلدهای کامل)
    // =========================================================
    const resForm = document.getElementById('reservation-form');
    
    if (resForm) {
        resForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // دکمه ثبت
            const submitBtn = resForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ثبت...';
            submitBtn.classList.add('opacity-70', 'cursor-not-allowed');

            // جمع‌آوری تمام داده‌ها (شامل فیلدهای جدید)
            const data = {
                name: document.getElementById('name')?.value || '',
                phone: document.getElementById('phone')?.value || '',
                date: document.getElementById('date')?.value || '',
                time: document.getElementById('time')?.value || '',
                guests: document.getElementById('guests')?.value || '',
                space: document.getElementById('space')?.value || '', // اضافه شده
                occasion: document.getElementById('occasion')?.value || '' // اضافه شده
            };

            try {
                const response = await fetch('/api/reservations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    alert('رزرو شما با موفقیت ثبت شد! همکاران ما برای تایید نهایی با شما تماس می‌گیرند.');
                    resForm.reset();
                } else {
                    alert('مشکلی در ثبت رزرو پیش آمد. لطفا دوباره تلاش کنید.');
                }
            } catch (error) {
                console.error('Reservation Error:', error);
                alert('خطای ارتباط با سرور. لطفا اتصال اینترنت را بررسی کنید.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
                submitBtn.classList.remove('opacity-70', 'cursor-not-allowed');
            }
        });
    }

    // مدیریت منوی موبایل (برای صفحات غیر از ایندکس که ممکن است این کد را جداگانه نداشته باشند)
    const menuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if(menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }
});
