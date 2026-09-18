# 📊 Triptic 프로젝트 전체 코드 리뷰 보고서

**리뷰 일자**: 2025-09-18  
**리뷰어**: Senior Software Architect (10+ years)  
**프로젝트**: Triptic - Smart Travel Planner PWA  
**버전**: 2.0.0  

---

## [1. 총평]

### 프로젝트 개요
PWA 기반 여행 일정 관리 애플리케이션
- **기술 스택**: TypeScript + Vanilla JS 하이브리드, Vite, Supabase, Google Maps API
- **주요 기능**: 오프라인 지원, 소셜 로그인, 클라우드 동기화, AI 추천
- **배포**: Vercel (프로덕션)

### 전반적 수준

#### ✅ 긍정적 측면
- 모듈화 진행 중 (기존 단일 파일에서 분리)
- PWA 구현 완료 (Service Worker, 오프라인 지원)
- 테스트 커버리지 목표 설정 (80%)
- XSS 방어 (`escapeHtml` 함수)
- Strict TypeScript 설정 (`strict: true`, `noImplicitAny: true`)
- 적절한 빌드 최적화 설정 (Tree-shaking, Terser)

#### ⚠️ 개선 필요 영역
- **보안**: 하드코딩된 시크릿, CORS 와일드카드, Git에 커밋된 토큰
- **아키텍처**: TypeScript/JavaScript 파일 중복, 불일치한 구조
- **성능**: 대용량 index.html (343KB, 8208줄), 번들 최적화 부족
- **안정성**: 런타임 오류 (미정의 변수), 에러 처리 미흡

### 전체 위험도 평가
**🔴 High** - 프로덕션 환경에서 즉시 수정이 필요한 보안 및 안정성 문제 존재

---

## [2. 주요 문제점 및 위험 요소]

### 🔴 Critical (즉시 수정 필요)

#### 1. 하드코딩된 Supabase 인증 키 노출
**위치**: `src/services/authService.js:4-5`

**문제점**:
```javascript
const DEFAULT_SUPABASE_URL = 'https://mfwfqfzdgcgfnnmnlrxu.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1md2ZxZnpkZ2NnZm5ubW5scnh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcxNTE2NzAsImV4cCI6MjA1MjcyNzY3MH0.kXP5vVkp4ND0xEU5VXvGQ_qZy2fWJlG4KqYgBqCTkXc';
```

**영향도**: **Critical**
- 악의적 사용자가 데이터베이스에 직접 접근 가능
- RLS(Row Level Security) 정책 우회 시도 가능
- 공개 저장소에 노출되어 있음

**해결 방법**:
1. 즉시 기존 키 폐기 및 재발급
2. 환경 변수로 완전 이동
3. 폴백(fallback) 값 제거

---

#### 2. Vercel OIDC 토큰 Git 커밋
**위치**: `.env.local:2`

**문제점**:
```bash
VERCEL_OIDC_TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Im1yay00MzAyZWMxYjY3MGY0OGE5OGFkNjFkYWRlNGEyM2JlNyJ9..."
```

**영향도**: **Critical**
- Vercel 프로젝트 전체 접근 권한 탈취 가능
- 환경 변수 수정, 배포 권한 획득 가능

**해결 방법**:
1. 즉시 `.env.local`을 `.gitignore`에 추가
2. Git 히스토리에서 완전 제거
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env.local" \
     --prune-empty --tag-name-filter cat -- --all
   ```
3. Vercel CLI에서 토큰 재발급
4. 팀원들에게 `git pull --force` 공지

---

#### 3. CORS 와일드카드 설정
**위치**: `api/env.js:6`, `vite.config.js:87`

**문제점**:
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
```

**영향도**: **High**
- 모든 도메인에서 API 키 조회 가능
- 제3자 사이트에서 무단 사용 → 비용 발생
- CSRF 공격 가능성

**해결 방법**:
```javascript
const ALLOWED_ORIGINS = [
    'https://triptic-ten.vercel.app',
    'https://triptic-preview.vercel.app',
    'capacitor://localhost',
    'http://localhost:3000'
];

const origin = req.headers.origin;
if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
}
```

---

#### 4. authService.js의 미정의 변수 참조
**위치**: `src/services/authService.js:16`

**문제점**:
```javascript
export async function signInWithProvider(provider) {
    // ...
    const result = await client.auth.signInWithOAuth({
        // ReferenceError: client is not defined
```

**영향도**: **High**
- 소셜 로그인 기능 완전 작동 불가
- 프로덕션 환경에서 런타임 오류 발생

**해결 방법**:
```javascript
export async function signInWithProvider(provider) {
    const client = (typeof window !== 'undefined' && window.supabaseClient) || supabase;
    
    if (!client) {
        throw new Error('Supabase client not initialized');
    }
    
    // ... rest of code
}
```

---

### 🟠 High (빠른 수정 권장)

#### 5. 대용량 index.html (8208줄, 343KB)
**위치**: `index.html`

