/**
 * Supabase 통합 초기화 스크립트
 * index.html에서 로드하여 사용
 */

(async function initSupabase() {
    // 환경 변수 확인
    const SUPABASE_URL = 'https://mfwfqfzdgcgfnnmnlrxu.supabase.co';  // Vercel 환경 변수에서 가져옴
    const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';  // Vercel 환경 변수에서 가져옴

    // 프로덕션에서는 환경 변수 사용
    const supabaseUrl = window.ENV?.SUPABASE_URL || SUPABASE_URL;
    const supabaseKey = window.ENV?.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

    // Supabase 사용 가능 여부 확인
    if (!supabaseUrl || !supabaseKey || supabaseKey === 'YOUR_ANON_KEY_HERE') {
        console.log('Supabase가 설정되지 않았습니다. localStorage 모드로 실행합니다.');
        window.SUPABASE_ENABLED = false;
        return;
    }

    try {
        // Supabase SDK 동적 로드
        if (!window.supabase) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            document.head.appendChild(script);

            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
            });
        }

        // Supabase 클라이언트 생성
        window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        window.SUPABASE_ENABLED = true;

        console.log('✅ Supabase 초기화 완료');

        // 익명 세션 자동 생성
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) {
            const { data, error } = await window.supabaseClient.auth.signInAnonymously();
            if (error) {
                console.warn('익명 세션 생성 실패:', error);
            } else {
                console.log('✅ 익명 세션 생성 완료');
            }
        }

        // 마이그레이션 UI 표시 (설정 화면에 버튼 추가)
        showMigrationOption();

    } catch (error) {
        console.error('Supabase 초기화 실패:', error);
        window.SUPABASE_ENABLED = false;
    }
})();

// 마이그레이션 옵션 UI 표시
function showMigrationOption() {
    // 로비 화면에 마이그레이션 버튼 추가
    const lobbyContainer = document.querySelector('.lobby-container');
    if (!lobbyContainer) return;

    // 이미 추가되었는지 확인
    if (document.getElementById('supabase-migration-btn')) return;

    const migrationBtn = document.createElement('button');
    migrationBtn.id = 'supabase-migration-btn';
    migrationBtn.className = 'modal-btn primary';
    migrationBtn.style.cssText = 'margin: 20px auto; display: block; max-width: 400px;';
    migrationBtn.innerHTML = '☁️ 클라우드 동기화 활성화';
    migrationBtn.onclick = async () => {
        if (!window.SUPABASE_ENABLED) {
            showToast('Supabase가 설정되지 않았습니다.', { type: 'error' });
            return;
        }

        const confirm = window.confirm(
            '여행 데이터를 클라우드로 이동하시겠습니까?\n\n' +
            '✓ 기기 간 자동 동기화\n' +
            '✓ 데이터 손실 방지\n' +
            '✓ 무제한 저장 공간\n\n' +
            '기존 localStorage 데이터는 유지됩니다.'
        );

        if (!confirm) return;

        try {
            migrationBtn.disabled = true;
            migrationBtn.innerHTML = '⏳ 마이그레이션 중...';

            // SupabaseService 사용하여 마이그레이션
            const { supabaseService } = await import('./src/services/supabaseService.js');

            const count = await supabaseService.migrateFromLocalStorage();

            showToast(`✅ ${count}개 여행이 클라우드로 이동되었습니다!`, {
                type: 'success',
                duration: 5000
            });

            migrationBtn.innerHTML = '✅ 마이그레이션 완료';
            migrationBtn.disabled = true;

            // localStorage에 마이그레이션 완료 표시
            localStorage.setItem('supabaseMigrated', 'true');

        } catch (error) {
            console.error('마이그레이션 실패:', error);
            showToast('마이그레이션 중 오류가 발생했습니다: ' + error.message, {
                type: 'error',
                duration: 5000
            });
            migrationBtn.disabled = false;
            migrationBtn.innerHTML = '☁️ 클라우드 동기화 활성화';
        }
    };

    // 이미 마이그레이션 완료했으면 버튼 비활성화
    if (localStorage.getItem('supabaseMigrated') === 'true') {
        migrationBtn.innerHTML = '✅ 클라우드 동기화 활성화됨';
        migrationBtn.disabled = true;
        migrationBtn.style.opacity = '0.6';
    }

    // 로비 헤더 아래에 추가
    const lobbyHeader = lobbyContainer.querySelector('.lobby-header');
    if (lobbyHeader) {
        lobbyHeader.after(migrationBtn);
    }
}

// 자동 저장 시 Supabase에도 동기화
window.addEventListener('tripDataChanged', async (event) => {
    if (!window.SUPABASE_ENABLED) return;
    if (localStorage.getItem('supabaseMigrated') !== 'true') return;

    try {
        const { supabaseService } = await import('./src/services/supabaseService.js');
        const { tripName, tripData } = event.detail;

        // 백그라운드에서 동기화 (사용자 경험에 영향 없음)
        supabaseService.saveTrip({
            name: tripName,
            ...tripData
        }).catch(err => {
            console.error('Supabase 동기화 실패:', err);
        });

    } catch (error) {
        console.error('동기화 오류:', error);
    }
});
