// 설정 및 지원 목록
const SUPPORTED_ITEMS = {
  civilLaw: { type: "law", displayName: "민법", urlName: "민법" },
  constitution: { type: "law", displayName: "헌법", urlName: "대한민국헌법" },
  criminalLaw: { type: "law", displayName: "형법", urlName: "형법" },
};
const DEFAULT_SETTINGS = {
  civilLaw: true,
  constitution: true,
  criminalLaw: true,
};

// 판례 및 조문 번호 식별을 위한 정규식
const CONST_COURT_REGEX = /\d{2,4}헌[가-하]\d+/; // 헌법재판소
const SUPREME_COURT_REGEX = /\d{2,4}[가-힣]\d+/; // 대법원
const LAW_ARTICLE_REGEX = /제?\s*\d+조(의\d+)?/; // 법률 조문

const updateContextMenus = () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "casenoteParent",
      title: "CaseNote에서 검색",
      contexts: ["selection"],
    });

    // ✨ --- 1. "지능형 검색" 메뉴를 최상단에 추가 --- ✨
    chrome.contextMenus.create({
        id: "intelligentSearch",
        parentId: "casenoteParent",
        title: "지능형 검색 🧠",
        contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: "separator_intelligent",
      parentId: "casenoteParent",
      type: "separator",
      contexts: ["selection"],
    });


    // 2. 기존 메뉴들은 그대로 유지
    chrome.contextMenus.create({
      id: "autoPrecedentSearch",
      parentId: "casenoteParent",
      title: "판례 자동 검색 🏛️",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "separator_manual",
      parentId: "casenoteParent",
      type: "separator",
      contexts: ["selection"],
    });
    chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, (result) => {
      const settings = result.settings;
      for (const id in SUPPORTED_ITEMS) {
        if (settings[id]) {
          const item = SUPPORTED_ITEMS[id];
          chrome.contextMenus.create({
            id: id,
            parentId: "casenoteParent",
            title: `${item.displayName} 조문 검색 📜`,
            contexts: ["selection"],
          });
        }
      }
    });
  });
};

// 확장 프로그램 설치 및 시작 시 메뉴 생성 (이전과 동일)
chrome.runtime.onInstalled.addListener(updateContextMenus);
chrome.runtime.onStartup.addListener(updateContextMenus);

// 메뉴 클릭 이벤트 리스너
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const selection = info.selectionText.trim();
  if (!selection) return;

  const menuItemId = info.menuItemId;
  let finalURL = "";
  let displayText = "";

  if (menuItemId === "intelligentSearch") {
      let handled = false; // 작업이 처리되었는지 여부 플래그
      for (const id in SUPPORTED_ITEMS) {
          const item = SUPPORTED_ITEMS[id];
          if (selection.includes(item.displayName)) {
              const match = selection.match(LAW_ARTICLE_REGEX);
              if (match) {
                  const articleTextForUrl = match[0].replace(/\s/g, "");
                  finalURL = `https://casenote.kr/법령/${item.urlName}/${articleTextForUrl}`;
                  displayText = selection;
                  handled = true;
                  break;
              }
          }
      }
      if (!handled) {
          let match = selection.match(CONST_COURT_REGEX) || selection.match(SUPREME_COURT_REGEX);
          if (match) {
              const courtUrlName = selection.match(CONST_COURT_REGEX) ? "헌법재판소" : "대법원";
              const caseNumber = match[0];
              finalURL = `https://casenote.kr/${courtUrlName}/${encodeURIComponent(caseNumber)}`;
              displayText = `${courtUrlName} ${caseNumber}`;
              handled = true;
          }
      }
      if (!handled) {
          finalURL = `https://casenote.kr/search/?q=${encodeURIComponent(selection)}`;
          displayText = selection;
      }
  }
  // "판례 자동 검색" 메뉴를 클릭한 경우 (기존 로직과 동일)
  else if (menuItemId === "autoPrecedentSearch") {
    let courtUrlName = "";
    let courtDisplayName = "";
    let caseNumber = "";
    let match = selection.match(CONST_COURT_REGEX);
    if (match) {
      courtUrlName = "헌법재판소";
      courtDisplayName = "헌법재판소";
      caseNumber = match[0];
    } else {
      match = selection.match(SUPREME_COURT_REGEX);
      if (match) {
        courtUrlName = "대법원";
        courtDisplayName = "대법원";
        caseNumber = match[0];
      }
    }
    if (caseNumber) {
      finalURL = `https://casenote.kr/${courtUrlName}/${encodeURIComponent(
        caseNumber
      )}`;
      displayText = `${courtDisplayName} ${caseNumber}`;
    } else {
      finalURL = `https://casenote.kr/search/?q=${encodeURIComponent(
        selection
      )}`;
      displayText = selection;
    }
  }

  // 특정 법률 조문 검색 메뉴를 클릭한 경우
  else if (SUPPORTED_ITEMS[menuItemId]) {
    const item = SUPPORTED_ITEMS[menuItemId];
    const match = selection.match(LAW_ARTICLE_REGEX);

    if (match) {
      const articleTextForUrl = match[0].replace(/\s/g, "");
      finalURL = `https://casenote.kr/법령/${item.urlName}/${articleTextForUrl}`;
      displayText = `${item.displayName} ${match[0]}`;
    } else {
      const searchQuery = `${item.displayName} ${selection}`;
      finalURL = `https://casenote.kr/search/?q=${encodeURIComponent(
        searchQuery
      )}`;
      displayText = searchQuery;
    }
  }

  if (finalURL) {
    createPopupWindow(finalURL);
    saveToHistory({ url: finalURL, displayText: displayText });
  }
});

