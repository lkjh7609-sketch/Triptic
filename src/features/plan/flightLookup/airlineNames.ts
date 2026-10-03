/* i18n-exempt-file: 항공사 공식 이름(영·일·번체) 데이터 */
/**
 * 항공사 이름 — IATA 코드 → 영어·일본어·번체(대만) 공식(통용) 이름. 한국어 이름은 API가 준 값을 그대로 쓰므로 여기에 없다.
 * 일본어·번체 이름이 따로 없거나 확인하지 못한 항공사는 영어 이름을 쓴다(값을 비워 둔 칸).
 */

export interface AirlineNames {
  en: string;
  ja?: string;
  zhTW?: string;
}

const AIRLINES: Record<string, AirlineNames> = {
  '3U': { en: 'Sichuan Airlines', ja: '四川航空', zhTW: '四川航空' },
  '5J': { en: 'Cebu Pacific', ja: 'セブ・パシフィック航空', zhTW: '宿霧太平洋航空' },
  '7C': { en: 'Jeju Air', ja: 'チェジュ航空', zhTW: '濟州航空' },
  '8M': { en: 'Myanmar Airways International', ja: 'ミャンマー国際航空', zhTW: '緬甸國際航空' },
  '9C': { en: 'Spring Airlines', ja: '春秋航空', zhTW: '春秋航空' },
  '9G': { en: 'Sun PhuQuoc Airways' },
  AA: { en: 'American Airlines', ja: 'アメリカン航空', zhTW: '美國航空' },
  AC: { en: 'Air Canada', ja: 'エア・カナダ', zhTW: '加拿大航空' },
  AF: { en: 'Air France', ja: 'エールフランス航空', zhTW: '法國航空' },
  AI: { en: 'Air India', ja: 'エア・インディア', zhTW: '印度航空' },
  AK: { en: 'AirAsia', ja: 'エアアジア', zhTW: '亞洲航空' },
  AM: { en: 'Aeroméxico', ja: 'アエロメヒコ航空', zhTW: '墨西哥航空' },
  AR: { en: 'Aerolíneas Argentinas', ja: 'アルゼンチン航空', zhTW: '阿根廷航空' },
  AS: { en: 'Alaska Airlines', ja: 'アラスカ航空', zhTW: '阿拉斯加航空' },
  AT: { en: 'Royal Air Maroc', ja: 'ロイヤル・エア・モロッコ', zhTW: '摩洛哥皇家航空' },
  AY: { en: 'Finnair', ja: 'フィンエアー', zhTW: '芬蘭航空' },
  B7: { en: 'UNI Air', ja: '立栄航空', zhTW: '立榮航空' },
  BA: { en: 'British Airways', ja: 'ブリティッシュ・エアウェイズ', zhTW: '英國航空' },
  BI: { en: 'Royal Brunei Airlines', ja: 'ロイヤルブルネイ航空', zhTW: '汶萊皇家航空' },
  BR: { en: 'EVA Air', ja: 'エバー航空', zhTW: '長榮航空' },
  BX: { en: 'Air Busan', ja: 'エアプサン', zhTW: '釜山航空' },
  C6: { en: 'Centrum Air' },
  CA: { en: 'Air China', ja: '中国国際航空', zhTW: '中國國際航空' },
  CI: { en: 'China Airlines', ja: 'チャイナ エアライン', zhTW: '中華航空' },
  CM: { en: 'Copa Airlines', ja: 'コパ航空', zhTW: '巴拿馬航空' },
  CX: { en: 'Cathay Pacific', ja: 'キャセイパシフィック航空', zhTW: '國泰航空' },
  CZ: { en: 'China Southern Airlines', ja: '中国南方航空', zhTW: '中國南方航空' },
  D7: { en: 'AirAsia X', ja: 'エアアジアX', zhTW: '亞洲航空X' },
  DL: { en: 'Delta Air Lines', ja: 'デルタ航空', zhTW: '達美航空' },
  DV: { en: 'SCAT Airlines' },
  EK: { en: 'Emirates', ja: 'エミレーツ航空', zhTW: '阿聯酋航空' },
  ET: { en: 'Ethiopian Airlines', ja: 'エチオピア航空', zhTW: '衣索比亞航空' },
  EY: { en: 'Etihad Airways', ja: 'エティハド航空', zhTW: '阿提哈德航空' },
  FD: { en: 'Thai AirAsia', ja: 'タイ・エアアジア', zhTW: '泰國亞洲航空' },
  FM: { en: 'Shanghai Airlines', ja: '上海航空', zhTW: '上海航空' },
  GA: { en: 'Garuda Indonesia', ja: 'ガルーダ・インドネシア航空', zhTW: '印尼鷹航' },
  GS: { en: 'Tianjin Airlines', ja: '天津航空', zhTW: '天津航空' },
  HA: { en: 'Hawaiian Airlines', ja: 'ハワイアン航空', zhTW: '夏威夷航空' },
  HH: { en: 'Qanot Sharq' },
  HO: { en: 'Juneyao Air', ja: '吉祥航空', zhTW: '吉祥航空' },
  HU: { en: 'Hainan Airlines', ja: '海南航空', zhTW: '海南航空' },
  HX: { en: 'Hong Kong Airlines', ja: '香港航空', zhTW: '香港航空' },
  HY: { en: 'Uzbekistan Airways', ja: 'ウズベキスタン航空', zhTW: '烏茲別克航空' },
  IB: { en: 'Iberia', ja: 'イベリア航空', zhTW: '伊比利航空' },
  IT: { en: 'Tigerair Taiwan', ja: 'タイガーエア台湾', zhTW: '台灣虎航' },
  JD: { en: 'Beijing Capital Airlines', ja: '北京首都航空', zhTW: '北京首都航空' },
  JL: { en: 'Japan Airlines', ja: '日本航空', zhTW: '日本航空' },
  JQ: { en: 'Jetstar', ja: 'ジェットスター航空', zhTW: '捷星航空' },
  JT: { en: 'Lion Air', ja: 'ライオン・エア', zhTW: '獅子航空' },
  JU: { en: 'Air Serbia', ja: 'エア・セルビア', zhTW: '塞爾維亞航空' },
  KC: { en: 'Air Astana', ja: 'エア・アスタナ', zhTW: '阿斯塔納航空' },
  KE: { en: 'Korean Air', ja: '大韓航空', zhTW: '大韓航空' },
  KL: { en: 'KLM Royal Dutch Airlines', ja: 'KLMオランダ航空', zhTW: '荷蘭皇家航空' },
  KQ: { en: 'Kenya Airways', ja: 'ケニア航空', zhTW: '肯亞航空' },
  KU: { en: 'Kuwait Airways', ja: 'クウェート航空', zhTW: '科威特航空' },
  LA: { en: 'LATAM Airlines' },
  LH: { en: 'Lufthansa', ja: 'ルフトハンザ ドイツ航空', zhTW: '漢莎航空' },
  LJ: { en: 'Jin Air', ja: 'ジンエアー', zhTW: '真航空' },
  LO: { en: 'LOT Polish Airlines', ja: 'LOTポーランド航空', zhTW: '波蘭航空' },
  LX: {
    en: 'Swiss International Air Lines',
    ja: 'スイス インターナショナル エア ラインズ',
    zhTW: '瑞士國際航空',
  },
  LY: { en: 'EL AL Israel Airlines', ja: 'エル・アル航空', zhTW: '以色列航空' },
  M0: { en: 'Aero Mongolia' },
  MF: { en: 'Xiamen Airlines', ja: '厦門航空', zhTW: '廈門航空' },
  MH: { en: 'Malaysia Airlines', ja: 'マレーシア航空', zhTW: '馬來西亞航空' },
  MM: { en: 'Peach Aviation', ja: 'ピーチ・アビエーション', zhTW: '樂桃航空' },
  MS: { en: 'EgyptAir', ja: 'エジプト航空', zhTW: '埃及航空' },
  MU: { en: 'China Eastern Airlines', ja: '中国東方航空', zhTW: '中國東方航空' },
  NH: { en: 'All Nippon Airways', ja: '全日本空輸', zhTW: '全日空' },
  NX: { en: 'Air Macau', ja: 'マカオ航空', zhTW: '澳門航空' },
  NZ: { en: 'Air New Zealand', ja: 'ニュージーランド航空', zhTW: '紐西蘭航空' },
  OD: { en: 'Batik Air Malaysia' },
  OM: { en: 'MIAT Mongolian Airlines', ja: 'MIATモンゴル航空', zhTW: '蒙古國民航' },
  OZ: { en: 'Asiana Airlines', ja: 'アシアナ航空', zhTW: '韓亞航空' },
  PR: { en: 'Philippine Airlines', ja: 'フィリピン航空', zhTW: '菲律賓航空' },
  QF: { en: 'Qantas', ja: 'カンタス航空', zhTW: '澳洲航空' },
  QR: { en: 'Qatar Airways', ja: 'カタール航空', zhTW: '卡達航空' },
  QV: { en: 'Lao Airlines', ja: 'ラオス航空', zhTW: '寮國航空' },
  QW: { en: 'Qingdao Airlines', ja: '青島航空', zhTW: '青島航空' },
  RF: { en: 'Aero K' },
  RJ: { en: 'Royal Jordanian', ja: 'ロイヤル・ヨルダン航空', zhTW: '約旦皇家航空' },
  RS: { en: 'Air Seoul', ja: 'エアソウル', zhTW: '首爾航空' },
  SC: { en: 'Shandong Airlines', ja: '山東航空', zhTW: '山東航空' },
  SK: { en: 'Scandinavian Airlines', ja: 'スカンジナビア航空', zhTW: '北歐航空' },
  SQ: { en: 'Singapore Airlines', ja: 'シンガポール航空', zhTW: '新加坡航空' },
  SV: { en: 'Saudia', ja: 'サウディア', zhTW: '沙烏地阿拉伯航空' },
  T5: { en: 'Turkmenistan Airlines', ja: 'トルクメニスタン航空', zhTW: '土庫曼航空' },
  TG: { en: 'Thai Airways', ja: 'タイ国際航空', zhTW: '泰國航空' },
  TK: { en: 'Turkish Airlines', ja: 'ターキッシュ エアラインズ', zhTW: '土耳其航空' },
  TN: { en: 'Air Tahiti Nui', ja: 'エア・タヒチ・ヌイ', zhTW: '大溪地航空' },
  TP: { en: 'TAP Air Portugal', ja: 'TAPポルトガル航空', zhTW: '葡萄牙航空' },
  TR: { en: 'Scoot', ja: 'スクート', zhTW: '酷航' },
  TW: { en: "T'way Air", ja: 'ティーウェイ航空', zhTW: '德威航空' },
  UA: { en: 'United Airlines', ja: 'ユナイテッド航空', zhTW: '聯合航空' },
  UL: { en: 'SriLankan Airlines', ja: 'スリランカ航空', zhTW: '斯里蘭卡航空' },
  UO: { en: 'HK Express', ja: '香港エクスプレス航空', zhTW: '香港快運航空' },
  UX: { en: 'Air Europa', ja: 'エア・ヨーロッパ', zhTW: '歐羅巴航空' },
  VA: { en: 'Virgin Australia', ja: 'ヴァージン・オーストラリア', zhTW: '維珍澳洲航空' },
  VJ: { en: 'VietJet Air', ja: 'ベトジェットエア', zhTW: '越捷航空' },
  VN: { en: 'Vietnam Airlines', ja: 'ベトナム航空', zhTW: '越南航空' },
  VS: { en: 'Virgin Atlantic', ja: 'ヴァージン アトランティック航空', zhTW: '維珍大西洋航空' },
  VZ: { en: 'Thai VietJet Air', ja: 'タイ・ベトジェットエア', zhTW: '泰國越捷航空' },
  WB: { en: 'RwandAir', ja: 'ルワンダ航空', zhTW: '盧安達航空' },
  WE: { en: 'Parata Air' },
  WS: { en: 'WestJet', ja: 'ウエストジェット', zhTW: '西捷航空' },
  WY: { en: 'Oman Air', ja: 'オマーン航空', zhTW: '阿曼航空' },
  XY: { en: 'flynas' },
  YP: { en: 'Air Premia' },
  ZA: { en: 'Sky Angkor Airlines' },
  ZE: { en: 'Eastar Jet', ja: 'イースター航空', zhTW: '易斯達航空' },
  ZG: { en: 'ZIPAIR Tokyo', ja: 'ジップエア' },
  ZH: { en: 'Shenzhen Airlines', ja: '深圳航空', zhTW: '深圳航空' },
  '4V': { en: 'Fly Gangwon' },
};

/** 표시 언어에 맞는 항공사 이름 — 한국어는 API 원문(koName), 그 밖은 공식 이름표(없으면 영어, 그것도 없으면 koName) */
export function airlineDisplayName(
  code: string | undefined,
  locale: string,
  koName: string | undefined,
): string {
  const ko = koName ?? '';
  if (locale === 'ko') return ko;
  const names = code ? AIRLINES[code.toUpperCase()] : undefined;
  if (!names) return ko;
  if (locale === 'ja') return names.ja ?? names.en;
  if (locale === 'zh-TW') return names.zhTW ?? names.en;
  return names.en;
}

export function hasAirlineNames(code: string): boolean {
  return code.toUpperCase() in AIRLINES;
}