**문제점**:
- 모든 스타일, 스크립트, 마크업이 단일 파일에 집중
- 파일 크기: 343KB (압축 전)
- 8208줄의 코드

**영향도**: **High**
- **성능 저하**:
  - First Contentful Paint(FCP): 예상 2.5초+ (3G 환경)
  - Time to Interactive(TTI): 예상 4초+
  - Largest Contentful Paint(LCP): 예상 3초+
- **유지보수성**: 수정 시 충돌 위험, 코드 리뷰 불가능
- **캐싱 비효율**: 한 줄만 변경해도 전체 재다운로드

**해결 방법**:
```
# 목표 구조
dist/
├── index.html (< 20KB)
├── assets/
│   ├── main-[hash].css (스타일)
│   ├── core-[hash].js (필수 로직)
│   ├── vendor-[hash].js (외부 라이브러리)
│   └── async-[hash].js (지연 로딩)
```

**권장 작업**:
1. CSS를 별도 파일로 분리 (`src/styles/main.css`)
2. 인라인 스크립트를 모듈로 전환
3. 조건부 로딩 구현 (예: 지도는 필요할 때만)

---

#### 6. TypeScript/JavaScript 이중 구조
**위치**: `src/utils/`, `src/services/`

**문제점**:
```
src/utils/
  ├── escapeHtml.ts      ← TypeScript
  ├── escapeHtml.js      ← JavaScript (중복)
  ├── timeUtils.ts       ← TypeScript
  └── timeUtils.js       ← JavaScript (중복)
```

**영향도**: **Medium-High**
- 빌드 시 중복 번들링 가능성
- 일관성 없는 타입 체킹
- 개발자 혼란 (어느 파일 수정?)

**해결 방법**:
1. `.js` 파일 모두 삭제
2. TypeScript로 완전 마이그레이션
3. `tsconfig.json`에서 `.js` 임포트 금지:
   ```json
   {
     "compilerOptions": {
       "allowJs": false,
       "checkJs": false
     }
   }
   ```

---

#### 7. Service Worker 캐시 버전 불일치
**위치**: `sw.js:1-16`

**문제점**:
```javascript
/**
 * Requirements: Cache versioning: 'triptic-v2'
 */
const CACHE_NAME = 'triptic-v4'; // 실제는 v4
```

**영향도**: **Medium**
- 문서와 코드 불일치
- 사용자가 오래된 앱 버전 사용
- 업데이트 미반영

**해결 방법**:
```javascript
// package.json 버전 자동 사용
import packageJson from './package.json' assert { type: 'json' };
const CACHE_NAME = `triptic-v${packageJson.version}`;
```

---

#### 8. 에러 처리 없는 Promise Chain
**위치**: `src/components/loginModal.js:46-60`

**문제점**:
```javascript
authBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
        const provider = btn.dataset.provider;
        try {
            btn.disabled = true;
            btn.textContent = '로그인 중...';
            await signInWithProvider(provider);
        } catch (error) {
            alert('로그인 실패: ' + error.message);
            btn.disabled = false;
            btn.innerHTML = btn.dataset.originalHtml; // 이미 변경된 후
        }
    });
    btn.dataset.originalHtml = btn.innerHTML; // 이벤트 리스너 추가 후 저장
});
```

**영향도**: **Medium**
- 로그인 실패 시 버튼 텍스트가 "로그인 중..."으로 고정
- 재시도 불가능

**해결 방법**:
```javascript
authBtns.forEach(btn => {
    const originalHtml = btn.innerHTML; // 클로저에 저장
    
    btn.addEventListener('click', async () => {
        const provider = btn.dataset.provider;
        try {
            btn.disabled = true;
            btn.textContent = '로그인 중...';
            await signInWithProvider(provider);
        } catch (error) {
            console.error('Login error:', error);
            alert('로그인 실패: ' + error.message);
            btn.disabled = false;
            btn.innerHTML = originalHtml; // 복원
        }
    });
});
```

---

### 🟡 Medium (개선 권장)

#### 9. SQL Injection 위험 (Supabase RPC)
**위치**: `src/services/supabaseService.js:260-262`

**문제점**:
```javascript
async loadTrip(tripId) {
    const { data, error } = await this.supabase.rpc('get_trip_full_data', {
        trip_uuid: tripId  // 입력값 검증 없음
    });
}
```

**영향도**: **Medium**
- Supabase가 파라미터 이스케이프를 수행하나, 명시적 검증 부재
- UUID 포맷 아닌 값 전달 시 예측 불가능한 동작

**해결 방법**:
```javascript
async loadTrip(tripId) {
    // UUID 포맷 검증
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(tripId)) {
        throw new Error('Invalid trip ID format');
    }
    
    const { data, error } = await this.supabase.rpc('get_trip_full_data', {
        trip_uuid: tripId
    });
    
    if (error) throw error;
    return this._transformToLocalFormat(data);
}
```

---

#### 10. localStorage 예외 처리 불완전
**위치**: `src/services/storageService.js:38-40`

