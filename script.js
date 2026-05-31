/**
 * NEXORA PARTY - CORE JAVASCRIPT ENGINE (DRAG & SWIPE INFINITE CAROUSEL)
 * เวอร์ชันอัปเดต: รองรับการปัดแบบสมูทขั้นสุด + ระบบ Smart Auto-Play เลื่อนอัตโนมัติแบบไม่ขัดใจผู้ใช้
 */

const snapContainer = document.querySelector('.snap-container');
let hasClosedPopupShown = false; 
const adminAPI_URL = 'https://api.steinhq.com/v1/storages/6a114ab392b1163e97f9c787'; 
let localApplicantsData = []; 

// ตัวแปรควบคุมระบบ Carousel
let currentIndex = 0;
let originalCount = 0;
let stepSize = 0;
let isTransitioning = false;

// ตัวแปรสำหรับระบบตรวจจับการลาก (Drag & Swipe แบบจับเวลาความเร็ว)
let isDragging = false;
let startX = 0;
let currentTranslateX = 0;
let dragOffset = 0;
let baseTranslateX = 0;
let dragStartTime = 0; 

// ➕ ตัวแปรสำหรับระบบเลื่อนอัตโนมัติ (Smart Auto-Play Variables)
let autoPlayTimer = null;
const autoPlayDelay = 3000; // ⏱️ ตั้งเวลาให้เลื่อนทุกๆ 3 วินาที (3000ms) สามารถปรับเพิ่ม-ลดได้ตรงนี้เลยครับ

// ==========================================
// 1. ระบบเริ่มต้นเมื่อ DOM โหลดเสร็จสิ้น (INITIALIZATION ENGINE)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // โหลดข้อมูลรายชื่อหน้า Admin Dashboard (ถ้ามี Component อยู่ในหน้านั้น)
    fetchApplicants();
    
    // ตั้งค่าระบบสไลด์วนลูปไม่สิ้นสุดและระบบลาก
    initInfiniteCarousel();

    // เพิ่มระบบปิด Overlay เมื่อกดปุ่ม Esc บนคีย์บอร์ด
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMemberOverlay();
        }
    });

    // อัปเดตขนาดพิกัดใหม่เมื่อผู้ใช้เปลี่ยนขนาดหน้าจอ (Responsive Reset)
    window.addEventListener('resize', () => {
        recalculateCarousel();
        moveTrack(false); // บังคับล็อกตำแหน่งให้ตรงกลางทันทีหลังขยายหน้าจอ
    });
});

// ดักจับอีกชั้นเมื่อรูปภาพและสไตล์ทั้งหมดโหลดเสร็จสมบูรณ์ เพื่อป้องกันค่ากว้างการ์ดเป็น 0
window.addEventListener('load', () => {
    recalculateCarousel();
    moveTrack(false);
});

// ==========================================
// 2. ระบบควบคุมแอนิเมชันโลโก้และการซ่อนองค์ประกอบ (Scroll Setup)
// ==========================================
if (snapContainer) {
    snapContainer.addEventListener('scroll', function() {
        const navbar = document.getElementById('navbar');
        const logo = document.getElementById('party-logo');
        const slogan = document.getElementById('party-slogan');
        const indicator = document.querySelector('.scroll-indicator');
        
        if (snapContainer.scrollTop > 80) {
            if (navbar) navbar.classList.add('scrolled');
            if (logo) logo.classList.add('fade-and-shrink'); 
            if (slogan) slogan.classList.add('fade-out');
            if (indicator) indicator.classList.add('fade-out');
        } else {
            if (navbar) navbar.classList.remove('scrolled');
            if (logo) logo.classList.remove('fade-and-shrink'); 
            if (slogan) slogan.classList.remove('fade-out');
            if (indicator) indicator.classList.remove('fade-out');
        }
    });
}

// ==========================================
// 3. ระบบควบคุมแผงสไลด์และการลาก (INFINITE DRAG CAROUSEL ENGINE)
// ==========================================

