import {
  SUPPORTED_ITEMS,
  DEFAULT_SETTINGS,
  CONST_COURT_REGEX,
  SUPREME_COURT_REGEX,
  PATENT_COURT_REGEX,
  LAW_ARTICLE_REGEX,
} from "./constants.js";

const updateContextMenus = () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "casenoteParent",
      title: "CaseNote에서 검색",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: "PrecedentSearch",
      parentId: "casenoteParent",
      title: "판례 검색",
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
            title: `${item.displayName} 조문 검색`,
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

// 지능형 검색 로직
const handleIntelligentSearch = (selection) => {
  let finalURL = "";
  let displayText = "";
  let handled = false;

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
    let match =
      selection.match(CONST_COURT_REGEX) ||
      selection.match(SUPREME_COURT_REGEX)||
      selection.match(PATENT_COURT_REGEX);
    if (match) {
      const caseNumber = match[0];
      let courtUrlName = "대법원";
      if (selection.match(CONST_COURT_REGEX)) {
        courtUrlName = "헌법재판소";
      } else if (selection.match(PATENT_COURT_REGEX)) {
        courtUrlName = "특허법원";
      }
      finalURL = `https://casenote.kr/${courtUrlName}/${encodeURIComponent(
        caseNumber
      )}`;
      displayText = `${courtUrlName} ${caseNumber}`;
      handled = true;
    }
  }

  if (!handled) {
    finalURL = `https://casenote.kr/search/?q=${encodeURIComponent(selection)}`;
    displayText = selection;
  }

  if (finalURL) {
    createPopupWindow(finalURL);
    saveToHistory({ url: finalURL, displayText: displayText });
  }
};

// 메뉴 클릭 이벤트 리스너
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const selection = info.selectionText.trim();
  if (!selection) return;

  const menuItemId = info.menuItemId;
  let finalURL = "";
  let displayText = "";

  // "판례 검색" 메뉴를 클릭한 경우
  if (menuItemId === "PrecedentSearch") {
    let courtUrlName = "";
    let courtDisplayName = "";
    let caseNumber = "";
    let match = 
      selection.match(CONST_COURT_REGEX) || 
      selection.match(SUPREME_COURT_REGEX) || 
      selection.match(PATENT_COURT_REGEX);

    if (match) {
      caseNumber = match[0];
      if (selection.match(CONST_COURT_REGEX)) {
        courtUrlName = "헌법재판소";
        courtDisplayName = "헌법재판소";
      } else if (selection.match(PATENT_COURT_REGEX)) {
        courtUrlName = "특허법원";
        courtDisplayName = "특허법원";
      } else {
        courtUrlName = "대법원";
        courtDisplayName = "대법원";
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
  // 0. content.js의 아이콘 클릭으로부터 지능형 검색 요청
  if (request.action === "intelligentSearchFromIcon") {
    if (request.selection) {
      handleIntelligentSearch(request.selection);
    }
    return; // 메시지 처리 후 종료
  }
  // 1. 팝업에서 히스토리 열기 요청
  else if (request.action === "openFromHistory") {
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

      const itemIndex = history.findIndex((item) => {
        const decodedItemUrl = decodeURIComponent(item.url);
        return decodedItemUrl === decodedRequestUrl;
      });

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
