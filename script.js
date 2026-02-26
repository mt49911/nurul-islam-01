```javascript
// ==================== GLOBAL DATA ====================
let posts = [];
let currentLanguage = 'en';
let currentCategory = 'all';
let bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDa5zzgazYSLOz__nQi4SzIgPQ57H4gYEE",
  authDomain: "nurul-islam-web.firebaseapp.com",
  projectId: "nurul-islam-web",
  storageBucket: "nurul-islam-web.firebasestorage.app",
  messagingSenderId: "169510958216",
  appId: "1:169510958216:web:fc45e40977a02572d2db3d",
  measurementId: "G-1GD3MTZM4J"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();
const db = firebase.firestore();
const auth = firebase.auth();

// VAPID Key (replace with your own from Firebase Cloud Messaging)
const VAPID_KEY = 'BlhK3F5TKZAp8_hTTJwEc'; // Saka VAPID key ɗinka a nan

// Translations
const translations = {
    en: {
        home: "Home",
        tafseer: "Tafseer",
        hadith: "Hadith Reminder",
        quran: "Quran Reminder",
        motivation: "Daily Motivation",
        calendar: "Islamic Calendar",
        ramadan: "Ramadan Countdown",
        about: "About",
        contact: "Contact",
        search: "Search posts...",
        all: "All",
        bookmark: "Bookmark",
        bookmarked: "Bookmarked"
    },
    ar: {
        home: "الرئيسية",
        tafseer: "التفسير",
        hadith: "تذكير بالحديث",
        quran: "تذكير بالقرآن",
        motivation: "تحفيز يومي",
        calendar: "التقويم الإسلامي",
        ramadan: "عد تنازلي رمضان",
        about: "حول",
        contact: "اتصل",
        search: "البحث في المنشورات...",
        all: "الكل",
        bookmark: "حفظ",
        bookmarked: "تم الحفظ"
    }
};

// ==================== INITIALIZE ====================
document.addEventListener('DOMContentLoaded', () => {
    AOS.init({ duration: 1000, once: true });
    loadPostsFromFirestore();
    setupEventListeners();
    loadPage('home');
    updateRamadanCountdown();
    fetchPrayerTimes();
    fetchQuranVerse();
    fetchHadith();
    loadDailyDua();
    requestNotificationPermission();
});

// ==================== PUSH NOTIFICATIONS ====================
async function requestNotificationPermission() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            const token = await messaging.getToken({ vapidKey: VAPID_KEY });
            console.log('FCM Token:', token);
            
            // Save token to Firestore
            await db.collection('fcmTokens').doc(token).set({
                token: token,
                userAgent: navigator.userAgent,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            console.log('Unable to get permission to notify.');
        }
    } catch (err) {
        console.error('Error getting permission:', err);
    }
}

// Listen for messages in foreground
messaging.onMessage((payload) => {
    console.log('Message received in foreground:', payload);
    // Show a custom notification or alert
    alert(`${payload.notification.title}\n${payload.notification.body}`);
});

// ==================== LOAD POSTS FROM FIRESTORE ====================
async function loadPostsFromFirestore() {
    try {
        const snapshot = await db.collection('posts').orderBy('createdAt', 'desc').get();
        posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayPosts();
        checkNotifications();
    } catch (error) {
        console.error('Error loading posts:', error);
        // Fallback to local posts.json if Firestore fails
        loadPostsFromJSON();
    }
}

async function loadPostsFromJSON() {
    try {
        const response = await fetch('posts.json?t=' + Date.now());
        posts = await response.json();
        displayPosts();
        checkNotifications();
    } catch (e) {
        console.log('No posts yet');
    }
}

function displayPosts(filterCategory = currentCategory, searchTerm = '') {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    let filtered = posts;
    if (filterCategory !== 'all') {
        filtered = filtered.filter(p => p.category === filterCategory);
    }
    if (searchTerm) {
        filtered = filtered.filter(p => p.title.toLowerCase().includes(searchTerm) || p.content.toLowerCase().includes(searchTerm));
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:60px; background:rgba(255,255,255,0.1); border-radius:30px;"><i class="fas fa-inbox fa-4x" style="color:var(--accent);"></i><p style="margin-top:20px; font-size:1.3rem;">No posts found.</p></div>';
        return;
    }
    
    container.innerHTML = '';
    filtered.forEach(post => {
        const postEl = document.createElement('div');
        postEl.className = 'post';
        postEl.setAttribute('data-aos', 'fade-up');
        
        let media = '';
        if (post.type === 'photo' && post.url) {
            media = `<img src="${post.url}" alt="post" loading="lazy">`;
        } else if (post.type === 'video' && post.url) {
            media = `<video controls><source src="${post.url}" type="video/mp4"></video>`;
        } else if (post.type === 'audio' && post.url) {
            media = `<audio controls><source src="${post.url}" type="audio/mpeg"></audio>`;
        }
        
        const date = post.createdAt ? new Date(post.createdAt.seconds * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown date';
        const isBookmarked = bookmarks.includes(post.id);
        
        postEl.innerHTML = `
            <h3>${escapeHtml(post.title)}</h3>
            <div class="post-meta">
                <i class="far fa-calendar-alt"></i> ${date}  |  
                <i class="fas fa-tag"></i> ${post.category || 'General'}
                <span class="bookmark-icon" data-id="${post.id}" style="float:right; cursor:pointer;">
                    <i class="${isBookmarked ? 'fas' : 'far'} fa-bookmark"></i>
                </span>
            </div>
            <p>${escapeHtml(post.content).replace(/\n/g, '<br>')}</p>
            ${media}
        `;
        container.appendChild(postEl);
    });
    
    document.querySelectorAll('.bookmark-icon').forEach(icon => {
        icon.addEventListener('click', toggleBookmark);
    });
}

function toggleBookmark(e) {
    const id = e.currentTarget.dataset.id;
    if (bookmarks.includes(id)) {
        bookmarks = bookmarks.filter(d => d !== id);
    } else {
        bookmarks.push(id);
    }
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    displayPosts(); // refresh
}

function escapeHtml(unsafe) {
    return unsafe.replace(/[&<>"]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        return m;
    });
}

function checkNotifications() {
    const lastVisit = localStorage.getItem('lastVisit');
    const now = new Date().toISOString();
    
    if (!lastVisit) {
        localStorage.setItem('lastVisit', now);
        return;
    }
    
    const newPosts = posts.filter(p => p.createdAt && new Date(p.createdAt.seconds * 1000) > new Date(lastVisit));
    document.getElementById('notificationBadge').innerText = newPosts.length;
}

document.getElementById('notificationBell').addEventListener('click', () => {
    localStorage.setItem('lastVisit', new Date().toISOString());
    document.getElementById('notificationBadge').innerText = '0';
});

// ==================== PAGE ROUTER ====================
function loadPage(page) {
    const content = document.getElementById('content');
    currentCategory = page;
    
    switch(page) {
        case 'home':
            content.innerHTML = getHomePageHTML();
            setTimeout(() => {
                displayPosts();
                displayHijriDate();
                fetchPrayerTimes();
                fetchQuranVerse();
                fetchHadith();
                loadDailyDua();
            }, 100);
            break;
        case 'about':
            content.innerHTML = getAboutPageHTML();
            break;
        case 'contact':
            content.innerHTML = getContactPageHTML();
            break;
        case 'tafseer':
        case 'hadith':
        case 'quran':
        case 'motivation':
        case 'calendar':
        case 'ramadan':
            content.innerHTML = getCategoryPageHTML(page);
            setTimeout(() => {
                displayPosts(page);
                setupCategoryFilter(page);
            }, 100);
            break;
        default:
            content.innerHTML = '<h2>Page not found</h2>';
    }
    
    document.getElementById('sideMenu').classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getHomePageHTML() {
    return `
        <section class="hero" data-aos="fade-down">
            <h1 class="ramadan-greeting">🌙 Ramadan Kareem</h1>
            <div class="countdown" id="ramadanCountdown"></div>
            <p class="hero-sub">Daily reminders & tafseer to brighten your Ramadan</p>
        </section>
        
        <!-- AdMob Banner -->
        <div style="margin: 20px 0; text-align: center;">
            <ins class="adsbygoogle"
                 style="display:block"
                 data-ad-client="ca-pub-9887128308131750"
                 data-ad-slot="5301380099"
                 data-ad-format="auto"
                 data-full-width-responsive="true"></ins>
            <script>
                 (adsbygoogle = window.adsbygoogle || []).push({});
            </script>
        </div>
        
        <section class="daily-section">
            <div class="daily-card" data-aos="fade-right">
                <h3><i class="fas fa-quran"></i> Quran Verse of the Day</h3>
                <div id="quranVerse">Loading...</div>
            </div>
            <div class="daily-card" data-aos="fade-up">
                <h3><i class="fas fa-hadith"></i> Hadith of the Day</h3>
                <div id="hadithOfDay">Loading...</div>
            </div>
            <div class="daily-card" data-aos="fade-left">
                <h3><i class="fas fa-hand-praying"></i> Dua of the Day</h3>
                <div id="duaOfDay">Loading...</div>
            </div>
        </section>
        
        <section class="prayer-times" data-aos="fade-up">
            <h2><i class="fas fa-clock"></i> Prayer Times (Mecca)</h2>
            <div id="prayerTimes">Loading...</div>
        </section>
        
        <section class="cards">
            <div class="card" onclick="loadPage('tafseer')" data-aos="flip-left">
                <i class="fas fa-book-open"></i>
                <h3>Tafseer</h3>
                <p>Understand the Quran deeply</p>
            </div>
            <div class="card" onclick="loadPage('hadith')" data-aos="flip-left" data-aos-delay="100">
                <i class="fas fa-hadith"></i>
                <h3>Hadith</h3>
                <p>Prophetic traditions</p>
            </div>
            <div class="card" onclick="loadPage('quran')" data-aos="flip-left" data-aos-delay="200">
                <i class="fas fa-quran"></i>
                <h3>Quran</h3>
                <p>Verses & reminders</p>
            </div>
            <div class="card" onclick="loadPage('motivation')" data-aos="flip-left" data-aos-delay="300">
                <i class="fas fa-heart"></i>
                <h3>Motivation</h3>
                <p>Daily spiritual boost</p>
            </div>
        </section>
        
        <section class="calendar-widget" data-aos="fade-up">
            <h2><i class="fas fa-calendar-alt"></i> Islamic Calendar</h2>
            <div id="hijriDate">Loading...</div>
            <div id="gregorianDate"></div>
            <div id="nextEvent"></div>
        </section>
        
        <section class="posts-feed">
            <h2 data-aos="fade-right"><i class="fas fa-newspaper"></i> Latest Posts</h2>
            <div id="postsContainer"></div>
        </section>
    `;
}

function getCategoryPageHTML(category) {
    return `
        <div style="margin-bottom:30px;">
            <h1 style="color:var(--accent); font-size:3rem; margin-bottom:20px;">${category.charAt(0).toUpperCase() + category.slice(1)}</h1>
            
            <div class="search-box">
                <input type="text" id="searchInput" placeholder="Search ${category} posts...">
                <button id="searchBtn"><i class="fas fa-search"></i></button>
            </div>
            
            <div class="category-filter">
                <button class="category-btn active" data-cat="all">All</button>
                <button class="category-btn" data-cat="${category}">${category}</button>
            </div>
            
            <div id="postsContainer"></div>
        </div>
    `;
}

function setupCategoryFilter(category) {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const filterBtns = document.querySelectorAll('.category-btn');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            displayPosts(category, searchInput.value.toLowerCase());
        });
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                displayPosts(category, searchInput.value.toLowerCase());
            }
        });
    }
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const cat = btn.dataset.cat === 'all' ? 'all' : category;
            displayPosts(cat, searchInput ? searchInput.value.toLowerCase() : '');
        });
    });
    
    displayPosts(category);
}

// ==================== ABOUT PAGE HTML ====================
function getAboutPageHTML() {
    return `
        <div class="about-section" data-aos="fade-up">
            <h1>About NURUL ISLAM</h1>
            <p>Welcome to NURUL ISLAM</p>
            <p>NURUL ISLAM is a global Islamic reminder and Tafseer platform dedicated to spreading authentic knowledge of the Qur’an and Sunnah to Muslims worldwide.</p>
            <p>This website was established to serve as a source of spiritual guidance, daily Islamic reminders, Qur’anic reflections (Tafseer), Hadith teachings, and motivational content — especially during the blessed month of Ramadan and beyond.</p>
            
            <div class="mission-box">
                <p><strong>Our mission is simple:</strong> To illuminate hearts with the light of the Qur’an and authentic Islamic knowledge.</p>
            </div>

            <h2>Our Purpose</h2>
            <p>NURUL ISLAM was created as an act of Sadaqatu Jariyah — a continuous charity — seeking the pleasure of Allah alone.</p>
            <p>The intention behind this platform is purely for the sake of Allah (Subhanahu wa Ta’ala), hoping that it becomes a source of ongoing reward in this life and after death.</p>
            <p>We pray that:</p>
            <ul style="list-style:none; padding:0;">
                <li><i class="fas fa-check-circle" style="color:var(--accent); margin-right:15px;"></i> Allah accepts this effort.</li>
                <li><i class="fas fa-check-circle" style="color:var(--accent); margin-right:15px;"></i> Allah forgives our shortcomings.</li>
                <li><i class="fas fa-check-circle" style="color:var(--accent); margin-right:15px;"></i> Allah grants Jannatul Firdaus to our beloved parents.</li>
                <li><i class="fas fa-check-circle" style="color:var(--accent); margin-right:15px;"></i> Allah makes this platform beneficial for the entire Ummah. Ameen.</li>
            </ul>
            <h2>What We Offer</h2>
            <p>Through NURUL ISLAM, we provide:</p>
            <ul style="list-style:none; padding:0;">
                <li><i class="fas fa-book-open" style="color:var(--accent); margin-right:15px;"></i> 📖 Qur’an Tafseer (Audio, Text, and Video)</li>
                <li><i class="fas fa-hadith" style="color:var(--accent); margin-right:15px;"></i> 📜 Authentic Hadith Reminders</li>
                <li><i class="fas fa-moon" style="color:var(--accent); margin-right:15px;"></i> 🌙 Ramadan Special Reflections</li>
                <li><i class="fas fa-calendar-alt" style="color:var(--accent); margin-right:15px;"></i> 🗓 Islamic Calendar & Important Dates</li>
                <li><i class="fas fa-heart" style="color:var(--accent); margin-right:15px;"></i> 💬 Daily Islamic Motivation</li>
                <li><i class="fas fa-bell" style="color:var(--accent); margin-right:15px;"></i> 🔔 Timely Notifications for New Posts</li>
                <li><i class="fas fa-globe" style="color:var(--accent); margin-right:15px;"></i> 🌍 Content accessible to Muslims worldwide</li>
                <li><i class="fas fa-language" style="color:var(--accent); margin-right:15px;"></i> 🌐 Language selection (English & Arabic)</li>
            </ul>
            <p>Our goal is to make Islamic knowledge accessible, structured, and spiritually uplifting.</p>

            <h2>Our Vision</h2>
            <p>We envision NURUL ISLAM becoming a trusted digital Islamic platform where Muslims can:</p>
            <ul style="list-style:none; padding:0;">
                <li><i class="fas fa-star" style="color:var(--accent); margin-right:15px;"></i> Strengthen their Iman</li>
                <li><i class="fas fa-star" style="color:var(--accent); margin-right:15px;"></i> Reflect deeply on the Qur’an</li>
                <li><i class="fas fa-star" style="color:var(--accent); margin-right:15px;"></i> Learn authentic teachings</li>
                <li><i class="fas fa-star" style="color:var(--accent); margin-right:15px;"></i> Stay connected to beneficial reminders</li>
                <li><i class="fas fa-star" style="color:var(--accent); margin-right:15px;"></i> Grow spiritually every single day</li>
            </ul>
            <p>This platform is continuously updated with new content to ensure fresh and relevant reminders.</p>

            <h2>About the Founder</h2>
            <div class="founder-card">
                <img src="logo.jpg" alt="Abdullahi Muhammad Tukur" onerror="this.src='https://via.placeholder.com/180x180?text=AMT'">
                <div>
                    <p><strong>NURUL ISLAM</strong> was created and developed by:</p>
                    <p><strong>Abdullahi Muhammad Tukur</strong></p>
                    <p>A student dedicated to Islamic learning and digital da’wah, striving to use modern technology to serve Islam responsibly.</p>
                    <p>This project was built with sincere intention, hoping it becomes a means of ongoing reward and benefit for the Ummah.</p>
                </div>
            </div>

            <h2>A Message to the Ummah</h2>
            <div class="dua-section">
                <p>We extend our sincere gratitude and prayers to Muslims all around the world.</p>
                <p>May Allah unite our hearts upon truth. May He strengthen our faith. May He grant relief to those in hardship. May He grant victory to the oppressed. May He admit us all into Jannah without reckoning.</p>
                <p><strong>Ameen.</strong></p>
            </div>

            <h2>Stay Connected</h2>
            <p>We encourage you to:</p>
            <ul style="list-style:none; padding:0;">
                <li><i class="fas fa-check" style="color:var(--accent); margin-right:15px;"></i> Visit daily for new reminders.</li>
                <li><i class="fas fa-check" style="color:var(--accent); margin-right:15px;"></i> Reflect upon what you learn.</li>
                <li><i class="fas fa-check" style="color:var(--accent); margin-right:15px;"></i> Share beneficial knowledge.</li>
                <li><i class="fas fa-check" style="color:var(--accent); margin-right:15px;"></i> Make du’a for this project.</li>
            </ul>
            <p>May this platform be a light for us in this world and the next.</p>
        </div>
    `;
}

// ==================== CONTACT PAGE HTML ====================
function getContactPageHTML() {
    return `
        <div class="contact-section" data-aos="fade-up">
            <h1>Contact Us</h1>
            <p style="font-size:1.3rem;">We'd love to hear from you! Reach out via WhatsApp or email.</p>
            
            <div class="contact-cards">
                <div class="contact-card" data-aos="zoom-in">
                    <i class="fab fa-whatsapp"></i>
                    <h3>WhatsApp</h3>
                    <p>+234 902 089 9102</p>
                    <a href="https://wa.me/2349020899102" target="_blank">Chat Now</a>
                </div>
                
                <div class="contact-card" data-aos="zoom-in" data-aos-delay="100">
                    <i class="fas fa-envelope"></i>
                    <h3>Email</h3>
                    <p>emteeydigitalservice11@gmail.com</p>
                    <a href="mailto:emteeydigitalservice11@gmail.com">Send Email</a>
                </div>
            </div>
            
            <p style="margin-top:40px; font-size:1.2rem;">You can also use the AI assistant for quick questions.</p>
        </div>
    `;
}

// ==================== FETCH PRAYER TIMES ====================
async function fetchPrayerTimes(city = 'Mecca') {
    try {
        const response = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=${city}&country=&method=2`);
        const data = await response.json();
        if (data.code === 200) {
            const timings = data.data.timings;
            displayPrayerTimes(timings);
        }
    } catch (error) {
        console.log('Error fetching prayer times');
    }
}

