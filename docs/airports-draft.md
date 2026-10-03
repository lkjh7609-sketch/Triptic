# 공항 목록 초안 (171곳) — 검토용

항공편 입력의 출발·도착 공항 검색을 Google 대신 **우리 목록**으로 바꾸기 위한 **초안**입니다. **승인 전에는 DB에 넣지 않습니다.**

- 기준: 인천국제공항공사 정기운항편 API(S26 시즌, 2026-03-29 ~ 2026-10-24)에 나오는 **인천 연결 공항 169곳** + 국내용으로 **인천(ICN)·김포(GMP) 2곳 추가** = 171곳. 원본 데이터: `supabase/data/airports.json`.
- 한국어 이름은 인천공항 API가 주는 표기 그대로(예: 도쿄/나리타), **영어·일본어·번체 이름과 좌표·시간대는 제가 채웠습니다 — 정확성을 보장하지 못합니다.** 좌표는 소수 둘째 자리까지 근사치이고, 신설 공항(프놈펜 떼조, 신 울란바타르 등)은 특히 부정확할 수 있습니다.
- 시간대는 IANA 이름(서머타임 자동 반영, 코드로 유효성만 검사함). 중국 우루무치는 `Asia/Urumqi`, 카자흐스탄 아스타나·쉼켄트는 `Asia/Almaty`.
- **등록 여행지**: 이미 등록된 100곳 도시와 이어지는 공항(여행지 슬러그). 이어지지 않은 곳(`-`)은 아직 여행지 목록에 없는 도시입니다(다음 단계의 도시 목록 때 함께 결정).
- **주간 편수**: 인천 기준 출발+도착 합산 주간 편수(공동운항 제외한 대표 편). 0이면 시즌 기간 안에 정기편이 아직/이미 없는 곳.
- 앱의 국가 목록에 아직 없는 나라: 라오스(LA)·미얀마(MM)·스리랑카(LK)·우즈베키스탄(UZ)·카자흐스탄(KZ)·키르기스스탄(KG)·투르크메니스탄(TM)·아르메니아(AM)·조지아(GE)·핀란드(FI)·브루나이(BN)·에티오피아(ET)는 `destinationRegions.ts`의 국가 목록에 없어 승인 시 함께 추가해야 합니다.

## 한국 (5곳)

| IATA | 한국어 | English | 日本語 | 繁體中文 | 국가 | 위도, 경도 | 시간대 | 등록 여행지 | 주간 편수 |
|---|---|---|---|---|---|---|---|---|---|
| PUS | 김해 | Busan Gimhae | 釜山/金海 | 釜山/金海 | KR | 35.18, 128.94 | Asia/Seoul | busan | 72 |
| TAE | 대구 | Daegu | 大邱 | 大邱 | KR | 35.89, 128.66 | Asia/Seoul | - | 14 |
| CJU | 제주 | Jeju | 済州 | 濟州 | KR | 33.51, 126.49 | Asia/Seoul | jeju | 0 |
| GMP | 김포 | Seoul Gimpo | ソウル/金浦 | 首爾/金浦 | KR | 37.56, 126.79 | Asia/Seoul | seoul | 0 |
| ICN | 인천 | Seoul Incheon | ソウル/仁川 | 首爾/仁川 | KR | 37.46, 126.44 | Asia/Seoul | seoul | 0 |

## 일본 (30곳)

