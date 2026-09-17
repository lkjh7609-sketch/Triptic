/**
 * @jest-environment jsdom
 */

import { StorageService } from '../services/storageService.js';

// localStorage mock
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

global.localStorage = localStorageMock;
global.showToast = jest.fn(); // Toast 함수 mock

describe('StorageService', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    describe('save', () => {
        test('프로젝트를 성공적으로 저장해야 함', () => {
            const projects = {
                'Tokyo Trip': {
                    city: 'Tokyo',
                    startDate: '2026-10-01',
                    endDate: '2026-10-05'
                }
            };

            const result = StorageService.save(projects);
            expect(result).toBe(true);

            const saved = localStorage.getItem('smartPlannerAllProjects');
            expect(saved).toBeTruthy();
            expect(JSON.parse(saved)).toEqual(projects);
        });

        test('용량이 4.5MB를 초과하면 경고해야 함', () => {
            // 큰 데이터 생성 (약 5MB)
            const largeData = 'x'.repeat(5 * 1024 * 1024);
            const projects = { 'Big Trip': { data: largeData } };

            StorageService.save(projects);

            expect(global.showToast).toHaveBeenCalledWith(
                expect.stringContaining('저장 공간이 거의 가득'),
                expect.objectContaining({ type: 'warning' })
            );
        });
    });

    describe('load', () => {
        test('저장된 프로젝트를 불러와야 함', () => {
            const projects = { 'Trip': { city: 'Seoul' } };
            localStorage.setItem('smartPlannerAllProjects', JSON.stringify(projects));

            const loaded = StorageService.load();
            expect(loaded).toEqual(projects);
        });

        test('데이터가 없으면 빈 객체를 반환해야 함', () => {
            const loaded = StorageService.load();
            expect(loaded).toEqual({});
        });

        test('잘못된 JSON 형식은 빈 객체를 반환해야 함', () => {
            localStorage.setItem('smartPlannerAllProjects', 'invalid json');

            const loaded = StorageService.load();
            expect(loaded).toEqual({});
        });
    });

    describe('getStorageInfo', () => {
        test('저장 공간 사용량 정보를 반환해야 함', () => {
            const projects = { 'Trip': { city: 'Seoul' } };
            StorageService.save(projects);

            const info = StorageService.getStorageInfo();
            expect(info).toHaveProperty('used');
            expect(info).toHaveProperty('available');
            expect(info).toHaveProperty('percentage');
            expect(info.available).toBe(5); // 5MB
            expect(info.percentage).toBeGreaterThanOrEqual(0);
            expect(info.percentage).toBeLessThanOrEqual(100);
        });
    });

    describe('Backup ID management', () => {
        test('백업 ID를 저장하고 불러와야 함', () => {
            const backupId = 'T1234-ABCD';
            StorageService.saveBackupId(backupId);

            const loaded = StorageService.loadBackupId();
            expect(loaded).toBe(backupId);
        });

        test('백업 ID가 없으면 null을 반환해야 함', () => {
            const loaded = StorageService.loadBackupId();
            expect(loaded).toBeNull();
        });
    });

    describe('Guest name management', () => {
        test('게스트 이름을 저장하고 불러와야 함', () => {
            const name = '홍길동';
            StorageService.saveGuestName(name);

            const loaded = StorageService.loadGuestName();
            expect(loaded).toBe(name);
        });

        test('이름이 없으면 빈 문자열을 반환해야 함', () => {
            const loaded = StorageService.loadGuestName();
            expect(loaded).toBe('');
        });
    });
});
