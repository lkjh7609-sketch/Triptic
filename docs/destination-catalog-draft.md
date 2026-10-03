# 도시 300곳 + 공항 카탈로그 초안 — 검토용

항공편 입력의 공항 검색과(나중에) 도시 검색을 Google 대신 **우리 데이터**로 바꾸기 위한 **초안**입니다. **승인 전에는 DB에 넣지 않습니다.**

- 범위: **지금 등록된 여행지 100곳 + 한국인이 많이 가는 도시 200곳 = 300곳**, 그 도시들이 속한 **86개국**, 그 도시의 **공항 326곳**(사용자 CSV 3,244곳 중에서만).
- 추가 200곳 선정 근거: 아고다·마이리얼트립·익스피디아의 2025년 한국인 인기 여행지 기사(푸꾸옥·호이안·나가노·구마모토·포르투·파타야 등 급상승/인기), **인천 직항이 있는 도시**(주간 편수), 한국인 단체·가족여행 단골(칭다오·웨이하이·장자제 등), 제 일반 지식. **빼거나 더할 도시는 알려 주세요.**
- 이름: 한국어·일본어·번체는 Wikidata, 행정구역 접미사(시·도·현·정 등)는 떼고 몇몇은 직접 고쳤습니다. 좌표는 Wikidata, 시간대는 좌표로 계산, 통화는 국가별로 제가 지정(검토 필요).
- 공항: 도시에 **연결된 공항**(Wikidata) + **80km 안쪽 공항** 중 연간 이용객이 도시 최대 공항의 10% 이상인 곳만, 최대 4개, 이용객 많은 순. 이용객 수는 Wikidata 값(연도 제각각)이라 대략치입니다.
- 이름 표기: 자동완성은 **도시(국가)** + 작은 글씨로 공항코드·공항이름.

## 확인이 필요한 곳
- Labuan Bajo(라부안바조) — 사용자 CSV에 공항(LBJ 코모도)이 없어 공항 없음. LBJ를 추가할지 알려 주세요.
- Clark(클락) — Wikidata에서 못 찾아 좌표·이름을 직접 넣음.
- Salzburg·Nikko·Kochi — Wikidata가 주(州)·촌 항목을 잡아 이름·좌표를 직접 지정.
- 공항 이용객 수가 없는 곳 32곳은 가까운 순으로만 정렬(공항이 여러 개인 도시는 확인 권장).
- 번체 이름은 대만식 표기를 우선했으나 일부는 홍콩·간체 표기에서 가져와 어색할 수 있음.
- 한국어 이름은 한국에서 흔히 쓰는 표기와 다를 수 있음(예: 족자카르타는 직접 지정).

## 추가 200곳

### 일본 (36곳)

| 한국어 | English | 日本語 | 繁體 | 국가 | 공항 | slug |
|---|---|---|---|---|---|---|
| 고베 | Kobe | 神戸 | 神戶 | JP | KIX, ITM, UKB | kobe |
| 나라 | Nara | 奈良 | 奈良 | JP | KIX, ITM, UKB | nara |
| 히로시마 | Hiroshima | 広島 | 廣島 | JP | MYJ, HIJ, IWK | hiroshima |
| 가나자와 | Kanazawa | 金沢 | 金澤 | JP | KMQ, TOY | kanazawa |
| 나가사키 | Nagasaki | 長崎 | 長崎 | JP | NGS, HSG | nagasaki |
| 구마모토 | Kumamoto | 熊本 | 熊本 | JP | KMJ, NGS, HSG | kumamoto |
| 가고시마 | Kagoshima | 鹿児島 | 鹿兒島 | JP | KOJ | kagoshima |
| 마쓰야마 | Matsuyama | 松山 | 松山 | JP | MYJ, HIJ, IWK | matsuyama |
| 다카마쓰 | Takamatsu | 高松 | 高松 | JP | TAK, OKJ, TKS | takamatsu |
| 하코다테 | Hakodate | 函館 | 函館 | JP | HKD | hakodate |
| 오타루 | Otaru | 小樽 | 小樽 | JP | CTS | otaru |
| 센다이 | Sendai | 仙台 | 仙台 | JP | SDJ | sendai |
| 니가타 | Niigata | 新潟 | 新潟 | JP | KIJ | niigata |
| 나가노 | Nagano | 長野 | 長野 | JP | MMJ | nagano |
| 마쓰모토 | Matsumoto | 松本 | 松本 | JP | MMJ | matsumoto |
| 다카야마 | Takayama | 高山 | 高山 | JP | TOY, MMJ | takayama |
| 하코네 | Hakone | 箱根 | 箱根 | JP | HND, NRT | hakone |
| 가마쿠라 | Kamakura | 鎌倉 | 鎌倉 | JP | HND, NRT | kamakura |
| 요코하마 | Yokohama | 横浜 | 橫濱 | JP | HND, NRT | yokohama |
| 닛코 | Nikko | 日光 | 日光 | JP | HND, NRT | nikko |
| 이시가키 | Ishigaki | 石垣 | 石垣 | JP | TRA | ishigaki |
| 미야코지마 | Miyakojima | 宮古島 | 宮古島 | JP | MMY, SHI | miyakojima |
| 유후인 | Yufuin | 湯布院 | 湯布院 | JP | KMJ, OIT, KKJ, UBJ | yufuin |
| 기타큐슈 | Kitakyushu | 北九州 | 北九州 | JP | FUK | kitakyushu |
| 오카야마 | Okayama | 岡山 | 岡山 | JP | TAK, OKJ | okayama |
| 구라시키 | Kurashiki | 倉敷 | 倉敷 | JP | HIJ, TAK, OKJ | kurashiki |
| 히메지 | Himeji | 姫路 | 姬路 | JP | KIX, UKB | himeji |
| 시즈오카 | Shizuoka | 静岡 | 靜岡 | JP | FSZ | shizuoka |
| 아오모리 | Aomori | 青森 | 青森 | JP | AOJ, ONJ | aomori |
| 가루이자와 | Karuizawa | 軽井沢 | 輕井澤 | JP | HND, NRT | karuizawa |
| 아사히카와 | Asahikawa | 旭川 | 旭川 | JP | AKJ | asahikawa |
| 미야자키 | Miyazaki | 宮崎 | 宮崎 | JP | KOJ, KMI | miyazaki |
| 도야마 | Toyama | 富山 | 富山 | JP | KMQ, TOY | toyama |
| 마쓰에 | Matsue | 松江 | 松江 | JP | IZO, YGJ | matsue |
| 고치 | Kochi | 高知 | 高知 | JP | KCZ | kochi |
| 도쿠시마 | Tokushima | 徳島 | 德島 | JP | KIX | tokushima |

### 중국·대만 (31곳)

| 한국어 | English | 日本語 | 繁體 | 국가 | 공항 | slug |
|---|---|---|---|---|---|---|
| 칭다오 | Qingdao | 青島 | 青島 | CN | TAO | qingdao |
| 웨이하이 | Weihai | 威海 | 威海 | CN | WEH | weihai |
| 옌타이 | Yantai | 煙台 | 煙臺 | CN | YNT, WEH | yantai |
| 다롄 | Dalian | 大連 | 大連 | CN | DLC | dalian |
| 선양 | Shenyang | 瀋陽 | 瀋陽 | CN | SHE | shenyang |
| 톈진 | Tianjin | 天津 | 天津 | CN | PKX, TSN | tianjin |
| 옌지 | Yanji | 延吉 | 延吉 | CN | YNJ | yanji |
| 하얼빈 | Harbin | ハルビン | 哈爾濱 | CN | HRB | harbin |
| 광저우 | Guangzhou | 広州 | 廣州 | CN | CAN, SZX | guangzhou |
| 선전 | Shenzhen | 深圳 | 深圳 | CN | SZX | shenzhen |
| 시안 | Xi'an | 西安 | 西安 | CN | XIY | xian |
| 청두 | Chengdu | 成都 | 成都 | CN | TFU, CTU | chengdu |
| 충칭 | Chongqing | 重慶 | 重慶 | CN | CKG | chongqing |
| 항저우 | Hangzhou | 杭州 | 杭州 | CN | HGH | hangzhou |
| 난징 | Nanjing | 南京 | 南京 | CN | NKG | nanjing |
| 장자제 | Zhangjiajie | 張家界 | 張家界 | CN | DYG | zhangjiajie |
| 구이린 | Guilin | 桂林 | 桂林 | CN | KWL | guilin |
| 쿤밍 | Kunming | 昆明 | 昆明 | CN | KMG | kunming |
| 리장 | Lijiang | 麗江 | 麗江 | CN | LJG | lijiang |
| 싼야 | Sanya | 三亜 | 三亞 | CN | SYX | sanya |
| 샤먼 | Xiamen | 廈門 | 廈門 | CN | XMN, JJN | xiamen |
| 우한 | Wuhan | 武漢 | 武漢 | CN | WUH | wuhan |
| 정저우 | Zhengzhou | 鄭州 | 鄭州 | CN | CGO | zhengzhou |
| 하이커우 | Haikou | 海口 | 海口 | CN | HAK | haikou |
| 창사 | Changsha | 長沙 | 長沙 | CN | CSX | changsha |
| 푸저우 | Fuzhou | 福州 | 福州 | CN | FOC | fuzhou |
| 우루무치 | Urumqi | ウルムチ | 烏魯木齊 | CN | URC | urumqi |
| 타이중 | Taichung | 台中 | 臺中 | TW | RMQ | taichung |
| 타이난 | Tainan | 台南 | 臺南 | TW | KHH | tainan |
| 화롄 | Hualien | 花蓮 | 花蓮 | TW | HUN | hualien |
| 타오위안 | Taoyuan | 桃園 | 桃園 | TW | TPE | taoyuan |

