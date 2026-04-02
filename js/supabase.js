/**
 * =====================================================
 * Supabase 연동 설정
 * =====================================================
 * 아래 두 줄을 본인 Supabase 프로젝트 정보로 교체하세요!
 * Supabase 대시보드 → Project Settings → API 에서 확인
 * =====================================================
 */

const SUPABASE_URL = 'https://kqsnkutvscypmihtvblg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtxc25rdXR2c2N5cG1paHR2YmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMDg0MTEsImV4cCI6MjA5MDY4NDQxMX0.kEGXwzR8B5T63fnq_xq89Lyy5n6nVbjXL3OxGCStkT0';

// =====================================================
// Supabase API 헬퍼 클래스
// =====================================================
class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.headers = {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': 'return=representation'
    };
  }

  // ── 전체 조회 ──────────────────────────────────────
  async getAll(table, options = {}) {
    let url = `${this.url}/rest/v1/${table}?select=*`;
    if (options.order)  url += `&order=${options.order}`;
    if (options.limit)  url += `&limit=${options.limit}`;
    if (options.filter) url += `&${options.filter}`;

    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) throw new Error(`GET 실패: ${res.status}`);
    return await res.json();
  }

  // ── 단건 조회 ──────────────────────────────────────
  async getOne(table, id) {
    const res = await fetch(
      `${this.url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`GET 실패: ${res.status}`);
    const data = await res.json();
    return data[0] || null;
  }

  // ── 추가 (INSERT) ──────────────────────────────────
  async insert(table, row) {
    const res = await fetch(`${this.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(row)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `INSERT 실패: ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  }

  // ── 수정 (UPDATE) ──────────────────────────────────
  async update(table, id, row) {
    const res = await fetch(
      `${this.url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify(row)
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `UPDATE 실패: ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  }

  // ── 삭제 (DELETE) ──────────────────────────────────
  async delete(table, id) {
    const res = await fetch(
      `${this.url}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,
      { method: 'DELETE', headers: this.headers }
    );
    if (!res.ok) throw new Error(`DELETE 실패: ${res.status}`);
    return true;
  }

  // ── 텍스트 검색 ────────────────────────────────────
  async search(table, column, query) {
    const res = await fetch(
      `${this.url}/rest/v1/${table}?${column}=ilike.*${encodeURIComponent(query)}*&select=*`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error(`SEARCH 실패: ${res.status}`);
    return await res.json();
  }
}

// ── 전역 클라이언트 인스턴스 생성 ──────────────────────
const db = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── 연결 상태 확인 ─────────────────────────────────────
async function checkSupabaseConnection() {
  try {
    await db.getAll('books', { limit: 1 });
    console.log('✅ Supabase 연결 성공!');
    return true;
  } catch (e) {
    console.warn('⚠️ Supabase 연결 실패, 로컬 샘플 데이터 사용:', e.message);
    return false;
  }
}
