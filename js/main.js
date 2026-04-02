/**
 * 그림책 질문박스 — 메인 페이지 JavaScript
 * 기능: 도서 그리드, 검색, 필터, 오늘의 질문, 페이지네이션
 */

/* =============================================
   전역 상태
   ============================================= */
const state = {
  allBooks: [],
  filteredBooks: [],
  currentPage: 1,
  booksPerPage: 8,
  activeTheme: 'all',
  activeAge: 'all',
  searchQuery: '',
  sortBy: 'default'
};

/* =============================================
   초기화
   ============================================= */
document.addEventListener('DOMContentLoaded', async () => {
  showLoading(true);
  await loadBooks();
  showLoading(false);
  renderFeatured();
  renderBooks();
  initTodaySlider();
  initSearch();
  initFilters();
  initSort();
  initHamburger();
  initScrollTop();
  updateTotalStat();
});

/* =============================================
   도서 데이터 로드 — Supabase 전용
   ============================================= */
async function loadBooks() {
  try {
    const books = await db.getAll('books', { order: 'title.asc' });
    state.allBooks = books || [];
    state.filteredBooks = [...state.allBooks];
  } catch (e) {
    console.error('도서 로드 실패:', e.message);
    state.allBooks = [];
    state.filteredBooks = [];
    showError('데이터를 불러오지 못했어요. Supabase 연결을 확인해주세요.');
  }
}

/* =============================================
   로딩 표시
   ============================================= */
function showLoading(show) {
  const spinner = document.getElementById('loadingSpinner');
  const grid = document.getElementById('booksGrid');
  if (!spinner || !grid) return;
  spinner.style.display = show ? 'flex' : 'none';
  grid.style.display   = show ? 'none' : 'grid';
}

function showError(msg) {
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) spinner.innerHTML = `<div class="spinner-icon">⚠️</div><p style="color:#E53E3E">${msg}</p>`;
}

/* =============================================
   도서 렌더링
   ============================================= */
function renderBooks() {
  const grid = document.getElementById('booksGrid');
  const emptyState = document.getElementById('emptyState');
  const resultCount = document.getElementById('resultCount');

  const total = state.filteredBooks.length;
  const start = (state.currentPage - 1) * state.booksPerPage;
  const end = start + state.booksPerPage;
  const pageBooks = state.filteredBooks.slice(start, end);

  resultCount.textContent = total > 0
    ? `총 ${total}권의 그림책`
    : '검색 결과가 없어요';

  if (pageBooks.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'block';
  } else {
    grid.style.display = 'grid';
    emptyState.style.display = 'none';
    grid.innerHTML = pageBooks.map(book => createBookCard(book)).join('');
  }

  renderPagination(total);
}

function createBookCard(book) {
  const themes = (book.themes || []).slice(0, 2).map(t =>
    `<span class="theme-tag">${escHtml(t)}</span>`
  ).join('');

  const qCount = (book.creative_questions || []).length + (book.kids_questions || []).length;
  const isFeatured = book.is_featured ? `<span class="book-featured-badge">⭐</span>` : '';

  return `
    <div class="book-card fade-in" onclick="goToBook('${escHtml(book.id)}')" role="button" tabindex="0"
         onkeydown="if(event.key==='Enter') goToBook('${escHtml(book.id)}')">
      <div class="book-card-cover" style="background-color: ${book.cover_color || '#EEF3FF'}">
        <span>${book.cover_emoji || '📚'}</span>
        <span class="book-card-age">${escHtml(formatAge(book.age_range))}</span>
        ${isFeatured}
      </div>
      <div class="book-card-body">
        <p class="book-card-title">${escHtml(book.title)}</p>
        <p class="book-card-author">${escHtml(book.author || '')} · ${book.year || ''}</p>
        <div class="book-card-themes">${themes}</div>
        <div class="book-card-footer">
          <span class="book-card-q-count">
            <i class="fas fa-question-circle"></i> 질문 ${qCount}개
          </span>
          <span class="book-card-arrow"><i class="fas fa-arrow-right"></i></span>
        </div>
      </div>
    </div>
  `;
}

function formatAge(ageRange) {
  if (!ageRange) return '';
  const map = {
    '유아(3-5세)': '3-5세',
    '저학년(6-8세)': '6-8세',
    '중학년(9-10세)': '9-10세',
    '고학년(11-13세)': '11-13세',
    '전연령': '전연령'
  };
  return map[ageRange] || ageRange;
}