### 동남아 (35곳)

| 한국어 | English | 日本語 | 繁體 | 국가 | 공항 | slug |
|---|---|---|---|---|---|---|
| 푸꾸옥 | Phu Quoc | フーコック | 富國島 | VN | PQC | phuquoc |
| 호이안 | Hoi An | ホイアン | 會安 | VN | DAD | hoian |
| 달랏 | Da Lat | ダラット | 大叻 | VN | DLI | dalat |
| 후에 | Hue | フエ | 順化 | VN | HUI | hue |
| 할롱 | Ha Long | ハロン | 下龍 | VN | HPH, VDO | halong |
| 하이퐁 | Hai Phong | ハイフォン | 海防 | VN | HPH | haiphong |
| 사파 | Sa Pa | サパ | 沙壩 | VN | HAN | sapa |
| 파타야 | Pattaya | パッタヤー | 芭達雅 | TH | UTP | pattaya |
| 끄라비 | Krabi | クラビー | 喀比 | TH | HKT | krabi |
| 코사무이 | Ko Samui | サムイ島 | 蘇美島 | TH | USM | kosamui |
| 후아힌 | Hua Hin | ホアヒン | 華欣 | TH | HHQ | huahin |
| 치앙라이 | Chiang Rai | チェンライ | 清萊 | TH | CEI | chiangrai |
| 코타키나발루 | Kota Kinabalu | コタキナバル | 亞庇 | MY | BKI | kotakinabalu |
| 조지타운 | George Town | ジョージタウン | 喬治 | MY | PEN | georgetown |
| 랑카위 | Langkawi | ランカウイ島 | 蘭卡威 | MY | LGK, AOR | langkawi |
| 믈라카 | Malacca | マラッカ | 麻六甲 | MY | MKZ | malacca |
| 조호르바루 | Johor Bahru | ジョホールバル | 新山 | MY | JHB | johorbahru |
| 쿠칭 | Kuching | クチン | 古晉 | MY | KCH | kuching |
| 마닐라 | Manila | マニラ | 馬尼拉 | PH | MNL | manila |
| 클락 | Clark | クラーク | 克拉克 | PH | CRK | clark |
| 타그빌라란 | Tagbilaran | タグビララン | 塔比拉蘭 | PH | CEB, TAG, DGT | tagbilaran |
| 푸에르토프린세사 | Puerto Princesa | プエルト・プリンセサ | 普林塞薩港 | PH | PPS | puertoprincesa |
| 엘니도 | El Nido | エルニド | 愛妮島 | PH | PPS | elnido |
| 코론 | Coron | コロン | 科隆 | PH | USU | coron |
| 자카르타 | Jakarta | ジャカルタ | 雅加達 | ID | CGK, HLP | jakarta |
| 족자카르타 | Yogyakarta | ジョグジャカルタ | 日惹 | ID | JOG, SOC | yogyakarta |
| 우붓 | Ubud | ウブド | 烏布 | ID | DPS | ubud |
| 마타람 | Mataram | マタラム | 馬塔蘭 | ID | LOP | mataram |
| 라부안바조 | Labuan Bajo | ラブアンバジョ | 拉布安巴佐 | ID | **없음** | labuanbajo |
| 마나도 | Manado | マナド | 美娜多 | ID | MDC | manado |
| 프놈펜 | Phnom Penh | プノンペン | 金邊 | KH | KTI | phnompenh |
| 비엔티안 | Vientiane | ヴィエンチャン | 永珍 | LA | VTE | vientiane |
| 루앙파방 | Luang Prabang | ルアンパバーン | 琅勃拉邦 | LA | LPQ | luangprabang |
| 양곤 | Yangon | ヤンゴン | 仰光 | MM | RGN | yangon |
| 반다르스리브가완 | Bandar Seri Begawan | バンダルスリブガワン | 斯里巴加萬港 | BN | BWN | bandarseribegawan |

### 남아시아·중앙아시아·중동 (19곳)

| 한국어 | English | 日本語 | 繁體 | 국가 | 공항 | slug |
|---|---|---|---|---|---|---|
| 콜롬보 | Colombo | コロンボ | 可倫坡 | LK | CMB | colombo |
| 캔디 | Kandy | キャンディ | 康提 | LK | CMB | kandy |
| 아그라 | Agra | アーグラ | 阿格拉 | IN | AGR | agra |
| 파나지 | Panaji | パナジ | 帕納吉 | IN | GOI | panaji |
| 포카라 | Pokhara | ポカラ | 博卡拉 | NP | PKR | pokhara |
| 타슈켄트 | Tashkent | タシュケント | 塔什干 | UZ | TAS | tashkent |
| 사마르칸트 | Samarkand | サマルカンド | 撒馬爾罕 | UZ | SKD | samarkand |
| 알마티 | Almaty | アルマトイ | 阿拉木圖 | KZ | ALA | almaty |
| 쉼켄트 | Shymkent | シムケント | 希姆肯特 | KZ | CIT | shymkent |
| 아스타나 | Astana | アスタナ | 阿斯塔納 | KZ | NQZ | astana |
| 비슈케크 | Bishkek | ビシュケク | 比斯凱克 | KG | BSZ | bishkek |
| 트빌리시 | Tbilisi | トビリシ | 提比里斯 | GE | TBS | tbilisi |
| 예레반 | Yerevan | イェレヴァン | 葉里溫 | AM | EVN | yerevan |
| 바쿠 | Baku | バクー | 巴庫 | AZ | GYD | baku |
| 안탈리아 | Antalya | アンタルヤ | 安塔利亞 | TR | AYT | antalya |
| 괴레메 | Göreme | ギョレメ | 格雷梅 | TR | ASR, NAV | goreme |
| 무스카트 | Muscat | マスカット | 馬斯喀特 | OM | MCT | muscat |
| 암만 | Amman | アンマン | 安曼 | JO | AMM | amman |
| 블라디보스토크 | Vladivostok | ウラジオストク | 海參崴 | RU | VVO | vladivostok |

### 유럽 (42곳)

