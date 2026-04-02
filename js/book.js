/**
 * 그림책 질문박스 — 책 상세 페이지 JavaScript
 * 기능: 책 정보 표시, 탭, 질문 아코디언, 관련 도서
 */

/* =============================================
   초기화
   ============================================= */
document.addEventListener('DOMContentLoaded', async () => {
  const bookId = getUrlParam('id');
  if (!bookId) {
    showError('책 정보를 찾을 수 없습니다.');
    return;
  }

  const allBooks = await loadAllBooks();
  const book = allBooks.find(b => b.id === bookId);

  if (!book) {
    showError('해당 그림책을 찾을 수 없습니다.');
    return;
  }

  renderBookHero(book);
  renderCreativeQuestions(book);
  renderKidsQuestions(book);
  renderRelatedBooks(book, allBooks);
  renderLessonTips(book);
  initTabs();
  initHamburger();
  initScrollTop();
});

/* =============================================
   API / 데이터 로드
   ============================================= */
async function loadAllBooks() {
  try {
    const res = await fetch('tables/books?limit=300');
    if (!res.ok) throw new Error('API 오류');
    const data = await res.json();
    if (data && data.data && data.data.length > 0) return data.data;
    return SAMPLE_BOOKS;
  } catch (e) {
    console.warn('API 연결 실패, 샘플 데이터 사용');
    return SAMPLE_BOOKS;
  }
}

/* =============================================
   책 히어로 렌더링
   ============================================= */
function renderBookHero(book) {
  document.title = `${book.title} | 그림책 질문박스`;
  const breadcrumb = document.getElementById('breadcrumbTitle');
  if (breadcrumb) breadcrumb.textContent = book.title;

  // 표지
  const cover = document.getElementById('bookCover');
  if (cover) cover.style.backgroundColor = book.cover_color || '#EEF3FF';
  const coverEmoji = document.getElementById('bookCoverEmoji');
  if (coverEmoji) coverEmoji.textContent = book.cover_emoji || '📚';

  // 배지 (추천 도서)
  const badgesEl = document.getElementById('bookBadges');
  if (badgesEl && book.is_featured) {
    badgesEl.innerHTML =
      `<span class="book-age-badge" style="background:#FFF8E8;color:#E88C30;border:1px solid #FFD08A">⭐ 추천 도서</span>`;
  }

  // 메타 정보
  const ageEl = document.getElementById('bookAgeBadge');
  if (ageEl) ageEl.textContent = book.age_range || '';
  const yearEl = document.getElementById('bookYear');
  if (yearEl) yearEl.textContent = book.year ? `${book.year}년` : '';
  const titleEl = document.getElementById('bookTitle');
  if (titleEl) titleEl.textContent = book.title;
  const authorEl = document.getElementById('bookAuthor');
  if (authorEl) authorEl.textContent = buildAuthorText(book);
  const synopsisEl = document.getElementById('bookSynopsis');
  if (synopsisEl) synopsisEl.textContent = book.synopsis || '';

  // 주제 태그
  const themesEl = document.getElementById('bookThemes');
  if (themesEl) {
    themesEl.innerHTML = (book.themes || []).map(t =>
      `<span class="book-theme-tag">${escHtml(t)}</span>`
    ).join('');
  }

  // 키워드
  const kwEl = document.getElementById('bookKeywords');
  if (kwEl) {
    kwEl.innerHTML = (book.keywords || []).map(k =>
      `<span class="keyword-tag">#${escHtml(k)}</span>`
    ).join('');
  }
}

function buildAuthorText(book) {
  const parts = [];
  if (book.author) parts.push(`글 ${book.author}`);
  if (book.illustrator && book.illustrator !== book.author) parts.push(`그림 ${book.illustrator}`);
  if (book.publisher) parts.push(book.publisher);
  return parts.join(' · ');
}

/* =============================================
   수업 팁 렌더링
   ============================================= */
function renderLessonTips(book) {
  const box = document.getElementById('lessonTipsBox');
  const text = document.getElementById('lessonTipsText');
  if (!box || !text) return;

  if (book.lesson_tips) {
    text.textContent = book.lesson_tips;
    box.style.display = 'block';
  } else {
    box.style.display = 'none';
  }
}

/* =============================================
   창의 질문 (아코디언)
   ============================================= */
function renderCreativeQuestions(book) {
  const container = document.getElementById('creativeQuestions');
  if (!container) return;
  const questions = book.creative_questions || [];

  if (questions.length === 0) {
    container.innerHTML = '<p class="empty-msg">등록된 창의 질문이 없습니다.</p>';
    return;
  }

  container.innerHTML = questions.map((q, i) =>
    createAccordionItem(q, i, 'creative', book.id)
  ).join('');
}

/* =============================================
   아이들 질문 (아코디언)
   ============================================= */
function renderKidsQuestions(book) {
  const container = document.getElementById('kidsQuestions');
  if (!container) return;
  const questions = book.kids_questions || [];
  const countEl = document.getElementById('kidsQCount');
  if (countEl) countEl.textContent = questions.length;

  if (questions.length === 0) {
    container.innerHTML = '<p class="empty-msg">등록된 아이들 질문이 없습니다.</p>';
    return;
  }

  container.innerHTML = questions.map((q, i) =>
    createAccordionItem(q, i, 'kids', book.id)
  ).join('');
}

