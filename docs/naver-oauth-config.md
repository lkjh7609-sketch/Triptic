# Naver OAuth 설정값

## Supabase Dashboard에 입력할 값

### Provider Identifier
```
custom:naver
```

### Display Name
```
Naver
```

### Configuration Method
**Manual configuration** 선택

### OAuth Endpoints

#### Issuer URL
```
https://nid.naver.com
```

#### Authorization URL
```
https://nid.naver.com/oauth2.0/authorize
```

#### Token URL
```
https://nid.naver.com/oauth2.0/token
```

#### User Info URL
```
https://openapi.naver.com/v1/nid/me
```

---

## Naver Developers에서 설정할 값

### 애플리케이션 이름
```
Triptic
```

### 사용 API
- [x] 네이버 로그인

### 서비스 URL
```
https://triptic-ten.vercel.app
```

### Callback URL (중요!)
```
https://mfwfqfzdgcgfnnmnlrxu.supabase.co/auth/v1/callback
```

### 제공 정보 선택
- [x] 회원이름
- [x] 이메일 주소
- [x] 프로필 사진

---

## 순서

1. Naver Developers에서 앱 생성
2. Client ID와 Client Secret 복사
3. Supabase Dashboard에 위 값들 입력
4. Client ID와 Secret 붙여넣기
5. "Create and enable provider" 클릭