| 한국어 | English | 日本語 | 繁體 | 국가 | 공항 | slug |
|---|---|---|---|---|---|---|
| 니스 | Nice | ニース | 尼斯 | FR | NCE | nice |
| 리옹 | Lyon | リヨン | 里昂 | FR | LYS | lyon |
| 스트라스부르 | Strasbourg | ストラスブール | 史特拉斯堡 | FR | SXB | strasbourg |
| 루체른 | Lucerne | ルツェルン | 琉森 | CH | ZRH | lucerne |
| 제네바 | Geneva | ジュネーヴ | 日內瓦 | CH | GVA | geneva |
| 인터라켄 | Interlaken | インターラーケン | 因特拉肯 | CH | BRN | interlaken |
| 잘츠부르크 | Salzburg | ザルツブルク | 薩爾茲堡 | AT | SZG | salzburg |
| 인스브루크 | Innsbruck | インスブルック | 茵斯布魯克 | AT | INN | innsbruck |
| 할슈타트 | Hallstatt | ハルシュタット | 哈修塔特 | AT | SZG | hallstatt |
| 프랑크푸르트 | Frankfurt | フランクフルト | 法蘭克福 | DE | FRA | frankfurt |
| 함부르크 | Hamburg | ハンブルク | 漢堡 | DE | HAM | hamburg |
| 나폴리 | Naples | ナポリ | 拿坡里 | IT | NAP | naples |
| 피사 | Pisa | ピサ | 比薩 | IT | PSA, FLR | pisa |
| 베로나 | Verona | ヴェローナ | 維洛那 | IT | VRN | verona |
| 볼로냐 | Bologna | ボローニャ | 波隆那 | IT | BLQ, FLR | bologna |
| 카타니아 | Catania | カターニア | 卡塔尼亞 | IT | CTA | catania |
| 세비야 | Seville | セビリア | 塞維亞 | ES | SVQ | seville |
| 그라나다 | Granada | グラナダ | 格拉納達 | ES | GRX | granada |
| 발렌시아 | Valencia | バレンシア | 瓦倫西亞 | ES | VLC | valencia |
| 말라가 | Málaga | マラガ | 馬拉加 | ES | AGP | malaga |
| 팔마 | Palma | パルマ・デ・マヨルカ | 帕爾馬 | ES | PMI | palma |
| 포르투 | Porto | ポルト | 波多 | PT | OPO | porto |
| 미코노스섬 | Mykonos | ミコノス島 | 米科諾斯島 | GR | JMK | mykonos |
| 이라클리오 | Heraklion | イラクリオン | 伊拉克利翁 | GR | HER | heraklion |
| 로도스섬 | Rhodes | ロドス島 | 羅得島 | GR | RHO | rhodes |
| 스플리트 | Split | スプリト | 史普利特 | HR | SPU | split |
| 자그레브 | Zagreb | ザグレブ | 札格雷布 | HR | ZAG | zagreb |
| 류블랴나 | Ljubljana | リュブリャナ | 盧比安納 | SI | LJU | ljubljana |
| 크라쿠프 | Kraków | クラクフ | 克拉科夫 | PL | KRK, KTW | krakow |
| 브로츠와프 | Wrocław | ヴロツワフ | 弗羅次瓦夫 | PL | WRO | wrocaw |
| 그단스크 | Gdańsk | グダニスク | 格但斯克 | PL | GDN | gdansk |
| 브라티슬라바 | Bratislava | ブラチスラヴァ | 布拉提斯拉瓦 | SK | BTS | bratislava |
| 빌뉴스 | Vilnius | ヴィルニュス | 維爾紐斯 | LT | VNO | vilnius |
| 리가 | Riga | リガ | 里加 | LV | RIX | riga |
| 탈린 | Tallinn | タリン | 塔林 | EE | TLL | tallinn |
| 헬싱키 | Helsinki | ヘルシンキ | 赫爾辛基 | FI | HEL | helsinki |
| 오슬로 | Oslo | オスロ | 奧斯陸 | NO | OSL | oslo |
| 레이캬비크 | Reykjavík | レイキャヴィーク | 雷克雅維克 | IS | KEF | reykjavik |
| 로바니에미 | Rovaniemi | ロヴァニエミ | 羅瓦涅米 | FI | RVN | rovaniemi |
| 트롬쇠 | Tromsø | トロムソ | 特隆瑟 | NO | TOS | troms |
| 에든버러 | Edinburgh | エディンバラ | 愛丁堡 | GB | EDI, GLA | edinburgh |
| 발레타 | Valletta | バレッタ | 法勒他 | MT | MLA | valletta |

### 북미·중남미 (19곳)

| 한국어 | English | 日本語 | 繁體 | 국가 | 공항 | slug |
|---|---|---|---|---|---|---|
| 시카고 | Chicago | シカゴ | 芝加哥 | US | ORD, MDW | chicago |
| 보스턴 | Boston | ボストン | 波士頓 | US | BOS | boston |
| 워싱턴 D.C. | Washington, D.C. | ワシントンD.C. | 華盛頓哥倫比亞特區 | US | IAD, BWI, DCA | washingtondc |
| 시애틀 | Seattle | シアトル | 西雅圖 | US | SEA | seattle |
| 샌디에고 | San Diego | サン・ディエゴ | 聖地牙哥 | US | SAN | sandiego |
| 올랜도 | Orlando | オーランド | 奧蘭多 | US | MCO | orlando |
| 댈러스 | Dallas | ダラス | 達拉斯 | US | DFW, DAL | dallas |
| 애틀랜타 | Atlanta | アトランタ | 亞特蘭大 | US | ATL | atlanta |
| 솔트레이크시티 | Salt Lake City | ソルトレイクシティ | 鹽湖城 | US | SLC | saltlakecity |
| 덴버 | Denver | デンバー | 丹佛 | US | DEN | denver |
| 포틀랜드 | Portland | ポートランド | 波特蘭 | US | PDX | portland |
| 몬트리올 | Montreal | モントリオール | 蒙特婁 | CA | YUL | montreal |
| 캘거리 | Calgary | カルガリー | 卡加利 | CA | YYC | calgary |
| 밴프 | Banff | バンフ | 班夫 | CA | YYC | banff |
| 퀘벡 | Quebec City | ケベック | 魁北克 | CA | YQB | quebeccity |
| 몬테레이 | Monterrey | モンテレイ | 蒙特雷 | MX | MTY | monterrey |
| 보고타 | Bogotá | ボゴタ | 波哥大 | CO | BOG | bogota |
| 카르타헤나 | Cartagena | カルタヘナ | 卡塔赫納 | CO | CTG | cartagena |
| 파나마시티 | Panama City | パナマ | 巴拿馬城 | PA | PTY | panamacity |

### 오세아니아·아프리카 (14곳)

| 한국어 | English | 日本語 | 繁體 | 국가 | 공항 | slug |
|---|---|---|---|---|---|---|
| 골드코스트 | Gold Coast | ゴールドコースト | 黃金海岸 | AU | BNE, OOL | goldcoast |
| 케언스 | Cairns | ケアンズ | 凱恩斯 | AU | CNS | cairns |
| 퍼스 | Perth | パース | 伯斯 | AU | PER | perth |
| 애들레이드 | Adelaide | アデレード | 阿得雷德 | AU | ADL | adelaide |
| 크라이스트처치 | Christchurch | クライストチャーチ | 基督城 | NZ | CHC | christchurch |
| 웰링턴 | Wellington | ウェリントン | 威靈頓 | NZ | WLG, BHE | wellington |
| 파페에테 | Papeete | パペーテ | 巴比提 | PF | PPT | papeete |
| 코로르 | Koror | コロール | 科羅 | PW | ROR | koror |
| 카사블랑카 | Casablanca | カサブランカ | 卡薩布蘭卡 | MA | CMN | casablanca |
| 요하네스버그 | Johannesburg | ヨハネスブルグ | 約翰尼斯堡 | ZA | HLA, JNB | johannesburg |
| 아디스아바바 | Addis Ababa | アディスアベバ | 阿迪斯阿貝巴 | ET | ADD | addisababa |
| 빅토리아폴스 | Victoria Falls | ビクトリア・フォールズ | 維多利亞瀑布城 | ZW | VFA | victoriafalls |
| 룩소르 | Luxor | ルクソール | 路克索 | EG | LXR | luxor |
| 포트루이스 | Port Louis | ポートルイス | 路易港 | MU | MRU | portlouis |

### 한국 (4곳)

| 한국어 | English | 日本語 | 繁體 | 국가 | 공항 | slug |
|---|---|---|---|---|---|---|
| 인천 | Incheon | 仁川 | 仁川 | KR | ICN, GMP | incheon |
| 대구 | Daegu | 大邱 | 大邱廣域 | KR | TAE, USN, KPO | daegu |
| 광주 | Gwangju | 光州 | 光州廣域 | KR | KWJ, RSU | gwangju |
| 청주 | Cheongju | 清州 | 清州 | KR | CJJ | cheongju |

