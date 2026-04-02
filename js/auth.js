/**
 * ================================================================
 * auth.js — 그림책 질문박스 인증 모듈
 * Supabase Auth (이메일/비밀번호) 기반 회원가입·로그인·로그아웃
 * 모든 페이지에서 <script src="js/supabase.js"> 다음에 로드
 * ================================================================
 */

// ── 전역 인증 상태 ────────────────────────────────────────────────
const Auth = (() => {
  let _currentUser  = null;   // Supabase Auth user 객체
  let _profile      = null;   // public.profiles 행
  let _listeners    = [];     // 상태 변경 콜백 목록

  // ── 내부 헬퍼: 프로필 가져오기 ─────────────────────────────────
  async function _fetchProfile(userId) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`,
        { headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${_currentUser?.access_token || SUPABASE_ANON_KEY}`
          }
        }
      );
      const data = await res.json();
      return Array.isArray(data) ? data[0] || null : null;
    } catch { return null; }
  }

  // ── 상태 변경 알림 ──────────────────────────────────────────────
  function _notify() {
    _listeners.forEach(fn => fn(_currentUser, _profile));
  }

  // ── 세션 토큰 저장/삭제 ─────────────────────────────────────────
  function _saveSession(session) {
    if (session) {
      localStorage.setItem('sb_access_token',  session.access_token);
      localStorage.setItem('sb_refresh_token', session.refresh_token);
      localStorage.setItem('sb_user',          JSON.stringify(session.user));
    } else {
      localStorage.removeItem('sb_access_token');
      localStorage.removeItem('sb_refresh_token');
      localStorage.removeItem('sb_user');
    }
  }

  // ── 저장된 세션으로 헤더 갱신 ───────────────────────────────────
  function _getAuthHeaders() {
    const token = localStorage.getItem('sb_access_token');
    return {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`,
      'Prefer': 'return=representation'
    };
  }

  // ================================================================
  // PUBLIC API
  // ================================================================
  return {

    // ── 초기화: 페이지 로드 시 저장된 세션 복원 ────────────────────
    async init() {
      try {
        const savedUser  = localStorage.getItem('sb_user');
        const savedToken = localStorage.getItem('sb_access_token');
        if (!savedUser || !savedToken) { _notify(); return; }

        _currentUser = JSON.parse(savedUser);
        _currentUser.access_token = savedToken;

        // 토큰 유효성 검증 (실제 API 호출로 확인)
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${savedToken}`
          }
        });

        if (res.ok) {
          const userData = await res.json();
          _currentUser = { ...userData, access_token: savedToken };
          _profile = await _fetchProfile(userData.id);
        } else {
          // 토큰 만료 → 자동 로그아웃
          _saveSession(null);
          _currentUser = null;
          _profile = null;
        }
      } catch (e) {
        console.warn('[Auth] init 오류:', e.message);
      }
      _notify();
    },

    // ── 회원가입 ─────────────────────────────────────────────────
    async signUp({ email, password, nickname, school = '' }) {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({
          email,
          password,
          data: { nickname, school }   // → profiles 트리거로 자동 삽입
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || data.error_description || '회원가입에 실패했습니다.');

      // 이메일 확인 필요 여부 분기
      if (data.session) {
        // 이메일 확인 OFF 설정인 경우 → 바로 로그인
        _currentUser = { ...data.user, access_token: data.session.access_token };
        _saveSession(data.session);
        _profile = await _fetchProfile(data.user.id);
        _notify();
        return { needsConfirm: false, user: data.user };
      } else {
        // 이메일 확인 ON 설정인 경우
        return { needsConfirm: true, email };
      }
    },

    // ── 로그인 ───────────────────────────────────────────────────
    async signIn({ email, password }) {
      const res = await fetch(
        `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
          body: JSON.stringify({ email, password })
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error_description || data.msg || '이메일 또는 비밀번호가 틀렸습니다.');

      _currentUser = { ...data.user, access_token: data.access_token };
      _saveSession({ ...data, user: data.user });
      _profile = await _fetchProfile(data.user.id);
      _notify();
      return _currentUser;
    },

    // ── 로그아웃 ─────────────────────────────────────────────────
    async signOut() {
      try {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: _getAuthHeaders()
        });
      } catch {}
      _currentUser = null;
      _profile = null;
      _saveSession(null);
      _notify();
    },

    // ── 비밀번호 재설정 메일 발송 ────────────────────────────────
    async resetPassword(email) {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ email })
      });
      if (!res.ok) throw new Error('재설정 메일 발송에 실패했습니다.');
      return true;
    },

    // ── 프로필 수정 ───────────────────────────────────────────────
    async updateProfile({ nickname, school, bio, avatar_url }) {
      if (!_currentUser) throw new Error('로그인이 필요합니다.');
      const body = {};
      if (nickname   !== undefined) body.nickname   = nickname;
      if (school     !== undefined) body.school     = school;
      if (bio        !== undefined) body.bio        = bio;
      if (avatar_url !== undefined) body.avatar_url = avatar_url;

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${_currentUser.id}`,
        { method: 'PATCH', headers: _getAuthHeaders(), body: JSON.stringify(body) }
      );
      if (!res.ok) throw new Error('프로필 수정에 실패했습니다.');
      _profile = { ..._profile, ...body };
      _notify();
      return _profile;
    },

    // ── Getter ────────────────────────────────────────────────────
    getUser()        { return _currentUser; },
    getProfile()     { return _profile; },
    isLoggedIn()     { return !!_currentUser; },
    isAdmin()        { return _profile?.role === 'admin'; },
    getAuthHeaders() { return _getAuthHeaders(); },

    getNickname() {
      return _profile?.nickname
        || _currentUser?.user_metadata?.nickname
        || '익명 선생님';
    },

    // ── 상태 변경 리스너 등록/해제 ───────────────────────────────
    onChange(fn)       { _listeners.push(fn); },
    offChange(fn)      { _listeners = _listeners.filter(l => l !== fn); },
  };
})();