| IATA | 한국어 | English | 日本語 | 繁體中文 | 국가 | 위도, 경도 | 시간대 | 등록 여행지 | 주간 편수 |
|---|---|---|---|---|---|---|---|---|---|
| NRT | 도쿄/나리타 | Tokyo Narita | 東京/成田 | 東京/成田 | JP | 35.77, 140.39 | Asia/Tokyo | tokyo | 576 |
| KIX | 오사카/간사이 | Osaka Kansai | 大阪/関西 | 大阪/關西 | JP | 34.43, 135.24 | Asia/Tokyo | osaka | 528 |
| FUK | 후쿠오카 | Fukuoka | 福岡 | 福岡 | JP | 33.59, 130.45 | Asia/Tokyo | fukuoka | 376 |
| CTS | 삿포로 | Sapporo New Chitose | 札幌/新千歳 | 札幌/新千歲 | JP | 42.78, 141.69 | Asia/Tokyo | sapporo | 140 |
| NGO | 나고야 | Nagoya Chubu | 名古屋/中部 | 名古屋/中部 | JP | 34.86, 136.81 | Asia/Tokyo | nagoya | 120 |
| OKA | 오키나와 | Okinawa Naha | 沖縄/那覇 | 沖繩/那霸 | JP | 26.2, 127.65 | Asia/Tokyo | okinawa | 98 |
| UKB | 고베 | Kobe | 神戸 | 神戶 | JP | 34.63, 135.22 | Asia/Tokyo | - | 70 |
| HND | 도쿄/하네다 | Tokyo Haneda | 東京/羽田 | 東京/羽田 | JP | 35.55, 139.78 | Asia/Tokyo | tokyo | 42 |
| MYJ | 마쓰야마 | Matsuyama | 松山 | 松山 | JP | 33.83, 132.7 | Asia/Tokyo | - | 42 |
| HIJ | 히로시마 | Hiroshima | 広島 | 廣島 | JP | 34.44, 132.92 | Asia/Tokyo | - | 36 |
| FSZ | 시즈오카 | Shizuoka | 静岡 | 靜岡 | JP | 34.8, 138.19 | Asia/Tokyo | - | 28 |
| KMJ | 구마모토 | Kumamoto | 熊本 | 熊本 | JP | 32.84, 130.86 | Asia/Tokyo | - | 28 |
| TAK | 다카마쓰 | Takamatsu | 高松 | 高松 | JP | 34.21, 134.02 | Asia/Tokyo | - | 28 |
| ISG | 이시가키지마 | Ishigaki | 石垣島 | 石垣島 | JP | 24.34, 124.19 | Asia/Tokyo | - | 14 |
| KIJ | 니가타 | Niigata | 新潟 | 新潟 | JP | 37.96, 139.12 | Asia/Tokyo | - | 14 |
| KKJ | 키타큐슈 | Kitakyushu | 北九州 | 北九州 | JP | 33.84, 131.03 | Asia/Tokyo | - | 14 |
| KMQ | 고마쓰 | Komatsu | 小松 | 小松 | JP | 36.39, 136.41 | Asia/Tokyo | - | 14 |
| KOJ | 가고시마 | Kagoshima | 鹿児島 | 鹿兒島 | JP | 31.8, 130.72 | Asia/Tokyo | - | 14 |
| SHI | 미야코지마/시모지시마 | Miyako-jima (Shimojishima) | 宮古島/下地島 | 宮古島/下地島 | JP | 24.83, 125.14 | Asia/Tokyo | - | 14 |
| AOJ | 아오모리 | Aomori | 青森 | 青森 | JP | 40.73, 140.69 | Asia/Tokyo | - | 10 |
| SDJ | 센다이 | Sendai | 仙台 | 仙台 | JP | 38.14, 140.92 | Asia/Tokyo | - | 10 |
| YGJ | 요나고 | Yonago | 米子 | 米子 | JP | 35.49, 133.24 | Asia/Tokyo | - | 10 |
| HSG | 사가 | Saga | 佐賀 | 佐賀 | JP | 33.15, 130.3 | Asia/Tokyo | - | 8 |
| OIT | 오이타 | Oita (Beppu) | 大分 | 大分 | JP | 33.48, 131.74 | Asia/Tokyo | beppu | 8 |
| OKJ | 오카야마 | Okayama | 岡山 | 岡山 | JP | 34.76, 133.86 | Asia/Tokyo | - | 8 |
| KMI | 미야자키 | Miyazaki | 宮崎 | 宮崎 | JP | 31.88, 131.45 | Asia/Tokyo | - | 6 |
| NGS | 나가사키 | Nagasaki | 長崎 | 長崎 | JP | 32.92, 129.91 | Asia/Tokyo | - | 6 |
| TKS | 도쿠시마 | Tokushima | 徳島 | 德島 | JP | 34.13, 134.61 | Asia/Tokyo | - | 6 |
| TOY | 도야마 | Toyama | 富山 | 富山 | JP | 36.65, 137.19 | Asia/Tokyo | - | 1 |
| HNA | 하나마키 | Hanamaki (Iwate) | 花巻 | 花卷 | JP | 39.43, 141.14 | Asia/Tokyo | - | 0 |