function displayPrayerTimes(timings) {
    const container = document.getElementById('prayerTimes');
    if (!container) return;
    const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    let html = '<div class="prayer-grid">';
    prayers.forEach(p => {
        html += `
            <div class="prayer-item">
                <strong>${p}</strong>
                <span>${timings[p]}</span>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

// ==================== QURAN VERSE OF THE DAY ====================
async function fetchQuranVerse() {
    try {
        const response = await fetch('https://api.alquran.cloud/v1/ayah/random/editions/quran-english,ar.alafasy');
        const data = await response.json();
        if (data.data) {
            const verse = data.data[0];
            const verseAr = data.data[1];
            displayQuranVerse(verse.text, verseAr.text, verse.surah.englishName, verse.numberInSurah);
        }
    } catch (error) {
        console.log('Error fetching Quran verse');
    }
}

function displayQuranVerse(textEn, textAr, surah, ayah) {
    const container = document.getElementById('quranVerse');
    if (!container) return;
    container.innerHTML = `
        <p class="arabic">${textAr}</p>
        <p class="english">${textEn}</p>
        <p class="reference">— ${surah} (${ayah})</p>
    `;
}

// ==================== HADITH OF THE DAY ====================
async function fetchHadith() {
    try {
        const response = await fetch('https://api.hadith.gading.dev/books/muslim?range=1-1');
        const data = await response.json();
        if (data.data && data.data.hadiths) {
            const hadith = data.data.hadiths[0];
            displayHadith(hadith.arab, hadith.id);
        } else {
            displayHadith('The best among you are those who have the best manners and character.', 'Bukhari');
        }
    } catch (error) {
        displayHadith('The best among you are those who have the best manners and character.', 'Bukhari');
    }
}

function displayHadith(text, reference) {
    const container = document.getElementById('hadithOfDay');
    if (!container) return;
    container.innerHTML = `
        <p>${text}</p>
        <p class="reference">— ${reference}</p>
    `;
}

// ==================== DUA OF THE DAY ====================
function loadDailyDua() {
    const duas = [
        { arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ', english: 'Our Lord, give us in this world good and in the Hereafter good and protect us from the punishment of the Fire.', reference: 'Quran 2:201' },
        { arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى', english: 'O Allah, I ask You for guidance, piety, chastity, and self-sufficiency.', reference: 'Muslim' },
        { arabic: 'رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي', english: 'My Lord, expand for me my breast and ease for me my task.', reference: 'Quran 20:25-26' }
    ];
    const random = Math.floor(Math.random() * duas.length);
    const container = document.getElementById('duaOfDay');
    if (!container) return;
    container.innerHTML = `
        <p class="arabic">${duas[random].arabic}</p>
        <p class="english">${duas[random].english}</p>
        <p class="reference">— ${duas[random].reference}</p>
    `;
}

// ==================== RAMADAN COUNTDOWN ====================
function updateRamadanCountdown() {
    const el = document.getElementById('ramadanCountdown');
    if (!el) return;
    
    const now = new Date();
    let year = now.getFullYear();
    let ramadan = new Date(year, 2, 1);
    
    if (now > ramadan) {
        ramadan = new Date(year + 1, 2, 1);
    }
    
    const diff = ramadan - now;
    const days = Math.floor(diff / (1000*60*60*24));
    const hours = Math.floor((diff % (86400000)) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    el.innerHTML = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    setTimeout(updateRamadanCountdown, 1000);
}

// ==================== HIJRI CALENDAR ====================
function displayHijriDate() {
    const hijriEl = document.getElementById('hijriDate');
    const gregorianEl = document.getElementById('gregorianDate');
    const nextEventEl = document.getElementById('nextEvent');
    if (!hijriEl) return;
    
    const today = new Date();
    gregorianEl.innerText = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const d = String(today.getDate()).padStart(2,'0');
    const m = String(today.getMonth()+1).padStart(2,'0');
    const y = today.getFullYear();
    
    fetch(`https://api.aladhan.com/v1/gToH?date=${d}-${m}-${y}`)
        .then(r => r.json())
        .then(data => {
            if (data.code === 200) {
                const h = data.data.hijri;
                hijriEl.innerText = `${h.day} ${h.month.en} ${h.year} AH`;
                
                const nextDay = new Date(today);
                nextDay.setDate(today.getDate() + 1);
                const nd = String(nextDay.getDate()).padStart(2,'0');
                const nm = String(nextDay.getMonth()+1).padStart(2,'0');
                const ny = nextDay.getFullYear();
                return fetch(`https://api.aladhan.com/v1/gToH?date=${nd}-${nm}-${ny}`);
            }
        })
        .then(r => r.json())
        .then(data => {
            if (data && data.code === 200) {
                const h = data.data.hijri;
                nextEventEl.innerHTML = `Tomorrow: ${h.day} ${h.month.en}`;
            }
        })
        .catch(() => {
            hijriEl.innerText = 'Unable to load Hijri date';
        });
}

// ==================== MENU & LANGUAGE ====================
document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sideMenu').classList.toggle('open');
});