## 기존 100곳의 공항 매칭

| 한국어 | English | 국가 | 공항 |
|---|---|---|---|
| 도쿄 | Tokyo | JP | HND, NRT |
| 오사카 | Osaka | JP | KIX, ITM, UKB |
| 교토 | Kyoto | JP | ITM, UKB |
| 후쿠오카 | Fukuoka | JP | FUK |
| 삿포로 | Sapporo | JP | CTS |
| 오키나와 | Okinawa | JP | OKA |
| 나고야 | Nagoya | JP | NGO |
| 벳푸 | Beppu | JP | KMJ, OIT, KKJ, UBJ |
| 방콕 | Bangkok | TH | BKK, DMK |
| 다낭 | Da Nang | VN | DAD, HUI |
| 나트랑 | Nha Trang | VN | CXR |
| 호치민 | Ho Chi Minh City | VN | SGN |
| 하노이 | Hanoi | VN | HAN |
| 싱가포르 | Singapore | SG | SIN |
| 쿠알라룸푸르 | Kuala Lumpur | MY | KUL |
| 발리 | Bali | ID | DPS |
| 세부 | Cebu | PH | CEB |
| 보라카이 | Boracay | PH | MPH, KLO |
| 타이페이 | Taipei | TW | TPE |
| 가오슝 | Kaohsiung | TW | KHH |
| 홍콩 | Hong Kong | HK | HKG |
| 마카오 | Macau | MO | MFM |
| 상하이 | Shanghai | CN | PVG, SHA |
| 베이징 | Beijing | CN | PKX, PEK |
| 제주 | Jeju | KR | CJU |
| 부산 | Busan | KR | PUS |
| 강릉 | Gangneung | KR | YNY |
| 여수 | Yeosu | KR | RSU, HIN |
| 경주 | Gyeongju | KR | PUS, TAE |
| 전주 | Jeonju | KR | KUV |
| 속초 | Sokcho | KR | YNY |
| 서울 | Seoul | KR | ICN, GMP |
| 파리 | Paris | FR | CDG, ORY |
| 런던 | London | GB | LHR, LGW, LTN |
| 로마 | Rome | IT | FCO |
| 바르셀로나 | Barcelona | ES | BCN |
| 프라하 | Prague | CZ | PRG |
| 빈 | Vienna | AT | VIE |
| 취리히 | Zurich | CH | ZRH |
| 암스테르담 | Amsterdam | NL | AMS |
| 리스본 | Lisbon | PT | LIS |
| 이스탄불 | Istanbul | TR | IST, SAW |
| 뉴욕 | New York | US | JFK, EWR, LGA |
| LA | Los Angeles | US | LAX |
| 하와이 | Hawaii | US | HNL |
| 밴쿠버 | Vancouver | CA | YVR |
| 시드니 | Sydney | AU | SYD |
| 괌 | Guam | GU | GUM |
| 사이판 | Saipan | MP | SPN |
| 샌프란시스코 | San Francisco | US | SFO, OAK |
| 치앙마이 | Chiang Mai | TH | CNX |
| 푸켓 | Phuket | TH | HKT |
| 시엠레아프 | Siem Reap | KH | SAI, BBM |
| 델리 | Delhi | IN | DEL |
| 뭄바이 | Mumbai | IN | BOM |
| 자이푸르 | Jaipur | IN | JAI |
| 카트만두 | Kathmandu | NP | KTM |
| 말레 | Malé | MV | MLE |
| 두바이 | Dubai | AE | DXB, SHJ |
| 아부다비 | Abu Dhabi | AE | AUH |
| 도하 | Doha | QA | DOH |
| 텔아비브 | Tel Aviv | IL | TLV |
| 울란바토르 | Ulaanbaatar | MN | UBN |
| 베를린 | Berlin | DE | BER |
| 뮌헨 | Munich | DE | MUC |
| 마드리드 | Madrid | ES | MAD |
| 밀라노 | Milan | IT | MXP, BGY, LIN |
| 베네치아 | Venice | IT | VCE, TSF |
| 피렌체 | Florence | IT | PSA, FLR |
| 산토리니 | Santorini | GR | JTR |
| 아테네 | Athens | GR | ATH |
| 두브로브니크 | Dubrovnik | HR | DBV |
| 부다페스트 | Budapest | HU | BUD |
| 바르샤바 | Warsaw | PL | WAW, WMI |
| 코펜하겐 | Copenhagen | DK | CPH |
| 스톡홀름 | Stockholm | SE | ARN |
| 더블린 | Dublin | IE | DUB |
| 브뤼셀 | Brussels | BE | CRL, BRU |
| 멕시코시티 | Mexico City | MX | MEX, NLU |
| 칸쿤 | Cancún | MX | CUN |
| 토론토 | Toronto | CA | YYZ |
| 라스베가스 | Las Vegas | US | LAS |
| 마이애미 | Miami | US | MIA, FLL |
| 아바나 | Havana | CU | HAV |
| 리우데자네이루 | Rio de Janeiro | BR | GIG, SDU |
| 상파울루 | São Paulo | BR | CGH, VCP, GRU |
| 부에노스아이레스 | Buenos Aires | AR | EZE, AEP |
| 리마 | Lima | PE | LIM |
| 쿠스코 | Cusco | PE | CUZ |
| 산티아고 | Santiago | CL | SCL |
| 케이프타운 | Cape Town | ZA | CPT |
| 마라케시 | Marrakech | MA | RAK |
| 카이로 | Cairo | EG | CAI |
| 나이로비 | Nairobi | KE | NBO, WIL |
| 잔지바르 | Zanzibar | TZ | DAR, ZNZ |
| 멜버른 | Melbourne | AU | MEL |
| 브리즈번 | Brisbane | AU | BNE |
| 오클랜드 | Auckland | NZ | AKL |
| 퀸스타운 | Queenstown | NZ | ZQN |
| 피지 | Fiji | FJ | SUV, NAN |

## 공항 326곳 목록