function initInfiniteCarousel() {
    const carousel = document.getElementById('member-carousel');
    const track = document.getElementById('carousel-track');
    if (!carousel || !track) return;

    const originalCards = Array.from(track.querySelectorAll('.horizontal-member-card'));
    originalCount = originalCards.length;
    if (originalCount === 0) return;

    // ทำการ Clone การ์ดไปแปะท้าย (Buffer Right)
    originalCards.forEach(card => {
        const clone = card.cloneNode(true);
        clone.classList.add('is-clone');
        track.appendChild(clone);
    });
    
    // ทำการ Clone การ์ดไปแปะหัว (Buffer Left)
    originalCards.slice().reverse().forEach(card => {
        const clone = card.cloneNode(true);
        clone.classList.add('is-clone');
        track.insertBefore(clone, track.firstChild);
    });

    // เริ่มคำนวณตำแหน่งและขยับหน้าปัดสไลด์ไปจุดเริ่มต้นจริง
    recalculateCarousel();
    
    // ตั้งพิกัดให้อยู่ที่การ์ดจริงใบแรก (ข้ามชุดโคลนซ้ายสุดไป)
    currentIndex = originalCount;
    moveTrack(false);
    carousel.classList.add('carousel-ready');

    // ➕ เริ่มต้นระบบขยับอัตโนมัติหลังจาก Carousel พร้อมทำงาน
    startAutoPlay();

    // ผูกระบบ Event ตรวจจับการลากและปัดด้วยเมาส์/นิ้วมือ
    carousel.addEventListener('mousedown', dragStart);
    carousel.addEventListener('touchstart', dragStart, { passive: true });
    
    window.addEventListener('mousemove', dragMove);
    window.addEventListener('touchmove', dragMove, { passive: false });
    
    window.addEventListener('mouseup', dragEnd);
    window.addEventListener('touchend', dragEnd);

    // ดักจับจังหวะสไลด์แอนิเมชันจบลง เพื่อทำ Seamless Teleport (วาร์ปกลับลูปหลัก)
    track.addEventListener('transitionend', (e) => {
        // ดักตรวจสอบให้ชัวร์ว่าเกิดจากแอนิเมชันของตัว track หลักจริงๆ ไม่ใช่ของแอนิเมชันเงาในตัวย่อย
        if (e.target !== track) return; 

        isTransitioning = false;
        
        // หลุดไปฝั่งชุดโคลนซ้ายสุด -> วาร์ปกลับมาเวอร์ชันการ์ดจริงฝั่งขวา
        if (currentIndex < originalCount) {
            currentIndex += originalCount;
            moveTrack(false);
        }
        // หลุดไปฝั่งชุดโคลนขวาสุด -> วาร์ปกลับมาเวอร์ชันการ์ดจริงฝั่งซ้าย
        else if (currentIndex >= originalCount * 2) {
            currentIndex -= originalCount;
            moveTrack(false);
        }
    });
}

/**
 * ➕ ฟังก์ชันเริ่มนับเวลา Auto-Play 
 */
function startAutoPlay() {
    // ป้องกันการสร้าง Loop ซ้อนกันโดยสั่งเคลียร์ของเก่าก่อนทุกครั้ง
    stopAutoPlay(); 
    autoPlayTimer = setInterval(() => {
        if (!isDragging && !isTransitioning) {
            currentIndex++;
            moveTrack(true);
        }
    }, autoPlayDelay);
}

/**
 * ➕ ฟังก์ชันหยุดนับเวลา Auto-Play
 */
function stopAutoPlay() {
    if (autoPlayTimer) {
        clearInterval(autoPlayTimer);
        autoPlayTimer = null;
    }
}

/**
 * คำนวณขนาดกว้างของการ์ด + Gap เพื่อหาพิกัดการขยับ Track ที่ถูกต้อง
 */
