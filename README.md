# 📦 그림책 질문박스

> 초등 창의논술 강사를 위한 그림책 질문 아카이브 플랫폼

---

## 📁 파일 구조

```
/
├── index.html          # 메인 (도서 그리드, 검색/필터, 오늘의 질문 슬라이더)
├── book.html           # 책 상세 (창의질문, 아이들 질문, 수업가이드, 댓글)
├── auth.html           # 로그인 / 회원가입
├── admin.html          # 관리자 CRUD (도서 추가/수정/삭제)
│
├── css/
│   ├── style.css       # 공통 스타일 전체
│   └── admin.css       # 관리자 전용 스타일
│
├── js/
│   ├── supabase.js     # Supabase 연결 설정 + SupabaseClient 클래스
│   ├── auth.js         # 회원가입·로그인·로그아웃 + 헤더 UI
│   ├── main.js         # 메인 페이지 로직 (그리드, 검색, 필터, 슬라이더)
│   ├── book.js         # 책 상세 페이지 로직
│   ├── admin.js        # 관리자 CRUD 로직
│   └── comments.js     # 댓글 CRUD 로직
│
├── supabase_setup.sql      # books 테이블 생성 SQL
└── supabase_auth_setup.sql # profiles 테이블 + 인증 설정 SQL
```

---

## ✅ 구현된 기능

### 메인 페이지 (index.html)
- 도서 그리드 (12개 페이지네이션)
- 연령대 필터 (위) + 주제 필터 (아래)
- 키워드 검색 (디바운스 200ms)
- 정렬 (기본/제목/최신/연도)
- 오늘의 질문 슬라이더 (4장, 5초 자동 + 클릭/스와이프)
- 추천 도서 배너
- 그림책 질문박스란? 소개 섹션

### 메뉴 구조 (전체 페이지 통일)
```
오늘의 질문 | 도서 목록 | 그림책 질문박스란?    [로그인] [가입]
                                               또는 [닉네임▼]
```
- 로고 클릭 → 홈(index.html)
- 관리자 계정: 닉네임 드롭다운에 ⚙️ 관리자 페이지 자동 노출

### 인증 (auth.html + js/auth.js)
- 이메일/비밀번호 회원가입·로그인
- Supabase profiles 테이블 연동 (nickname, role, school)
- role = 'admin' 계정만 admin.html 접근 가능

### 관리자 (admin.html + js/admin.js)
- 도서 목록 테이블 (검색, 수정, 삭제)
- 도서 추가/수정 모달 폼 (전체 필드)
- 대시보드: 통계 카드 + 연령별 바 차트

### 책 상세 (book.html + js/book.js)
- 창의 질문 3종 / 아이들 질문 / 수업 가이드 탭
- 댓글 (로그인 필요, 별점 포함)
- 관련 도서 추천

---

## 🗄️ 데이터베이스 (Supabase)

**데이터 소스: Supabase 전용** (로컬 샘플 데이터 없음)

### books 테이블 주요 필드
| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| title | text | 제목 |
| author | text | 저자 |
| age_range | text | 연령대 |
| themes | text[] | 주제 태그 |
| creative_questions | text[] | 창의 질문 (최대 5) |
| kids_questions | text[] | 아이들 질문 |
| is_featured | bool | 추천 도서 여부 |
| cover_emoji | text | 표지 이모지 |
| cover_color | text | 표지 배경색 |

---

## 🚀 관리자 계정 설정

1. `auth.html`에서 관리자 이메일로 회원가입
2. Supabase SQL Editor에서 실행:
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = '관리자이메일@example.com');
```
3. 로그인 후 닉네임 드롭다운 → ⚙️ 관리자 페이지 접속

---

## 🌐 배포 (GitHub → Vercel)

1. GitHub 저장소 생성 후 `git push`
2. [vercel.com](https://vercel.com) → New Project → GitHub 저장소 연결
3. Framework: **Other** (Static Site) 선택 → Deploy
4. 자동 배포: `main` 브랜치 push 시 자동 재배포

---

## 📅 업데이트 이력
- 2025-04-02: Supabase 전용으로 전환 (data.js 제거, 폴백 코드 삭제)
- 2025-04-02: 메뉴 3개 통일, 오늘의 질문 슬라이더, 필터 순서 변경
- 2025-04-02: admin.html CSS/JS 외부 파일 분리 (40KB → 12KB)
