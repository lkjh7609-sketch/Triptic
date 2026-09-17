# Supabase 환경 변수 설정 가이드

## Vercel Dashboard에서 설정하기

### 1. Vercel 프로젝트 접속
1. https://vercel.com 로그인
2. Triptic 프로젝트 선택

### 2. 환경 변수 추가
1. 상단 메뉴에서 **Settings** 클릭
2. 왼쪽 메뉴에서 **Environment Variables** 선택
3. 다음 환경 변수 추가:

#### 변수 1: SUPABASE_URL
```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://your-project-id.supabase.co
Environment: Production, Preview, Development (모두 체크)
```

#### 변수 2: SUPABASE_ANON_KEY
```
Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (긴 문자열)
Environment: Production, Preview, Development (모두 체크)
```

⚠️ **중요**: 
- `NEXT_PUBLIC_` 접두사를 반드시 붙여야 브라우저에서 접근 가능합니다
- anon key만 사용하세요 (service_role key는 절대 안됨!)

### 3. 재배포
환경 변수를 추가한 후 반드시 재배포해야 합니다:
1. Vercel 프로젝트 페이지로 이동
2. **Deployments** 탭 클릭
3. 최신 배포 옆의 **...** 메뉴 → **Redeploy** 클릭
4. "Redeploy" 버튼 클릭

---

## Vercel CLI로 설정하기 (선택사항)

```bash
# Vercel CLI 설치
npm i -g vercel

# 프로젝트 디렉토리에서 실행
vercel env add NEXT_PUBLIC_SUPABASE_URL
# 값 입력: https://your-project-id.supabase.co
# 환경 선택: Production, Preview, Development

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# 값 입력: eyJhbGci...
# 환경 선택: Production, Preview, Development

# 재배포
vercel --prod
```

---

## 로컬 개발 환경 설정

### .env.local 파일 생성

프로젝트 루트에 `.env.local` 파일 생성:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ `.env.local`은 절대 Git에 커밋하지 마세요!

---

## 연동 테스트

### 브라우저 콘솔에서 테스트

배포 후 사이트에 접속하여 브라우저 콘솔(F12)에서:

```javascript
// 환경 변수 확인
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL || 
            process.env.NEXT_PUBLIC_SUPABASE_URL);

// Supabase 초기화 테스트
import { supabaseService } from './src/services/supabaseService.js';

await supabaseService.initialize(
    'YOUR_SUPABASE_URL',
    'YOUR_SUPABASE_ANON_KEY'
);

console.log('Supabase 초기화 완료!');

// 익명 세션 생성 테스트
const user = await supabaseService.createAnonymousSession();
console.log('익명 사용자:', user);

// 여행 목록 조회 테스트
const trips = await supabaseService.listTrips();
console.log('여행 목록:', trips);
```

---

## 연동 확인 체크리스트

- [ ] Supabase SQL 스키마 실행 완료
- [ ] Supabase API 키 복사 (URL + anon key)
- [ ] Vercel 환경 변수 추가 (NEXT_PUBLIC_ 접두사)
- [ ] Vercel 재배포 완료
- [ ] 브라우저에서 환경 변수 접근 확인
- [ ] Supabase 초기화 성공
- [ ] 익명 세션 생성 성공

---

## 문제 해결

### 환경 변수가 undefined로 나옴
- Vercel 재배포 했는지 확인
- `NEXT_PUBLIC_` 접두사가 있는지 확인
- 브라우저 캐시 클리어 후 새로고침

### Supabase 연결 실패
- API 키가 올바른지 확인
- Supabase 프로젝트가 일시 중지되지 않았는지 확인
- 브라우저 네트워크 탭에서 CORS 에러 확인

### RLS 정책 에러
- SQL 스키마가 완전히 실행되었는지 확인
- 익명 인증이 활성화되었는지 확인 (Supabase → Authentication → Providers)
