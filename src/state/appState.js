/**
 * Triptic 상태 관리 클래스
 * 전역 변수를 대체하는 중앙 집중식 상태 관리
 */

class TripticState {
    constructor() {
        // 여행 데이터
        this._allProjects = {};
        this._activeProjectName = null;
        this._currentDay = 1;
        this._plannerData = {};
        this._hotelsData = {};
        this._mealsData = {};
        this._expensesData = {};
        this._flightsData = { outbound: null, return: null };

        // 여행 메타 정보
        this._tripCity = '';
        this._tripCityLat = null;
        this._tripCityLng = null;
        this._tripStart = '';
        this._tripEnd = '';
        this._totalTripDays = 0;
        this._tripDates = {};
        this._tripCurrency = 'KRW';

        // UI 상태
        this._currentMode = 'edit';
        this._sharedProjectName = null;
        this._activeShareId = null;
        this._backupId = null;

        // 지도 객체
        this._map = null;
        this._autocomplete = null;
        this._markers = [];

        // 이벤트 리스너
        this._listeners = new Map();
    }

    // Getters
    get allProjects() { return this._allProjects; }
    get activeProjectName() { return this._activeProjectName; }
    get currentDay() { return this._currentDay; }
    get plannerData() { return this._plannerData; }
    get hotelsData() { return this._hotelsData; }
    get mealsData() { return this._mealsData; }
    get expensesData() { return this._expensesData; }
    get flightsData() { return this._flightsData; }
    get tripCity() { return this._tripCity; }
    get tripStart() { return this._tripStart; }
    get tripEnd() { return this._tripEnd; }
    get totalDays() { return this._totalTripDays; }
    get currentMode() { return this._currentMode; }
    get map() { return this._map; }

    // Setters with change notification
    setCurrentDay(day) {
        if (this._currentDay !== day) {
            this._currentDay = day;
            this._notify('dayChanged', day);
        }
    }

    setActiveProject(projectName) {
        if (this._activeProjectName !== projectName) {
            this._activeProjectName = projectName;
            this._notify('projectChanged', projectName);
        }
    }

    setMode(mode) {
        if (this._currentMode !== mode) {
            this._currentMode = mode;
            this._notify('modeChanged', mode);
        }
    }

    setTripInfo({ city, start, end, totalDays }) {
        this._tripCity = city;
        this._tripStart = start;
        this._tripEnd = end;
        this._totalTripDays = totalDays;
        this._notify('tripInfoChanged', { city, start, end, totalDays });
    }

    setMap(map) {
        this._map = map;
    }

    setAutocomplete(autocomplete) {
        this._autocomplete = autocomplete;
    }

    // 데이터 업데이트
    updatePlannerData(day, data) {
        this._plannerData[day] = data;
        this._notify('plannerDataChanged', { day, data });
    }

    updateHotelData(day, hotel) {
        this._hotelsData[day] = hotel;
        this._notify('hotelDataChanged', { day, hotel });
    }

    updateFlightData(type, flight) {
        this._flightsData[type] = flight;
        this._notify('flightDataChanged', { type, flight });
    }

    // 프로젝트 관리
    addProject(name, project) {
        this._allProjects[name] = project;
        this._notify('projectAdded', { name, project });
    }

    deleteProject(name) {
        delete this._allProjects[name];
        this._notify('projectDeleted', name);
    }

    // 이벤트 구독
    subscribe(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        this._listeners.get(event).push(callback);

        // 구독 해제 함수 반환
        return () => {
            const callbacks = this._listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }

    // 이벤트 발행
    _notify(event, data) {
        const callbacks = this._listeners.get(event) || [];
        callbacks.forEach(cb => {
            try {
                cb(data);
            } catch (error) {
                console.error(`Error in ${event} listener:`, error);
            }
        });
    }

    // 상태 초기화
    reset() {
        this._allProjects = {};
        this._activeProjectName = null;
        this._currentDay = 1;
        this._plannerData = {};
        this._hotelsData = {};
        this._mealsData = {};
        this._expensesData = {};
        this._flightsData = { outbound: null, return: null };
        this._notify('stateReset', null);
        // stateReset 알림 이후 리스너를 비워, 테스트/화면 전환 간 구독이 누수되지 않도록 함
        this._listeners.clear();
    }
}

// 싱글톤 인스턴스 생성 및 export
export const appState = new TripticState();

// 브라우저 환경에서 전역 접근 가능하도록 (기존 코드 호환성)
if (typeof window !== 'undefined') {
    window.appState = appState;
}