## 중국 (45곳)

| IATA | 한국어 | English | 日本語 | 繁體中文 | 국가 | 위도, 경도 | 시간대 | 등록 여행지 | 주간 편수 |
|---|---|---|---|---|---|---|---|---|---|
| TAO | 칭다오 | Qingdao | 青島 | 青島 | CN | 36.27, 120.37 | Asia/Shanghai | - | 264 |
| PVG | 상하이/푸동 | Shanghai Pudong | 上海/浦東 | 上海/浦東 | CN | 31.14, 121.81 | Asia/Shanghai | shanghai | 224 |
| PEK | 베이징/서우두 | Beijing Capital | 北京/首都 | 北京/首都 | CN | 40.08, 116.58 | Asia/Shanghai | beijing | 118 |
| YNT | 옌타이 | Yantai | 煙台 | 煙台 | CN | 37.66, 121.37 | Asia/Shanghai | - | 94 |
| DLC | 다롄(대련) | Dalian | 大連 | 大連 | CN | 38.97, 121.54 | Asia/Shanghai | - | 84 |
| SHE | 선양(심양) | Shenyang | 瀋陽 | 瀋陽 | CN | 41.64, 123.48 | Asia/Shanghai | - | 84 |
| TSN | 톈진 | Tianjin | 天津 | 天津 | CN | 39.12, 117.35 | Asia/Shanghai | - | 84 |
| YNJ | 옌지(연길) | Yanji | 延吉 | 延吉 | CN | 42.88, 129.45 | Asia/Shanghai | - | 84 |
| CAN | 광저우 | Guangzhou | 広州 | 廣州 | CN | 23.39, 113.3 | Asia/Shanghai | - | 82 |
| SZX | 선전 | Shenzhen | 深セン | 深圳 | CN | 22.64, 113.81 | Asia/Shanghai | - | 63 |
| TNA | 지난 | Jinan | 済南 | 濟南 | CN | 36.86, 117.22 | Asia/Shanghai | - | 56 |
| XIY | 시안 | Xi'an | 西安 | 西安 | CN | 34.45, 108.75 | Asia/Shanghai | - | 52 |
| HGH | 항저우 | Hangzhou | 杭州 | 杭州 | CN | 30.23, 120.43 | Asia/Shanghai | - | 48 |
| CGQ | 창춘 | Changchun | 長春 | 長春 | CN | 43.99, 125.68 | Asia/Shanghai | - | 46 |
| NKG | 난징 | Nanjing | 南京 | 南京 | CN | 31.74, 118.86 | Asia/Shanghai | - | 46 |
| HRB | 하얼빈 | Harbin | ハルビン | 哈爾濱 | CN | 45.62, 126.25 | Asia/Shanghai | - | 42 |
| PKX | 베이징/다싱 | Beijing Daxing | 北京/大興 | 北京/大興 | CN | 39.51, 116.41 | Asia/Shanghai | beijing | 42 |
| WEH | 웨이하이 | Weihai | 威海 | 威海 | CN | 37.19, 122.23 | Asia/Shanghai | - | 42 |
| TFU | 청두/톈푸 | Chengdu Tianfu | 成都/天府 | 成都/天府 | CN | 30.31, 104.44 | Asia/Shanghai | - | 38 |
| CGO | 정저우 | Zhengzhou | 鄭州 | 鄭州 | CN | 34.52, 113.84 | Asia/Shanghai | - | 30 |
| CKG | 충칭 | Chongqing | 重慶 | 重慶 | CN | 29.72, 106.64 | Asia/Shanghai | - | 28 |
| CSX | 장사 | Changsha | 長沙 | 長沙 | CN | 28.19, 113.22 | Asia/Shanghai | - | 28 |
| XMN | 샤먼 | Xiamen | アモイ | 廈門 | CN | 24.54, 118.13 | Asia/Shanghai | - | 28 |
| DYG | 장가계 | Zhangjiajie | 張家界 | 張家界 | CN | 29.1, 110.44 | Asia/Shanghai | - | 26 |
| FOC | 푸저우 | Fuzhou | 福州 | 福州 | CN | 25.94, 119.66 | Asia/Shanghai | - | 22 |
| WUH | 우한 | Wuhan | 武漢 | 武漢 | CN | 30.78, 114.21 | Asia/Shanghai | - | 22 |
| WUX | 우시 | Wuxi | 無錫 | 無錫 | CN | 31.49, 120.43 | Asia/Shanghai | - | 20 |
| KMG | 쿤밍 | Kunming | 昆明 | 昆明 | CN | 25.1, 102.93 | Asia/Shanghai | - | 16 |
| SYX | 싼야 | Sanya | 三亜 | 三亞 | CN | 18.3, 109.41 | Asia/Shanghai | - | 14 |
| KWL | 구이린 | Guilin | 桂林 | 桂林 | CN | 25.22, 110.04 | Asia/Shanghai | - | 12 |
| HFE | 허페이 | Hefei | 合肥 | 合肥 | CN | 31.78, 117.3 | Asia/Shanghai | - | 10 |
| HAK | 하이커우 | Haikou | 海口 | 海口 | CN | 19.93, 110.46 | Asia/Shanghai | - | 8 |
| SJW | 스자좡 | Shijiazhuang | 石家荘 | 石家莊 | CN | 38.28, 114.7 | Asia/Shanghai | - | 8 |
| WNZ | 원저우 | Wenzhou | 温州 | 溫州 | CN | 27.91, 120.85 | Asia/Shanghai | - | 6 |
| LJG | 리장 | Lijiang | 麗江 | 麗江 | CN | 26.68, 100.25 | Asia/Shanghai | - | 4 |
| LYI | 린이 | Linyi | 臨沂 | 臨沂 | CN | 35.05, 118.41 | Asia/Shanghai | - | 4 |
| NGB | 닝보 | Ningbo | 寧波 | 寧波 | CN | 29.83, 121.46 | Asia/Shanghai | - | 4 |
| YIH | 이창 | Yichang | 宜昌 | 宜昌 | CN | 30.67, 111.44 | Asia/Shanghai | - | 4 |
| YNZ | 옌청 | Yancheng | 塩城 | 鹽城 | CN | 33.43, 120.2 | Asia/Shanghai | - | 4 |
| YTY | 양저우 | Yangzhou/Taizhou | 揚州/泰州 | 揚州/泰州 | CN | 32.56, 119.72 | Asia/Shanghai | - | 4 |
| JMU | 자무쓰 | Jiamusi | 佳木斯 | 佳木斯 | CN | 46.84, 130.46 | Asia/Shanghai | - | 2 |
| BAV | 바우터우 | Baotou | 包頭 | 包頭 | CN | 40.56, 109.99 | Asia/Shanghai | - | 0 |
| TXN | 황산 | Huangshan (Tunxi) | 黄山 | 黃山 | CN | 29.73, 118.26 | Asia/Shanghai | - | 0 |
| URC | 우루무치 | Urumqi | ウルムチ | 烏魯木齊 | CN | 43.91, 87.47 | Asia/Urumqi | - | 0 |
| WDS | 쓰옌 무당산 | Shiyan Wudangshan | 十堰/武当山 | 十堰/武當山 | CN | 32.59, 110.91 | Asia/Shanghai | - | 0 |

