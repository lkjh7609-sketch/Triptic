# 소셜 로그인 설정 가이드

## 🔐 Supabase에서 소셜 로그인 활성화

### 1. Google 로그인 설정

#### Google Cloud Console 설정
1. https://console.cloud.google.com 접속
2. **APIs & Services** → **Credentials** 선택
3. **Create Credentials** → **OAuth 2.0 Client ID** 클릭
4. Application type: **Web application**
5. Authorized redirect URIs 추가:
   ```
   https://mfwfqfzdgcgfnnmnlrxu.supabase.co/auth/v1/callback
   ```
6. **Client ID**와 **Client Secret** 복사

#### Supabase Dashboard 설정
1. Supabase Dashboard → **Authentication** → **Providers**
2. **Google** 찾아서 **Enable** 토글
3. Client ID 붙여넣기
4. Client Secret 붙여넣기
5. **Save** 클릭

---

### 2. Naver 로그인 설정

#### Naver Developers 설정
1. https://developers.naver.com/apps 접속
2. **애플리케이션 등록** 클릭
3. 애플리케이션 이름: `Triptic`
4. **사용 API**: 네이버 로그인
5. **서비스 URL**: `https://triptic-ten.vercel.app`
6. **Callback URL**:
   ```
   https://mfwfqfzdgcgfnnmnlrxu.supabase.co/auth/v1/callback
   ```
7. **제공 정보**: 이메일, 프로필 정보 선택
8. **Client ID**와 **Client Secret** 복사

#### Supabase Dashboard 설정
1. Supabase Dashboard → **Authentication** → **Providers**
2. 아래로 스크롤하여 **Add Provider** 클릭
3. Provider type: **OAuth**
4. Provider name: `naver`
5. Client ID 붙여넣기
6. Client Secret 붙여넣기
7. Authorization URL:
   ```
   https://nid.naver.com/oauth2.0/authorize
   ```
8. Token URL:
   ```
   https://nid.naver.com/oauth2.0/token
   ```
9. User Info URL:
   ```
   https://openapi.naver.com/v1/nid/me
   ```
10. **Save** 클릭

---

### 3. Kakao 로그인 설정

#### Kakao Developers 설정
1. https://developers.kakao.com/console/app 접속
2. **애플리케이션 추가하기** 클릭
3. 앱 이름: `Triptic`
4. 앱 생성 후 → **카카오 로그인** 활성화
5. **Redirect URI 등록**:
   ```
   https://mfwfqfzdgcgfnnmnlrxu.supabase.co/auth/v1/callback
   ```
6. **동의 항목** 설정:
   - 닉네임 (필수)
   - 이메일 (선택)
7. **REST API 키** 복사

#### Supabase Dashboard 설정
1. Supabase Dashboard → **Authentication** → **Providers**
2. **Add Provider** 클릭
3. Provider name: `kakao`
4. Client ID: REST API 키 붙여넣기
5. Authorization URL:
   ```
   https://kauth.kakao.com/oauth/authorize
   ```
6. Token URL:
   ```
   https://kauth.kakao.com/oauth/token
   ```
7. User Info URL:
   ```
   https://kapi.kakao.com/v2/user/me
   ```
8. **Save** 클릭

---

## 🔧 코드 통합

### index.html에 추가

`</head>` 태그 직전에 추가:

```html
<!-- 로그인 모달 -->
<script type="module">
    import { createLoginModal } from './src/components/loginModal.js';
    import { authService } from './src/services/authService.js';
    
    // DOM 로드 후 실행
    document.addEventListener('DOMContentLoaded', async () => {
        // 로그인 모달 HTML 추가
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = createLoginModal();
        document.body.appendChild(modalContainer.firstElementChild);
        
        // Supabase 초기화
        const envResponse = await fetch('/api/env');
        const env = await envResponse.json();
        
        if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
            await authService.initialize(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
            
            // 로그인 상태 확인
            const user = authService.getCurrentUser();
            if (user && !authService.isAnonymous()) {
                // 사용자 프로필 UI 표시
                updateUserUI();
            } else {
                // 로그인 버튼 표시
                showLoginButton();
            }
        }
        
        // 인증 상태 변경 리스너
        window.addEventListener('authStateChanged', (e) => {
            if (e.detail.user && !authService.isAnonymous()) {
                updateUserUI();
            } else {
                showLoginButton();
            }
        });
    });
    
    function showLoginButton() {
        const header = document.querySelector('.header') || document.body;
        const loginBtn = document.createElement('button');
        loginBtn.id = 'login-btn';
        loginBtn.className = 'btn-primary';
        loginBtn.textContent = '로그인';
        loginBtn.onclick = openLoginModal;
        loginBtn.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 999;';
        header.appendChild(loginBtn);
    }
    
    async function updateUserUI() {
        const { authService } = await import('./src/services/authService.js');
        const { createUserProfileUI } = await import('./src/components/loginModal.js');
        
        const profile = authService.getUserProfile();
        const loginBtn = document.getElementById('login-btn');
        
        if (loginBtn) {
            loginBtn.outerHTML = createUserProfileUI(profile);
        } else {
            const header = document.querySelector('.header') || document.body;
            const profileDiv = document.createElement('div');
            profileDiv.innerHTML = createUserProfileUI(profile);
            profileDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 999;';
            header.appendChild(profileDiv);
        }
    }
</script>
```

---

## 🎨 스타일 커스터마이징

원하는 대로 버튼 색상과 디자인을 변경할 수 있습니다:

```css
/* src/components/loginModal.js 파일의 <style> 섹션 수정 */

.social-login-btn.google {
    background: #4285F4;
    color: white;
    border-color: #4285F4;
}

.social-login-btn.naver {
    background: #03C75A;
    color: white;
}

.social-login-btn.kakao {
    background: #FEE500;
    color: #371D1E;
}
```

---

## ✅ 테스트

1. **로그인 버튼** 클릭
2. **Google/Naver/Kakao** 선택
3. 소셜 계정으로 로그인
4. 프로필 사진과 이름이 표시되는지 확인
5. **데이터 동기화** 클릭하여 localStorage → Supabase 마이그레이션 테스트

---

## 🔒 보안 고려사항

### Redirect URI 검증
- Supabase/Google/Naver/Kakao 콘솔에서 정확한 Redirect URI 설정 필수
- 프로덕션: `https://triptic-ten.vercel.app`
- 로컬 개발: `http://localhost:3000` 추가

### RLS (Row Level Security)
이미 `supabase/schema.sql`에 설정되어 있습니다:
```sql
-- 사용자는 자신의 데이터만 접근
CREATE POLICY "Users can view own trips"
    ON trips FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own trips"
    ON trips FOR INSERT
    WITH CHECK (auth.uid() = user_id);
```

---

## 📱 모바일 앱 (Capacitor)

iOS/Android 앱에서는 추가 설정이 필요합니다:

### iOS (Info.plist)
```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>triptic</string>
        </array>
    </dict>
</array>
```

### Android (AndroidManifest.xml)
```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="triptic" />
</intent-filter>
```

---

**설정 완료 후 Vercel 재배포하면 바로 사용 가능합니다!** 🎉