function recalculateCarousel() {
    const track = document.getElementById('carousel-track');
    if (!track) return;

    const card = track.querySelector('.horizontal-member-card');
    if (!card) return;

    const cardWidth = card.offsetWidth;
    const gap = parseInt(window.getComputedStyle(track).getPropertyValue('gap')) || 0;
    stepSize = cardWidth + gap;
}

/**
 * ฟังก์ชันคำนวณตำแหน่งกึ่งกลางแท้จริงของ Index นั้นๆ
 */
function getCalculatedTranslateX(index) {
    const carousel = document.getElementById('member-carousel');
    const track = document.getElementById('carousel-track');
    if (!carousel || !track || stepSize === 0) return 0;

    const carouselCenter = carousel.offsetWidth / 2;
    const card = track.querySelector('.horizontal-member-card');
    const cardWidth = card ? card.offsetWidth : 0;
    
    const targetOffset = (index * stepSize) + (cardWidth / 2);
    return carouselCenter - targetOffset;
}

/**
 * สั่งขับเคลื่อนแถบ Track ผ่านการใช้ CSS Transform TranslateX พร้อมควบคุมแอนิเมชันการ์ดรอบข้าง
 */
function moveTrack(animated = true) {
    const track = document.getElementById('carousel-track');
    if (!track || stepSize === 0) return;

    baseTranslateX = getCalculatedTranslateX(currentIndex);
    const cards = track.querySelectorAll('.horizontal-member-card');

    if (animated) {
        /* 👑 อัปเกรด: ใช้ Quintic Easing ผ่อนความเร็วปลายเพื่อความพรีเมียม และคุมการ์ดทั้งหมดไม่ให้แตกแถว */
        track.style.transition = 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1)';
        
        cards.forEach(card => {
            card.style.transition = 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease, filter 0.5s ease';
        });
        isTransitioning = true;
    } else {
        // ✨ จังหวะเชื่อมลูป (Teleport): ปิดแอนิเมชันทุกจุดพร้อมกันเด็ดขาด ผลคือสไลด์ต่อเนื่องลื่นไหลไม่เด้งสู้มือ
        track.style.transition = 'none';
        cards.forEach(card => {
            card.style.transition = 'none';
        });
        isTransitioning = false;
    }

    track.style.transform = `translateX(${baseTranslateX}px)`;
    updateFocusState();
}

/**
 * มอบคลาสขยายใหญ่ (.is-focused) ให้กับการ์ดใบที่อยู่ตรงกลางสายตา
 */
function updateFocusState() {
    const track = document.getElementById('carousel-track');
    if (!track) return;

    const cards = track.querySelectorAll('.horizontal-member-card');
    if (cards.length === 0) return;

    cards.forEach((card, index) => {
        if (index === currentIndex) {
            card.classList.add('is-focused');
        } else {
            card.classList.remove('is-focused');
        }
    });
}

// ==========================================
// 🕹️ LOGIC ระบบใช้นิ้วปัดและเมาส์ลาก (MOUSE & TOUCH HANDLING - VELOCITY UPGRADE)
// ==========================================

function dragStart(e) {
    if (isTransitioning) return;
    isDragging = true;
    
    // ➕ เมื่อผู้ใช้เริ่มลาก ให้หยุดระบบเลื่อนอัตโนมัติชั่วคราว
    stopAutoPlay();

    startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    dragStartTime = Date.now(); 
    
    baseTranslateX = getCalculatedTranslateX(currentIndex);
    
    const track = document.getElementById('carousel-track');
    if (track) {
        // ⚡ บังคับปิดแอนิเมชันให้เป็น 0 ทันทีที่นิ้วแตะ
        track.style.transition = 'none'; 
        const cards = track.querySelectorAll('.horizontal-member-card');
        cards.forEach(card => card.style.transition = 'none');
    }
}

