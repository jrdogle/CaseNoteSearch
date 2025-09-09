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
};

export const CATEGORY_ORDER = ["공법", "민사법", "형사법", "지적재산권법"];

export const MAX_FAVORITES = 3; // 즐겨찾기 최대 개수

// 판례 및 조문 번호 식별을 위한 정규식
export const CONST_COURT_REGEX = /\d{2,4}헌[가-아]\d+/;
export const SUPREME_COURT_REGEX = /\d{2,4}(다|도|두)\d+/;
export const PATENT_COURT_REGEX = /\d{2,4}(허|후|흐|히|카허)\d+/;
export const LAW_ARTICLE_REGEX = /제?\s*\d+조(의\d+)?/;