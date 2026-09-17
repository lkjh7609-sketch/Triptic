/**
 * 접근성(A11y) 유틸리티 함수
 * WCAG 2.1 AA 수준 준수
 */

/**
 * 요소에 적절한 ARIA 속성 추가
 * @param element - DOM 요소
 * @param role - ARIA role
 * @param label - ARIA label
 */
export function setAriaAttributes(
    element: HTMLElement,
    role: string,
    label?: string
): void {
    element.setAttribute('role', role);
    if (label) {
        element.setAttribute('aria-label', label);
    }
}

/**
 * 포커스 가능한 요소 목록 가져오기
 * @param container - 컨테이너 요소
 * @returns 포커스 가능한 요소 배열
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

/**
 * 포커스 트랩 (모달 등에서 사용)
 * @param container - 포커스를 가둘 컨테이너
 * @returns cleanup 함수
 */
export function trapFocus(container: HTMLElement): () => void {
    const focusableElements = getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
            // Shift + Tab
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            // Tab
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    };

    container.addEventListener('keydown', handleKeyDown);

    // 첫 번째 요소에 포커스
    firstElement?.focus();

    // cleanup 함수 반환
    return () => {
        container.removeEventListener('keydown', handleKeyDown);
    };
}

/**
 * 스크린 리더 전용 텍스트 추가
 * @param element - 요소
 * @param text - 스크린 리더용 텍스트
 */
export function addScreenReaderText(element: HTMLElement, text: string): void {
    const srOnly = document.createElement('span');
    srOnly.className = 'sr-only';
    srOnly.textContent = text;
    srOnly.style.cssText = `
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
    `;
    element.appendChild(srOnly);
}

/**
 * 키보드 네비게이션 지원
 * @param element - 요소
 * @param onActivate - Enter/Space 키 활성화 시 콜백
 */
export function makeKeyboardAccessible(
    element: HTMLElement,
    onActivate: () => void
): void {
    // tabindex 설정 (이미 포커스 가능한 요소가 아닌 경우)
    if (!element.hasAttribute('tabindex')) {
        element.setAttribute('tabindex', '0');
    }

    element.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onActivate();
        }
    });
}

/**
 * 색상 대비 비율 계산
 * @param color1 - 첫 번째 색상 (hex)
 * @param color2 - 두 번째 색상 (hex)
 * @returns 대비 비율
 */
export function getContrastRatio(color1: string, color2: string): number {
    const getLuminance = (hex: string): number => {
        const rgb = parseInt(hex.slice(1), 16);
        const r = (rgb >> 16) & 0xff;
        const g = (rgb >> 8) & 0xff;
        const b = rgb & 0xff;

        const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });

        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const l1 = getLuminance(color1);
    const l2 = getLuminance(color2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * WCAG AA 수준 대비 확인
 * @param bgColor - 배경색 (hex)
 * @param textColor - 텍스트 색 (hex)
 * @param largeText - 큰 텍스트 여부 (18pt 이상)
 * @returns 통과 여부
 */
export function meetsContrastRequirement(
    bgColor: string,
    textColor: string,
    largeText: boolean = false
): boolean {
    const ratio = getContrastRatio(bgColor, textColor);
    const minRatio = largeText ? 3 : 4.5;
    return ratio >= minRatio;
}

/**
 * 라이브 리전 알림 (스크린 리더용)
 * @param message - 알림 메시지
 * @param priority - 우선순위 ('polite' | 'assertive')
 */
export function announceToScreenReader(
    message: string,
    priority: 'polite' | 'assertive' = 'polite'
): void {
    const liveRegion = document.getElementById('aria-live-region') || createLiveRegion();
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.textContent = message;

    // 메시지 제거 (재사용 가능하도록)
    setTimeout(() => {
        liveRegion.textContent = '';
    }, 1000);
}

/**
 * 라이브 리전 생성
 * @returns 라이브 리전 요소
 */
function createLiveRegion(): HTMLElement {
    const region = document.createElement('div');
    region.id = 'aria-live-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
    `;
    document.body.appendChild(region);
    return region;
}
