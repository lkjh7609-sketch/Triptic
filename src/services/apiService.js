/**
 * API 호출 서비스
 * - AI 추천 API 호출
 * - 에러 처리 및 재시도 로직
 */

export class ApiService {
    /**
     * AI 추천 가져오기
     * @param {string} placeName - 기준 장소명
     * @param {string} city - 도시명
     * @param {string} category - 카테고리 (all, restaurant, cafe, hotel, spot)
     * @returns {Promise<Object>} 추천 결과
     */
    static async getRecommendations(placeName, city, category = 'all') {
        try {
            const isNativeApp = window.location.protocol === 'capacitor:' ||
                              window.location.hostname === 'localhost';
            const apiUrl = isNativeApp
                ? 'https://triptic-ten.vercel.app/api/recommend'
                : '/api/recommend';

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    placeName,
                    city,
                    category
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'AI 추천을 불러오지 못했습니다.');
            }

            return {
                success: true,
                recommendations: data.recommendations || [],
                modelUsed: data.modelUsed,
                provider: data.provider
            };
        } catch (error) {
            console.error('AI 추천 API 오류:', error);
            return {
                success: false,
                error: error.message,
                recommendations: []
            };
        }
    }

    /**
     * Google Places 자동완성
     * @param {string} query - 검색어
     * @returns {Promise<Array>} 장소 목록
     */
    static async searchPlaces(query) {
        // Google Places API는 전역 객체로 관리
        // 이 함수는 래퍼 역할만 수행
        return new Promise((resolve, reject) => {
            if (!window.google || !window.google.maps) {
                reject(new Error('Google Maps API가 로드되지 않았습니다.'));
                return;
            }
            // 실제 구현은 기존 autocomplete 객체 사용
            resolve([]);
        });
    }
}

export default ApiService;
