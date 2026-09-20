/**
 * 현재 위치 버튼 (index.html addCurrentLocationControl 이식 — ADR-001)
 * 원본: index.html addCurrentLocationControl (2026-09-20 기준 라인 6967~7033).
 * 지도 우하단에 커스텀 컨트롤을 추가하고, 클릭 시 geolocation으로 지도를 이동시킨다.
 * Google Maps 컨트롤 자체가 DOM 엘리먼트 기반이라, React 렌더 트리 밖에서
 * imperative하게 다루는 것이 원본과 동일한 방식이다.
 */
import { useEffect } from 'react';

export function useCurrentLocationControl(map: google.maps.Map | null) {
  useEffect(() => {
    if (!map) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'current-location-btn';
    btn.title = '현재 위치로 이동';
    btn.setAttribute('aria-label', '현재 위치로 이동');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
      </svg>
    `;
    btn.style.cssText =
      'background:#fff;border:none;border-radius:8px;width:40px;height:40px;margin:10px;box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:pointer;display:flex;align-items:center;justify-content:center;color:#1E3A5F;';

    let locationMarker: google.maps.Marker | null = null;

    btn.addEventListener('click', () => {
      if (!navigator.geolocation) return;
      btn.disabled = true;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          btn.disabled = false;
          const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          map.panTo(here);
          map.setZoom(16);

          if (locationMarker) {
            locationMarker.setPosition(here);
          } else {
            locationMarker = new google.maps.Marker({
              map,
              position: here,
              title: '현재 위치',
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#2563EB',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              },
              zIndex: 999,
            });
          }
        },
        () => {
          btn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
      );
    });

    const controls = map.controls[google.maps.ControlPosition.RIGHT_BOTTOM];
    controls.push(btn);

    return () => {
      locationMarker?.setMap(null);
      for (let i = 0; i < controls.getLength(); i++) {
        if (controls.getAt(i) === btn) {
          controls.removeAt(i);
          break;
        }
      }
    };
  }, [map]);
}