## 홍콩·마카오·대만 (5곳)

| IATA | 한국어 | English | 日本語 | 繁體中文 | 국가 | 위도, 경도 | 시간대 | 등록 여행지 | 주간 편수 |
|---|---|---|---|---|---|---|---|---|---|
| HKG | 홍콩 | Hong Kong | 香港 | 香港 | HK | 22.31, 113.91 | Asia/Hong_Kong | hongkong | 270 |
| TPE | 타이베이 | Taipei Taoyuan | 台北/桃園 | 台北/桃園 | TW | 25.08, 121.23 | Asia/Taipei | taipei | 176 |
| MFM | 마카오 | Macau | マカオ | 澳門 | MO | 22.15, 113.59 | Asia/Macau | macau | 56 |
| RMQ | 타이중/칭촨강 | Taichung | 台中 | 台中 | TW | 24.26, 120.62 | Asia/Taipei | - | 42 |
| KHH | 가오슝 | Kaohsiung | 高雄 | 高雄 | TW | 22.58, 120.35 | Asia/Taipei | kaohsiung | 36 |

## 동남아 (25곳)

| IATA | 한국어 | English | 日本語 | 繁體中文 | 국가 | 위도, 경도 | 시간대 | 등록 여행지 | 주간 편수 |
|---|---|---|---|---|---|---|---|---|---|
| BKK | 방콕/수완나품 | Bangkok Suvarnabhumi | バンコク/スワンナプーム | 曼谷/素萬那普 | TH | 13.69, 100.75 | Asia/Bangkok | bangkok | 192 |
| DAD | 다낭 | Da Nang | ダナン | 峴港 | VN | 16.04, 108.2 | Asia/Ho_Chi_Minh | danang | 182 |
| HAN | 하노이 | Hanoi | ハノイ | 河內 | VN | 21.22, 105.81 | Asia/Ho_Chi_Minh | hanoi | 152 |
| SIN | 싱가포르 | Singapore | シンガポール | 新加坡 | SG | 1.36, 103.99 | Asia/Singapore | singapore | 148 |
| MNL | 마닐라 | Manila | マニラ | 馬尼拉 | PH | 14.51, 121.02 | Asia/Manila | - | 140 |
| SGN | 호찌민 | Ho Chi Minh City | ホーチミン | 胡志明市 | VN | 10.82, 106.65 | Asia/Ho_Chi_Minh | hochiminh | 140 |
| CXR | 나트랑 | Nha Trang (Cam Ranh) | ニャチャン | 芽莊 | VN | 11.99, 109.22 | Asia/Ho_Chi_Minh | nhatrang | 134 |
| PQC | 푸꾸옥 | Phu Quoc | フーコック | 富國島 | VN | 10.17, 103.99 | Asia/Ho_Chi_Minh | - | 110 |
| KUL | 쿠알라룸푸르 | Kuala Lumpur | クアラルンプール | 吉隆坡 | MY | 2.75, 101.71 | Asia/Kuala_Lumpur | kualalumpur | 55 |
| CGK | 자카르타/수카르노하타 | Jakarta | ジャカルタ | 雅加達 | ID | -6.13, 106.66 | Asia/Jakarta | - | 52 |
| CNX | 치앙마이 | Chiang Mai | チェンマイ | 清邁 | TH | 18.77, 98.96 | Asia/Bangkok | chiangmai | 44 |
| CEB | 세부 | Cebu | セブ | 宿霧 | PH | 10.31, 123.98 | Asia/Manila | cebu | 42 |
| DPS | 덴파사르 | Bali Denpasar | バリ島/デンパサール | 峇里島/登巴薩 | ID | -8.75, 115.17 | Asia/Makassar | bali | 42 |
| BKI | 코타키나발루 | Kota Kinabalu | コタキナバル | 亞庇 | MY | 5.94, 116.05 | Asia/Kuala_Lumpur | - | 38 |
| CRK | 클라크필드 | Clark | クラーク | 克拉克 | PH | 15.19, 120.56 | Asia/Manila | - | 36 |
| KTI | 프놈펜/떼조 | Phnom Penh Techo | プノンペン/テチョ | 金邊/德崇 | KH | 11.55, 104.92 | Asia/Phnom_Penh | - | 34 |
| HKT | 푸켓 | Phuket | プーケット | 普吉島 | TH | 8.11, 98.32 | Asia/Bangkok | phuket | 28 |
| TAG | 보홀 팡라오 | Bohol Panglao | ボホール/パングラオ | 薄荷島/邦勞 | PH | 9.57, 123.77 | Asia/Manila | - | 28 |
| VTE | 비엔티안 | Vientiane | ビエンチャン | 永珍 | LA | 17.99, 102.56 | Asia/Vientiane | - | 24 |
| DMK | 방콕/돈므앙 | Bangkok Don Mueang | バンコク/ドンムアン | 曼谷/廊曼 | TH | 13.91, 100.61 | Asia/Bangkok | bangkok | 14 |
| HPH | 하이퐁 | Hai Phong | ハイフォン | 海防 | VN | 20.82, 106.72 | Asia/Ho_Chi_Minh | - | 14 |
| KLO | 칼리보 | Kalibo (Boracay) | カリボ | 卡里博 | PH | 11.68, 122.38 | Asia/Manila | boracay | 14 |
| MDC | 마나도 | Manado | マナド | 萬鴉老 | ID | 1.55, 124.93 | Asia/Makassar | - | 14 |
| RGN | 양곤 | Yangon | ヤンゴン | 仰光 | MM | 16.91, 96.13 | Asia/Yangon | - | 10 |
| BWN | 반다르스리브가완 | Bandar Seri Begawan | バンダルスリブガワン | 斯里巴加灣 | BN | 4.94, 114.93 | Asia/Brunei | - | 6 |

