# 📦 그림책 질문박스

> **초등 창의논술 강사를 위한 그림책 질문 아카이브 플랫폼**  
> 300권의 그림책 창의 질문과 아이들의 목소리를 한곳에 모았습니다.

---

## 🌐 사이트 구조

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 메인 홈 | `/index.html` | 도서 그리드, 검색/필터, 오늘의 질문 |
| 책 상세 | `/book.html?id={bookId}` | 창의 질문, 아이들 질문, 수업 가이드 탭 |
| 관리자 | `/admin.html` | 도서 추가/수정/삭제 CRUD 관리 |

---

## ✅ 현재 구현된 기능

### 🔍 메인 페이지 (index.html)
- **도서 그리드**: 12개씩 페이지네이션, 카드 클릭 시 상세 페이지 이동
- **추천 도서 배너**: is_featured=true인 도서 가로 스크롤
- **오늘의 창의 질문**: 랜덤 질문 표시, 새로고침 버튼
- **주제별 필터**: 용기, 우정, 가족, 감정 등 15개 주제 칩
- **연령대 필터**: 유아/저학년/중학년/고학년
- **키워드 검색**: 제목, 저자, 줄거리, 키워드, 주제 통합 검색 (디바운스 200ms)
- **정렬**: 기본/제목순/최신순/연도순
- **스크롤 탑 버튼**
- **반응형 모바일 메뉴**

### 📖 책 상세 페이지 (book.html?id=...)
- **책 정보 헤더**: 표지 이모지, 연령대, 출판연도, 저자, 줄거리, 주제/키워드 태그
- **스티키 탭 메뉴**: 창의 질문 / 아이들 질문 / 수업 가이드
- **질문 아코디언**: 클릭 시 답변 사례 펼치기/접기
- **강사 맞춤 수업 팁** 표시
- **수업 가이드**: STEP 1~3 안내
- **관련 도서**: 같은 주제의 도서 4개 표시
- **링크 복사 / 인쇄 기능**

### ⚙️ 관리자 페이지 (admin.html)
- **대시보드**: 전체/추천/질문 수 통계, 연령대별 도서 분포 차트
- **도서 목록**: 검색, 테이블 뷰
- **도서 추가**: 전체 필드 폼, 배열 필드 동적 추가/삭제
- **도서 수정**: 기존 데이터 불러와 수정
- **도서 삭제**: 확인 모달 후 삭제

---

## 🗄️ 데이터베이스 스키마 (books 테이블)

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `id` | text | 고유 ID (예: book001) |
| `title` | text | 책 제목 |
| `author` | text | 저자 |
| `illustrator` | text | 그림 작가 |
| `publisher` | text | 출판사 |
| `year` | number | 출판연도 |
| `age_range` | text | 권장 연령대 |
| `themes` | array | 주제 태그 |
| `keywords` | array | 키워드 |
| `synopsis` | rich_text | 줄거리 |
| `cover_color` | text | 표지 배경색 (HEX) |
| `cover_emoji` | text | 표지 이모지 |
| `creative_questions` | array | 강사의 창의 질문 3개 |
| `kids_questions` | array | 아이들 질문 리스트 |
| `is_featured` | bool | 추천 도서 여부 |
| `lesson_tips` | rich_text | 수업 활용 팁 |

**API 엔드포인트:**
```
GET    tables/books?limit=300&sort=title
POST   tables/books
PUT    tables/books/{id}
DELETE tables/books/{id}
```

---

## 🚀 GitHub + Vercel 배포 가이드

### 1단계: GitHub 레포지토리 생성

```bash
# 터미널에서 실행
git init
git add .
git commit -m "feat: 그림책 질문박스 초기 구현"
git remote add origin https://github.com/YOUR_USERNAME/picture-book-question-box.git
git push -u origin main
```

### 2단계: Vercel 배포

1. [vercel.com](https://vercel.com) 접속 → GitHub로 로그인
2. **New Project** 클릭
3. GitHub 레포지토리 선택
4. Framework: **Other (Static Site)**
5. **Deploy** 클릭 → 자동 배포 완료

> **무료 도메인**: `https://picture-book-question-box.vercel.app`

### 3단계: 커스텀 도메인 연결 (선택)

Vercel Dashboard → Settings → Domains → 도메인 추가

---

## 🛠️ 향후 개발 예정 기능

### 단기 (1-2개월)
- [ ] 답변 추가/관리 기능 (kids_answers 테이블)
- [ ] 이미지 표지 업로드 지원
- [ ] 책 ID 중복 체크 로직 강화

### 중기 (3-6개월)
- [ ] 수업 플랜 PDF 자동 생성
- [ ] 학년별 맞춤 활동지 템플릿
- [ ] 수업 후기 공유 게시판

### 장기
- [ ] 회원가입/로그인 (강사 계정)
- [ ] 강사별 즐겨찾기 목록
- [ ] AI 질문 추천 기능

---

## 📁 파일 구조

```
/
├── index.html          # 메인 페이지
├── book.html           # 책 상세 페이지
├── admin.html          # 관리자 페이지
├── css/
│   └── style.css       # 통합 스타일시트 (파스텔 에듀테크 디자인)
└── js/
    ├── main.js         # 메인 페이지 로직
    ├── book.js         # 책 상세 페이지 로직
    └── data.js         # 로컬 샘플 데이터 (API 폴백용)
```

---

## 💡 로컬 개발 환경 설정

```bash
# 간단히 Live Server 사용 (VS Code 확장)
# 또는

npx serve .
# → http://localhost:3000
```

---

## 📝 운영 가이드

### 도서 추가하기
1. `/admin.html` 접속
2. 좌측 메뉴 **도서 추가** 클릭
3. 폼 작성 후 저장

### 데이터 백업
- 현재는 내장 DB 사용
- 향후 Supabase 연동 시 자동 백업 지원 예정

---

*© 2025 그림책 질문박스. 초등 창의논술 수업을 위한 질문 아카이브.*