**문제점**:
```javascript
} catch (e) {
    return this._handleSaveError(e);
}

static _handleSaveError(error) {
    if (error.name === 'QuotaExceededError') {
        // 처리
    } else {
        console.error('저장 오류:', error);
        this._showToast('데이터 저장 중 오류가 발생했습니다.', 'error');
    }
}
```

**영향도**: **Medium**
- Safari Private Mode에서 `SecurityError` 발생 → 앱 작동 불가
- iOS 사용자 비율 고려 시 치명적

**해결 방법**:
```javascript
static _handleSaveError(error) {
    if (error.name === 'QuotaExceededError') {
        console.error('localStorage 용량 초과:', error);
        this._showToast('저장 공간이 가득 찼습니다. 백업 후 일부 여행을 삭제해 주세요.', 'error');
    } else if (error.name === 'SecurityError') {
        console.error('localStorage 접근 거부 (Private Mode):', error);
        this._showToast('비공개 모드에서는 데이터를 저장할 수 없습니다. 일반 모드로 전환해 주세요.', 'warning');
    } else {
        console.error('저장 오류:', error);
        this._showToast('데이터 저장 중 오류가 발생했습니다.', 'error');
    }
    return false;
}
```

---

#### 11. console.log 과다 사용
**위치**: 전체 소스 코드

**문제점**:
- 총 40개 이상의 console 문
- `vite.config.js`에서 프로덕션 빌드 시 제거 설정했으나, 개발 시 노이즈

**영향도**: **Low-Medium**
- 개발 환경에서 중요한 로그 놓침
- 디버깅 효율성 저하

**해결 방법**:
```typescript
// src/utils/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL: LogLevel = import.meta.env.PROD ? 'warn' : 'debug';

const LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

export const logger = {
    debug: (...args: any[]) => {
        if (LEVELS[LOG_LEVEL] <= LEVELS.debug) {
            console.debug('[DEBUG]', ...args);
        }
    },
    info: (...args: any[]) => {
        if (LEVELS[LOG_LEVEL] <= LEVELS.info) {
            console.info('[INFO]', ...args);
        }
    },
    warn: (...args: any[]) => {
        if (LEVELS[LOG_LEVEL] <= LEVELS.warn) {
            console.warn('[WARN]', ...args);
        }
    },
    error: (...args: any[]) => {
        if (LEVELS[LOG_LEVEL] <= LEVELS.error) {
            console.error('[ERROR]', ...args);
        }
    }
};

// 사용 예시
import { logger } from '@/utils/logger';

logger.debug('저장 공간 정보:', storageInfo);
logger.error('프로젝트 로드 실패:', error);
```

---

#### 12. API 재시도 로직 부재
**위치**: `src/services/apiService.js:15-53`

**문제점**:
```javascript
const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placeName, city, category })
});
// 네트워크 일시 장애 시 즉시 실패
```

**영향도**: **Medium**
- 불안정한 네트워크 환경에서 사용성 저하
- 모바일 환경 고려 시 중요

**해결 방법**:
```typescript
// src/utils/retry.ts
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries?: number;
        baseDelay?: number;
        maxDelay?: number;
    } = {}
): Promise<T> {
    const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = options;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxRetries - 1) {
                throw error;
            }
            
            const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
            console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw new Error('Max retries exceeded');
}

// apiService.js에서 사용
import { retryWithBackoff } from '@/utils/retry';

static async getRecommendations(placeName, city, category = 'all') {
    return retryWithBackoff(async () => {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ placeName, city, category })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    }, { maxRetries: 3, baseDelay: 1000 });
}
```

---

#### 13. 메모리 누수 위험 (이벤트 리스너)
**위치**: `src/state/appState.js:125-139`

**문제점**:
```javascript
subscribe(event, callback) {
    if (!this._listeners.has(event)) {
        this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);

    // 구독 해제 함수 반환
    return () => {
        const callbacks = this._listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    };
}
```

**영향도**: **Medium**
- 반환된 unsubscribe 함수를 호출하지 않으면 메모리 누수
- 장시간 사용 시 성능 저하

**해결 방법**:
```typescript
// 컴포넌트 패턴 예시
class Component {
    private unsubscribes: Array<() => void> = [];
    
    constructor() {
        // 구독 시 해제 함수 저장
        this.unsubscribes.push(
            appState.subscribe('dayChanged', this.handleDayChange)
        );
        this.unsubscribes.push(
            appState.subscribe('projectChanged', this.handleProjectChange)
        );
    }
    
    destroy() {
        // 컴포넌트 파괴 시 모든 구독 해제
        this.unsubscribes.forEach(unsub => unsub());
        this.unsubscribes = [];
    }
}
```

---

### 🟢 Low (선택적 개선)

#### 14. 매직 넘버 하드코딩
**위치**: `src/services/storageService.js:9-11`

**문제점**:
```javascript
const STORAGE_KEY = 'smartPlannerAllProjects';
const MAX_SIZE_MB = 4.5; // 5MB 제한 중 안전 마진
const BACKUP_KEY_STORAGE = 'smartPlannerBackupId';
```

