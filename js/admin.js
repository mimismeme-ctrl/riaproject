/* ================================================================
   admin.js — 그림책 질문박스 관리자 페이지 전체 로직
================================================================ */

let allAdminBooks = [];
let filteredAdminBooks = [];
let deleteTargetId = null;
let editingBookId = null;

/* ── 초기화 ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await loadAdminBooks();
  updateDashboard();
  renderAdminTable(allAdminBooks);

  // 모달 외부 클릭 닫기
  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', (e) => {
      if (e.target === bd) closeModal(bd.id);
    });
  });
});

/* ── 데이터 로드 — Supabase 전용 ────────────────────────────── */
async function loadAdminBooks() {
  try {
    const books = await db.getAll('books', { order: 'title.asc' });
    allAdminBooks = books || [];
  } catch (e) {
    allAdminBooks = [];
    showAlert('error', `DB 연결 실패: ${e.message}`);
  }
  filteredAdminBooks = [...allAdminBooks];
  updateSidebarCount();
}

function updateSidebarCount() {
  const el = document.getElementById('sidebarBookCount');
  if (el) el.textContent = allAdminBooks.length;
}

/* ── 대시보드 ────────────────────────────────────────────────── */
function updateDashboard() {
  document.getElementById('statTotal').textContent = allAdminBooks.length;
  document.getElementById('statFeatured').textContent = allAdminBooks.filter(b => b.is_featured).length;
  const totalQ  = allAdminBooks.reduce((s, b) => s + (b.creative_questions || []).length, 0);
  const totalKQ = allAdminBooks.reduce((s, b) => s + (b.kids_questions || []).length, 0);
  document.getElementById('statQuestions').textContent = totalQ;
  document.getElementById('statKidsQ').textContent = totalKQ;
  renderAgeChart();
}

function renderAgeChart() {
  const chart = document.getElementById('ageChart');
  if (!chart) return;
  const ageMap = {};
  allAdminBooks.forEach(b => { const a = b.age_range || '미분류'; ageMap[a] = (ageMap[a] || 0) + 1; });
  const max = Math.max(...Object.values(ageMap), 1);
  const colors = { '유아(3-5세)':'#FFB3CC','저학년(6-8세)':'#A8C5F5','중학년(9-10세)':'#FFD08A','고학년(11-13세)':'#B5EAD7','전연령':'#C7B3F5' };
  chart.innerHTML = Object.entries(ageMap).map(([age, count]) => `
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="width:120px;font-size:13px;color:var(--text-muted);flex-shrink:0;">${age}</div>
      <div style="flex:1;height:28px;background:#F7F9FF;border-radius:6px;overflow:hidden;">
        <div style="width:${(count/max)*100}%;height:100%;background:${colors[age]||'#A8C5F5'};border-radius:6px;display:flex;align-items:center;padding:0 10px;font-size:12px;font-weight:700;color:#2D3748;transition:width .5s ease;">${count}권</div>
      </div>
    </div>`).join('');
}

