/**
 * ================================================================
 * comments.js — 그림책 질문박스 댓글 / 의견 모듈
 * - 책 상세 페이지에서 "의견 남기기" 섹션 렌더링
 * - Supabase comments_with_profile VIEW 사용
 * - 로그인 사용자만 작성·삭제 가능 (비로그인은 읽기만)
 * ================================================================
 */

const Comments = (() => {

  // ── 댓글 목록 가져오기 (Supabase VIEW) ─────────────────────────
  async function fetchComments(bookId) {
    const url = `${SUPABASE_URL}/rest/v1/comments_with_profile`
      + `?book_id=eq.${encodeURIComponent(bookId)}`
      + `&order=created_at.desc`
      + `&limit=100`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (!res.ok) throw new Error('댓글을 불러오지 못했습니다.');
    return await res.json();
  }

  // ── 댓글 작성 ──────────────────────────────────────────────────
  async function postComment({ bookId, content, rating, commentType = 'review' }) {
    if (!Auth.isLoggedIn()) throw new Error('로그인이 필요합니다.');
    const user = Auth.getUser();

    const res = await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
      method: 'POST',
      headers: Auth.getAuthHeaders(),
      body: JSON.stringify({
        book_id: bookId,
        user_id: user.id,
        content,
        rating: rating || null,
        comment_type: commentType,
        is_public: true
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || '댓글 작성에 실패했습니다.');
    }
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  }

  // ── 댓글 삭제 ──────────────────────────────────────────────────
  async function deleteComment(commentId) {
    if (!Auth.isLoggedIn()) throw new Error('로그인이 필요합니다.');
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/comments?id=eq.${commentId}`,
      { method: 'DELETE', headers: Auth.getAuthHeaders() }
    );
    if (!res.ok) throw new Error('삭제에 실패했습니다.');
    return true;
  }

  // ── 좋아요 토글 ────────────────────────────────────────────────
  async function toggleLike(commentId) {
    if (!Auth.isLoggedIn()) throw new Error('로그인이 필요합니다.');
    const user = Auth.getUser();

    // 이미 좋아요 눌렀는지 확인
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/comment_likes?comment_id=eq.${commentId}&user_id=eq.${user.id}`,
      { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${localStorage.getItem('sb_access_token') || SUPABASE_ANON_KEY}` } }
    );
    const existing = await checkRes.json();

    if (existing && existing.length > 0) {
      // 좋아요 취소
      await fetch(
        `${SUPABASE_URL}/rest/v1/comment_likes?comment_id=eq.${commentId}&user_id=eq.${user.id}`,
        { method: 'DELETE', headers: Auth.getAuthHeaders() }
      );
      return false; // liked = false
    } else {
      // 좋아요 추가
      await fetch(`${SUPABASE_URL}/rest/v1/comment_likes`, {
        method: 'POST',
        headers: Auth.getAuthHeaders(),
        body: JSON.stringify({ comment_id: commentId, user_id: user.id })
      });
      return true; // liked = true
    }
  }

  // ── 날짜 포맷 ──────────────────────────────────────────────────
  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60)   return '방금 전';
    if (diff < 3600) return `${Math.floor(diff/60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff/3600)}시간 전`;
    if (diff < 86400*7) return `${Math.floor(diff/86400)}일 전`;
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  }

  // ── 별점 렌더링 ────────────────────────────────────────────────
  function renderStars(rating) {
    if (!rating) return '';
    return Array.from({ length: 5 }, (_, i) =>
      `<span style="color:${i < rating ? '#F6AD55' : '#E2E8F0'}">★</span>`
    ).join('');
  }

  // ── 댓글 유형 뱃지 ─────────────────────────────────────────────
  function typeBadge(type) {
    const map = {
      review:   { label: '후기', color: '#EEF3FF', text: '#4A6FA5' },
      question: { label: '질문', color: '#FFF8E8', text: '#C07000' },
      tip:      { label: '수업팁', color: '#F0FFF4', text: '#276749' }
    };
    const t = map[type] || map.review;
    return `<span style="background:${t.color};color:${t.text};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;">${t.label}</span>`;
  }

  // ── 아바타 색상 ─────────────────────────────────────────────────
  function avatarColor(str) {
    const colors = ['#A8C5F5','#FFB3CC','#B5EAD7','#FFD08A','#C7B3F5','#FFDBB5','#B5D8F7'];
    let hash = 0;
    for (let i = 0; i < (str||'').length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  // ── HTML escape ────────────────────────────────────────────────
  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── 댓글 카드 HTML ─────────────────────────────────────────────
  function renderCommentCard(c, currentUserId) {
    const nick  = esc(c.nickname || '익명 선생님');
    const isOwn = currentUserId && c.user_id === currentUserId;
    const bg    = avatarColor(c.nickname || c.user_id);

    return `
    <div class="comment-card" data-id="${c.id}">
      <div class="comment-header">
        <div class="comment-avatar" style="background:${bg}">${nick.charAt(0)}</div>
        <div class="comment-meta">
          <span class="comment-nick">${nick}</span>
          ${typeBadge(c.comment_type)}
          ${c.rating ? `<span class="comment-stars">${renderStars(c.rating)}</span>` : ''}
          <span class="comment-date">${formatDate(c.created_at)}</span>
        </div>
        ${isOwn ? `
          <button class="comment-del-btn" onclick="Comments.handleDelete('${c.id}')" title="삭제">
            <i class="fas fa-trash"></i>
          </button>
        ` : ''}
      </div>
      <p class="comment-content">${esc(c.content).replace(/\n/g,'<br>')}</p>
      <div class="comment-footer">
        <button class="comment-like-btn" data-id="${c.id}" onclick="Comments.handleLike(this, '${c.id}')">
          <i class="fas fa-heart"></i>
          <span class="like-count">${c.likes || 0}</span>
        </button>
      </div>
    </div>`;
  }

  // ── 메인 렌더 함수 (섹션 전체 마운트) ─────────────────────────
  async function mount(containerId, bookId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 로딩 표시
    container.innerHTML = `
      <div class="comments-loading">
        <i class="fas fa-spinner fa-spin"></i> 의견을 불러오는 중...
      </div>`;

    let comments = [];
    try {
      comments = await fetchComments(bookId);
    } catch (e) {
      container.innerHTML = `<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:24px;">의견을 불러오지 못했습니다.</p>`;
      return;
    }

    const user = Auth.getUser();
    const profile = Auth.getProfile();
    const isLoggedIn = Auth.isLoggedIn();

    container.innerHTML = `
      <!-- 작성 폼 -->
      <div class="comment-form-wrap" id="commentFormWrap">
        ${isLoggedIn ? `
          <div class="comment-form">
            <div class="comment-form-avatar" style="background:${avatarColor(profile?.nickname || '')}">
              ${(profile?.nickname || '?').charAt(0)}
            </div>
            <div class="comment-form-body">
              <div class="comment-type-row">
                <label class="comment-type-label">유형</label>
                <select id="commentType" class="comment-type-select">
                  <option value="review">📝 후기</option>
                  <option value="tip">💡 수업팁</option>
                  <option value="question">❓ 질문</option>
                </select>
                <label class="comment-type-label" style="margin-left:12px;">별점</label>
                <div class="star-picker" id="starPicker">
                  ${[1,2,3,4,5].map(n => `<span class="star-pick" data-v="${n}" onclick="Comments.pickStar(${n})">★</span>`).join('')}
                </div>
                <span id="starValue" style="display:none;">0</span>
              </div>
              <textarea
                id="commentInput"
                class="comment-textarea"
                placeholder="이 책으로 수업한 경험, 질문, 팁을 나눠주세요! (최대 1000자)"
                rows="3"
                maxlength="1000"
                oninput="Comments.updateCharCount(this)"
              ></textarea>
              <div class="comment-form-actions">
                <span class="char-count" id="charCount">0 / 1000</span>
                <button class="btn btn-primary btn-sm" onclick="Comments.handleSubmit('${bookId}')">
                  <i class="fas fa-paper-plane"></i> 의견 남기기
                </button>
              </div>
            </div>
          </div>
        ` : `
          <div class="comment-login-prompt">
            <i class="fas fa-comment-dots" style="font-size:28px;color:var(--primary-light);margin-bottom:10px;display:block;"></i>
            <p>의견을 남기려면 로그인이 필요합니다.</p>
            <a href="auth.html?redirect=${encodeURIComponent(location.href)}" class="btn btn-primary btn-sm" style="margin-top:12px;">
              <i class="fas fa-sign-in-alt"></i> 로그인 / 회원가입
            </a>
          </div>
        `}
      </div>

      <!-- 구분 -->
      <div class="comments-header-row">
        <span class="comments-count">
          <i class="fas fa-comments"></i>
          의견 <strong>${comments.length}</strong>개
        </span>
      </div>

      <!-- 댓글 목록 -->
      <div class="comments-list" id="commentsList">
        ${comments.length === 0
          ? `<div class="comments-empty">
               <div style="font-size:32px;margin-bottom:10px;">💬</div>
               <p>아직 의견이 없어요.<br>첫 번째로 의견을 남겨보세요!</p>
             </div>`
          : comments.map(c => renderCommentCard(c, user?.id)).join('')
        }
      </div>
    `;
  }

  // ── 별점 선택 ──────────────────────────────────────────────────
  function pickStar(n) {
    document.getElementById('starValue').textContent = n;
    document.querySelectorAll('.star-pick').forEach((el, i) => {
      el.classList.toggle('active', i < n);
    });
  }

  // ── 글자 수 카운트 ─────────────────────────────────────────────
  function updateCharCount(el) {
    const counter = document.getElementById('charCount');
    if (counter) counter.textContent = `${el.value.length} / 1000`;
  }

  // ── 댓글 제출 핸들러 ───────────────────────────────────────────
  async function handleSubmit(bookId) {
    if (!Auth.isLoggedIn()) {
      window.location.href = `auth.html?redirect=${encodeURIComponent(location.href)}`;
      return;
    }
    const input   = document.getElementById('commentInput');
    const content = input?.value.trim();
    const type    = document.getElementById('commentType')?.value || 'review';
    const rating  = parseInt(document.getElementById('starValue')?.textContent || '0') || null;

    if (!content || content.length < 2) {
      alert('의견을 2자 이상 입력해주세요.');
      return;
    }

    try {
      const saved = await postComment({ bookId, content, rating, commentType: type });
      // 목록 맨 위에 추가
      const list = document.getElementById('commentsList');
      const profile = Auth.getProfile();
      const user = Auth.getUser();
      const newCard = renderCommentCard({
        ...saved,
        nickname: profile?.nickname || '선생님',
        avatar_url: profile?.avatar_url || null
      }, user?.id);

      // 빈 상태 메시지 제거
      const empty = list.querySelector('.comments-empty');
      if (empty) empty.remove();

      list.insertAdjacentHTML('afterbegin', newCard);

      // 카운트 업데이트
      const countEl = document.querySelector('.comments-count strong');
      if (countEl) countEl.textContent = parseInt(countEl.textContent || '0') + 1;

      // 입력 초기화
      input.value = '';
      updateCharCount(input);
      pickStar(0);
    } catch (err) {
      alert(err.message);
    }
  }

  // ── 댓글 삭제 핸들러 ───────────────────────────────────────────
  async function handleDelete(commentId) {
    if (!confirm('댓글을 삭제할까요?')) return;
    try {
      await deleteComment(commentId);
      const card = document.querySelector(`.comment-card[data-id="${commentId}"]`);
      if (card) {
        card.style.opacity = '0';
        card.style.transform = 'scale(.97)';
        card.style.transition = '.2s';
        setTimeout(() => card.remove(), 200);
      }
      // 카운트 업데이트
      const countEl = document.querySelector('.comments-count strong');
      if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent || '1') - 1);
    } catch (err) {
      alert(err.message);
    }
  }

  // ── 좋아요 핸들러 ──────────────────────────────────────────────
  async function handleLike(btn, commentId) {
    if (!Auth.isLoggedIn()) {
      window.location.href = `auth.html?redirect=${encodeURIComponent(location.href)}`;
      return;
    }
    try {
      const liked = await toggleLike(commentId);
      const countEl = btn.querySelector('.like-count');
      const current = parseInt(countEl.textContent || '0');
      countEl.textContent = liked ? current + 1 : Math.max(0, current - 1);
      btn.classList.toggle('liked', liked);
    } catch (err) {
      alert(err.message);
    }
  }

  return { mount, handleSubmit, handleDelete, handleLike, pickStar, updateCharCount };
})();