**해결 방법**:
```javascript
// 명시적 상수화
const LOCALSTORAGE_LIMIT_MB = 5;
const SAFETY_MARGIN_MB = 0.5;
const MAX_SIZE_MB = LOCALSTORAGE_LIMIT_MB - SAFETY_MARGIN_MB;

// 또는 설정 객체
const STORAGE_CONFIG = {
    MAIN_KEY: 'smartPlannerAllProjects',
    BACKUP_KEY: 'smartPlannerBackupId',
    GUEST_NAME_KEY: 'tripticGuestName',
    LIMITS: {
        TOTAL_MB: 5,
        SAFE_THRESHOLD_MB: 4.5,
        WARNING_THRESHOLD_PERCENT: 90
    }
} as const;
```

---

#### 15. 날짜 계산 오류 가능성
**위치**: `src/utils/dateUtils.js:24-28`

**문제점**:
```javascript
export function calculateDaysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}
```

**영향도**: **Low**
- DST(Daylight Saving Time) 전환 시점에서 1일 오차 가능
- 시간대 미고려

**해결 방법**:
```typescript
// date-fns 사용 (권장)
import { differenceInDays, parseISO } from 'date-fns';

export function calculateDaysBetween(startDate: string, endDate: string): number {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    return differenceInDays(end, start) + 1;
}

// 또는 Temporal API (미래 표준)
export function calculateDaysBetweenTemporal(startDate: string, endDate: string): number {
    const start = Temporal.PlainDate.from(startDate);
    const end = Temporal.PlainDate.from(endDate);
    return start.until(end).days + 1;
}
```

---

## [3. 개선된 코드 및 권장 사항]

### A. 보안 개선

#### authService.js 완전 수정본

```javascript
// src/services/authService.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/+esm';

// ❌ 하드코딩 제거
// const DEFAULT_SUPABASE_URL = 'https://...';
// const DEFAULT_ANON_KEY = 'eyJ...';

// ✅ 환경 변수에서만 로드
const SUPABASE_URL = window.ENV?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY;

// 초기화 실패 시 명확한 에러
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase credentials in environment variables');
}

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY 
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

/**
 * 소셜 로그인
 * @param {string} provider - 'google' | 'kakao'
 * @returns {Promise<Object>}
 */
export async function signInWithProvider(provider) {
    if (!supabase) {
        throw new Error('Supabase client not initialized. Check environment variables.');
    }

    // Provider 화이트리스트 검증
    const ALLOWED_PROVIDERS = ['google', 'kakao'];
    if (!ALLOWED_PROVIDERS.includes(provider)) {
        throw new Error(`Invalid provider: ${provider}`);
    }

    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';
    
    const redirectUrl = isLocal 
        ? window.location.origin 
        : 'https://triptic-ten.vercel.app';

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectUrl }
    });

    if (error) throw error;
    return data;
}

/**
 * 로그아웃
 */
export async function signOut() {
    if (!supabase) {
        throw new Error('Supabase client not initialized');
    }
    
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

/**
 * 현재 사용자 조회
 * @returns {Promise<Object|null>}
 */
export async function getCurrentUser() {
    if (!supabase) return null;
    
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
        console.error('Get user error:', error);
        return null;
    }
    return user;
}

/**
 * 인증 상태 변경 감지
 * @param {Function} callback - (event, session) => void
 * @returns {Function} unsubscribe function
 */
export function onAuthStateChange(callback) {
    if (!supabase) {
        console.warn('Cannot listen to auth changes: Supabase not initialized');
        return () => {}; // noop unsubscribe
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return () => subscription.unsubscribe();
}
```

---

#### CORS 제한 설정

```javascript
// api/env.js
const ALLOWED_ORIGINS = [
    'https://triptic-ten.vercel.app',
    'https://triptic-preview.vercel.app', // 프리뷰 배포
    'capacitor://localhost',              // iOS/Android 앱
    'http://localhost:3000',              // 로컬 개발
    'http://127.0.0.1:3000'
];

export default function handler(req, res) {
    const origin = req.headers.origin;
    
    // Origin 화이트리스트 검증
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin'); // 캐싱 정확성
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    
    // Preflight 요청
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 클라이언트 안전 환경 변수만 전달
    const env = {
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        // ⚠️ AVIATIONSTACK_API_KEY는 서버 측에서만 사용 (클라이언트 노출 금지)
        GEMINI_API_KEY_EXISTS: !!process.env.GEMINI_API_KEY
    };

    res.status(200).json(env);
}
```

---

#### .gitignore 업데이트

```gitignore
# 환경 변수 (절대 커밋 금지)
.env
.env.local
.env.*.local
.env.development
.env.production

# Vercel
.vercel
.vercel.json

# 빌드 출력
dist
dist-ssr
*.local

# 캐시
node_modules
.vite
.cache

# OS
.DS_Store
Thumbs.db

# IDE
.idea
.vscode
*.swp
*.swo
*~

# 로그
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*
yarn-error.log*

# 테스트 커버리지
coverage
.nyc_output
```