function dragMove(e) {
    if (!isDragging) return;
    
    const currentX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    dragOffset = currentX - startX;
    
    if (e.type === 'touchmove') {
        if (Math.abs(dragOffset) > 5) {
            e.preventDefault();
        }
    }

    currentTranslateX = baseTranslateX + dragOffset;
    
    const track = document.getElementById('carousel-track');
    if (track) {
        // 💡 บรรทัดสำคัญ: ดับเบิ้ลเช็กว่า transition ต้องเป็น none ตลอดการลาก (แก้ปัญหาอาการสไลด์หนืด)
        track.style.transition = 'none'; 
        track.style.transform = `translateX(${currentTranslateX}px)`;
    }
}

function dragEnd() {
    if (!isDragging) return;
    isDragging = false;
    
    const track = document.getElementById('carousel-track');
    if (!track) return;

    const dragDuration = Date.now() - dragStartTime;
    const velocity = dragOffset / dragDuration; 

    // 📐 ✨ ปรับลดเกณฑ์ลงเพื่อให้เปลี่ยนคนง่ายขึ้นมาก (เบามือขึ้น 50%)
    const distanceThreshold = 20;  // จากเดิม 50px ลดเหลือ 30px ลากสั้นๆ ก็ผ่านแล้ว
    const velocityThreshold = 0.15; // จากเดิม 0.25 ลดเหลือ 0.15 สะกิดเบาๆ นิ้วบินทันที
    
    if (dragOffset < -distanceThreshold || velocity < -velocityThreshold) {
        currentIndex++;
    } else if (dragOffset > distanceThreshold || velocity > velocityThreshold) {
        currentIndex--;
    }
    
    dragOffset = 0;
    moveTrack(true);

    // ➕ เมื่อปล่อยมือแล้ว ให้เปิดระบบเลื่อนอัตโนมัติกลับมาทำงานต่อ
    startAutoPlay();
}

/**
 * ฟังก์ชันเปิดหน้าต่างรายละเอียดแบบเต็มจอ
 */
/**
 * ฟังก์ชันเปิดหน้าต่างรายละเอียดแบบเต็มจอ
 */
/**
 * ฟังก์ชันเปิดหน้าต่างรายละเอียดแบบเต็มจอ (อัปเดตระบบ Reset สถานะป้องกันบัค)
 */
function openMemberOverlay(element) {
    if (!element || isDragging) return; 
    
    const track = document.getElementById('carousel-track');
    if (!track) return;
    
    const cards = Array.from(track.querySelectorAll('.horizontal-member-card'));
    const elementIndex = cards.indexOf(element);

    if (elementIndex !== currentIndex) {
        currentIndex = elementIndex;
        moveTrack(true);
        return; 
    }

    // 🛑 สั่งหยุดระบบสไลด์ออโต้ทันทีและล้างค่าเผื่อไว้
    stopAutoPlay();
    isDragging = false;
    isTransitioning = false;

    // สกัดชุดข้อมูลตัวแปรจาก Data attribute
    const name = element.getAttribute('data-name');
    const role = element.getAttribute('data-role');
    const imgSrc = element.getAttribute('data-img');
    const dept = element.getAttribute('data-dept');
    const bio = element.getAttribute('data-bio');
    const ig = element.getAttribute('data-ig') || '';

    // บรรจุข้อมูลลงในแผงรายละเอียด (Overlay)
    const targetImg = document.getElementById('overlay-img');
    const targetDept = document.getElementById('overlay-dept');
    const targetName = document.getElementById('overlay-name');
    const targetRole = document.getElementById('overlay-role');
    const targetBio = document.getElementById('overlay-bio');
    
    const targetIg = document.getElementById('overlay-ig');
    const targetIgUsername = document.getElementById('overlay-ig-username');

    if (targetImg) targetImg.src = imgSrc || 'members/nexora.jpg';
    if (targetDept) targetDept.innerText = dept || 'DEPARTMENT';
    if (targetName) targetName.innerText = name || 'NAME';
    if (targetRole) targetRole.innerText = role || 'ROLE';
    if (targetBio) targetBio.innerText = bio || 'BIOGRAPHY';
    
    if (targetIg) {
        const cleanIg = ig.replace('@', '').trim(); 
        if (cleanIg) {
            targetIg.href = `https://instagram.com/${cleanIg}`;
            targetIg.style.display = 'inline-flex'; 
            if (targetIgUsername) {
                targetIgUsername.innerText = `@${cleanIg}`; 
            }
        } else {
            targetIg.style.display = 'none';
        }
    }

    const overlayScreen = document.getElementById('immersive-profile-overlay');
    if (overlayScreen) overlayScreen.classList.add('active');
    document.body.style.overflow = 'hidden'; 
}

