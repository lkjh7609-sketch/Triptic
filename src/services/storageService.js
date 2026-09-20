/**
 * localStorage 관리 서비스
 * - 용량 제한 체크
 * - 에러 처리
 * - 압축 및 마이그레이션
 */

const STORAGE_KEY = 'smartPlannerAllProjects';
const MAX_SIZE_MB = 4.5; // 5MB 제한 중 안전 마진
const BACKUP_KEY_STORAGE = 'smartPlannerBackupId';
const GUEST_NAME_KEY = 'tripticGuestName';

export class StorageService {
    /**
     * 모든 프로젝트 저장
     * @param {Object} projects - 저장할 프로젝트 객체
     * @param {boolean} silent - 성공 메시지 표시 여부
     * @returns {boolean} 저장 성공 여부
     */
    static save(projects, silent = false) {
        try {
            const serialized = JSON.stringify(projects);
            const sizeInMB = new Blob([serialized]).size / (1024 * 1024);

            // 용량 경고
            if (sizeInMB > MAX_SIZE_MB) {
                console.warn(`localStorage 용량 경고: ${sizeInMB.toFixed(2)}MB / 5MB`);
                this._showToast('저장 공간이 거의 가득 찼습니다. 백업 후 오래된 여행을 삭제하세요.', 'warning');
            }

            localStorage.setItem(STORAGE_KEY, serialized);

            if (!silent) {
                console.log(`저장 완료: ${sizeInMB.toFixed(2)}MB`);
            }

            return true;
        } catch (e) {
            return this._handleSaveError(e);
        }
    }

    /**
     * 모든 프로젝트 로드
     * @returns {Object} 프로젝트 객체
     */
    static load() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) return {};

            const parsed = JSON.parse(data);

            // 데이터 유효성 검증
            if (typeof parsed !== 'object' || Array.isArray(parsed)) {
                console.warn('Invalid projects data format');
                return {};
            }

            return parsed;
        } catch (e) {
            console.error('프로젝트 로드 실패:', e);
            this._showToast('데이터 로드 중 오류가 발생했습니다.', 'error');
            return {};
        }
    }

    /**
     * 백업 ID 저장
     * @param {string} id - 백업 ID
     */
    static saveBackupId(id) {
        try {
            localStorage.setItem(BACKUP_KEY_STORAGE, id);
        } catch (e) {
            console.error('백업 ID 저장 실패:', e);
        }
    }

    /**
     * 백업 ID 로드
     * @returns {string|null} 백업 ID
     */
    static loadBackupId() {
        return localStorage.getItem(BACKUP_KEY_STORAGE);
    }

    /**
     * 게스트 이름 저장
     * @param {string} name - 게스트 이름
     */
    static saveGuestName(name) {
        try {
            if (name) {
                localStorage.setItem(GUEST_NAME_KEY, name);
            }
        } catch (e) {
            console.error('게스트 이름 저장 실패:', e);
        }
    }

    /**
     * 게스트 이름 로드
     * @returns {string} 게스트 이름
     */
    static loadGuestName() {
        return localStorage.getItem(GUEST_NAME_KEY) || '';
    }

    /**
     * 저장 공간 사용량 조회
     * @returns {Object} { used: number, available: number, percentage: number }
     */
    static getStorageInfo() {
        try {
            const data = localStorage.getItem(STORAGE_KEY) || '{}';
            const usedBytes = new Blob([data]).size;
            const usedMB = usedBytes / (1024 * 1024);
            const maxBytes = 5 * 1024 * 1024; // 5MB

            return {
                used: usedMB,
                available: 5,
                percentage: (usedBytes / maxBytes) * 100
            };
        } catch {
            return { used: 0, available: 5, percentage: 0 };
        }
    }

    /**
     * 전체 데이터 삭제
     */
    static clear() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            return true;
        } catch (e) {
            console.error('데이터 삭제 실패:', e);
            return false;
        }
    }

    /**
     * 저장 오류 처리
     * @private
     */
    static _handleSaveError(error) {
        if (error.name === 'QuotaExceededError') {
            console.error('localStorage 용량 초과:', error);
            this._showToast('저장 공간이 가득 찼습니다. 백업 후 일부 여행을 삭제해 주세요.', 'error');
        } else {
            console.error('저장 오류:', error);
            this._showToast('데이터 저장 중 오류가 발생했습니다.', 'error');
        }
        return false;
    }

    /**
     * Toast 메시지 표시 (전역 함수 호출)
     * @private
     */
    static _showToast(message, type = 'info') {
        if (typeof window !== 'undefined' && window.showToast) {
            window.showToast(message, { type });
        }
    }
}

export default StorageService;
