# 도시 대표 사진 만들기 안내 (100곳)

사용자가 직접 Google Nano Banana(Gemini 이미지 생성)로 만들어 오는 도시 대표 사진의 규격·프롬프트·목록. 사진을 받으면 변환·업로드해 `destinations.cover_url`을 채운다.

## 규격
- **파일 이름: `슬러그.확장자`** (예: `osaka.png`) — 아래 표의 slug 그대로. 확장자는 PNG·JPG·WebP 아무거나(제가 1200×900 WebP로 변환·압축합니다).
- **가로 4:3** (예: 1600×1200). 가운데에 대표 장면을 두세요 — 앱에서 정사각형·원형·와이드로 잘려 쓰입니다(여행지 선택 창 썸네일은 40px 정사각형).
- 글자·로고·워터마크 없음, 사람 얼굴 클로즈업 없음. 시리즈 느낌이 나도록 **같은 스타일 문장**을 모든 도시에 씁니다.
- 생성 결과의 **랜드마크가 실제와 맞는지** 꼭 확인(AI가 건물 모양을 틀리게 그리는 경우가 있음). Gemini 앱에서 만든 이미지에 눈에 보이는 워터마크가 붙는지 확인하고, 있으면 없는 방식으로 만들거나 잘라내야 합니다. 상업 이용 조건은 Google 이용약관으로 확인하세요.

> 복사해서 바로 쓰는 도시별 한 줄 프롬프트는 `docs/destination-cover-prompts.md`에 있다(아래 영어 템플릿은 참고용).

## 프롬프트 템플릿 (영어 권장)
```
A photorealistic travel photograph of {English}, {country}: {scene}.
Golden-hour natural light, vivid but natural colors, sharp detail, wide 4:3 landscape composition,
main subject centered with safe margins, no text, no logos, no watermark, no close-up faces.
```
(표의 `scene` 칸 문장을 `{scene}`에 넣으면 됩니다. 마음에 안 들면 장면만 바꾸세요.)