/**
 * ฟังก์ชันปิดหน้าต่างรายละเอียด (อัปเดตล้างสถานะตกค้าง + ปลุกความลื่นไหลกลับมา)
 */
function closeMemberOverlay() {
    const overlayScreen = document.getElementById('immersive-profile-overlay');
    if (overlayScreen) overlayScreen.classList.remove('active');
    document.body.style.overflow = ''; 

    // 🧼 [แก้บัคเลื่อนยาก] เคลียร์สถานะการลากและแอนิเมชันที่ตกค้างให้กลับเป็นปกติ
    isDragging = false;
    isTransitioning = false;
    dragOffset = 0;

    // 🛠️ [แก้บัคฝืด] บังคับให้เบราว์เซอร์คำนวณตำแหน่งสไลเดอร์และจัดระเบียบการ์ดใหม่อีกครั้งทันทีที่ปิดหน้าต่าง
    setTimeout(() => {
        recalculateCarousel();
        moveTrack(false); // ล็อกเป้าตรงกลางแบบต่อเนื่อง
        
        // ➕ [แก้บัคไม่ยอมเลื่อนออโต้] สั่งให้ระบบ Auto-Play เริ่มนับเวลาใหม่อย่างปลอดภัย
        startAutoPlay();
    }, 50); // ดีเลย์ 50ms เพื่อรอให้แอนิเมชันหน้าต่างปิดตัวเรียบร้อยก่อน
}

// ผูกระบบปิดเมื่อคลิกที่ว่างด้านนอกกล่องป๊อปอัป overlay
const overlayScreen = document.getElementById('immersive-profile-overlay');
if (overlayScreen) {
    overlayScreen.addEventListener('click', function(e) {
        if (e.target === overlayScreen) {
            closeMemberOverlay();
        }
    });
}

function scrollToMembers() {
    const target = document.getElementById('member-section');
    if (target) { 
        target.scrollIntoView({ behavior: 'smooth', block: 'start' }); 
    }
}

// ==========================================
// 4. ระบบดึงและควบคุมข้อมูลแอดมิน (Admin Dashboard)
// ==========================================