// ================================================================
// 공통 헤더 UI 업데이트 — 모든 페이지에서 auth.js 로드 시 자동 적용
// ================================================================
function updateHeaderAuthUI(user, profile) {
  const isAdmin = profile?.role === 'admin';
  const nick    = profile?.nickname || user?.user_metadata?.nickname || '선생님';

  // ── 비로그인 버튼 ──
  document.querySelectorAll('.h-btn-login').forEach(el  => el.style.display = user ? 'none' : 'inline-flex');
  document.querySelectorAll('.h-btn-signup').forEach(el => el.style.display = user ? 'none' : 'inline-flex');

  // ── 로그인 후 유저 메뉴 ──
  document.querySelectorAll('.h-user-menu').forEach(el  => el.style.display = user ? 'flex'  : 'none');

  // ── 닉네임·아바타 ──
  document.querySelectorAll('.h-user-name').forEach(el   => el.textContent = nick);
  document.querySelectorAll('.h-user-avatar').forEach(el => {
    el.textContent = nick.charAt(0);
    // 아바타 배경색 — 닉네임 해시
    const colors = ['#A8C5F5','#FFB3CC','#B5EAD7','#FFD08A','#C7B3F5'];
    let h = 0; for (const c of nick) h = c.charCodeAt(0) + ((h<<5)-h);
    el.style.background = colors[Math.abs(h) % colors.length];
  });

  // ── 관리자 메뉴 항목 (role=admin 일 때만 표시) ──
  document.querySelectorAll('.h-admin-only').forEach(el  => el.style.display = (user && isAdmin) ? '' : 'none');

  // ── 모바일 메뉴 로그인 링크 텍스트 변경 ──
  const mobileAuthLink = document.getElementById('mobileAuthLink');
  if (mobileAuthLink) {
    if (user) {
      mobileAuthLink.textContent = `👤 ${nick}`;
      mobileAuthLink.href = '#';
      mobileAuthLink.onclick = async (e) => { e.preventDefault(); await Auth.signOut(); location.href='index.html'; };
    } else {
      mobileAuthLink.textContent = '🔑 로그인 / 가입';
      mobileAuthLink.href = 'auth.html';
      mobileAuthLink.onclick = null;
    }
  }
}

// ── 관리자 전용 페이지 접근 제어 (admin.html 에서 호출) ──────────
function requireAdmin() {
  Auth.onChange((user, profile) => {
    if (!user) {
      // 비로그인 → 로그인 페이지로
      location.href = `auth.html?redirect=${encodeURIComponent(location.href)}`;
    } else if (profile && profile.role !== 'admin') {
      // 로그인했지만 일반 유저 → 홈으로
      alert('관리자 권한이 필요합니다.\n관리자 계정으로 로그인해주세요.');
      location.href = 'index.html';
    }
    // role=admin 이면 그대로 유지
  });
}

// ── 페이지 로드 시 자동 실행 ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  Auth.onChange(updateHeaderAuthUI);
  await Auth.init();

  // 로그아웃 버튼 (공통 id: headerLogoutBtn)
  document.getElementById('headerLogoutBtn')?.addEventListener('click', async () => {
    await Auth.signOut();
    location.href = 'index.html';
  });

  // 드롭다운 토글
  const menuBtn  = document.getElementById('headerUserMenuBtn');
  const dropdown = document.getElementById('headerUserDropdown');
  if (menuBtn && dropdown) {
    menuBtn.addEventListener('click', e => { e.stopPropagation(); dropdown.classList.toggle('open'); });
    document.addEventListener('click', () => dropdown.classList.remove('open'));
  }

  // 모바일 햄버거
  const ham = document.getElementById('hamburger');
  const mob = document.getElementById('mobileNav');
  if (ham && mob) {
    ham.addEventListener('click', () => mob.classList.toggle('open'));
  }
});
