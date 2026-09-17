# 🚀 Supabase 연동 빠른 시작 가이드

## 📋 체크리스트

### 1️⃣ Supabase 설정 (5분)

```bash
# ✅ 완료한 작업
[x] Supabase 프로젝트 생성
[x] SQL 스키마 실행 (supabase/schema.sql)

# 🔜 남은 작업
[ ] API 키 복사
[ ] Vercel 환경 변수 설정
```

---

## 2️⃣ Supabase API 키 가져오기

### Supabase Dashboard
1. https://supabase.com/dashboard 접속
2. Triptic 프로젝트 선택
3. **Settings (⚙️)** → **API** 클릭
4. 다음 정보 복사:

```
Project URL:
https://mfwfqfzdgcgfnnmnlrxu.supabase.co

anon/public key:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBh...
```

⚠️ **주의**: `service_role` key는 절대 사용하지 마세요!

---

## 3️⃣ Vercel 환경 변수 설정

### 방법 A: Vercel Dashboard (권장)

1. https://vercel.com/dashboard 접속
2. **Triptic 프로젝트** 선택
3. **Settings** → **Environment Variables**
4. 다음 2개 변수 추가:

#### 변수 1
```
Name:        SUPABASE_URL
Value:       https://mfwfqfzdgcgfnnmnlrxu.supabase.co
Environment: ✓ Production  ✓ Preview  ✓ Development
```

#### 변수 2
```
Name:        SUPABASE_ANON_KEY
Value:       eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Environment: ✓ Production  ✓ Preview  ✓ Development
```

5. **Save** 클릭

### 방법 B: Vercel CLI

```bash
# Vercel CLI 설치 (처음 한 번만)
npm i -g vercel

# 프로젝트 루트에서 실행
cd /Users/benlee/Triptic

# 환경 변수 추가
vercel env add SUPABASE_URL production
# 값 입력: https://mfwfqfzdgcgfnnmnlrxu.supabase.co

vercel env add SUPABASE_ANON_KEY production
# 값 입력: eyJhbGci... (긴 키)

# Preview/Development도 동일하게 추가
vercel env add SUPABASE_URL preview
vercel env add SUPABASE_ANON_KEY preview
```

---

## 4️⃣ 재배포 (필수!)

환경 변수는 **재배포 후에만** 적용됩니다.

### Vercel Dashboard
1. **Deployments** 탭
2. 최신 배포 옆 **... 메뉴**
3. **Redeploy** 클릭
4. "Redeploy" 확인

### Vercel CLI
```bash
vercel --prod
```

---

## 5️⃣ 동작 확인

### 배포 완료 후 사이트 접속
1. https://triptic-ten.vercel.app 접속
2. 브라우저 콘솔(F12) 확인
3. 다음 메시지가 보이면 성공:

```
✅ Supabase 클라이언트 생성 완료
✅ 익명 세션 생성 완료
```

### 클라우드 동기화 배너 확인
- 로비 화면 상단에 보라색 배너 표시
- "지금 활성화" 버튼 표시

---

## 6️⃣ 사용자가 할 일

### 기존 사용자
1. 앱 접속
2. 상단 배너의 **"지금 활성화"** 클릭
3. 확인 팝업에서 **"확인"** 클릭
4. 완료 메시지: "✅ N개 여행이 클라우드로 이동되었습니다!"

### 새로운 사용자
- 자동으로 Supabase에 저장됨
- 별도 작업 불필요

---

## 🔧 문제 해결

### 콘솔에 "Supabase가 설정되지 않았습니다" 표시
```
원인: 환경 변수가 로드되지 않음
해결:
1. Vercel 환경 변수 다시 확인
2. 재배포 했는지 확인
3. 브라우저 캐시 클리어 (Ctrl+Shift+R)
```

### "익명 세션 생성 실패" 에러
```
원인: Supabase 익명 인증 비활성화
해결:
1. Supabase Dashboard → Authentication
2. Providers → Anonymous
3. "Enable Anonymous sign-ins" 토글 ON
```

### API 키 에러
```
원인: 잘못된 키 또는 만료된 키
해결:
1. Supabase Dashboard에서 키 재확인
2. 복사 시 전체 선택 확인 (앞뒤 공백 주의)
3. Vercel 환경 변수 값 다시 붙여넣기
```

---

## 📊 연동 후 기대 효과

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 저장 용량 | 5MB | **무제한** |
| 기기 동기화 | 수동 (백업 코드) | **자동** |
| 데이터 백업 | 없음 | **실시간 클라우드** |
| 데이터 손실 위험 | 높음 | **없음** |
| 공유 기능 | 읽기 전용 링크 | **읽기+쓰기 가능** |

---

## 🎯 다음 단계

### 자동 저장 기능 (향후 개선)
현재는 수동 마이그레이션만 지원하지만, 향후 업데이트로:
- ✅ 장소 추가 시 자동 Supabase 저장
- ✅ 실시간 다중 사용자 협업
- ✅ 버전 히스토리 (변경 내역 추적)

---

## 📞 지원

문제가 있으시면:
1. 브라우저 콘솔 에러 메시지 확인
2. [GitHub Issues](https://github.com/lkjh7609-sketch/Triptic/issues) 제보
3. 에러 메시지와 함께 스크린샷 첨부

---

**설정 완료 시간**: 약 5분  
**난이도**: ⭐⭐ (중급)  
**필수 여부**: 선택사항 (localStorage도 계속 작동)