function sanitizeHTML(str) {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

function fetchApplicants() {
    const loadingState = document.getElementById('loading-state');
    const totalCount = document.getElementById('total-applicants');
    const applicantsGrid = document.getElementById('applicants-grid');

    if (!applicantsGrid) return;

    fetch(adminAPI_URL)
        .then(response => {
            if (!response.ok) throw new Error('Network error');
            return response.json();
        })
        .then(data => {
            const rawData = Array.isArray(data) ? data : (data.data || []);
            
            localApplicantsData = rawData.map(person => ({
                name: person.name || person['data[name]'] || 'ไม่ระบุชื่อ',
                grade: person.grade || person['data[grade]'] || '-',
                gpa: person.gpa || person['data[gpa]'] || 'ไม่ได้ระบุ',
                facebook: person.facebook || person['data[facebook]'] || '-',
                instagram: person.instagram || person['data[instagram]'] || '-',
                reason: person.reason || person['data[reason]'] || 'ไม่มีคำตอบ'
            }));

            if (totalCount) totalCount.innerText = localApplicantsData.length;
            if (loadingState) loadingState.style.display = 'none';
            displayApplicants(localApplicantsData);
        })
        .catch(error => {
            console.error('Error fetching:', error);
            if (loadingState) {
                loadingState.innerHTML = `<p style="color: #f87171; font-weight: 500;">ERROR: ไม่สามารถเชื่อมต่อฐานข้อมูลได้</p>`;
            }
        });
}

function displayApplicants(applicants) {
    const applicantsGrid = document.getElementById('applicants-grid');
    if (!applicantsGrid) return;

    applicantsGrid.innerHTML = ''; 

    if (applicants.length === 0) {
        applicantsGrid.innerHTML = `<p style="color: #64748b; text-align: center; grid-column: 1/-1; padding: 40px;">ไม่พบข้อมูลผู้สมัครที่ตรงเงื่อนไข</p>`;
        return;
    }

    applicants.forEach(person => {
        const card = document.createElement('div');
        card.className = 'applicant-card';

        card.innerHTML = `
            <div class="card-badge">MEMBER</div>
            <div class="card-info">
                <h3 class="name">${sanitizeHTML(person.name)}</h3>
                <div class="info-item"><span class="label">ระดับชั้น</span><span class="value">${sanitizeHTML(person.grade)}</span></div>
                <div class="info-item"><span class="label">เกรดเฉลี่ย</span><span class="value" style="color: #3b82f6; font-weight: 600;">${sanitizeHTML(person.gpa)}</span></div>
                <div class="info-item"><span class="label">Facebook</span><span class="value social">${sanitizeHTML(person.facebook)}</span></div>
                <div class="info-item"><span class="label">Instagram</span><span class="value social">${sanitizeHTML(person.instagram)}</span></div>
                <div class="info-item" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05);">
                    <span class="label" style="color: #06b6d4;">เหตุผลที่เข้าร่วม:</span>
                    <p class="value" style="font-size: 0.85rem; line-height: 1.5; color: #94a3b8; white-space: pre-line;">"${sanitizeHTML(person.reason)}"</p>
                </div>
            </div>
        `;
        applicantsGrid.appendChild(card);
    });
}

const searchInput = document.getElementById('search-input');
if (searchInput) {
    searchInput.addEventListener('input', function(e) {
        const searchText = e.target.value.toLowerCase().trim();
        const filteredData = localApplicantsData.filter(person => {
            return person.name.toLowerCase().includes(searchText) || 
                   person.grade.toLowerCase().includes(searchText);
        });
        displayApplicants(filteredData);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // เปลี่ยน Selector ให้ตรงกับ Class Prefix ใหม่ (ป้องกันคลาสชนกัน)
    const slides = document.querySelectorAll(".kc-card-slide");
    const prevBtn = document.querySelector(".btn-prev");
    const nextBtn = document.querySelector(".btn-next");
    const dotsContainer = document.querySelector(".policy-dots-indicator");
    let currentSlide = 0;

    // สร้างจุดวงกลมตามจำนวนสไลด์จริง
    slides.forEach((_, index) => {
        const dot = document.createElement("div");
        dot.classList.add("kc-dot"); // เปลี่ยนคลาสของจุดเป็นระบบใหม่
        if (index === 0) dot.classList.add("kc-is-active"); // ใช้ kc-is-active แทน active
        dot.addEventListener("click", () => goToSlide(index));
        dotsContainer.appendChild(dot);
    });

    const dots = document.querySelectorAll(".kc-dot");

    function updateSlider() {
        slides.forEach((slide, index) => {
            if (index === currentSlide) {
                slide.classList.add("kc-is-active"); // อัปเดตคลาสแสดงผลสไลด์
                dots[index].classList.add("kc-is-active"); // อัปเดตคลาสแสดงผลจุดอินดิเคเตอร์
            } else {
                slide.classList.remove("kc-is-active");
                dots[index].classList.remove("kc-is-active");
            }
        });
    }

    function goToSlide(index) {
        currentSlide = index;
        updateSlider();
    }

    nextBtn.addEventListener("click", () => {
        currentSlide = (currentSlide + 1) % slides.length;
        updateSlider();
    });

    prevBtn.addEventListener("click", () => {
        currentSlide = (currentSlide - 1 + slides.length) % slides.length;
        updateSlider();
    });
});

document.addEventListener("DOMContentLoaded", () => {
    const section = document.getElementById("policy-section");
    const slides = section.querySelectorAll(".kc-card-slide");
    const prevBtn = section.querySelector(".btn-prev");
    const nextBtn = section.querySelector(".btn-next");
    const dotsContainer = section.querySelector(".policy-dots-indicator");
    
    let currentIndex = 0;
    let autoPlayTimer = null;
    const AUTO_PLAY_INTERVAL = 4000; // ⏱️ ตั้งเวลาเลื่อนอัตโนมัติ (4000 มิลลิวินาที = 4 วินาที)

    // 1. สร้างจุดอินดิเคเตอร์ (Dots) ตามจำนวนสไลด์จริง (มี 10 นโยบายก็สร้าง 10 จุด)
    function createDots() {
        dotsContainer.innerHTML = "";
        slides.forEach((_, index) => {
            const dot = document.createElement("div");
            dot.classList.add("kc-dot");
            if (index === 0) dot.classList.add("kc-is-active");
            
            // คลิกที่จุดแล้วให้ข้ามไปยังนโยบายนั้นๆ
            dot.addEventListener("click", () => {
                goToSlide(index);
                resetAutoPlay(); // รีเซ็ตตัวนับเวลาใหม่เมื่อผู้ใช้กด
            });
            dotsContainer.appendChild(dot);
        });
    }

    // 2. ฟังก์ชันอัปเดตสถานะการแสดงผลของการ์ดและจุด
    function updateSlides() {
        // อัปเดตตัวการ์ดนโยบาย
        slides.forEach((slide, index) => {
            if (index === currentIndex) {
                slide.classList.add("kc-is-active");
            } else {
                slide.classList.remove("kc-is-active");
            }
        });

        // อัปเดตจุดบอกตำแหน่ง
        const dots = dotsContainer.querySelectorAll(".kc-dot");
        dots.forEach((dot, index) => {
            if (index === currentIndex) {
                dot.classList.add("kc-is-active");
            } else {
                dot.classList.remove("kc-is-active");
            }
        });
    }

    // 3. ฟังก์ชันกระโดดไปสไลด์ที่เลือก
    function goToSlide(index) {
        currentIndex = index;
        updateSlides();
    }

    // 4. ฟังก์ชันสำหรับเลื่อนไปข้างหน้า (ถัดไป)
    function nextSlide() {
        currentIndex = (currentIndex + 1) % slides.length; // ถ้าถึงนโยบายที่ 10 จะวนกลับมา 01 ใหม่
        updateSlides();
    }

    // 5. ฟังก์ชันสำหรับย้อนกลับไปข้างหลัง
    function prevSlide() {
        currentIndex = (currentIndex - 1 + slides.length) % slides.length;
        updateSlides();
    }

    // 6. ระบบเริ่มทำงานการเลื่อนอัตโนมัติ
    function startAutoPlay() {
        if (!autoPlayTimer) {
            autoPlayTimer = setInterval(nextSlide, AUTO_PLAY_INTERVAL);
        }
    }

    // 7. ระบบหยุดเลื่อนชั่วคราวและเริ่มนับเวลาใหม่ (ป้องกันปัญหาการ์ดเลื่อนหนีเวลาคนกำลังกดดู)
    function resetAutoPlay() {
        clearInterval(autoPlayTimer);
        autoPlayTimer = null;
        startAutoPlay();
    }

    // 8. ผูกเหตุการณ์การคลิกเข้ากับปุ่มนำทาง ซ้าย-ขวา
    nextBtn.addEventListener("click", () => {
        nextSlide();
        resetAutoPlay();
    });

    prevBtn.addEventListener("click", () => {
        prevSlide();
        resetAutoPlay();
    });

    // 🚀 สั่งเริ่มทำงานระบบทั้งหมด
    createDots();
    startAutoPlay();
});