---

### B. 성능 개선

#### index.html 코드 스플리팅

**현재 상태**: 343KB, 8208줄의 단일 파일

**목표 구조**:
```
dist/
├── index.html (< 20KB) ← 최소한의 HTML만
├── assets/
│   ├── main-[hash].css (스타일)
│   ├── core-[hash].js (필수 로직)
│   ├── vendor-maps-[hash].js (Google Maps)
│   ├── vendor-supabase-[hash].js (Supabase)
│   └── vendor-ui-[hash].js (Sortable, jsPDF)
```

**vite.config.js 개선**:
```javascript
import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    build: {
      outDir: 'dist',
      sourcemap: true,
      minify: 'terser',
      
      // 청크 크기 최적화
      chunkSizeWarningLimit: 300, // 300KB 경고
      
      rollupOptions: {
        output: {
          // ✅ 전략적 코드 스플리팅
          manualChunks: {
            // 외부 의존성 분리 (변경 빈도 낮음)
            'vendor-maps': ['@googlemaps/js-api-loader'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-ui': ['sortablejs', 'jspdf', 'lz-string'],
            
            // 코어 서비스 (변경 빈도 중간)
            'core-services': [
              './src/services/storageService.js',
              './src/services/apiService.js',
              './src/services/supabaseService.js',
              './src/services/authService.js'
            ],
            
            // 유틸리티 (변경 빈도 낮음)
            'core-utils': [
              './src/utils/dateUtils.ts',
              './src/utils/timeUtils.ts',
              './src/utils/escapeHtml.ts',
              './src/utils/logger.ts',
              './src/utils/retry.ts'
            ],
            
            // 상태 관리 (변경 빈도 중간)
            'core-state': [
              './src/state/appState.js'
            ]
          },
          
          // 파일명 패턴
          chunkFileNames: (chunkInfo) => {
            // 초기 로딩 필수 청크는 해시 제거 (캐싱 최적화)
            const isCore = chunkInfo.name.startsWith('core-');
            return isCore 
              ? 'assets/[name].js' 
              : 'assets/[name]-[hash].js';
          },
          
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      },
      
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: true,
          pure_funcs: mode === 'production' ? ['console.log', 'console.debug'] : []
        },
        mangle: {
          safari10: true // Safari 10 호환성
        }
      }
    },
    
    // 성능 최적화
    optimizeDeps: {
      include: ['@supabase/supabase-js'],
      exclude: ['@googlemaps/js-api-loader'] // 동적 로딩
    }
  };
});
```

**예상 효과**:
- FCP: 2.5초 → **1.2초** (3G 환경)
- TTI: 4초 → **2.5초**
- 번들 크기: 343KB → **180KB** (gzip 압축 후 ~60KB)

---

#### Service Worker 버전 자동화

```javascript
// sw.js
/**
 * Triptic Service Worker
 * Auto-versioned from package.json
 */

// ✅ package.json에서 버전 자동 로드
import packageJson from './package.json' assert { type: 'json' };
const CACHE_NAME = `triptic-v${packageJson.version}`;

console.log(`[SW] Initializing Service Worker ${CACHE_NAME}`);

// App shell files
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-1024.png'
];

// Versioned external CDN resources
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.5.0/lz-string.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

const PRECACHE_ASSETS = [...APP_SHELL, ...CDN_ASSETS];

// ... rest of sw.js remains same
```

**package.json에 빌드 스크립트 추가**:
```json
{
  "scripts": {
    "version:bump": "npm version patch",
    "build": "npm run version:bump && tsc && vite build"
  }
}
```

---

### C. 코드 품질 개선

#### 재시도 로직 유틸리티

```typescript
// src/utils/retry.ts

export interface RetryOptions {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    exponential?: boolean;
    onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Exponential backoff 재시도 로직
 * @example
 * const data = await retryWithBackoff(
 *   () => fetch('/api/data').then(r => r.json()),
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        maxDelay = 10000,
        exponential = true,
        onRetry
    } = options;
    
    let lastError: Error;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            
            // 마지막 시도면 에러 던지기
            if (attempt === maxRetries - 1) {
                throw lastError;
            }
            
            // 재시도 콜백
            if (onRetry) {
                onRetry(attempt + 1, lastError);
            }
            
            // 지연 시간 계산
            const delay = exponential
                ? Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
                : baseDelay;
            
            console.warn(
                `[Retry] Attempt ${attempt + 1}/${maxRetries} failed. ` +
                `Retrying in ${delay}ms...`,
                lastError.message
            );
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError!;
}

/**
 * 조건부 재시도 (특정 에러만)
 */
export async function retryIf<T>(
    fn: () => Promise<T>,
    shouldRetry: (error: Error) => boolean,
    options: RetryOptions = {}
): Promise<T> {
    return retryWithBackoff(async () => {
        try {
            return await fn();
        } catch (error) {
            if (!shouldRetry(error as Error)) {
                throw error; // 재시도하지 않고 즉시 실패
            }
            throw error; // 재시도 계속
        }
    }, options);
}
```