/* =============================================
   아코디언 아이템 생성
   ============================================= */
function createAccordionItem(questionText, index, type, bookId) {
  const answerKey = `${bookId}_q${index}`;
  const answers = (typeof SAMPLE_ANSWERS !== 'undefined' && SAMPLE_ANSWERS[answerKey]) || [];
  const numLabel = type === 'creative' ? `Q${index + 1}` : `${index + 1}`;

  const answersHtml = answers.length > 0
    ? `
      <p class="answers-intro">💬 수업에서 나온 아이들의 답변 <strong>${answers.length}가지</strong></p>
      <div class="answer-list">
        ${answers.map(a => `
          <div class="answer-item">
            <span class="answer-avatar">${a.avatar || '🧒'}</span>
            <p class="answer-text">${escHtml(a.text)}</p>
          </div>
        `).join('')}
      </div>
      <div class="add-answer-placeholder">
        ✏️ 답변 추가 기능 준비 중 · 곧 업데이트 예정입니다
      </div>
    `
    : `
      <p class="answers-intro">아직 수집된 답변이 없어요. 수업 후 아이들의 대답을 기록해 두세요!</p>
      <div class="add-answer-placeholder">
        ✏️ 답변 추가 기능 준비 중 · 곧 업데이트 예정입니다
      </div>
    `;

  return `
    <div class="question-item" id="accordion-${type}-${index}">
      <div class="question-header" onclick="toggleAccordion('${type}', ${index})">
        <span class="question-num">${numLabel}</span>
        <p class="question-text-preview">${escHtml(questionText)}</p>
        <i class="fas fa-chevron-down question-toggle-icon"></i>
      </div>
      <div class="question-answers">
        ${answersHtml}
      </div>
    </div>
  `;
}

function toggleAccordion(type, index) {
  const item = document.getElementById(`accordion-${type}-${index}`);
  if (!item) return;
  item.classList.toggle('open');
}

/* =============================================
   관련 도서
   ============================================= */
function renderRelatedBooks(book, allBooks) {
  const container = document.getElementById('relatedBooks');
  if (!container) return;
  const themes = book.themes || [];

  const related = allBooks
    .filter(b => b.id !== book.id && (b.themes || []).some(t => themes.includes(t)))
    .slice(0, 4);

  if (related.length === 0) {
    const section = container.closest('section');
    if (section) section.style.display = 'none';
    return;
  }

  container.innerHTML = related.map(b => `
    <div class="book-card fade-in" onclick="window.location.href='book.html?id=${encodeURIComponent(b.id)}'"
         role="button" tabindex="0">
      <div class="book-card-cover" style="background-color: ${b.cover_color || '#EEF3FF'}">
        <span>${b.cover_emoji || '📚'}</span>
        <span class="book-card-age">${escHtml(formatAge(b.age_range))}</span>
      </div>
      <div class="book-card-body">
        <p class="book-card-title">${escHtml(b.title)}</p>
        <p class="book-card-author">${escHtml(b.author || '')}</p>
        <div class="book-card-themes">
          ${(b.themes || []).slice(0, 2).map(t => `<span class="theme-tag">${escHtml(t)}</span>`).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

/* =============================================
   탭 기능
   ============================================= */
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`tab-${tabName}`);
      if (panel) panel.classList.add('active');
    });
  });
}

/* =============================================
   햄버거 메뉴
   ============================================= */
function initHamburger() {
  const btn = document.getElementById('hamburger');
  const nav = document.getElementById('mobileNav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => nav.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !nav.contains(e.target)) {
      nav.classList.remove('open');
    }
  });
}

/* =============================================
   스크롤 탑
   ============================================= */
function initScrollTop() {
  const btn = document.getElementById('scrollTop');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
}

/* =============================================
   링크 복사 / 인쇄
   ============================================= */
function copyBookLink() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    showToast('링크가 복사되었습니다! 📋');
  }).catch(() => {
    prompt('아래 링크를 복사하세요:', window.location.href);
  });
}

function printPage() {
  window.print();
}

/* =============================================
   토스트 알림
   ============================================= */
function showToast(message) {
  let toast = document.getElementById('toastMessage');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastMessage';
    toast.style.cssText = `
      position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
      background:#2D3748; color:#fff; padding:12px 24px; border-radius:12px;
      font-size:14px; font-weight:600; z-index:9999;
      box-shadow:0 4px 20px rgba(0,0,0,.2);
      transition:opacity .3s ease;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 2000);
}

/* =============================================
   유틸
   ============================================= */
function getUrlParam(key) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
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

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showError(msg) {
  document.body.innerHTML = `
    <div style="text-align:center;padding:80px 24px;font-family:'Noto Sans KR',sans-serif;">
      <div style="font-size:56px;margin-bottom:16px;">📦</div>
      <p style="font-size:20px;font-weight:700;color:#2D3748;margin-bottom:8px;">${msg}</p>
      <a href="index.html" style="color:#6C9EE8;font-size:15px;text-decoration:underline;">← 목록으로 돌아가기</a>
    </div>
  `;
}