## 남아시아 (3곳)

| IATA | 한국어 | English | 日本語 | 繁體中文 | 국가 | 위도, 경도 | 시간대 | 등록 여행지 | 주간 편수 |
|---|---|---|---|---|---|---|---|---|---|
| DEL | 델리 | Delhi | デリー | 德里 | IN | 28.56, 77.1 | Asia/Kolkata | delhi | 20 |
| CMB | 콜롬보 | Colombo | コロンボ | 可倫坡 | LK | 7.18, 79.88 | Asia/Colombo | - | 4 |
| KTM | 카트만두 | Kathmandu | カトマンズ | 加德滿都 | NP | 27.7, 85.36 | Asia/Kathmandu | kathmandu | 4 |

## 중앙아시아·코카서스 (9곳)

| IATA | 한국어 | English | 日本語 | 繁體中文 | 국가 | 위도, 경도 | 시간대 | 등록 여행지 | 주간 편수 |
|---|---|---|---|---|---|---|---|---|---|
| UBN | 신 울란바타르 | Ulaanbaatar | ウランバートル | 烏蘭巴托 | MN | 47.65, 106.82 | Asia/Ulaanbaatar | ulaanbaatar | 51 |
| TAS | 타슈켄트 | Tashkent | タシケント | 塔什干 | UZ | 41.26, 69.28 | Asia/Tashkent | - | 31 |
| ALA | 알마티 | Almaty | アルマトイ | 阿拉木圖 | KZ | 43.35, 77.04 | Asia/Almaty | - | 28 |
| CIT | 쉼켄트 | Shymkent | シムケント | 奇姆肯特 | KZ | 42.36, 69.48 | Asia/Almaty | - | 8 |
| NQZ | 아스타나 | Astana | アスタナ | 阿斯塔納 | KZ | 51.02, 71.47 | Asia/Almaty | - | 8 |
| BSZ | 비슈케크 | Bishkek | ビシュケク | 比什凱克 | KG | 43.06, 74.48 | Asia/Bishkek | - | 6 |
| ASB | 아쉬가바트 | Ashgabat | アシガバット | 阿什哈巴德 | TM | 37.99, 58.36 | Asia/Ashgabat | - | 4 |
| EVN | 쯔바르트노츠 | Yerevan | エレバン | 葉里溫 | AM | 40.15, 44.4 | Asia/Yerevan | - | 0 |
| TBS | 트빌리시 | Tbilisi | トビリシ | 提比里斯 | GE | 41.67, 44.95 | Asia/Tbilisi | - | 0 |

