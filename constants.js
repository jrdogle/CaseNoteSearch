// constants.js

// 지원하는 모든 법률 목록 (카테고리 포함)
export const ALL_SUPPORTED_LAWS = {
  // --- 공법 ---
  constitution: { type: "law", displayName: "헌법", urlName: "대한민국헌법", category: "공법" },
  adminLitigation: { type: "law", displayName: "행정소송법", urlName: "행정소송법", category: "공법" },
  
  // --- 민사법 ---
  civilLaw: { type: "law", displayName: "민법", urlName: "민법", category: "민사법" },
  commercialLaw: { type: "law", displayName: "상법", urlName: "상법", category: "민사법" },
  civilProcedure: { type: "law", displayName: "민사소송법", urlName: "민사소송법", category: "민사법" },

  // --- 형사법 ---
  criminalLaw: { type: "law", displayName: "형법", urlName: "형법", category: "형사법" },
  criminalProcedure: { type: "law", displayName: "형사소송법", urlName: "형사소송법", category: "형사법" },
  
  // --- 지적재산권법 ---
  patentAct: { type: "law", displayName: "특허법", urlName: "특허법", category: "지적재산권법" },
  utilityModelAct: { type: "law", displayName: "실용신안법", urlName: "실용신안법", category: "지적재산권법" },
  designProtectionAct: { type: "law", displayName: "디자인보호법", urlName: "디자인보호법", category: "지적재산권법" },
  trademarkAct: { type: "law", displayName: "상표법", urlName: "상표법", category: "지적재산권법" },
  copyrightAct: { type: "law", displayName: "저작권법", urlName: "저작권법", category: "지적재산권법" },
};

// 기본 활성화 법률 목록
export const DEFAULT_SETTINGS = {
  settings: {
    civilLaw: true,
    constitution: true,
    criminalLaw: true,
  },
  favoriteLaws: [],
  autoHighlight: true,
  dragToSearch: true,
};

export const CATEGORY_ORDER = ["공법", "민사법", "형사법", "지적재산권법"];

export const MAX_FAVORITES = 5; // 즐겨찾기 최대 개수

// 판례 및 조문 번호 식별을 위한 정규식
const PRECEDENT_MARKERS = '가합|가단|가소|가|나|다|라|마|바|사|아|자|차|카|타|파|하|거|너|더|러|머|버|서|어|저|처|커|터|퍼|허|고합|고단|고정|고|노|도|로|모|보|소|오|조|초|코|토|포|호|구합|구단|구|누|두|루|무|부|수|우|주|추|쿠|투|푸|후|그|느|드|르|므|브|스|으|즈|츠|크|트|프|흐|기|니|디|리|미|비|시|이|지|치|키|티|피|히|카허|카합|카단|카기|카|크|재심|재|특별|특|인|헌가|헌나|헌다|헌라|헌마|헌바|헌사|헌아|헌자|헌차|헌카|헌타|헌파|헌하|B';
export const COURT_REGEX = new RegExp(`\\d{2,4}(${PRECEDENT_MARKERS})\\d+(?![0-9])`);
export const LAW_ARTICLE_REGEX = /제?\s*\d+조(의\d+)?/;