document.querySelectorAll('.side-menu a[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        loadPage(link.getAttribute('data-page'));
    });
});

window.loadPage = loadPage;

document.getElementById('langSelect').addEventListener('change', function(e) {
    const lang = e.target.value;
    currentLanguage = lang;
    document.body.className = lang === 'ar' ? 'ar' : '';
    
    document.querySelectorAll('.side-menu a span').forEach(span => {
        const key = span.parentElement.getAttribute('data-page');
        if (key && translations[lang][key]) {
            span.innerText = translations[lang][key];
        }
    });
});

// ==================== AI ASSISTANT ====================
const modal = document.getElementById('aiModal');
const aiBtn = document.getElementById('aiBtn');
const closeBtn = document.querySelector('.close');
const sendBtn = document.getElementById('sendChat');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

const islamicResponses = {
    'salaam': 'Wa alaikum assalaam! How can I assist you today?',
    'ramadan': 'Ramadan is the month of mercy and forgiveness. May Allah accept your fasts and prayers.',
    'quran': 'The Quran is the ultimate guidance. Read, reflect, and implement its teachings.',
    'hadith': 'Hadith are the sayings and actions of Prophet Muhammad (peace be upon him). They explain the Quran.',
    'zakat': 'Zakat is an obligatory charity that purifies your wealth. Give 2.5% of your savings.',
    'hajj': 'Hajj is the pilgrimage to Mecca, obligatory once in a lifetime for those who can afford it.',
    'prayer': 'The five daily prayers are Fajr, Dhuhr, Asr, Maghrib, and Isha.',
    'default': 'I am your Islamic assistant. Ask me about Ramadan, Quran, Hadith, or daily motivation.'
};

aiBtn.addEventListener('click', () => {
    modal.style.display = 'flex';
    chatMessages.innerHTML = '<p class="bot">Assalamu alaikum! I am your Islamic assistant. How can I help you today?</p>';
});

closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
});

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const msg = chatInput.value.trim();
    if (!msg) return;
    
    chatMessages.innerHTML += `<p class="user">${escapeHtml(msg)}</p>`;
    chatInput.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    setTimeout(() => {
        const lower = msg.toLowerCase();
        let reply = islamicResponses.default;
        for (let key in islamicResponses) {
            if (lower.includes(key)) {
                reply = islamicResponses[key];
                break;
            }
        }
        chatMessages.innerHTML += `<p class="bot">${reply}</p>`;
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 800);
}

function setupEventListeners() {}
```

---
