-- =====================================================================
-- 그림책 질문박스 - 회원 & 의견 시스템 Supabase SQL
-- Supabase Dashboard → SQL Editor → New Query 에서 순서대로 실행하세요
-- =====================================================================


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 1. profiles 테이블 (회원 프로필)
--   Supabase Auth 의 auth.users 와 1:1 연결
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname    TEXT NOT NULL DEFAULT '익명 선생님',
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  avatar_url  TEXT,
  school      TEXT,
  bio         TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- profiles RLS 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 누구나 프로필 읽기 가능
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT USING (true);

-- 본인 프로필만 수정 가능
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 신규 가입 시 profiles 자동 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', '익명 선생님'),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 2. comments 테이블 (책 의견 / 후기)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS public.comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     TEXT NOT NULL,                        -- books.id 참조
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 2 AND 1000),
  rating      SMALLINT CHECK (rating BETWEEN 1 AND 5),  -- 별점 1~5
  comment_type TEXT NOT NULL DEFAULT 'review'
                   CHECK (comment_type IN ('review','question','tip')),
  is_public   BOOLEAN NOT NULL DEFAULT TRUE,
  likes       INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_book_id ON public.comments(book_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);

-- comments RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 공개 댓글은 누구나 읽기 가능
CREATE POLICY "comments_select_public"
  ON public.comments FOR SELECT
  USING (is_public = TRUE);

-- 로그인한 사용자만 작성 가능
CREATE POLICY "comments_insert_auth"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 댓글만 수정 가능
CREATE POLICY "comments_update_own"
  ON public.comments FOR UPDATE
  USING (auth.uid() = user_id);

-- 본인 댓글만 삭제 가능 (관리자도 삭제 가능하도록 추후 확장)
CREATE POLICY "comments_delete_own"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 3. comment_likes 테이블 (좋아요 중복 방지)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(comment_id, user_id)   -- 1인 1좋아요 강제
);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "likes_select_all"  ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "likes_insert_auth" ON public.comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete_own"  ON public.comment_likes FOR DELETE USING (auth.uid() = user_id);

-- 좋아요 수 자동 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.comments SET likes = likes + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.comments SET likes = GREATEST(likes - 1, 0) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_change ON public.comment_likes;
CREATE TRIGGER on_like_change
  AFTER INSERT OR DELETE ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_comment_likes_count();


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 4. opinions 테이블 (사이트 전반 의견 / 제안)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS public.opinions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nickname     TEXT,                                   -- 비로그인 작성 시 임시 닉네임
  category     TEXT NOT NULL DEFAULT 'general'
                    CHECK (category IN ('general','bug','feature','book_request','other')),
  title        TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 100),
  content      TEXT NOT NULL CHECK (char_length(content) BETWEEN 5 AND 2000),
  status       TEXT NOT NULL DEFAULT 'received'
                    CHECK (status IN ('received','reviewing','done','rejected')),
  admin_reply  TEXT,
  is_public    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.opinions ENABLE ROW LEVEL SECURITY;

-- 공개 의견 누구나 읽기
CREATE POLICY "opinions_select_public"
  ON public.opinions FOR SELECT USING (is_public = TRUE);

-- 누구나 (비로그인 포함) 의견 작성 가능
CREATE POLICY "opinions_insert_all"
  ON public.opinions FOR INSERT WITH CHECK (true);

-- 본인 의견만 수정 가능
CREATE POLICY "opinions_update_own"
  ON public.opinions FOR UPDATE
  USING (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 5. bookmarks 테이블 (즐겨찾기)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookmarks_own" ON public.bookmarks
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 6. 댓글 + 프로필 합친 VIEW (편의용)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE VIEW public.comments_with_profile AS
SELECT
  c.id,
  c.book_id,
  c.user_id,
  c.content,
  c.rating,
  c.comment_type,
  c.is_public,
  c.likes,
  c.created_at,
  c.updated_at,
  p.nickname,
  p.avatar_url,
  p.role
FROM public.comments c
LEFT JOIN public.profiles p ON p.id = c.user_id
WHERE c.is_public = TRUE;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 7. updated_at 자동 갱신 트리거
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_comments_updated
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_opinions_updated
  BEFORE UPDATE ON public.opinions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STEP 8. 관리자 계정 설정
-- 사용법: 아래 이메일을 실제 관리자 이메일로 바꾸고 실행
-- (먼저 auth.html 에서 해당 이메일로 회원가입을 완료한 뒤 실행)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ✅ 관리자로 승격할 이메일을 아래에 입력
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = '여기에_관리자_이메일_입력@example.com'
);

-- 확인 쿼리: 현재 관리자 목록
SELECT u.email, p.nickname, p.role, p.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.role = 'admin';


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 완료 확인 쿼리 (테이블 목록)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