/* =============================================
   추천 도서 배너
   ============================================= */
function renderFeatured() {
  const scroll = document.getElementById('featuredScroll');
  const banner = document.getElementById('featuredBanner');
  const featured = state.allBooks.filter(b => b.is_featured);

  if (featured.length === 0) {
    if (banner) banner.style.display = 'none';
    return;
  }

  scroll.innerHTML = featured.map(book => `
    <div class="mini-book-card" onclick="goToBook('${escHtml(book.id)}')">
      <div class="mini-cover" style="background-color: ${book.cover_color || '#EEF3FF'}">
        ${book.cover_emoji || '📚'}
      </div>
      <p class="mini-title">${escHtml(book.title)}</p>
    </div>
  `).join('');
}

/* =============================================
   오늘의 질문 슬라이더 (4장 카드 자동+수동)
   ============================================= */
/* =============================================
   오늘의 질문 — 1장씩 롤링 슬라이더
   ============================================= */
const tqState = {
  cards: [],
  idx: 0,
  total: 0,
  timer: null,
  progress: null,
  progressVal: 0,
  animating: false
};

function initTodaySlider() {
  const stage   = document.getElementById('tqStage');
  const dots    = document.getElementById('tqDots');
  const counter = document.getElementById('tqCounter');
  const prev    = document.getElementById('tqPrev');
  const next    = document.getElementById('tqNext');
  if (!stage) return;

  // 카드 풀 구성 (최대 8장 랜덤)
  const pool = state.allBooks.filter(b =>
    b.creative_questions && b.creative_questions.length > 0
  );
  if (pool.length === 0) return;

  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 8);
  tqState.cards = shuffled.map(book => {
    const qs = book.creative_questions;
    return { book, question: qs[Math.floor(Math.random() * qs.length)] };
  });
  tqState.total = tqState.cards.length;

  // 프로그레스 바 생성
  const progEl = document.createElement('div');
  progEl.className = 'tq-progress';
  progEl.style.width = '0%';
  document.querySelector('.today-question-section')?.appendChild(progEl);
  tqState.progress = progEl;

  // 닷 생성
  dots.innerHTML = '';
  for (let i = 0; i < tqState.total; i++) {
    const btn = document.createElement('button');
    btn.className = 'tq-dot' + (i === 0 ? ' active' : '');
    btn.setAttribute('aria-label', `${i + 1}번 질문`);
    btn.addEventListener('click', () => tqGoTo(i, i > tqState.idx ? 'right' : 'left'));
    dots.appendChild(btn);
  }

  // 화살표
  if (prev) prev.addEventListener('click', () => tqGoTo(tqState.idx - 1, 'left'));
  if (next) next.addEventListener('click', () => tqGoTo(tqState.idx + 1, 'right'));

  // 터치 스와이프
  let tx = 0;
  stage.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) tqGoTo(tqState.idx + (dx < 0 ? 1 : -1), dx < 0 ? 'right' : 'left');
  });

  // 첫 번째 카드 표시 (애니 없이)
  tqRender(0, null);
  tqUpdateUI();
  tqStartAuto();
}

/** 카드 HTML 생성 */
function tqCardHTML(item) {
  const { book, question } = item;
  const themes = Array.isArray(book.themes)
    ? book.themes : (book.themes ? String(book.themes).split(',').map(t => t.trim()) : []);
  const tagsHTML = themes.slice(0, 2).map(t =>
    `<span class="tq-rcard-tag">${escHtml(t)}</span>`).join('');

  return `
    <a class="tq-rcard" href="book.html?id=${encodeURIComponent(book.id || book.title)}"
       aria-label="${escHtml(book.title)} 창의 질문">
      <div class="tq-rcard-emoji">${book.cover_emoji || '📚'}</div>
      <div class="tq-rcard-body">
        <div class="tq-rcard-tags">
          ${tagsHTML}
          ${book.age_range ? `<span class="tq-rcard-tag">${escHtml(book.age_range)}</span>` : ''}
        </div>
        <p class="tq-rcard-question">"${escHtml(question)}"</p>
        <div class="tq-rcard-divider"></div>
        <div class="tq-rcard-book">
          <div class="tq-rcard-book-info">
            <span class="tq-rcard-book-title">${escHtml(book.title)}</span>
            ${book.author ? ` · <span>${escHtml(book.author)}</span>` : ''}
          </div>
          <span class="tq-rcard-go"><i class="fas fa-arrow-right"></i> 책 보기</span>
        </div>
      </div>
    </a>`;
}