/* ── 테이블 렌더링 ───────────────────────────────────────────── */
function renderAdminTable(books) {
  const tbody   = document.getElementById('booksTableBody');
  const countEl = document.getElementById('adminBookCount');
  if (countEl) countEl.textContent = `총 ${books.length}권`;

  if (!books.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty"><div class="empty-icon">🔍</div><p>도서를 찾을 수 없습니다</p></td></tr>`;
    return;
  }
  tbody.innerHTML = books.map(book => {
    const themes = (book.themes || []).slice(0, 3).map(t => `<span class="mini-tag">${escHtml(t)}</span>`).join('');
    return `
      <tr>
        <td><div class="book-mini-cover" style="background-color:${book.cover_color||'#EEF3FF'}">${book.cover_emoji||'📚'}</div></td>
        <td><p class="tbl-title">${escHtml(book.title)}</p><p class="tbl-author">${escHtml(book.author||'')}</p></td>
        <td><span class="tbl-badge">${escHtml(book.age_range||'-')}</span></td>
        <td><div class="tag-list">${themes}</div></td>
        <td style="text-align:center;font-weight:700;color:var(--primary);">${(book.creative_questions||[]).length}</td>
        <td style="text-align:center;font-weight:700;color:var(--accent);">${(book.kids_questions||[]).length}</td>
        <td style="text-align:center;">${book.is_featured ? '<span class="tbl-badge featured">⭐ 추천</span>' : '-'}</td>
        <td>
          <div class="tbl-actions">
            <button class="icon-btn" onclick="openEditBook('${escHtml(book.id)}')" title="수정"><i class="fas fa-edit"></i></button>
            <button class="icon-btn del" onclick="openDeleteConfirm('${escHtml(book.id)}','${escHtml(book.title)}')" title="삭제"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function filterAdminBooks(query) {
  const q = query.toLowerCase();
  filteredAdminBooks = q
    ? allAdminBooks.filter(b => (b.title||'').toLowerCase().includes(q) || (b.author||'').toLowerCase().includes(q))
    : [...allAdminBooks];
  renderAdminTable(filteredAdminBooks);
}

/* ── 패널 전환 ───────────────────────────────────────────────── */
function switchPanel(panelName, el) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${panelName}`)?.classList.add('active');
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  if (el) el.classList.add('active');
  if (panelName === 'books') renderAdminTable(filteredAdminBooks);
  if (panelName === 'dashboard') updateDashboard();
}

/* ── 모달 ────────────────────────────────────────────────────── */
function openModal(id)  { document.getElementById(id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('open'); document.body.style.overflow = ''; if (id === 'bookModal') clearForm(); }

/* ── 폼 초기화 ───────────────────────────────────────────────── */
function clearForm() {
  editingBookId = null;
  ['editBookId','fTitle','fAuthor','fIllustrator','fPublisher','fYear','fSynopsis','fThemes','fKeywords','fLessonTips'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('modalTitle').textContent = '📖 도서 추가';
  document.getElementById('fAgeRange').value = '';
  document.getElementById('fEmoji').value = '';
  document.getElementById('fCoverColor').value = '#EEF3FF';
  document.getElementById('fColorPicker').value = '#EEF3FF';
  document.getElementById('fFeatured').checked = false;
  document.getElementById('creativeQFields').innerHTML = '';
  document.getElementById('kidsQFields').innerHTML = '';
  addArrayField('creativeQFields', true);
  addArrayField('kidsQFields', false);
}

/* ── 도서 추가 모달 열기 ─────────────────────────────────────── */
function openAddBook() {
  clearForm();
  switchPanel('books', document.querySelector('[data-panel="books"]'));
  openModal('bookModal');
}

/* ── 도서 수정 모달 열기 ─────────────────────────────────────── */
function openEditBook(bookId) {
  const book = allAdminBooks.find(b => b.id === bookId);
  if (!book) return;
  editingBookId = bookId;
  document.getElementById('editBookId').value = bookId;
  document.getElementById('modalTitle').textContent = `✏️ 도서 수정: ${book.title}`;
  document.getElementById('fTitle').value        = book.title        || '';
  document.getElementById('fAuthor').value       = book.author       || '';
  document.getElementById('fIllustrator').value  = book.illustrator  || '';
  document.getElementById('fPublisher').value    = book.publisher    || '';
  document.getElementById('fYear').value         = book.year         || '';
  document.getElementById('fAgeRange').value     = book.age_range    || '';
  document.getElementById('fEmoji').value        = book.cover_emoji  || '';
  document.getElementById('fSynopsis').value     = book.synopsis     || '';
  document.getElementById('fThemes').value       = (book.themes   ||[]).join(', ');
  document.getElementById('fKeywords').value     = (book.keywords ||[]).join(', ');
  document.getElementById('fLessonTips').value   = book.lesson_tips  || '';
  document.getElementById('fFeatured').checked   = !!book.is_featured;
  const color = book.cover_color || '#EEF3FF';
  document.getElementById('fCoverColor').value   = color;
  document.getElementById('fColorPicker').value  = color;

  const cqField = document.getElementById('creativeQFields');
  cqField.innerHTML = '';
  (book.creative_questions || []).forEach(q => addArrayField('creativeQFields', true, q));
  if (!cqField.children.length) addArrayField('creativeQFields', true);

  const kqField = document.getElementById('kidsQFields');
  kqField.innerHTML = '';
  (book.kids_questions || []).forEach(q => addArrayField('kidsQFields', false, q));
  if (!kqField.children.length) addArrayField('kidsQFields', false);

  openModal('bookModal');
}

/* ── 배열 필드 ───────────────────────────────────────────────── */
function addArrayField(containerId, isTextarea = false, value = '') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'array-row';
  row.innerHTML = isTextarea
    ? `<textarea class="form-input" rows="2" placeholder="질문을 입력하세요...">${escHtml(value)}</textarea>
       <button type="button" class="array-del-btn" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`
    : `<input type="text" class="form-input" placeholder="질문을 입력하세요..." value="${escHtml(value)}" />
       <button type="button" class="array-del-btn" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
  container.appendChild(row);
}

function updateColorPicker(hex) {
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) document.getElementById('fColorPicker').value = hex;
}

/* ── 도서 저장 ───────────────────────────────────────────────── */
async function saveBook() {
  const title    = document.getElementById('fTitle').value.trim();
  const author   = document.getElementById('fAuthor').value.trim();
  const ageRange = document.getElementById('fAgeRange').value;
  if (!title || !author || !ageRange) { showAlert('error', '제목, 저자, 연령대는 필수입니다.'); return; }

  const bookData = {
    title, author,
    illustrator:        document.getElementById('fIllustrator').value.trim(),
    publisher:          document.getElementById('fPublisher').value.trim(),
    year:               parseInt(document.getElementById('fYear').value) || null,
    age_range:          ageRange,
    cover_emoji:        document.getElementById('fEmoji').value.trim()      || '📚',
    cover_color:        document.getElementById('fCoverColor').value.trim() || '#EEF3FF',
    synopsis:           document.getElementById('fSynopsis').value.trim(),
    themes:             parseCSV(document.getElementById('fThemes').value),
    keywords:           parseCSV(document.getElementById('fKeywords').value),
    creative_questions: collectField('creativeQFields').filter(v => v.trim()),
    kids_questions:     collectField('kidsQFields').filter(v => v.trim()),
    lesson_tips:        document.getElementById('fLessonTips').value.trim(),
    is_featured:        document.getElementById('fFeatured').checked
  };

  try {
    if (editingBookId) {
      await db.update('books', editingBookId, bookData);
      const idx = allAdminBooks.findIndex(b => b.id === editingBookId);
      if (idx !== -1) allAdminBooks[idx] = { ...allAdminBooks[idx], ...bookData };
    } else {
      bookData.id = 'book_' + Date.now();
      const saved = await db.insert('books', bookData);
      allAdminBooks.unshift(saved || bookData);
    }
    filteredAdminBooks = [...allAdminBooks];
    renderAdminTable(filteredAdminBooks);
    updateDashboard();
    updateSidebarCount();
    closeModal('bookModal');
    showAlert('success', editingBookId ? '✅ 수정되었습니다.' : '✅ 추가되었습니다.');
  } catch (err) {
    showAlert('error', `저장 실패: ${err.message}`);
  }
}

function collectField(id) {
  return Array.from(document.getElementById(id)?.querySelectorAll('input,textarea') || []).map(el => el.value);
}
function parseCSV(str) {
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

/* ── 삭제 ────────────────────────────────────────────────────── */
function openDeleteConfirm(bookId, bookTitle) {
  deleteTargetId = bookId;
  const desc = document.getElementById('confirmDesc');
  if (desc) desc.textContent = `"${bookTitle}" 도서를 삭제하면 복구할 수 없습니다.`;
  openModal('confirmModal');
}

async function executeDelete() {
  if (!deleteTargetId) return;
  try {
    await db.delete('books', deleteTargetId);
    allAdminBooks      = allAdminBooks.filter(b => b.id !== deleteTargetId);
    filteredAdminBooks = filteredAdminBooks.filter(b => b.id !== deleteTargetId);
    renderAdminTable(filteredAdminBooks);
    updateDashboard();
    updateSidebarCount();
    closeModal('confirmModal');
    showAlert('success', '✅ 삭제되었습니다.');
  } catch (err) {
    closeModal('confirmModal');
    showAlert('error', `삭제 실패: ${err.message}`);
  }
  deleteTargetId = null;
}

/* ── 알림 ────────────────────────────────────────────────────── */
function showAlert(type, message) {
  const isOk = type === 'success';
  const el   = document.getElementById(isOk ? 'alertSuccess' : 'alertError');
  const txt  = document.getElementById(isOk ? 'alertSuccessText' : 'alertErrorText');
  if (!el || !txt) return;
  txt.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3500);
  el.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

/* ── HTML escape ─────────────────────────────────────────────── */
function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
