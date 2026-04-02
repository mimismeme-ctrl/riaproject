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
  booksPerPage: 12,
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
  loadTodayQuestion();
  initSearch();
  initFilters();
  initSort();
  initHamburger();
  initScrollTop();
  updateTotalStat();
});

/* =============================================
   API 데이터 로드
   ============================================= */
async function loadBooks() {
  try {
    const res = await fetch('tables/books?limit=300&sort=title');
    if (!res.ok) throw new Error('API 오류');
    const data = await res.json();
    if (data && data.data && data.data.length > 0) {
      state.allBooks = data.data;
    } else {
      state.allBooks = SAMPLE_BOOKS;
    }
  } catch (e) {
    console.warn('API 연결 실패, 샘플 데이터 사용:', e.message);
    state.allBooks = SAMPLE_BOOKS;
  }
  state.filteredBooks = [...state.allBooks];
}

/* =============================================
   로딩 표시
   ============================================= */
function showLoading(show) {
  const spinner = document.getElementById('loadingSpinner');
  const grid = document.getElementById('booksGrid');
  if (!spinner || !grid) return;
  if (show) {
    spinner.style.display = 'flex';
    grid.style.display = 'none';
  } else {
    spinner.style.display = 'none';
    grid.style.display = 'grid';
  }
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
   오늘의 창의 질문
   ============================================= */
function loadTodayQuestion() {
  if (state.allBooks.length === 0) return;

  const pool = state.allBooks.filter(b =>
    b.creative_questions && b.creative_questions.length > 0
  );
  if (pool.length === 0) return;

  const book = pool[Math.floor(Math.random() * pool.length)];
  const questions = book.creative_questions;
  const question = questions[Math.floor(Math.random() * questions.length)];

  const emojiEl = document.getElementById('todayEmoji');
  const titleEl = document.getElementById('todayBookTitle');
  const questionEl = document.getElementById('todayQuestionText');
  const linkEl = document.getElementById('todayBookLink');

  if (emojiEl) emojiEl.textContent = book.cover_emoji || '📚';
  if (titleEl) titleEl.textContent = `📖 ${book.title}`;
  if (questionEl) questionEl.textContent = question;
  if (linkEl) linkEl.href = `book.html?id=${encodeURIComponent(book.id)}`;
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

      if (type === 'theme') state.activeTheme = filter;
      if (type === 'age') state.activeAge = filter;

      state.currentPage = 1;
      applyFilters();
    });
  });
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

  document.querySelectorAll('.chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.filter === 'all');
  });

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