/** 카드 렌더 (dirn: 'right'|'left'|null) */
function tqRender(idx, dirn) {
  const stage = document.getElementById('tqStage');
  if (!stage) return;

  const html = tqCardHTML(tqState.cards[idx]);

  if (!dirn) {
    stage.innerHTML = html;
    return;
  }

  // 들어오는 카드
  const incoming = document.createElement('div');
  incoming.style.cssText = 'position:absolute;inset:0;';
  incoming.innerHTML = html;
  incoming.firstElementChild?.classList.add(
    dirn === 'right' ? 'tq-slide-in-r' : 'tq-slide-in-l'
  );

  // 기존 카드 나가기 애니 (클래스는 별도 적용 없이 opacity fade)
  const existing = stage.firstElementChild;
  if (existing) {
    existing.style.transition = 'opacity .3s';
    existing.style.opacity = '0';
    existing.style.pointerEvents = 'none';
  }

  stage.style.position = 'relative';
  stage.appendChild(incoming);

  setTimeout(() => {
    stage.innerHTML = html;
    tqState.animating = false;
  }, 380);
}

function tqGoTo(idx, dirn = 'right') {
  if (tqState.animating) return;
  const total = tqState.total;
  idx = ((idx % total) + total) % total; // 순환
  if (idx === tqState.idx) return;

  tqState.animating = true;
  tqState.idx = idx;
  tqRender(idx, dirn);
  tqUpdateUI();
  tqRestartAuto();
}

function tqUpdateUI() {
  const { idx, total } = tqState;
  // 닷
  document.querySelectorAll('.tq-dot').forEach((d, i) =>
    d.classList.toggle('active', i === idx));
  // 카운터
  const counter = document.getElementById('tqCounter');
  if (counter) counter.textContent = `${idx + 1} / ${total}`;
  // 프로그레스 리셋
  if (tqState.progress) tqState.progress.style.width = '0%';
  tqState.progressVal = 0;
}

function tqStartAuto() {
  clearInterval(tqState.timer);
  const INTERVAL = 6000; // 6초
  const STEP     = 100;  // 100ms마다 갱신

  tqState.timer = setInterval(() => {
    tqState.progressVal += (STEP / INTERVAL) * 100;
    if (tqState.progress) tqState.progress.style.width = `${Math.min(tqState.progressVal, 100)}%`;

    if (tqState.progressVal >= 100) {
      const next = (tqState.idx + 1) % tqState.total;
      tqGoTo(next, 'right');
    }
  }, STEP);
}

function tqRestartAuto() {
  if (tqState.progress) tqState.progress.style.width = '0%';
  tqState.progressVal = 0;
  tqStartAuto();
}

/* =============================================
   검색
   ============================================= */
function initSearch() {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClear');
  if (!input) return;

  let debounceTimer;
  input.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    clearBtn.classList.toggle('visible', state.searchQuery.length > 0);
    state.currentPage = 1;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyFilters, 200);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    state.searchQuery = '';
    clearBtn.classList.remove('visible');
    state.currentPage = 1;
    applyFilters();
    input.focus();
  });
}

/* =============================================
   필터 (주제 / 연령대)
   ============================================= */
function initFilters() {
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const type = chip.dataset.type;
      const filter = chip.dataset.filter;

      document.querySelectorAll(`.chip[data-type="${type}"]`).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      if (type === 'theme') {
        state.activeTheme = filter;
        updateFilterLabel('themeCurLabel', chip.textContent.trim());
      }
      if (type === 'age') {
        state.activeAge = filter;
        updateFilterLabel('ageCurLabel', chip.textContent.trim());
      }

      state.currentPage = 1;
      applyFilters();
    });
  });
}

/* 필터 라벨 옆 현재 선택값 업데이트 */
function updateFilterLabel(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  // 이모지·특수문자 제거하고 핵심 텍스트만
  const clean = text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/gu, '').trim();
  el.textContent = clean || text.trim();
}

/* 라벨 뱃지 클릭 → 해당 타입 전체 초기화 */
function resetFilter(type) {
  if (type === 'age') {
    state.activeAge = 'all';
    updateFilterLabel('ageCurLabel', '전체');
  } else if (type === 'theme') {
    state.activeTheme = 'all';
    updateFilterLabel('themeCurLabel', '전체');
  }
  // 모든 칩 active 해제
  document.querySelectorAll(`.chip[data-type="${type}"]`).forEach(c => c.classList.remove('active'));
  state.currentPage = 1;
  applyFilters();
}

