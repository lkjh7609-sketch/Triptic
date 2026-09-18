/**
 * @jest-environment jsdom
 */

import { appState } from '../state/appState.js';

describe('AppState', () => {
    beforeEach(() => {
        // 각 테스트 전에 상태 초기화
        appState.reset();
    });

    describe('Basic getters and setters', () => {
        test('currentDay를 설정하고 가져올 수 있어야 함', () => {
            appState.setCurrentDay(3);
            expect(appState.currentDay).toBe(3);
        });

        test('activeProject를 설정하고 가져올 수 있어야 함', () => {
            appState.setActiveProject('Tokyo Trip');
            expect(appState.activeProjectName).toBe('Tokyo Trip');
        });

        test('mode를 설정하고 가져올 수 있어야 함', () => {
            appState.setMode('view');
            expect(appState.currentMode).toBe('view');
        });

        test('여행 정보를 설정하고 가져올 수 있어야 함', () => {
            appState.setTripInfo({
                city: 'Osaka',
                start: '2026-09-16',
                end: '2026-09-23',
                totalDays: 8
            });

            expect(appState.tripCity).toBe('Osaka');
            expect(appState.tripStart).toBe('2026-09-16');
            expect(appState.tripEnd).toBe('2026-09-23');
            expect(appState.totalDays).toBe(8);
        });
    });

    describe('Event subscription', () => {
        test('dayChanged 이벤트를 구독할 수 있어야 함', () => {
            const listener = jest.fn();
            appState.subscribe('dayChanged', listener);

            appState.setCurrentDay(5);

            expect(listener).toHaveBeenCalledWith(5);
            expect(listener).toHaveBeenCalledTimes(1);
        });

        test('projectChanged 이벤트를 구독할 수 있어야 함', () => {
            const listener = jest.fn();
            appState.subscribe('projectChanged', listener);

            appState.setActiveProject('Kyoto Trip');

            expect(listener).toHaveBeenCalledWith('Kyoto Trip');
        });

        test('여러 리스너가 동일한 이벤트를 구독할 수 있어야 함', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();

            appState.subscribe('dayChanged', listener1);
            appState.subscribe('dayChanged', listener2);

            appState.setCurrentDay(2);

            expect(listener1).toHaveBeenCalledWith(2);
            expect(listener2).toHaveBeenCalledWith(2);
        });

        test('구독을 해제할 수 있어야 함', () => {
            const listener = jest.fn();
            const unsubscribe = appState.subscribe('dayChanged', listener);

            // reset() 직후 currentDay는 이미 1이므로, 실제 변경이 발생하는 값으로 설정해야 함
            appState.setCurrentDay(2);
            expect(listener).toHaveBeenCalledTimes(1);

            unsubscribe(); // 구독 해제

            appState.setCurrentDay(3);
            expect(listener).toHaveBeenCalledTimes(1); // 더 이상 호출 안됨
        });

        test('같은 값으로 설정하면 이벤트가 발생하지 않아야 함', () => {
            appState.setCurrentDay(1);

            const listener = jest.fn();
            appState.subscribe('dayChanged', listener);

            appState.setCurrentDay(1); // 같은 값

            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('Data management', () => {
        test('plannerData를 업데이트할 수 있어야 함', () => {
            const listener = jest.fn();
            appState.subscribe('plannerDataChanged', listener);

            const places = [
                { name: 'Dotonbori', lat: 34.668, lng: 135.500 }
            ];

            appState.updatePlannerData(1, places);

            expect(listener).toHaveBeenCalledWith({ day: 1, data: places });
            expect(appState.plannerData[1]).toEqual(places);
        });

        test('프로젝트를 추가할 수 있어야 함', () => {
            const listener = jest.fn();
            appState.subscribe('projectAdded', listener);

            const project = {
                city: 'Tokyo',
                startDate: '2026-10-01'
            };

            appState.addProject('Tokyo Trip', project);

            expect(listener).toHaveBeenCalledWith({
                name: 'Tokyo Trip',
                project
            });
            expect(appState.allProjects['Tokyo Trip']).toEqual(project);
        });

        test('프로젝트를 삭제할 수 있어야 함', () => {
            const listener = jest.fn();

            appState.addProject('Test Trip', { city: 'Seoul' });
            appState.subscribe('projectDeleted', listener);

            appState.deleteProject('Test Trip');

            expect(listener).toHaveBeenCalledWith('Test Trip');
            expect(appState.allProjects['Test Trip']).toBeUndefined();
        });
    });

    describe('State reset', () => {
        test('reset은 모든 상태를 초기화해야 함', () => {
            const listener = jest.fn();
            appState.subscribe('stateReset', listener);

            // 상태 설정
            appState.setCurrentDay(5);
            appState.setActiveProject('Test');
            appState.addProject('Trip', { city: 'Seoul' });

            // 리셋
            appState.reset();

            expect(listener).toHaveBeenCalled();
            expect(appState.currentDay).toBe(1);
            expect(appState.activeProjectName).toBeNull();
            expect(appState.allProjects).toEqual({});
        });
    });

    describe('Error handling in listeners', () => {
        test('리스너 에러가 다른 리스너에 영향을 주지 않아야 함', () => {
            const errorListener = jest.fn(() => {
                throw new Error('Listener error');
            });
            const normalListener = jest.fn();

            appState.subscribe('dayChanged', errorListener);
            appState.subscribe('dayChanged', normalListener);

            // 에러가 발생해도 다른 리스너는 실행되어야 함
            expect(() => {
                appState.setCurrentDay(3);
            }).not.toThrow();

            expect(errorListener).toHaveBeenCalled();
            expect(normalListener).toHaveBeenCalledWith(3);
        });
    });
});
