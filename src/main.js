/**
 * Triptic 모듈 진입점
 *
 * index.html은 여전히 대부분의 UI 로직을 인라인 classic <script>로 담고 있지만
 * (전면 모듈화는 단계적으로 진행 중), 데이터 계층(Supabase 저장/공유/제안)과
 * 순수 유틸리티는 이 모듈에서 관리하고 window에 노출해 인라인 스크립트가
 * 호출할 수 있게 한다.
 *
 * 이 스크립트는 <script type="module">로 로드되어 파싱이 끝난 뒤(defer와 동일한
 * 시점)에 실행된다. 인라인 classic 스크립트들이 정의하는 함수(openShareModal 등)는
 * '정의'만 될 뿐 사용자가 실제로 클릭하기 전까지 호출되지 않으므로, 이 모듈이
 * window.TripticCloud를 채우는 시점이 약간 늦어도 안전하다.
 */

import { appState } from './state/appState.js';
import { StorageService } from './services/storageService.js';
import { ApiService } from './services/apiService.js';
import { supabaseService } from './services/supabaseService.js';
import { getSupabaseClient } from './services/supabaseClient.js';
import { escapeHtml, safeHtml } from './utils/escapeHtml.js';
import { generateHourOptions, generateMinuteOptions, isValidTimeFormat, addMinutes } from './utils/timeUtils.js';
import { formatDate, calculateDaysBetween, getWeekday, WEEKDAYS } from './utils/dateUtils.js';
import { generateShortId } from './utils/id.js';

// ── 기존 코드 호환을 위한 전역 노출 ──────────────────────────────────
window.appState = appState;
window.StorageService = StorageService;
window.ApiService = ApiService;
window.escapeHtml = window.escapeHtml || escapeHtml; // 인라인 스크립트가 이미 자체 정의를 갖고 있으면 그것을 우선 (완전 이관 전 과도기)
window.safeHtml = safeHtml;
window.generateHourOptions = generateHourOptions;
window.generateMinuteOptions = generateMinuteOptions;
window.isValidTimeFormat = isValidTimeFormat;
window.addMinutes = addMinutes;
window.formatDate = formatDate;
window.calculateDaysBetween = calculateDaysBetween;
window.getWeekday = getWeekday;
window.WEEKDAYS = WEEKDAYS;
window.generateShortId = generateShortId;

/**
 * 여행 데이터 클라우드 동기화 계층 (구 Firebase 호출부 대체)
 * index.html의 인라인 스크립트에서 window.TripticCloud.xxx(...) 형태로 호출한다.
 */
window.TripticCloud = {
    saveTrip: (project, name) => supabaseService.saveTrip(project, name),
    deleteTrip: (tripId) => supabaseService.deleteTrip(tripId),
    listTrips: () => supabaseService.listTrips(),
    toLocalProject: (row) => supabaseService.toLocalProject(row),
    createShareLink: (tripId) => supabaseService.createShareLink(tripId),
    revokeShareLinks: (tripId) => supabaseService.revokeShareLinks(tripId),
    getSharedTripByCode: (code) => supabaseService.getSharedTripByCode(code),
    addSuggestion: (tripId, suggestion) => supabaseService.addSuggestion(tripId, suggestion),
    listSuggestions: (tripId) => supabaseService.listSuggestions(tripId),
    deleteSuggestion: (id) => supabaseService.deleteSuggestion(id),
    getCurrentUser: () => supabaseService.getCurrentUser(),
    /** Supabase 클라이언트가 준비될 때까지 대기 (디버깅/콘솔용) */
    ready: () => getSupabaseClient()
};

document.addEventListener('DOMContentLoaded', () => {
    const storageInfo = StorageService.getStorageInfo();
    console.log(`localStorage 사용량: ${storageInfo.used.toFixed(2)}MB / ${storageInfo.available}MB (${storageInfo.percentage.toFixed(1)}%)`);
});

export {
    appState,
    StorageService,
    ApiService,
    supabaseService,
    escapeHtml,
    safeHtml,
    generateHourOptions,
    generateMinuteOptions,
    isValidTimeFormat,
    addMinutes,
    formatDate,
    calculateDaysBetween,
    getWeekday,
    WEEKDAYS,
    generateShortId
};