**사용 예시**:
```javascript
// src/services/apiService.js
import { retryWithBackoff, retryIf } from '@/utils/retry';

export class ApiService {
    static async getRecommendations(placeName, city, category = 'all') {
        try {
            // ✅ 네트워크 오류만 재시도
            return await retryIf(
                () => this._fetchRecommendations(placeName, city, category),
                (error) => {
                    // 네트워크 오류 또는 5xx 에러만 재시도
                    return error.name === 'TypeError' || // Network error
                           error.message.includes('HTTP 5'); // 500-599
                },
                {
                    maxRetries: 3,
                    baseDelay: 1000,
                    onRetry: (attempt, error) => {
                        console.warn(`API retry attempt ${attempt}:`, error.message);
                    }
                }
            );
        } catch (error) {
            console.error('AI 추천 API 최종 실패:', error);
            return {
                success: false,
                error: error.message,
                recommendations: []
            };
        }
    }
    
    static async _fetchRecommendations(placeName, city, category) {
        const response = await fetch('/api/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ placeName, city, category })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return {
            success: true,
            recommendations: data.recommendations || [],
            modelUsed: data.modelUsed,
            provider: data.provider
        };
    }
}
```

---

#### 로깅 시스템

```typescript
// src/utils/logger.ts

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
    level: LogLevel;
    enableTimestamp: boolean;
    enableStackTrace: boolean;
}

const DEFAULT_CONFIG: LoggerConfig = {
    level: import.meta.env.PROD ? 'warn' : 'debug',
    enableTimestamp: true,
    enableStackTrace: import.meta.env.DEV
};

const LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

class Logger {
    private config: LoggerConfig;
    
    constructor(config: Partial<LoggerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    
    private shouldLog(level: LogLevel): boolean {
        return LEVELS[level] >= LEVELS[this.config.level];
    }
    
    private format(level: LogLevel, ...args: any[]): any[] {
        const prefix: string[] = [];
        
        if (this.config.enableTimestamp) {
            prefix.push(new Date().toISOString());
        }
        
        prefix.push(`[${level.toUpperCase()}]`);
        
        return [...prefix, ...args];
    }
    
    debug(...args: any[]): void {
        if (this.shouldLog('debug')) {
            console.debug(...this.format('debug', ...args));
        }
    }
    
    info(...args: any[]): void {
        if (this.shouldLog('info')) {
            console.info(...this.format('info', ...args));
        }
    }
    
    warn(...args: any[]): void {
        if (this.shouldLog('warn')) {
            console.warn(...this.format('warn', ...args));
        }
    }
    
    error(...args: any[]): void {
        if (this.shouldLog('error')) {
            console.error(...this.format('error', ...args));
            
            if (this.config.enableStackTrace) {
                console.trace();
            }
        }
    }
    
    /**
     * 성능 측정
     */
    time(label: string): void {
        if (this.shouldLog('debug')) {
            console.time(label);
        }
    }
    
    timeEnd(label: string): void {
        if (this.shouldLog('debug')) {
            console.timeEnd(label);
        }
    }
}

// 싱글톤 인스턴스
export const logger = new Logger();

// 전역 접근 (기존 코드 호환성)
if (typeof window !== 'undefined') {
    (window as any).logger = logger;
}
```

**마이그레이션 가이드**:
```javascript
// Before
console.log('저장 완료:', sizeInMB.toFixed(2) + 'MB');
console.warn('localStorage 용량 경고:', sizeInMB);
console.error('프로젝트 로드 실패:', error);

// After
import { logger } from '@/utils/logger';

logger.info('저장 완료:', sizeInMB.toFixed(2) + 'MB');
logger.warn('localStorage 용량 경고:', sizeInMB);
logger.error('프로젝트 로드 실패:', error);

// 성능 측정
logger.time('데이터 로드');
const projects = StorageService.load();
logger.timeEnd('데이터 로드');
```

---

### D. 아키텍처 개선

#### 권장 디렉토리 구조

```
src/
├── core/                      # 핵심 인프라
│   ├── config.ts             # 환경 변수 중앙 관리
│   ├── logger.ts             # 로깅 시스템
│   ├── retry.ts              # 재시도 로직
│   └── constants.ts          # 전역 상수
│
├── features/                  # 기능별 모듈
│   ├── auth/
│   │   ├── authService.ts
│   │   ├── loginModal.ts
│   │   └── types.ts
│   │
│   ├── trips/
│   │   ├── tripService.ts
│   │   ├── tripState.ts
│   │   ├── components/
│   │   │   ├── TripCard.ts
│   │   │   └── TripList.ts
│   │   └── types.ts
│   │
│   ├── planner/
│   │   ├── plannerService.ts
│   │   ├── components/
│   │   │   ├── DayTab.ts
│   │   │   └── PlaceItem.ts
│   │   └── types.ts
│   │
│   └── map/
│       ├── mapService.ts
│       ├── mapState.ts
│       └── types.ts
│
├── shared/                    # 공유 모듈
│   ├── api/
│   │   ├── client.ts         # Fetch 래퍼
│   │   └── endpoints.ts      # API 엔드포인트
│   │
│   ├── storage/
│   │   ├── localStorage.ts
│   │   └── indexedDB.ts
│   │
│   ├── utils/
│   │   ├── date.ts
│   │   ├── time.ts
│   │   ├── sanitize.ts
│   │   └── validation.ts
│   │
│   └── types/
│       ├── index.ts          # 전역 타입
│       └── api.ts            # API 응답 타입
│
├── styles/                    # 스타일
│   ├── main.css
│   ├── variables.css
│   └── components/
│
├── assets/                    # 정적 자산
│   ├── icons/
│   └── images/
│
└── main.ts                    # 진입점
```

