document.addEventListener('DOMContentLoaded', () => {
    
    // --- مدیریت منوی موبایل ---
    const menuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    if(menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // --- مدیریت فیلترهای تب منو (در صفحه منو) ---
    const tabs = document.querySelectorAll('.menu-tab');
    const items = document.querySelectorAll('.menu-item');

    if(tabs.length > 0) {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // حذف کلاس اکتیو از همه تب‌ها
                tabs.forEach(t => {
                    t.classList.remove('bg-gold-500', 'text-dark-900');
                    t.classList.add('bg-dark-800', 'text-gray-300');
                });
                // افزودن کلاس اکتیو به تب کلیک شده
                tab.classList.remove('bg-dark-800', 'text-gray-300');
                tab.classList.add('bg-gold-500', 'text-dark-900');

                const target = tab.getAttribute('data-target');

                // نمایش/مخفی کردن آیتم‌ها
                items.forEach(item => {
                    const category = item.getAttribute('data-category');
                    if(target === 'all' || category === target) {
                        item.classList.remove('hidden');
                        item.classList.add('flex'); // چون دیسپلی flex دارند
                        // اضافه کردن انیمیشن کوتاه
                        item.animate([
                            { opacity: 0, transform: 'translateY(10px)' },
                            { opacity: 1, transform: 'translateY(0)' }
                        ], { duration: 300 });
                    } else {
                        item.classList.add('hidden');
                        item.classList.remove('flex');
                    }
                });
            });
        });
    }

    // --- مدیریت فرم رزرو ---
    const resForm = document.getElementById('reservation-form');
    if(resForm) {
        resForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // اینجا می‌توانید کد اتصال به بک‌اند را بنویسید
            alert('رزرو شما با موفقیت ثبت شد! منتظر تماس همکاران ما باشید.');
            resForm.reset();
        });
    }

    // --- مدیریت فرم تماس ---
    const contactForm = document.getElementById('contact-form');
    if(contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('پیام شما ارسال شد. ممنون از نظر شما!');
            contactForm.reset();
        });
    }
});