## 도시 목록
| slug | 한국어 | English | 국가 | scene |
|---|---|---|---|---|
| abudhabi | 아부다비 | Abu Dhabi | AE | Sheikh Zayed Grand Mosque at sunset |
| amsterdam | 암스테르담 | Amsterdam | NL | canal houses along a canal at dusk |
| athens | 아테네 | Athens | GR | Acropolis and Parthenon at golden hour |
| auckland | 오클랜드 | Auckland | NZ | Sky Tower and harbour skyline |
| bali | 발리 | Bali | ID | Ubud rice terraces with palm trees |
| bangkok | 방콕 | Bangkok | TH | Wat Arun temple across the river at sunset |
| barcelona | 바르셀로나 | Barcelona | ES | Sagrada Família towers |
| beijing | 베이징 | Beijing | CN | Forbidden City gate and red walls |
| beppu | 벳푸 | Beppu | JP | steaming hot spring pools ("Hells") with rising steam |
| berlin | 베를린 | Berlin | DE | Brandenburg Gate |
| boracay | 보라카이 | Boracay | PH | White Beach at sunset with sailboats |
| brisbane | 브리즈번 | Brisbane | AU | South Bank and river skyline |
| brussels | 브뤼셀 | Brussels | BE | Grand-Place guildhalls |
| budapest | 부다페스트 | Budapest | HU | Parliament building on the Danube at dusk |
| buenosaires | 부에노스아이레스 | Buenos Aires | AR | colorful houses of La Boca (Caminito) |
| busan | 부산 | Busan | KR | Gamcheon Culture Village colorful hillside houses |
| cairo | 카이로 | Cairo | EG | Giza pyramids in warm light |
| cancun | 칸쿤 | Cancún | MX | turquoise Caribbean beach |
| capetown | 케이프타운 | Cape Town | ZA | Table Mountain above the city and bay |
| cebu | 세부 | Cebu | PH | Kawasan Falls turquoise water |
| chiangmai | 치앙마이 | Chiang Mai | TH | Wat Phra That Doi Suthep golden temple |
| copenhagen | 코펜하겐 | Copenhagen | DK | Nyhavn colorful harbor |
| cusco | 쿠스코 | Cusco | PE | Plaza de Armas with Andean hills |
| danang | 다낭 | Da Nang | VN | Dragon Bridge lit up at night |
| delhi | 델리 | Delhi | IN | India Gate |
| doha | 도하 | Doha | QA | Museum of Islamic Art with skyline |
| dubai | 두바이 | Dubai | AE | Burj Khalifa skyline |
| dublin | 더블린 | Dublin | IE | Ha'penny Bridge over the Liffey |
| dubrovnik | 두브로브니크 | Dubrovnik | HR | old town walls and red roofs by the Adriatic |
| fiji | 피지 | Fiji | FJ | palm beach with turquoise lagoon |
| florence | 피렌체 | Florence | IT | Duomo and Ponte Vecchio |
| fukuoka | 후쿠오카 | Fukuoka | JP | yatai food stalls glowing at night along the river |
| gangneung | 강릉 | Gangneung | KR | sunrise over Gyeongpo Beach |
| guam | 괌 | Guam | GU | Two Lovers Point over turquoise sea |
| gyeongju | 경주 | Gyeongju | KR | Donggung Palace and Wolji Pond at night |
| hanoi | 하노이 | Hanoi | VN | Hoan Kiem Lake and Turtle Tower |
| havana | 아바나 | Havana | CU | classic cars on a colorful Old Havana street |
| hawaii | 하와이 | Hawaii | US | Waikiki Beach with Diamond Head |
| hochiminh | 호치민 | Ho Chi Minh City | VN | Saigon skyline with Landmark 81 |
| hongkong | 홍콩 | Hong Kong | HK | Victoria Harbour skyline |
| istanbul | 이스탄불 | Istanbul | TR | Hagia Sophia and the Bosphorus |
| jaipur | 자이푸르 | Jaipur | IN | Hawa Mahal pink facade |
| jeju | 제주 | Jeju | KR | Seongsan Ilchulbong crater at sunrise |
| jeonju | 전주 | Jeonju | KR | Hanok Village tiled rooftops |
| kaohsiung | 가오슝 | Kaohsiung | TW | Dragon and Tiger Pagodas at Lotus Pond |
| kathmandu | 카트만두 | Kathmandu | NP | Swayambhunath stupa with prayer flags |
| kualalumpur | 쿠알라룸푸르 | Kuala Lumpur | MY | Petronas Twin Towers at dusk |
| kyoto | 교토 | Kyoto | JP | Fushimi Inari red torii gates |
| lasvegas | 라스베가스 | Las Vegas | US | the Strip with neon lights at night |
| lima | 리마 | Lima | PE | Miraflores cliffside coast at sunset |
| lisbon | 리스본 | Lisbon | PT | yellow tram in Alfama |
| london | 런던 | London | GB | Tower Bridge over the Thames |
| losangeles | LA | Los Angeles | US | Santa Monica Pier at sunset |
| macau | 마카오 | Macau | MO | Ruins of St. Paul's facade |
| madrid | 마드리드 | Madrid | ES | Royal Palace of Madrid |
| male | 말레 | Malé | MV | aerial view of Malé island and turquoise sea |
| marrakech | 마라케시 | Marrakech | MA | Jemaa el-Fnaa square at dusk |
| melbourne | 멜버른 | Melbourne | AU | Flinders Street Station with a city tram |
| mexicocity | 멕시코시티 | Mexico City | MX | Palacio de Bellas Artes |
| miami | 마이애미 | Miami | US | South Beach art deco buildings and palm trees |
| milan | 밀라노 | Milan | IT | Duomo di Milano |
| mumbai | 뭄바이 | Mumbai | IN | Gateway of India |
| munich | 뮌헨 | Munich | DE | Marienplatz and New Town Hall |
| nagoya | 나고야 | Nagoya | JP | Nagoya Castle with golden shachihoko |
| nairobi | 나이로비 | Nairobi | KE | giraffes on the savanna with the city skyline behind |
| newyork | 뉴욕 | New York | US | Manhattan skyline with Brooklyn Bridge |
| nhatrang | 나트랑 | Nha Trang | VN | Nha Trang bay and beach |
| okinawa | 오키나와 | Okinawa | JP | Kouri Island bridge over turquoise water |
| osaka | 오사카 | Osaka | JP | Dotonbori canal neon at night |
| paris | 파리 | Paris | FR | Eiffel Tower |
| phuket | 푸켓 | Phuket | TH | Phang Nga Bay limestone karsts |
| prague | 프라하 | Prague | CZ | Charles Bridge and Prague Castle |
| queenstown | 퀸스타운 | Queenstown | NZ | Lake Wakatipu with the Remarkables |
| riodejaneiro | 리우데자네이루 | Rio de Janeiro | BR | Christ the Redeemer and Sugarloaf Mountain |
| rome | 로마 | Rome | IT | Colosseum |
| saipan | 사이판 | Saipan | MP | Managaha island turquoise lagoon |
| sanfrancisco | 샌프란시스코 | San Francisco | US | Golden Gate Bridge |
| santiago | 산티아고 | Santiago | CL | city skyline with the snow-capped Andes |
| santorini | 산토리니 | Santorini | GR | Oia white houses and blue domes |
| saopaulo | 상파울루 | São Paulo | BR | skyline at dusk |
| sapporo | 삿포로 | Sapporo | JP | Clock Tower in snow |
| seoul | 서울 | Seoul | KR | Gyeongbokgung Palace with Bukhansan behind |
| shanghai | 상하이 | Shanghai | CN | the Bund and Pudong skyline |
| siemreap | 시엠레아프 | Siem Reap | KH | Angkor Wat at sunrise |
| singapore | 싱가포르 | Singapore | SG | Marina Bay Sands and Gardens by the Bay |
| sokcho | 속초 | Sokcho | KR | Seoraksan rocky peaks |
| stockholm | 스톡홀름 | Stockholm | SE | Gamla Stan waterfront |
| sydney | 시드니 | Sydney | AU | Opera House and Harbour Bridge |
| taipei | 타이페이 | Taipei | TW | Taipei 101 |
| telaviv | 텔아비브 | Tel Aviv | IL | Jaffa old port at sunset |
| tokyo | 도쿄 | Tokyo | JP | Shibuya Crossing at dusk |
| toronto | 토론토 | Toronto | CA | CN Tower and skyline |
| ulaanbaatar | 울란바토르 | Ulaanbaatar | MN | Genghis Khan Equestrian Statue on the steppe |
| vancouver | 밴쿠버 | Vancouver | CA | skyline with harbour and mountains |
| venice | 베네치아 | Venice | IT | Grand Canal with gondolas |
| vienna | 빈 | Vienna | AT | Schönbrunn Palace |
| warsaw | 바르샤바 | Warsaw | PL | Old Town Market Square |
| yeosu | 여수 | Yeosu | KR | Yeosu night sea with glowing bridge lights |
| zanzibar | 잔지바르 | Zanzibar | TZ | traditional dhow boat on turquoise water |
| zurich | 취리히 | Zurich | CH | Limmat river old town with the Alps |
