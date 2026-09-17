/**
 * Triptic 모듈화된 진입점
 * 기존 index.html의 전역 변수와 함수들을 모듈로 대체
 */

// 상태 관리
import { appState } from './state/appState.js';

// 서비스
import { StorageService } from './services/storageService.js';
import { ApiService } from './services/apiService.js';

// 유틸리티
import { escapeHtml, safeHtml } from './utils/escapeHtml.js';
import { generateHourOptions, generateMinuteOptions, isValidTimeFormat, addMinutes } from './utils/timeUtils.js';
import { formatDate, calculateDaysBetween, getWeekday, WEEKDAYS } from './utils/dateUtils.js';

// 전역 노출 (기존 코드 호환성)
window.appState = appState;
window.StorageService = StorageService;
window.ApiService = ApiService;
window.escapeHtml = escapeHtml;
window.safeHtml = safeHtml;
window.generateHourOptions = generateHourOptions;
window.generateMinuteOptions = generateMinuteOptions;
window.isValidTimeFormat = isValidTimeFormat;
window.addMinutes = addMinutes;
window.formatDate = formatDate;
window.calculateDaysBetween = calculateDaysBetween;
window.getWeekday = getWeekday;
window.WEEKDAYS = WEEKDAYS;

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('Triptic 모듈화 버전 로드 완료');

    // 저장 공간 정보 출력
    const storageInfo = StorageService.getStorageInfo();
    console.log(`localStorage 사용량: ${storageInfo.used.toFixed(2)}MB / ${storageInfo.available}MB (${storageInfo.percentage.toFixed(1)}%)`);

    // 프로젝트 데이터 로드
    const projects = StorageService.load();
    console.log(`로드된 프로젝트 수: ${Object.keys(projects).length}`);
});

export {
    appState,
    StorageService,
    ApiService,
    escapeHtml,
    safeHtml,
    generateHourOptions,
    generateMinuteOptions,
    isValidTimeFormat,
    addMinutes,
    formatDate,
    calculateDaysBetween,
    getWeekday,
    WEEKDAYS
};