function initSort() {
  const sel = document.getElementById('sortSelect');
  if (!sel) return;
  sel.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    applyFilters();
  });
}

function applyFilters() {
  let books = [...state.allBooks];

  // 검색 필터
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    books = books.filter(b =>
      (b.title || '').toLowerCase().includes(q) ||
      (b.author || '').toLowerCase().includes(q) ||
      (b.synopsis || '').toLowerCase().includes(q) ||
      (b.keywords || []).some(k => k.toLowerCase().includes(q)) ||
      (b.themes || []).some(t => t.toLowerCase().includes(q))
    );
  }

  // 주제 필터
  if (state.activeTheme !== 'all') {
    books = books.filter(b =>
      (b.themes || []).some(t => t.includes(state.activeTheme))
    );
  }

  // 연령대 필터
  if (state.activeAge !== 'all') {
    books = books.filter(b => b.age_range === state.activeAge);
  }

  // 정렬
  if (state.sortBy === 'title') {
    books.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ko'));
  } else if (state.sortBy === 'year_desc') {
    books.sort((a, b) => (b.year || 0) - (a.year || 0));
  } else if (state.sortBy === 'year_asc') {
    books.sort((a, b) => (a.year || 0) - (b.year || 0));
  }

  state.filteredBooks = books;
  renderBooks();
}

function resetFilters() {
  state.searchQuery = '';
  state.activeTheme = 'all';
  state.activeAge = 'all';
  state.sortBy = 'default';
  state.currentPage = 1;

  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const sortSelect = document.getElementById('sortSelect');

  if (searchInput) searchInput.value = '';
  if (searchClear) searchClear.classList.remove('visible');
  if (sortSelect) sortSelect.value = 'default';

  // 칩 active 모두 해제 (전체 칩 없으므로 모두 해제)
  document.querySelectorAll('.chip').forEach(chip => chip.classList.remove('active'));
  // 라벨 뱃지 초기화
  updateFilterLabel('ageCurLabel', '전체');
  updateFilterLabel('themeCurLabel', '전체');

  state.filteredBooks = [...state.allBooks];
  renderBooks();
}

/* =============================================
   페이지네이션
   ============================================= */
function renderPagination(total) {
  const pag = document.getElementById('pagination');
  if (!pag) return;
  const totalPages = Math.ceil(total / state.booksPerPage);

  if (totalPages <= 1) { pag.innerHTML = ''; return; }

  let html = '';
  const cur = state.currentPage;

  if (cur > 1) {
    html += `<button class="page-btn" onclick="goPage(${cur - 1})"><i class="fas fa-chevron-left"></i></button>`;
  }

  const pages = buildPageRange(cur, totalPages);
  pages.forEach(p => {
    if (p === '...') {
      html += `<button class="page-btn ellipsis">···</button>`;
    } else {
      html += `<button class="page-btn ${p === cur ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`;
    }
  });

  if (cur < totalPages) {
    html += `<button class="page-btn" onclick="goPage(${cur + 1})"><i class="fas fa-chevron-right"></i></button>`;
  }

  pag.innerHTML = html;
}

function buildPageRange(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (cur <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (cur >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', cur - 1, cur, cur + 1, '...', total];
}

function goPage(page) {
  state.currentPage = page;
  renderBooks();
  const booksSection = document.getElementById('books-section');
  if (booksSection) booksSection.scrollIntoView({ behavior: 'smooth' });
}

/* =============================================
   네비게이션 & 스크롤 탑
   ============================================= */
function goToBook(id) {
  window.location.href = `book.html?id=${encodeURIComponent(id)}`;
}

function initHamburger() {
  const btn = document.getElementById('hamburger');
  const nav = document.getElementById('mobileNav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => nav.classList.toggle('open'));
  // 외부 클릭 시 메뉴 닫기
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !nav.contains(e.target)) {
      nav.classList.remove('open');
    }
  });
}

function initScrollTop() {
  const btn = document.getElementById('scrollTop');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
}

function updateTotalStat() {
  const el = document.getElementById('totalBooks');
  if (el) el.textContent = state.allBooks.length;
}

/* =============================================
   유틸
   ============================================= */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