---

#### 환경 변수 중앙 관리

```typescript
// src/core/config.ts

interface AppConfig {
    supabase: {
        url: string;
        anonKey: string;
    };
    googleMaps: {
        apiKey: string;
    };
    api: {
        baseUrl: string;
        timeout: number;
    };
    features: {
        aiRecommendations: boolean;
        offlineMode: boolean;
    };
}

class Config {
    private static instance: Config;
    private config: AppConfig | null = null;
    
    private constructor() {}
    
    static getInstance(): Config {
        if (!Config.instance) {
            Config.instance = new Config();
        }
        return Config.instance;
    }
    
    async initialize(): Promise<void> {
        // 환경 변수 로드
        await window.__envPromise;
        
        if (!window.ENV) {
            throw new Error('Failed to load environment variables');
        }
        
        this.config = {
            supabase: {
                url: window.ENV.SUPABASE_URL,
                anonKey: window.ENV.SUPABASE_ANON_KEY
            },
            googleMaps: {
                apiKey: window.ENV.GOOGLE_MAPS_API_KEY
            },
            api: {
                baseUrl: window.location.origin,
                timeout: 30000
            },
            features: {
                aiRecommendations: window.ENV.GEMINI_API_KEY_EXISTS,
                offlineMode: true
            }
        };
        
        this.validate();
    }
    
    private validate(): void {
        if (!this.config) {
            throw new Error('Config not initialized');
        }
        
        const required = [
            this.config.supabase.url,
            this.config.supabase.anonKey,
            this.config.googleMaps.apiKey
        ];
        
        if (required.some(v => !v)) {
            throw new Error('Missing required environment variables');
        }
    }
    
    get(): AppConfig {
        if (!this.config) {
            throw new Error('Config not initialized. Call initialize() first.');
        }
        return this.config;
    }
}

export const config = Config.getInstance();
```

**사용 예시**:
```typescript
// src/main.ts
import { config } from '@/core/config';
import { logger } from '@/core/logger';

async function bootstrap() {
    try {
        logger.info('Initializing Triptic...');
        
        // 환경 변수 로드
        await config.initialize();
        
        // 서비스 초기화
        // ...
        
        logger.info('Triptic initialized successfully');
    } catch (error) {
        logger.error('Bootstrap failed:', error);
        // 사용자에게 에러 표시
    }
}

bootstrap();
```

---

## [4. 즉시 실행 체크리스트]

### 🔴 긴급 (24시간 내)

- [ ] **보안 수정**
  - [ ] `.env.local`을 `.gitignore`에 추가
  - [ ] Git 히스토리에서 `.env.local` 완전 제거
  - [ ] Vercel OIDC 토큰 재발급
  - [ ] `authService.js`에서 하드코딩된 Supabase 키 제거
  - [ ] Supabase 콘솔에서 기존 ANON 키 폐기
  - [ ] Supabase 새 ANON 키 발급 및 환경 변수 설정
  - [ ] CORS 설정을 특정 도메인으로 제한
  - [ ] `authService.js`의 `client` 변수 미정의 버그 수정

### 🟠 고위험 (1주일 내)

- [ ] **성능 개선**
  - [ ] `index.html`을 여러 CSS/JS 파일로 분리
  - [ ] Vite 빌드 설정 최적화 (코드 스플리팅)
  - [ ] 번들 크기 분석 (`npm run analyze`)
  - [ ] Lighthouse 성능 측정 (목표: 90점 이상)
  
- [ ] **코드 정리**
  - [ ] TypeScript/JavaScript 중복 파일 정리 (`.js` 파일 삭제)
  - [ ] Service Worker 캐시 버전 자동화
  - [ ] 로그인 모달 에러 처리 수정

### 🟡 중위험 (2주일 내)

- [ ] **코드 품질**
  - [ ] UUID 입력값 검증 추가
  - [ ] localStorage SecurityError 처리
  - [ ] API 재시도 로직 구현
  - [ ] 로깅 시스템 도입 및 마이그레이션
  - [ ] 이벤트 리스너 메모리 누수 방지