| IATA | 공항(한국어) | 공항(English) | 국가 | 연간 이용객(대략) | 인천 주간 편수 |
|---|---|---|---|---|---|
| ADD | 볼레 국제공항 | Addis Ababa Bole International Airport | ET | 13.13M | 12 |
| ADL | 애들레이드 공항 | Adelaide International Airport | AU | 8.35M |  |
| AEP | 호르헤 뉴베리 공항 | Aeroparque Jorge Newbery | AR | 1.23M |  |
| AGP | 말라가 코스타델솔 공항 | Málaga-Costa del Sol Airport | ES | 26.76M |  |
| AGR |  | Agra Airport / Agra Air Force Station | IN | 0.01M |  |
| AKJ | 아사히카와 공항 | Asahikawa Airport | JP | 1.13M |  |
| AKL | 오클랜드 국제공항 | Auckland International Airport | NZ | 1.49M | 5 |
| ALA | 알마티 국제공항 | Almaty International Airport | KZ | 11.43M | 28 |
| AMM | 퀸 알리아 국제공항 | Queen Alia International Airport | JO | 7.84M |  |
| AMS | 스히폴 국제공항 | Amsterdam Airport Schiphol | NL | 66.83M | 26 |
| AOJ | 아오모리 공항 | Aomori Airport | JP | 1.23M | 10 |
| AOR |  | Sultan Abdul Halim Airport | MY | 0.16M |  |
| ARN | 스톡홀름 알란다 공항 | Stockholm-Arlanda Airport | SE | 1.52M |  |
| ASR | 에르킬레트 공항 | Kayseri Erkilet International Airport | TR | 2.28M |  |
| ATH | 아테네 국제공항 | Athens Eleftherios Venizelos International Airport | GR | 22.73M |  |
| ATL | 하츠필드 잭슨 애틀랜타 국제공항 | Hartsfield Jackson Atlanta International Airport | US | 106.3M | 56 |
| AUH | 아부다비 국제공항 | Zayed International Airport | AE | 22.94M | 22 |
| AYT | 안탈리아 공항 | Antalya International Airport | TR | 39M |  |
| BBM |  | Battambang Airport | KH |  |  |
| BCN | 바르셀로나 엘프라트 공항 | Josep Tarradellas Barcelona-El Prat Airport | ES | 57.48M | 20 |
| BER | 베를린 브란덴부르크 공항 | Berlin Brandenburg Airport | DE | 25.47M |  |
| BGY | 오리오알세리오 국제공항 | Il Caravaggio International Airport | IT | 16.94M |  |
| BHE |  | Woodbourne Airport | NZ | 0.32M |  |
| BKI | 코타키나발루 국제공항 | Kota Kinabalu International Airport | MY | 1.11M | 38 |
| BKK | 수완나품 국제공항 | Suvarnabhumi Airport | TH | 62.9M | 192 |
| BLQ | 볼로냐 굴리엘모 마르코니 공항 | Bologna Guglielmo Marconi Airport | IT | 11.14M |  |
| BNE | 브리즈번 공항 | Brisbane International Airport | AU | 16.91M | 14 |
| BOG | 엘도라도 국제공항 | El Dorado International Airport | CO | 36.48M |  |
| BOM | 차트라파티 시바지 국제공항 | Chhatrapati Shivaji Maharaj International Airport | IN | 4.34M |  |
| BOS | 로건 국제공항 | Boston Logan International Airport | US | 43.24M | 14 |
| BRN | 베른 공항 | Bern Airport | CH | 0.01M |  |
| BRU | 브뤼셀 공항 | Brussels Airport | BE | 1.57M |  |
| BSZ | 마나스 국제공항 | Manas International Airport | KG | 2.17M | 6 |
| BTS | 브라티슬라바 공항 | M. R. Štefánik Airport | SK | 1.41M |  |
| BUD | 부다페스트 리스트 페렌츠 국제공항 | Budapest Liszt Ferenc International Airport | HU | 17.57M | 14 |
| BWI | 볼티모어 워싱턴 서굿 마셜 국제공항 | Baltimore/Washington International Thurgood Marshall Airport | US | 25.22M |  |
| BWN | 브루나이 국제공항 | Brunei International Airport | BN |  | 6 |
| CAI | 카이로 국제공항 | Cairo International Airport | EG | 30.94M |  |
| CAN | 광저우 바이윈 국제공항 | Guangzhou Baiyun International Airport | CN | 76.37M | 82 |
| CDG | 파리 샤를 드 골 공항 | Charles de Gaulle International Airport | FR | 67.42M | 46 |
| CEB | 막탄 세부 국제공항 | Mactan Cebu International Airport | PH | 5.53M | 42 |
| CEI | 치앙라이 국제공항 | Mae Fah Luang - Chiang Rai International Airport | TH | 1.98M |  |
| CGH | 콩고냐스 상파울루 공항 | Congonhas–Deputado Freitas Nobre Airport | BR | 18.07M |  |
| CGK | 수카르노 하타 국제공항 | Soekarno-Hatta International Airport | ID | 54.81M | 52 |
| CGO | 정저우 신정 국제공항 | Zhengzhou Xinzheng International Airport | CN | 9.22M | 30 |
| CHC | 크라이스트처치 국제공항 | Christchurch International Airport | NZ | 0.5M |  |
| CIT |  | Shymkent International Airport | KZ | 0.96M | 8 |
| CJJ | 청주국제공항 | Cheongju International Airport/Cheongju Air Base (K-59/G-513) | KR | 3.17M |  |
| CJU | 제주국제공항 | Jeju International Airport | KR | 29.7M |  |
| CKG | 충칭 장베이 국제공항 | Chongqing Jiangbei International Airport | CN | 21.67M | 28 |
| CMB | 반다라나이케 국제공항 | Bandaranaike International Colombo Airport | LK | 0.43M | 4 |
| CMN | 무함마드 5세 국제공항 | Mohammed V International Airport | MA | 7.64M |  |
| CNS | 케언즈 공항 | Cairns International Airport | AU | 3.81M |  |
| CNX | 치앙마이 국제공항 | Chiang Mai International Airport | TH | 9.52M | 44 |
| CPH | 코펜하겐 공항 | Copenhagen Kastrup Airport | DK | 22.14M | 12 |
| CPT | 케이프타운 국제공항 | Cape Town International Airport | ZA | 0.84M |  |
| CRK | 디오스다도 마카파갈 국제공항 | Clark International Airport / Clark Air Base | PH | 0.94M | 36 |
| CRL | 브뤼셀 남 샤를루아 공항 | Brussels South Charleroi Airport | BE | 8.27M |  |
| CSX | 창사 황화 국제공항 | Changsha Huanghua International Airport | CN | 12.51M | 28 |
| CTA | 카타니아폰타나로사 공항 | Catania-Fontanarossa Airport | IT | 12.37M |  |
| CTG |  | Rafael Nuñez International Airport | CO | 7.09M |  |
| CTS | 신치토세 공항 | New Chitose Airport | JP | 23.97M | 140 |
| CTU | 청두 솽류 국제공항 | Chengdu Shuangliu International Airport | CN | 33.52M |  |
| CUN | 캉쿤 국제공항 | Cancún International Airport | MX | 32.75M |  |
| CUZ |  | Alejandro Velasco Astete International Airport | PE | 3M |  |
| CXR | 깜라인 국제공항 | Cam Ranh International Airport / Cam Ranh Air Base | VN | 10M | 134 |
| DAD | 다낭 국제공항 | Da Nang International Airport | VN | 15.5M | 182 |
| DAL | 댈러스 러브 필드 | Dallas Love Field | US | 16.9M |  |
| DAR | 줄리어스 니에레레 국제공항 | Julius Nyerere International Airport | TZ | 2.47M |  |
| DBV | 두브로브니크 공항 | Dubrovnik Ruđer Bošković Airport | HR | 2.15M |  |
| DCA | 로널드 레이건 워싱턴 내셔널 공항 | Ronald Reagan Washington National Airport | US | 24.89M |  |
| DEL | 인디라 간디 국제공항 | Indira Gandhi International Airport | IN | 77.82M | 20 |
| DEN | 덴버 국제공항 | Denver International Airport | US | 82.43M |  |
| DFW | 댈러스 포트워스 국제공항 | Dallas Fort Worth International Airport | US | 85.66M | 28 |
| DGT |  | Sibulan Airport | PH | 0.55M |  |
| DLC | 다롄 저우수이쯔 국제공항 | Dalian Zhoushuizi International Airport | CN | 6.37M | 84 |
| DLI | 리엔크엉 국제공항 | Lien Khuong Airport | VN | 1.75M |  |
| DMK | 돈므앙 국제공항 | Don Mueang International Airport | TH | 31.65M | 14 |
| DOH | 뉴도하 국제공항 | Hamad International Airport | QA | 35.73M | 16 |
| DPS | 응우라라이 공항 | Denpasar I Gusti Ngurah Rai International Airport | ID | 0M | 42 |
| DUB | 더블린 공항 | Dublin Airport | IE | 34.65M |  |
| DXB | 두바이 국제공항 | Dubai International Airport | AE | 95.2M | 20 |
| DYG | 장자제 공항 | Zhangjiajie Hehua International Airport | CN | 0.37M | 26 |
| EDI | 에든버러 공항 | Edinburgh Airport | GB | 11.26M |  |
| EVN | 츠바르트노츠 국제공항 | Zvartnots International Airport | AM | 3.64M |  |
| EWR | 뉴어크 리버티 국제공항 | Newark Liberty International Airport | US | 49.16M | 28 |
| EZE | 미니스토로 피스타리니 국제공항 | Ezeiza International Airport - Ministro Pistarini | AR | 11.91M |  |
| FCO | 레오나르도 다 빈치 국제공항 | Rome–Fiumicino Leonardo da Vinci International Airport | IT | 51.31M | 25 |
| FLL | 포트로더데일 할리우드 국제공항 | Fort Lauderdale Hollywood International Airport | US | 32.21M |  |
| FLR | 피렌체 공항 | Florence Airport, Peretola | IT | 3.52M |  |
| FOC | 푸저우 창러 국제공항 | Fuzhou Changle International Airport | CN | 16.12M | 22 |
| FRA | 프랑크푸르트 공항 | Frankfurt Main Airport | DE | 61.56M | 36 |
| FSZ | 시즈오카 공항 | Mount Fuji Shizuoka Airport | JP | 0.58M | 28 |
| FUK | 후쿠오카 공항 | Fukuoka Airport | JP | 26.76M | 376 |
| GDN | 그단스크 레흐 바웬사 공항 | Gdańsk Lech Wałęsa Airport | PL | 7.39M |  |
| GIG | 리우데자네이루 갈레안 국제공항 | Rio de Janeiro Galeão – Tom Jobim International Airport | BR | 14.44M |  |
| GLA |  | Glasgow Airport | GB | 6.52M |  |
| GMP | 김포국제공항 | Seoul Gimpo International Airport | KR | 24.52M |  |
| GOI |  | Goa Dabolim International Airport | IN | 0.88M |  |
| GRU | 상파울루 구아룰류스 국제공항 | São Paulo/Guarulhos–Governor André Franco Montoro International Airport | BR | 3.3M |  |
| GRX | 그라나다 국제공항 | F.G.L. Airport Granada-Jaén Airport | ES | 0.91M |  |
| GUM | 안토니오 비 원 팻 국제공항 | Antonio B. Won Pat International Airport | GU | 3.7M | 70 |
| GVA | 제네바 국제공항 | Geneva International Airport | CH | 17.8M |  |
| GYD | 헤이다르 알리예프 국제공항 | Heydar Aliyev International Airport | AZ | 1.03M |  |
| HAK | 하이커우 메이란 국제공항 | Haikou Meilan International Airport | CN | 11.16M | 8 |
| HAM | 함부르크 공항 | Hamburg Helmut Schmidt Airport | DE | 14.83M |  |
| HAN | 노이바이 국제공항 | Noi Bai International Airport | VN | 29.2M | 152 |
| HAV | 호세 마르티 국제공항 | José Martí International Airport | CU | 5.71M |  |
| HEL | 헬싱키 공항 | Helsinki Vantaa Airport | FI | 16.31M | 14 |
| HER | 이라클리온 국제공항 | Heraklion International Nikos Kazantzakis Airport | GR | 8.09M |  |
| HGH | 항저우 샤오산 국제공항 | Hangzhou Xiaoshan International Airport | CN | 50.46M | 48 |
| HHQ | 후아힌 공항 | Hua Hin Airport | TH | 0.03M |  |
| HIJ | 히로시마 공항 | Hiroshima Airport | JP | 2.85M | 36 |
| HIN | 사천공항 | Sacheon Airport / Sacheon Air Base | KR | 0.14M |  |
| HKD | 하코다테 공항 | Hakodate Airport | JP | 1.8M |  |
| HKG | 홍콩 국제공항 | Hong Kong International Airport | HK | 5.11M | 270 |
| HKT | 푸껫 국제공항 | Phuket International Airport | TH | 17.47M | 28 |
| HLA | 란세리아 국제공항 | Lanseria International Airport | ZA | 1.9M |  |
| HLP | 할림 페르다나쿠수마 국제공항 | Halim Perdanakusuma International Airport | ID | 7.4M |  |
| HND | 도쿄 국제공항 | Tokyo Haneda International Airport | JP | 85.9M | 42 |
| HNL | 호놀룰루 국제공항 | Daniel K. Inouye International Airport | US | 21.19M | 30 |
| HPH | 캇비 국제공항 | Cat Bi International Airport | VN | 2.37M | 14 |
| HRB | 하얼빈 타이핑 국제공항 | Harbin Taiping International Airport | CN | 9.5M | 42 |
| HSG | 사가 공항 | Kyushu Saga International Airport | JP | 0.6M | 8 |
| HUI | 후에 국제공항 | Phu Bai International Airport | VN | 1.83M |  |
| HUN | 화롄 공항 | Hualien Chiashan Airport | TW | 0.01M |  |
| IAD | 워싱턴 덜레스 국제공항 | Washington Dulles International Airport | US | 27.25M | 22 |
| ICN | 인천국제공항 | Incheon International Airport | KR | 74.07M |  |
| INN | 인스브루크 공항 | Innsbruck Airport | AT | 0.88M |  |
| IST | 이스탄불 공항 | İstanbul Airport | TR | 84.46M | 42 |
| ITM | 오사카 국제공항 | Osaka Itami International Airport | JP | 15.16M |  |
| IWK | 이와쿠니 비행장 | Iwakuni Kintaikyo Airport | JP | 0.52M |  |
| IZO | 이즈모 공항 | Izumo Enmusubi Airport | JP | 1.04M |  |
| JAI |  | Jaipur International Airport | IN | 0.5M |  |
| JFK | 존 F. 케네디 국제공항 | John F. Kennedy International Airport | US | 62.44M | 56 |
| JHB | 세나이 국제공항 | Senai International Airport | MY | 0.37M |  |
| JJN |  | Quanzhou Jinjiang International Airport | CN | 3.71M |  |
| JMK |  | Mykonos Island National Airport | GR | 1.69M |  |
| JNB | OR 탐보 국제공항 | O.R. Tambo International Airport | ZA | 1.5M |  |
| JOG |  | Adisutjipto International Airport | ID | 8.43M |  |
| JTR | 산토리니 국제공항 | Santorini International Airport | GR | 2.74M |  |
| KCH | 쿠칭 국제공항 | Kuching International Airport | MY | 0.84M |  |
| KCZ | 고치 공항 | Kochi Ryoma Airport | JP | 1.57M |  |
| KEF | 케플라비크 국제공항 | Keflavik International Airport | IS | 7.78M |  |
| KHH | 가오슝 국제공항 | Kaohsiung International Airport | TW | 6.97M | 36 |
| KIJ | 니가타 공항 | Niigata Airport | JP | 1.12M | 14 |
| KIX | 간사이 국제공항 | Kansai International Airport | JP | 30.6M | 528 |
| KKJ | 기타큐슈 공항 | Kitakyushu Airport | JP | 1.21M | 14 |
| KLO | 칼리보 국제공항 | Kalibo International Airport | PH | 0.63M | 14 |
| KMG | 쿤밍 창슈이 국제공항 | Kunming Changshui International Airport | CN | 49.71M | 16 |
| KMI | 미야자키 공항 | Miyazaki Airport | JP | 3.16M | 6 |
| KMJ | 구마모토 공항 | Kumamoto Airport | JP | 3.54M | 28 |
| KMQ | 고마쓰 공항 | Komatsu Airport / JASDF Komatsu Air Base | JP | 1.46M | 14 |
| KOJ | 가고시마 공항 | Kagoshima Airport | JP | 5.64M | 14 |
| KPO | 포항경주공항 | Pohang Airport (G-815/K-3) | KR | 0.25M |  |
| KRK | 요한 바오로 2세 크라쿠프 국제공항 | Kraków John Paul II International Airport | PL | 11.08M |  |
| KTI | 테초 국제공항 | Techo International Airport | KH |  | 34 |
| KTM | 트리부반 국제공항 | Tribhuvan International Airport | NP | 7.33M | 4 |
| KTW | 카토비체 공항 | Katowice Wojciech Korfanty International Airport | PL | 5.3M |  |
| KUL | 쿠알라룸푸르 국제공항 | Kuala Lumpur International Airport | MY | 25.38M | 55 |
| KUV | 군산공항 | Gunsan Airport / Gunsan Air Base | KR | 0.41M |  |
| KWJ | 광주공항 | Gwangju Airport | KR | 2.07M |  |
| KWL | 구이린 량장 국제공항 | Guilin Liangjiang International Airport | CN | 1.74M | 12 |
| LAS | 매캐런 국제공항 | Harry Reid International Airport | US | 54.99M | 14 |
| LAX |  | Los Angeles International Airport | US | 73.71M | 74 |
| LGA | 라과디아 공항 | LaGuardia Airport | US | 32.79M |  |
| LGK | 랑카위 국제공항 | Langkawi International Airport | MY | 0.76M |  |
| LGW | 런던 개트윅 공항 | London Gatwick Airport | GB | 40.9M |  |
| LHR | 런던 히드로 공항 | London Heathrow Airport | GB | 83.88M | 42 |
| LIM | 호르헤 차베스 국제공항 | Jorge Chávez International Airport | PE | 22.88M |  |
| LIN | 리나테 공항 | Milano Linate Airport | IT | 11.13M |  |
| LIS | 리스본 공항 | Lisbon Humberto Delgado Airport | PT | 2.3M | 8 |
| LJG |  | Lijiang Sanyi International Airport | CN | 2.88M | 4 |
| LJU | 류블랴나 요제 푸치니크 공항 | Ljubljana Jože Pučnik Airport | SI | 0.97M |  |
| LOP | 자이누딘 압둘 마지드 국제공항 | Lombok International Airport | ID | 4.14M |  |
| LPQ | 루앙파방 국제공항 | Luang Phabang International Airport | LA |  |  |
| LTN | 런던 루턴 공항 | London Luton Airport | GB | 13.32M |  |
| LXR | 룩소르 국제공항 | Luxor International Airport | EG | 0.13M |  |
| LYS | 생텍쥐페리 국제공항 | Lyon Saint-Exupéry Airport | FR | 8.56M |  |
| MAD | 마드리드 바라하스 국제공항 | Adolfo Suárez Madrid–Barajas Airport | ES | 66.2M | 8 |
| MCO | 올랜도 국제공항 | Orlando International Airport | US | 57.68M |  |
| MCT | 무스카트 국제공항 | Muscat International Airport | OM | 1.39M |  |
| MDC |  | Sam Ratulangi International Airport | ID | 2.82M | 14 |
| MDW | 시카고 미드웨이 국제공항 | Chicago Midway International Airport | US | 19.38M |  |
| MEL | 멜버른 공항 | Melbourne Airport | AU | 25.69M |  |
| MEX | 멕시코시티 국제공항 | Mexico City Benito Juárez International Airport | MX | 44.61M | 7 |
| MFM | 마카오 국제공항 | Macau International Airport | MO | 7.64M | 56 |
| MIA | 마이애미 국제공항 | Miami International Airport | US | 55.31M |  |
| MKZ | 믈라카 국제공항 | Malacca International Airport | MY |  |  |
| MLA | 몰타 국제공항 | Malta International Airport | MT | 5.85M |  |
| MLE | 말레 국제공항 | Velana International Airport | MV |  |  |
| MMJ | 마쓰모토 공항 | Shinshu-Matsumoto Airport | JP | 0.25M |  |
| MMY | 미야코 공항 | Miyako Airport | JP | 1.86M |  |
| MNL | 니노이 아키노 국제공항 | Ninoy Aquino International Airport | PH | 50.36M | 140 |
| MPH | 고도프레도 P. 라모스 공항 | Godofredo P. Ramos Airport | PH | 2.31M |  |
| MRU | 시우 사구르 람룰람경 국제공항 | Sir Seewoosagur Ramgoolam International Airport | MU | 3.88M |  |
| MTY | 몬테레이 국제공항 | Monterrey International Airport | MX | 13.33M | 7 |
| MUC | 뮌헨 국제공항 | Munich Airport | DE | 41.57M | 14 |
| MXP | 밀라노 말펜사 공항 | Milan Malpensa International Airport | IT | 31.39M | 14 |
| MYJ | 마쓰야마 공항 | Matsuyama Airport | JP | 3M | 42 |
| NAN | 난디 | Nadi International Airport | FJ |  |  |
| NAP | 나폴리 국제공항 | Naples International Airport | IT | 13.27M |  |
| NAV | 네브셰히르 카파도키아 공항 | Nevşehir Kapadokya Airport | TR | 0.44M |  |
| NBO | 조모 케냐타 국제공항 | Jomo Kenyatta International Airport | KE | 1.94M |  |
| NCE | 니스 코트다쥐르 공항 | Nice-Côte d'Azur Airport | FR | 12.12M |  |
| NGO | 중부국제공항 센트레어 | Chubu Centrair International Airport | JP | 10.62M | 120 |
| NGS | 나가사키 공항 | Nagasaki Airport | JP | 2.98M | 6 |
| NKG | 난징 루커우 국제공항 | Nanjing Lukou International Airport | CN | 31.38M | 46 |
| NLU | 펠리페 앙헬레스 국제공항 | Felipe Ángeles International Airport | MX | 7.08M |  |
| NQZ | 누르술탄 나자르바예프 국제공항 | Nursultan Nazarbayev International Airport | KZ | 8.32M | 8 |
| NRT | 나리타 국제공항 | Narita International Airport | JP | 39.81M | 576 |
| OAK | 오클랜드 국제공항 | Oakland San Francisco Bay Airport | US | 9.21M |  |
| OIT | 오이타 공항 | Oita Airport | JP | 1.88M | 8 |
| OKA | 나하 공항 | Naha International Airport | JP | 21.12M | 98 |
| OKJ | 오카야마 공항 | Okayama Momotaro Airport | JP | 1.34M | 8 |
| ONJ | 오다테 노시로 공항 | Odate Noshiro Airport | JP | 0.19M |  |
| OOL | 골드코스트 공항 | Gold Coast Airport | AU | 5.71M |  |
| OPO | 프란시스쿠 드 사 카르네이루 공항 | Francisco de Sá Carneiro Airport | PT | 0.98M |  |
| ORD | 오헤어 국제공항 | Chicago O'Hare International Airport | US | 84.85M | 14 |
| ORY | 파리 오를리 공항 | Paris-Orly Airport | FR | 32.29M |  |
| OSL | 오슬로 가르데르모엔 공항 | Oslo-Gardermoen International Airport | NO | 22.47M |  |
| PDX | 포틀랜드 국제공항 | Portland International Airport | US | 18.56M |  |
| PEK | 베이징 서우두 국제공항 | Beijing Capital International Airport | CN | 52.88M | 118 |
| PEN | 피낭 국제공항 | Penang International Airport | MY | 0.54M |  |
| PER | 퍼스 공항 | Perth International Airport | AU | 16.9M |  |
| PKR |  | Pokhara Domestic Airport | NP | 0.72M |  |
| PKX | 베이징 다싱 국제공항 | Beijing Daxing International Airport | CN | 53.62M | 42 |
| PMI | 팔마데마요르카 공항 | Palma de Mallorca Airport | ES | 33.81M |  |
| PPS | 푸에르토프린세사 국제공항 | Puerto Princesa International Airport / PAF Antonio Bautista Air Base | PH | 1.12M |  |
| PPT | 파아아 국제공항 | Fa'a'ā International Airport | PF | 1.4M |  |
| PQC | 즈엉동 공항 | Phú Quốc International Airport | VN |  | 110 |
| PRG | 프라하 루지네 국제공항 | Václav Havel Airport Prague | CZ | 17.75M | 14 |
| PSA | 피사 국제공항 | Pisa International Airport | IT | 5.94M |  |
| PTY | 토쿠멘 국제공항 | Tocumen International Airport | PA | 15.78M |  |
| PUS | 김해국제공항 | Gimhae International Airport | KR | 10.03M | 72 |
| PVG | 상하이 푸동 국제공항 | Shanghai Pudong International Airport | CN | 84.99M | 224 |
| RAK | 마라케시메나라 공항 | Marrakesh Menara Airport | MA | 4.9M |  |
| RGN | 양곤 국제공항 | Yangon International Airport | MM |  | 10 |
| RHO | 로도스 국제공항 | Rhodes International Airport "Diagoras" | GR | 5.86M |  |
| RIX | 리가 국제공항 | Riga International Airport | LV | 5.38M |  |
| RMQ | 타이중 공항 | Taichung International Airport / Ching Chuang Kang Air Base | TW | 0.58M | 42 |
| ROR | 팔라우 국제공항 | Roman Tmetuchl International Airport | PW | 0.01M |  |
| RSU | 여수공항 | Yeosu Airport | KR | 1.01M |  |
| RVN |  | Rovaniemi Airport | FI | 0.74M |  |
| SAI | 시엠립 앙코르 국제공항 | Siem Reap-Angkor International Airport | KH |  |  |
| SAN | 샌디에고 국제공항 | San Diego International Airport | US | 25.32M |  |
| SAW | 사비하 괵첸 국제공항 | Istanbul Sabiha Gökçen International Airport | TR | 48.42M |  |
| SCL | 코모도로 아르투로 메리노 베니테스 국제공항 | Comodoro Arturo Merino Benítez International Airport | CL | 24.93M |  |
| SDJ | 센다이 공항 | Sendai Airport | JP | 3.72M | 10 |
| SDU | 리우데자네이루 산투스 두몬트 공항 | Santos Dumont Airport | BR | 10.17M |  |
| SEA | 시애틀 터코마 국제공항 | Seattle–Tacoma International Airport | US | 52.72M | 48 |
| SFO | 샌프란시스코 국제공항 | San Francisco International Airport | US | 54.53M | 66 |
| SGN | 떤선녓 국제공항 | Tan Son Nhat International Airport | VN | 39.86M | 140 |
| SHA | 상하이 훙차오 국제공항 | Shanghai Hongqiao International Airport | CN | 50.15M |  |
| SHE | 선양 타오셴 국제공항 | Shenyang Taoxian International Airport | CN | 9.39M | 84 |
| SHI | 시모지시마 공항 | Shimojishima Airport | JP | 0.47M | 14 |
| SHJ | 샤르자 국제공항 | Sharjah International Airport | AE | 13M |  |
| SIN | 싱가포르 창이 국제공항 | Singapore Changi Airport | SG | 58.9M | 148 |
| SKD | 사마르칸트 국제공항 | Samarkand International Airport | UZ | 0.5M |  |
| SLC | 솔트레이크시티 국제공항 | Salt Lake City International Airport | US | 28.16M | 14 |
| SOC |  | Adisoemarmo International Airport | ID | 2.64M |  |
| SPN | 사이판 국제공항 | Saipan International Airport | MP | 1.14M | 14 |
| SPU | 스플리트 공항 | Split Saint Jerome Airport | HR | 2.91M |  |
| SUV | 나우소리 국제공항 | Nausori International Airport | FJ |  |  |
| SVQ | 세비야 공항 | Seville Airport | ES | 9.69M |  |
| SXB | 스트라스부르 공항 | Strasbourg Airport | FR | 0.93M |  |
| SYD | 시드니 공항 | Sydney Kingsford Smith International Airport | AU | 28.98M | 45 |
| SYX | 싼야 펑황 국제공항 | Sanya Phoenix International Airport | CN | 9.51M | 14 |
| SZG | 잘츠부르크 공항 | Salzburg Airport | AT | 1.79M |  |
| SZX | 선전 바오안 국제공항 | Shenzhen Bao'an International Airport | CN | 66.49M | 63 |
| TAE | 대구국제공항 | Daegu International Airport | KR | 2.26M | 14 |
| TAG | 타그빌라란 공항 | Bohol-Panglao International Airport | PH | 0.78M | 28 |
| TAK | 다카마쓰 공항 | Takamatsu Airport | JP | 2.04M | 28 |
| TAO | 칭다오 류팅 국제공항 | Qingdao Jiaodong International Airport | CN | 14.56M | 264 |
| TAS | 타슈켄트 국제공항 | Tashkent International Airport | UZ | 4.43M | 31 |
| TBS | 트빌리시 국제공항 | Tbilisi International Airport | GE | 3M |  |
| TFU | 청두 톈푸 국제공항 | Chengdu Tianfu International Airport | CN | 54.91M | 38 |
| TKS | 도쿠시마 공항 | Tokushima Awaodori Airport / JMSDF Tokushima Air Base | JP | 1.04M | 6 |
| TLL | 탈린 공항 | Lennart Meri Tallinn Airport | EE | 2.75M |  |
| TLV | 벤구리온 국제공항 | Ben Gurion International Airport | IL | 20.01M |  |
| TOS | 트롬쇠 공항 | Tromsø Airport | NO | 2.21M |  |
| TOY | 도야마 공항 | Toyama Kitokito Airport | JP | 0.4M | 1 |
| TPE | 타이완 타오위안 국제공항 | Taiwan Taoyuan International Airport | TW | 47.8M | 176 |
| TRA |  | Tarama Airport | JP | 0.04M |  |
| TSF | 트레비소 공항 | Treviso Airport | IT | 2.64M |  |
| TSN | 톈진 빈하이 국제공항 | Tianjin Binhai International Airport | CN | 5.84M | 84 |
| UBJ | 야마구치 우베 공항 | Yamaguchi Ube Airport | JP | 0.87M |  |
| UBN | 칭기즈 칸 국제공항 | Ulaanbaatar Chinggis Khaan International Airport | MN |  | 51 |
| UKB | 고베 공항 | Kobe Airport | JP | 3.58M | 70 |
| URC | 우루무치 디워푸 국제공항 | Ürümqi Tianshan International Airport | CN | 10.04M |  |
| USM | 사무이 공항 | Samui International Airport | TH | 3M |  |
| USN | 울산공항 | Ulsan Airport | KR | 0.8M |  |
| USU |  | Francisco B. Reyes (Busuanga) Airport | PH | 0.37M |  |
| UTP | 우타파오 국제공항 | U-Tapao–Rayong–Pattaya International Airport | TH | 1.86M |  |
| VCE | 베네치아 마르코 폴로 국제공항 | Venice Marco Polo Airport | IT | 11.85M |  |
| VCP | 비라코푸스 캄피나스 국제공항 | Viracopos International Airport | BR | 11.92M |  |
| VDO | 번돈 국제공항 | Van Don International Airport | VN | 0.26M |  |
| VFA | 빅토리아 폴스 공항 | Victoria Falls International Airport | ZW |  |  |
| VIE | 빈 국제공항 | Vienna International Airport | AT | 32.56M | 8 |
| VLC | 발렌시아 공항 | Valencia Airport | ES | 11.85M |  |
| VNO | 빌뉴스 공항 | Vilnius International Airport | LT | 3.92M |  |
| VRN | 베로나 빌라프란카 공항 | Verona Villafranca Valerio Catullo Airport | IT | 2.98M |  |
| VTE | 왓따이 국제공항 | Wattay International Airport | LA |  | 24 |
| VVO | 블라디보스토크 국제공항 | Vladivostok International Airport | RU | 3.26M |  |
| WAW | 바르샤바 쇼팽 공항 | Warsaw Chopin Airport | PL | 21.26M | 12 |
| WEH | 웨이하이 공항 | Weihai Dashuibo Airport | CN | 1.11M | 42 |
| WIL |  | Nairobi Wilson Airport | KE | 0.85M |  |
| WLG | 웰링턴 국제공항 | Wellington International Airport | NZ | 0.46M |  |
| WMI | 바르샤바 모들린 공항 | Warsaw Modlin Airport | PL | 3.13M |  |
| WRO | 브로츠와프-코페르니쿠스 공항 | Copernicus Wrocław Airport | PL | 4.91M | 2 |
| WUH | 우한 톈허 국제공항 | Wuhan Tianhe International Airport | CN | 11.61M | 22 |
| XIY | 시안 셴양 국제공항 | Xi'an Xianyang International Airport | CN | 13.56M | 52 |
| XMN | 샤먼 가오치 국제공항 | Xiamen Gaoqi International Airport | CN | 10.13M | 28 |
| YGJ | 미호 비행장 | Yonago Kitaro Airport / JASDF Miho Air Base | JP | 0.65M | 10 |
| YNJ | 옌지 차오양촨 공항 | Yanji Chaoyangchuan Airport | CN | 0.32M | 84 |
| YNT | 옌타이 펑라이 국제공항 | Yantai Penglai International Airport | CN | 3.1M | 94 |
| YNY | 양양국제공항 | Yangyang International Airport | KR | 0.38M |  |
| YQB | 퀘벡 시티 진 리사지 국제공항 | Quebec Jean Lesage International Airport | CA | 1.74M |  |
| YUL | 몬트리올 피에르 엘리오트 트뤼도 국제공항 | Montreal / Pierre Elliott Trudeau International Airport | CA | 21.55M | 6 |
| YVR | 밴쿠버 국제공항 | Vancouver International Airport | CA | 26.91M | 50 |
| YYC | 캘거리 국제공항 | Calgary International Airport | CA | 18.49M | 12 |
| YYZ | 토론토 피어슨 국제공항 | Toronto Pearson International Airport | CA | 45.71M | 28 |
| ZAG | 자그레브 국제공항 | Zagreb Franjo Tuđman International Airport | HR | 3.12M |  |
| ZNZ | 아베이드 아마니 카루메 국제공항 | Abeid Amani Karume International Airport | TZ | 0.93M |  |
| ZQN | 퀸스타운 공항 | Queenstown Airport | NZ | 0.23M |  |
| ZRH | 취리히 공항 | Zürich Airport | CH | 32.59M | 12 |
