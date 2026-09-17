// Login Modal Component
import { signInWithProvider } from '../services/authService.js';

export function createLoginModal() {
    const modal = document.createElement('div');
    modal.id = 'login-modal';
    modal.className = 'auth-modal';
    modal.innerHTML = `
        <div class="auth-modal-overlay"></div>
        <div class="auth-modal-content">
            <button class="auth-modal-close" aria-label="닫기">&times;</button>
            <div class="auth-modal-header">
                <h2>로그인 / 회원가입</h2>
                <p>소셜 계정으로 간편하게 시작하세요</p>
            </div>
            <div class="auth-modal-body">
                <button class="auth-btn google-btn" data-provider="google">
                    <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/></svg>
                    Google로 계속하기
                </button>
                <button class="auth-btn naver-btn" data-provider="naver">
                    <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#03C75A" d="M11.5 9.5L6.5 2H2v14h4.5V8.5l5 7.5H16V2h-4.5z"/></svg>
                    Naver로 계속하기
                </button>
                <button class="auth-btn kakao-btn" data-provider="kakao">
                    <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#000" d="M9 1C4.582 1 1 3.79 1 7.25c0 2.271 1.534 4.258 3.834 5.379-.158.551-.567 2-.651 2.31 0 0-.053.213.11.293.164.08.356 0 .356 0 .466-.062 2.706-1.757 3.139-2.056.404.056.818.086 1.24.086 4.418 0 8-2.79 8-6.25S13.418 1 9 1z"/></svg>
                    Kakao로 계속하기
                </button>
            </div>
            <div class="auth-modal-footer">
                <p>로그인하면 <a href="#" target="_blank">이용약관</a> 및 <a href="#" target="_blank">개인정보처리방침</a>에 동의하게 됩니다</p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const overlay = modal.querySelector('.auth-modal-overlay');
    const closeBtn = modal.querySelector('.auth-modal-close');
    const authBtns = modal.querySelectorAll('.auth-btn');

    function closeModal() {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }

    overlay.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);

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
                btn.innerHTML = btn.dataset.originalHtml;
            }
        });
        btn.dataset.originalHtml = btn.innerHTML;
    });

    setTimeout(() => modal.classList.add('active'), 10);
}

export function showLoginModal() {
    if (document.getElementById('login-modal')) return;
    createLoginModal();
}