## 중동·아프리카 (5곳)

| IATA | 한국어 | English | 日本語 | 繁體中文 | 국가 | 위도, 경도 | 시간대 | 등록 여행지 | 주간 편수 |
|---|---|---|---|---|---|---|---|---|---|
| IST | 이스탄불 | Istanbul | イスタンブール | 伊斯坦堡 | TR | 41.27, 28.74 | Europe/Istanbul | istanbul | 42 |
| AUH | 아부다비 | Abu Dhabi | アブダビ | 阿布達比 | AE | 24.43, 54.65 | Asia/Dubai | abudhabi | 22 |
| DXB | 두바이 | Dubai | ドバイ | 杜拜 | AE | 25.25, 55.36 | Asia/Dubai | dubai | 20 |
| DOH | 도하 | Doha | ドーハ | 杜哈 | QA | 25.27, 51.61 | Asia/Qatar | doha | 16 |
| ADD | 아디스아바바/볼레 | Addis Ababa | アディスアベバ | 阿迪斯阿貝巴 | ET | 8.98, 38.8 | Africa/Addis_Ababa | - | 12 |

## 유럽 (18곳)

| IATA | 한국어 | English | 日本語 | 繁體中文 | 국가 | 위도, 경도 | 시간대 | 등록 여행지 | 주간 편수 |
|---|---|---|---|---|---|---|---|---|---|
| CDG | 파리/샤를드골 | Paris Charles de Gaulle | パリ/シャルル・ド・ゴール | 巴黎/戴高樂 | FR | 49.01, 2.55 | Europe/Paris | paris | 46 |
| LHR | 런던/히드로 | London Heathrow | ロンドン/ヒースロー | 倫敦/希斯洛 | GB | 51.47, -0.45 | Europe/London | london | 42 |
| FRA | 프랑크푸르트 | Frankfurt | フランクフルト | 法蘭克福 | DE | 50.04, 8.56 | Europe/Berlin | - | 36 |
| AMS | 암스테르담 | Amsterdam | アムステルダム | 阿姆斯特丹 | NL | 52.31, 4.76 | Europe/Amsterdam | amsterdam | 26 |
| FCO | 로마 | Rome Fiumicino | ローマ/フィウミチーノ | 羅馬/菲烏米奇諾 | IT | 41.8, 12.25 | Europe/Rome | rome | 25 |
| BCN | 바르셀로나 | Barcelona | バルセロナ | 巴塞隆納 | ES | 41.3, 2.08 | Europe/Madrid | barcelona | 20 |
| BUD | 부다페스트 | Budapest | ブダペスト | 布達佩斯 | HU | 47.44, 19.26 | Europe/Budapest | budapest | 14 |
| HEL | 헬싱키 | Helsinki | ヘルシンキ | 赫爾辛基 | FI | 60.32, 24.96 | Europe/Helsinki | - | 14 |
| MUC | 뮌헨 | Munich | ミュンヘン | 慕尼黑 | DE | 48.35, 11.79 | Europe/Berlin | munich | 14 |
| MXP | 밀라노 | Milan Malpensa | ミラノ/マルペンサ | 米蘭/馬爾彭薩 | IT | 45.63, 8.72 | Europe/Rome | milan | 14 |
| PRG | 프라하 | Prague | プラハ | 布拉格 | CZ | 50.1, 14.26 | Europe/Prague | prague | 14 |
| CPH | 코펜하겐 | Copenhagen | コペンハーゲン | 哥本哈根 | DK | 55.62, 12.65 | Europe/Copenhagen | copenhagen | 12 |
| WAW | 바르샤바 | Warsaw | ワルシャワ | 華沙 | PL | 52.17, 20.97 | Europe/Warsaw | warsaw | 12 |
| ZRH | 취리히 | Zurich | チューリッヒ | 蘇黎世 | CH | 47.46, 8.55 | Europe/Zurich | zurich | 12 |
| LIS | 리스본 | Lisbon | リスボン | 里斯本 | PT | 38.77, -9.13 | Europe/Lisbon | lisbon | 8 |
| MAD | 마드리드 | Madrid | マドリード | 馬德里 | ES | 40.49, -3.57 | Europe/Madrid | madrid | 8 |
| VIE | 비엔나 | Vienna | ウィーン | 維也納 | AT | 48.11, 16.57 | Europe/Vienna | vienna | 8 |
| WRO | 브로츠와프 | Wrocław | ヴロツワフ | 弗羅茨瓦夫 | PL | 51.1, 16.89 | Europe/Warsaw | - | 2 |

