// 설정 및 지원 목록
export const SUPPORTED_ITEMS = {
  civilLaw: { type: "law", displayName: "민법", urlName: "민법" },
  constitution: { type: "law", displayName: "헌법", urlName: "대한민국헌법" },
  criminalLaw: { type: "law", displayName: "형법", urlName: "형법" },
};
export const DEFAULT_SETTINGS = {
  civilLaw: true,
  constitution: true,
  criminalLaw: true,
};

// 판례 및 조문 번호 식별을 위한 정규식
export const CONST_COURT_REGEX = /\d{2,4}헌[가-아]\d+/; // 헌법재판소
export const SUPREME_COURT_REGEX = /\d{2,4}(다|도|두)\d+/; // 대법원
export const PATENT_COURT_REGEX = /\d{2,4}(허|후|흐|히|카허)\d+/; // 특허법원
export const LAW_ARTICLE_REGEX = /제?\s*\d+조(의\d+)?/; // 법률 조문