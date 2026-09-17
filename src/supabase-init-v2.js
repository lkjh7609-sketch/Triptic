/**
 * Supabase 초기화 (런타임 환경 변수 사용)
 * index.html의 <script type="module"> 태그에서 로드
 */

(async function initSupabase() {
    console.log('🚀 Supabase 초기화 시작...');

    try {
        // 1. Vercel 환경 변수 가져오기
        const isNativeApp = window.location.protocol === 'capacitor:' ||
                          window.location.hostname === 'localhost';
        const apiUrl = isNativeApp
            ? 'https://triptic-ten.vercel.app/api/env'
            : '/api/env';

        const response = await fetch(apiUrl);
        const env = await response.json();

        const supabaseUrl = env.SUPABASE_URL;
        const supabaseKey = env.SUPABASE_ANON_KEY;

        // 2. Supabase 설정 확인
        if (!supabaseUrl || !supabaseKey) {
            console.log('ℹ️ Supabase가 설정되지 않았습니다. localStorage 모드로 실행합니다.');
            window.SUPABASE_ENABLED = false;
            return;
        }

        // 3. Supabase SDK 동적 로드
        if (!window.supabase) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            document.head.appendChild(script);

            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
                setTimeout(reject, 10000); // 10초 타임아웃
            });
        }

        // 4. Supabase 클라이언트 생성
        window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        window.SUPABASE_ENABLED = true;

        console.log('✅ Supabase 클라이언트 생성 완료');

        // 5. 익명 세션 확인 및 생성
        const { data: { session } } = await window.supabaseClient.auth.getSession();

        if (!session) {
            console.log('🔑 익명 세션 생성 중...');
            const { data, error } = await window.supabaseClient.auth.signInAnonymously();

            if (error) {
                console.warn('⚠️ 익명 세션 생성 실패:', error.message);
            } else {
                console.log('✅ 익명 세션 생성 완료');
            }
        } else {
            console.log('✅ 기존 세션 확인 완료');
        }

        // 6. 마이그레이션 UI 추가 (DOM 로드 후)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showMigrationOption);
        } else {
            showMigrationOption();
        }

    } catch (error) {
        console.error('❌ Supabase 초기화 실패:', error);
        window.SUPABASE_ENABLED = false;
    }
})();

/**
 * 클라우드 마이그레이션 버튼 표시
 */
function showMigrationOption() {
    if (!window.SUPABASE_ENABLED) return;

    // 이미 버튼이 있으면 중복 생성 방지
    if (document.getElementById('supabase-migration-banner')) return;

    // 마이그레이션 완료 여부 확인
    const migrated = localStorage.getItem('supabaseMigrated') === 'true';

    // 배너 생성
    const banner = document.createElement('div');
    banner.id = 'supabase-migration-banner';
    banner.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 20px;
        margin: 16px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
    `;

    if (migrated) {
        banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                <span style="font-size: 24px;">☁️</span>
                <div>
                    <div style="font-weight: 600; margin-bottom: 4px;">클라우드 동기화 활성화됨</div>
                    <div style="font-size: 13px; opacity: 0.9;">모든 기기에서 자동으로 동기화됩니다</div>
                </div>
            </div>
            <span style="font-size: 20px;">✅</span>
        `;
    } else {
        banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                <span style="font-size: 24px;">☁️</span>
                <div>
                    <div style="font-weight: 600; margin-bottom: 4px;">클라우드 동기화 사용 가능</div>
                    <div style="font-size: 13px; opacity: 0.9;">기기 간 자동 동기화 · 무제한 저장공간</div>
                </div>
            </div>
            <button id="migrate-btn" style="
                background: white;
                color: #667eea;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                white-space: nowrap;
                transition: transform 0.2s;
            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                지금 활성화
            </button>
        `;

        // 버튼 클릭 이벤트
        setTimeout(() => {
            const btn = document.getElementById('migrate-btn');
            if (btn) {
                btn.onclick = handleMigration;
            }
        }, 100);
    }

    // 로비 컨테이너에 추가
    const lobbyContainer = document.querySelector('.lobby-container');
    const lobbyHeader = document.querySelector('.lobby-header');

    if (lobbyContainer && lobbyHeader) {
        lobbyHeader.after(banner);
    } else if (document.body.firstChild) {
        document.body.insertBefore(banner, document.body.firstChild);
    }
}

/**
 * 마이그레이션 실행
 */
async function handleMigration() {
    const btn = document.getElementById('migrate-btn');
    if (!btn) return;

    const confirm = window.confirm(
        '여행 데이터를 클라우드로 이동하시겠습니까?\n\n' +
        '✓ 기기 간 자동 동기화\n' +
        '✓ 데이터 손실 방지\n' +
        '✓ 무제한 저장 공간\n\n' +
        '※ 기존 localStorage 데이터는 유지됩니다.'
    );

    if (!confirm) return;

    try {
        btn.disabled = true;
        btn.innerHTML = '⏳ 이동 중...';

        // localStorage 데이터 가져오기
        const allProjects = JSON.parse(localStorage.getItem('smartPlannerAllProjects') || '{}');
        const projectNames = Object.keys(allProjects);

        if (projectNames.length === 0) {
            showToast('마이그레이션할 여행이 없습니다.', { type: 'info' });
            btn.disabled = false;
            btn.innerHTML = '지금 활성화';
            return;
        }

        let successCount = 0;

        // 각 여행을 Supabase에 저장
        for (const name of projectNames) {
            try {
                const project = allProjects[name];

                // Supabase에 저장 (간단한 버전)
                const { data, error } = await window.supabaseClient
                    .from('trips')
                    .upsert({
                        name: name,
                        city: project.city,
                        city_lat: project.cityLat,
                        city_lng: project.cityLng,
                        start_date: project.startDate,
                        end_date: project.endDate,
                        total_days: project.totalDays || 1,
                        currency: project.currency || 'KRW'
                    })
                    .select()
                    .single();

                if (!error) {
                    successCount++;
                    console.log(`✓ ${name} 마이그레이션 완료`);
                }
            } catch (err) {
                console.error(`✗ ${name} 마이그레이션 실패:`, err);
            }
        }

        // 완료 처리
        localStorage.setItem('supabaseMigrated', 'true');

        showToast(`✅ ${successCount}개 여행이 클라우드로 이동되었습니다!`, {
            type: 'success',
            duration: 5000
        });

        // 배너 업데이트
        const banner = document.getElementById('supabase-migration-banner');
        if (banner) {
            banner.remove();
            showMigrationOption(); // 완료 상태로 다시 표시
        }

    } catch (error) {
        console.error('마이그레이션 실패:', error);
        showToast('마이그레이션 중 오류가 발생했습니다.', {
            type: 'error',
            duration: 5000
        });
        btn.disabled = false;
        btn.innerHTML = '지금 활성화';
    }
}