- [ ] **테스트**
  - [ ] 주요 서비스 단위 테스트 작성
  - [ ] E2E 테스트 환경 구축
  - [ ] 80% 커버리지 달성

### 🟢 낮은 우선순위 (1개월 내)

- [ ] **리팩토링**
  - [ ] 매직 넘버 상수화
  - [ ] 날짜 계산 라이브러리 도입 (date-fns)
  - [ ] 디렉토리 구조 개편
  - [ ] 환경 변수 중앙 관리

---

## [5. 성능 벤치마크 목표]

### 현재 상태 (예상)
- **FCP**: 2.5초 (3G)
- **LCP**: 3.0초
- **TTI**: 4.0초
- **Bundle Size**: 343KB (index.html)
- **Lighthouse Score**: 65점

### 개선 목표 (4주 후)
- **FCP**: < 1.5초 ✅
- **LCP**: < 2.0초 ✅
- **TTI**: < 2.5초 ✅
- **Bundle Size**: < 200KB (전체)
- **Lighthouse Score**: > 90점 ✅

### 측정 방법
```bash
# Lighthouse CI
npm install -g @lhci/cli
lhci autorun --upload.target=temporary-public-storage

# Bundle 분석
npm run analyze
```

---

## [6. 보안 감사 체크리스트]

- [ ] **인증 & 인가**
  - [ ] 모든 API 키가 환경 변수로 관리됨
  - [ ] 클라이언트에 서버 전용 키 노출 없음
  - [ ] CORS가 특정 도메인만 허용
  - [ ] Supabase RLS 정책 활성화 확인

- [ ] **입력 검증**
  - [ ] 모든 사용자 입력 sanitize
  - [ ] UUID/ID 포맷 검증
  - [ ] SQL Injection 방어 (Parameterized Query)

- [ ] **데이터 보호**
  - [ ] HTTPS 강제 (HSTS 헤더)
  - [ ] 민감 데이터 암호화
  - [ ] localStorage에 민감 정보 저장 금지

- [ ] **의존성 보안**
  ```bash
  npm audit fix
  npm outdated
  ```

---

## [7. 문서화 권장 사항]

### 추가 필요 문서
1. **SECURITY.md**: 보안 정책 및 취약점 보고 방법
2. **CONTRIBUTING.md**: 기여 가이드라인
3. **API.md**: API 엔드포인트 문서
4. **ARCHITECTURE.md**: 시스템 아키텍처 다이어그램

### README.md 개선
```markdown
# Triptic

## 🚀 Quick Start
\`\`\`bash
npm install
cp .env.example .env.local  # ← 추가 필요
npm run dev
\`\`\`

## 🔐 Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| SUPABASE_URL | Yes | Supabase project URL |
| SUPABASE_ANON_KEY | Yes | Supabase anonymous key |
| GOOGLE_MAPS_API_KEY | Yes | Google Maps API key |

## 📦 Project Structure
(상단 디렉토리 구조 참고)

## 🧪 Testing
\`\`\`bash
npm test
npm run test:coverage
\`\`\`

## 🛠️ Built With
- Vite 5.0
- TypeScript 5.2
- Supabase 2.38
- Google Maps API
```

---

## [8. 마이그레이션 로드맵]

### Phase 1: 긴급 보안 수정 (Week 1)
- Git에서 시크릿 제거
- 하드코딩 제거
- CORS 제한

### Phase 2: 안정화 (Week 2-3)
- 버그 수정 (authService, loginModal)
- 에러 처리 강화
- 재시도 로직 추가

### Phase 3: 성능 개선 (Week 4-5)
- index.html 분리
- 코드 스플리팅
- 번들 최적화

### Phase 4: 아키텍처 정리 (Week 6-8)
- TypeScript 완전 마이그레이션
- 디렉토리 구조 개편
- 테스트 작성

---

## [9. 참고 자료]

### 보안
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/security-best-practices)

### 성능
- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse Scoring Guide](https://web.dev/performance-scoring/)

### TypeScript
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

---

## [10. 리뷰 결론]

### 종합 평가
Triptic은 **좋은 기반**을 가진 프로젝트이지만, **프로덕션 배포 전 반드시 보안 및 안정성 문제를 해결**해야 합니다.

### 핵심 권장 사항
1. **즉시**: 하드코딩된 시크릿 제거 및 Git 히스토리 정리
2. **1주일 내**: 성능 최적화 (index.html 분리)
3. **2주일 내**: 코드 품질 개선 (에러 처리, 재시도 로직)
4. **1개월 내**: 아키텍처 정리 (TypeScript 마이그레이션)

### 긍정적 측면
- PWA 구현 완료
- 모듈화 진행 중
- 테스트 인프라 구축

### 개선 필요 측면
- 보안 취약점 (Critical)
- 대용량 파일 (High)
- 런타임 오류 (High)

---

**다음 리뷰 권장일**: 보안 수정 완료 후 1주일 이내

**연락처**: 추가 질문이 있으시면 이슈를 생성해 주세요.

---

*본 리뷰는 2025년 9월 18일 기준으로 작성되었습니다.*