## 북미 (21곳)

| IATA | 한국어 | English | 日本語 | 繁體中文 | 국가 | 위도, 경도 | 시간대 | 등록 여행지 | 주간 편수 |
|---|---|---|---|---|---|---|---|---|---|
| LAX | 로스앤젤레스 | Los Angeles | ロサンゼルス | 洛杉磯 | US | 33.94, -118.41 | America/Los_Angeles | losangeles | 74 |
| SFO | 샌프란시스코 | San Francisco | サンフランシスコ | 舊金山 | US | 37.62, -122.38 | America/Los_Angeles | sanfrancisco | 66 |
| ATL | 애틀랜타 | Atlanta | アトランタ | 亞特蘭大 | US | 33.64, -84.43 | America/New_York | - | 56 |
| JFK | 뉴욕/존에프케네디 | New York JFK | ニューヨーク/JFK | 紐約/甘迺迪 | US | 40.64, -73.78 | America/New_York | newyork | 56 |
| YVR | 밴쿠버 | Vancouver | バンクーバー | 溫哥華 | CA | 49.19, -123.18 | America/Vancouver | vancouver | 50 |
| SEA | 시애틀/타코마 | Seattle-Tacoma | シアトル | 西雅圖 | US | 47.45, -122.31 | America/Los_Angeles | - | 48 |
| HNL | 호놀룰루 | Honolulu | ホノルル | 檀香山 | US | 21.32, -157.92 | Pacific/Honolulu | hawaii | 30 |
| DFW | 댈러스/포트워스 | Dallas/Fort Worth | ダラス/フォートワース | 達拉斯/沃思堡 | US | 32.9, -97.04 | America/Chicago | - | 28 |
| EWR | 뉴어크 | Newark | ニューアーク | 紐華克 | US | 40.69, -74.17 | America/New_York | newyork | 28 |
| YYZ | 토론토 | Toronto | トロント | 多倫多 | CA | 43.68, -79.63 | America/Toronto | toronto | 28 |
| IAD | 워싱턴 | Washington Dulles | ワシントン/ダレス | 華盛頓/杜勒斯 | US | 38.95, -77.46 | America/New_York | - | 22 |
| BOS | 보스턴 | Boston | ボストン | 波士頓 | US | 42.36, -71.01 | America/New_York | - | 14 |
| DTW | 디트로이트 | Detroit | デトロイト | 底特律 | US | 42.21, -83.35 | America/New_York | - | 14 |
| LAS | 라스베이거스 | Las Vegas | ラスベガス | 拉斯維加斯 | US | 36.08, -115.15 | America/Los_Angeles | lasvegas | 14 |
| MSP | 미니애폴리스 | Minneapolis | ミネアポリス | 明尼阿波利斯 | US | 44.88, -93.22 | America/Chicago | - | 14 |
| ORD | 시카고/오헤어 | Chicago O'Hare | シカゴ/オヘア | 芝加哥/歐海爾 | US | 41.98, -87.9 | America/Chicago | - | 14 |
| SLC | 솔트레이크시티 | Salt Lake City | ソルトレイクシティ | 鹽湖城 | US | 40.79, -111.98 | America/Denver | - | 14 |
| YYC | 캘거리 | Calgary | カルガリー | 卡加利 | CA | 51.11, -114.02 | America/Edmonton | - | 12 |
| MEX | 멕시코시티 | Mexico City | メキシコシティ | 墨西哥城 | MX | 19.44, -99.07 | America/Mexico_City | mexicocity | 7 |
| MTY | 몬테레이 | Monterrey | モンテレイ | 蒙特瑞 | MX | 25.78, -100.11 | America/Monterrey | - | 7 |
| YUL | 몬트리올 | Montréal | モントリオール | 蒙特婁 | CA | 45.47, -73.74 | America/Toronto | - | 6 |

## 오세아니아·괌 (5곳)

| IATA | 한국어 | English | 日本語 | 繁體中文 | 국가 | 위도, 경도 | 시간대 | 등록 여행지 | 주간 편수 |
|---|---|---|---|---|---|---|---|---|---|
| GUM | 괌 | Guam | グアム | 關島 | GU | 13.48, 144.8 | Pacific/Guam | guam | 70 |
| SYD | 시드니 | Sydney | シドニー | 雪梨 | AU | -33.95, 151.18 | Australia/Sydney | sydney | 45 |
| BNE | 브리즈번 | Brisbane | ブリスベン | 布里斯本 | AU | -27.38, 153.12 | Australia/Brisbane | brisbane | 14 |
| SPN | 사이판 | Saipan | サイパン | 塞班 | MP | 15.12, 145.73 | Pacific/Saipan | saipan | 14 |
| AKL | 오클랜드(뉴질랜드) | Auckland | オークランド | 奧克蘭 | NZ | -37.01, 174.79 | Pacific/Auckland | auckland | 5 |