// 팝업 및 content.js로부터 메시지를 받는 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 1. 팝업에서 히스토리 열기 요청
  if (request.action === "openFromHistory") {
    createPopupWindow(request.item.url);
    chrome.storage.local.get({ history: [] }, (result) => {
      let history = result.history;
      const updatedHistory = history.filter(
        (item) =>
          decodeURIComponent(item.url) !== decodeURIComponent(request.item.url)
      );
      updatedHistory.unshift(request.item);
      chrome.storage.local.set({ history: updatedHistory });
    });
  }
  // 2. 팝업에서 메뉴 설정 변경 요청
  else if (request.action === "updateContextMenus") {
    updateContextMenus();
  }
  // 3. content.js에서 히스토리 제목 업데이트 요청
  else if (
    request.action === "updateHistoryTitle" &&
    request.url &&
    request.newTitle
  ) {
    chrome.storage.local.get({ history: [] }, (result) => {
      const history = result.history;
      const decodedRequestUrl = decodeURIComponent(request.url);

      // URL이 일치하는 히스토리 항목을 찾습니다.
      const itemIndex = history.findIndex((item) => {
        const decodedItemUrl = decodeURIComponent(item.url);
        return decodedItemUrl === decodedRequestUrl;
      });

      // 항목을 찾았고, 제목이 아직 업데이트되지 않은 상태일 때만 업데이트
      if (
        itemIndex > -1 &&
        history[itemIndex].displayText !== request.newTitle
      ) {
        history[itemIndex].displayText = request.newTitle;
        chrome.storage.local.set({ history: history });
      }
    });
  }
});

// Helper Functions
const createPopupWindow = (url) => {
  if (!url) return;
  chrome.system.display.getInfo((displays) => {
    const primaryDisplay = displays.find((d) => d.isPrimary) || displays[0];
    const screenWidth = primaryDisplay.workArea.width;
    const screenHeight = primaryDisplay.workArea.height;
    const popupWidth = Math.round(screenWidth / 3);
    const popupHeight = screenHeight;
    const popupLeft = Math.round((screenWidth * 2) / 3);
    const popupTop = 0;
    chrome.windows.create({
      url: url,
      type: "popup",
      width: popupWidth,
      height: popupHeight,
      left: Math.max(0, popupLeft),
      top: Math.max(0, popupTop),
    });
  });
};

//히스토리 저장 함수
const saveToHistory = (historyItem) => {
  chrome.storage.local.get({ history: [] }, (result) => {
    let history = result.history;
    history = history.filter((item) => item.url !== historyItem.url);
    history.unshift(historyItem);
    chrome.storage.local.set({ history: history });
  });
};
