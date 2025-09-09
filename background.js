import {
  ALL_SUPPORTED_LAWS,
  DEFAULT_SETTINGS,
  CONST_COURT_REGEX,
  SUPREME_COURT_REGEX,
  PATENT_COURT_REGEX,
  LAW_ARTICLE_REGEX,
  CATEGORY_ORDER,
} from "./constants.js";

// 존재하지 않는 판례 검색 시 404 페이지 대신 일반 검색으로 fallback하기 위한 맵
const precedentCheckMap = {};

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) {
    return;
  }

  const tabId = details.tabId;
  const checkInfo = precedentCheckMap[tabId];

  if (checkInfo) {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        delete precedentCheckMap[tabId];
        return;
      }
      
      console.log(`[CaseNote 검색기] webNavigation.onCompleted: tabId ${tabId}. 페이지 제목: "${tab.title}"`);

      if (!tab.title || (tab.title.includes("에러") || tab.title.includes("404"))) {
        console.log(`[CaseNote 검색기] 404 페이지로 판단. 일반 검색으로 전환합니다.`);
        const fallbackQuery = checkInfo.query;
        const fallbackURL = `https://casenote.kr/search/?q=${encodeURIComponent(fallbackQuery)}`;
        
        chrome.tabs.update(tabId, { url: fallbackURL });
        saveToHistory({ url: fallbackURL, displayText: fallbackQuery });
      } else {
        console.log(`[CaseNote 검색기] 정상 페이지로 판단. 히스토리를 저장합니다.`);
        saveToHistory(checkInfo.historyItem);
      }
      console.log(`[CaseNote 검색기] tabId ${tabId} 모니터링을 종료합니다.`);
      delete precedentCheckMap[tabId];
    });
  }
}, {url: [{hostContains: "casenote.kr"}]}); // casenote.kr 도메인에 대해서만 이벤트 수신

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

    chrome.storage.local.get(DEFAULT_SETTINGS, (result) => {
      const { settings, favoriteLaws } = result;
      
      // 즐겨찾기 메뉴 추가
      if (favoriteLaws && favoriteLaws.length > 0) {
        chrome.contextMenus.create({
          id: "separator_favorites",
          parentId: "casenoteParent",
          type: "separator",
          contexts: ["selection"],
        });

        favoriteLaws.forEach(lawId => {
          const law = ALL_SUPPORTED_LAWS[lawId];
          if (law) {
            chrome.contextMenus.create({
              id: `favorite_${lawId}`,
              parentId: "casenoteParent",
              title: `${law.displayName} 조문 검색`,
              contexts: ["selection"],
            });
          }
        });
      }

      chrome.contextMenus.create({
        id: "separator_laws",
        parentId: "casenoteParent",
        type: "separator",
        contexts: ["selection"],
      });

      const enabledLaws = Object.keys(ALL_SUPPORTED_LAWS)
                                .filter(id => settings[id])
                                .map(id => ({ id, ...ALL_SUPPORTED_LAWS[id] }));

      const categories = enabledLaws.reduce((acc, law) => {
        (acc[law.category] = acc[law.category] || []).push(law);
        return acc;
      }, {});

      CATEGORY_ORDER.forEach(categoryName => {
        if (categories[categoryName]) {
            const categoryLaws = categories[categoryName];
            
            const categoryParentId = `category-${categoryName}`;
            chrome.contextMenus.create({
              id: categoryParentId,
              parentId: "casenoteParent",
              title: categoryName,
              contexts: ["selection"],
            });

            categoryLaws.forEach(law => {
              chrome.contextMenus.create({
                id: law.id,
                parentId: categoryParentId,
                title: `${law.displayName} 조문 검색`,
                contexts: ["selection"],
              });
            });
        }
      });
    });
  });
};

// 확장 프로그램 설치 및 시작 시 메뉴 생성
chrome.runtime.onInstalled.addListener(updateContextMenus);
chrome.runtime.onStartup.addListener(updateContextMenus);

// 지능형 검색 로직
const handleIntelligentSearch = (selection) => {
  // 1. 법률 조문 형식인지 확인
  for (const id in ALL_SUPPORTED_LAWS) {
    const item = ALL_SUPPORTED_LAWS[id];
    if (selection.includes(item.displayName)) {
      const match = selection.match(LAW_ARTICLE_REGEX);
      if (match) {
        let articleTextForUrl = match[0].replace(/\s/g, "");
        if (!articleTextForUrl.startsWith("제")) {
          articleTextForUrl = "제" + articleTextForUrl;
        }
        const finalURL = `https://casenote.kr/법령/${item.urlName}/${articleTextForUrl}`;
        const displayText = selection;
        createPopupWindow(finalURL);
        saveToHistory({ url: finalURL, displayText: displayText });
        return; // 처리 완료
      }
    }
  }

  // 2. 판례 번호 형식인지 확인
  const precedent = parsePrecedent(selection);
  if (precedent) {
    const finalURL = `https://casenote.kr/${precedent.courtUrlName}/${encodeURIComponent(precedent.caseNumber)}`;
    const displayText = `${precedent.courtDisplayName} ${precedent.caseNumber}`;
    // 404 확인을 위해 히스토리 저장을 보류하고, 관련 정보를 전달
    createPopupWindow(finalURL, { 
      isPrecedent: true,
      query: selection, 
      historyItem: { url: finalURL, displayText: displayText } 
    });
    return; // 처리 완료
  }

  // 3. 위 형식에 해당하지 않으면 일반 검색 실행
  const finalURL = `https://casenote.kr/search/?q=${encodeURIComponent(selection)}`;
  const displayText = selection;
  createPopupWindow(finalURL);
  saveToHistory({ url: finalURL, displayText: displayText });
};

// 메뉴 클릭 이벤트 리스너
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const selection = info.selectionText.trim();
  if (!selection) return;
  const menuItemId = info.menuItemId;

  // "판례 검색" 메뉴를 클릭한 경우
  if (menuItemId === "PrecedentSearch") {
    const precedent = parsePrecedent(selection);
    if (precedent) {
      const finalURL = `https://casenote.kr/${precedent.courtUrlName}/${encodeURIComponent(precedent.caseNumber)}`;
      const displayText = `${precedent.courtDisplayName} ${precedent.caseNumber}`;
      createPopupWindow(finalURL, { 
        isPrecedent: true,
        query: selection, 
        historyItem: { url: finalURL, displayText: displayText } 
      });
    } else {
      const finalURL = `https://casenote.kr/search/?q=${encodeURIComponent(selection)}`;
      const displayText = selection;
      createPopupWindow(finalURL);
      saveToHistory({ url: finalURL, displayText: displayText });
    }
    return;
  }
  
  // 즐겨찾기 메뉴 또는 일반 법률 메뉴 클릭
  const lawId = menuItemId.startsWith("favorite_") ? menuItemId.replace("favorite_", "") : menuItemId;
  if (ALL_SUPPORTED_LAWS[lawId]) {
    const item = ALL_SUPPORTED_LAWS[lawId];
    const match = selection.match(LAW_ARTICLE_REGEX);
    let finalURL = "";
    let displayText = "";

    if (match) {
      let articleTextForUrl = match[0].replace(/\s/g, "");
      if (!articleTextForUrl.startsWith("제")) {
        articleTextForUrl = "제" + articleTextForUrl;
      }
      finalURL = `https://casenote.kr/법령/${item.urlName}/${articleTextForUrl}`;
      displayText = `${item.displayName} ${match[0]}`;
    } else {
      const searchQuery = `${item.displayName} ${selection}`;
      finalURL = `https://casenote.kr/search/?q=${encodeURIComponent(searchQuery)}`;
      displayText = searchQuery;
    }
    
    if (finalURL) {
      createPopupWindow(finalURL);
      saveToHistory({ url: finalURL, displayText: displayText });
    }
  }
});

// 팝업 및 content.js로부터 메시지를 받는 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 서비스 워커를 깨우기 위한 용도이며, 별도의 작업은 필요 없습니다.
  if (request.action === "ping") {
    return;
  }

  // 0. content.js의 아이콘 클릭으로부터 지능형 검색 요청
  if (request.action === "intelligentSearchFromIcon") {
    if (request.selection) {
      handleIntelligentSearch(request.selection);
    }
    return; // 메시지 처리 후 종료
  }
  // 1. 팝업에서 텍스트로 지능형 검색 요청
  else if (request.action === "intelligentSearchFromPopup") {
    if (request.text) {
      handleIntelligentSearch(request.text);
    }
    return;
  }
  // 2. 팝업에서 히스토리 열기 요청
  else if (request.action === "openFromHistory") {
    createPopupWindow(request.item.url);
    // Re-add the item to the top of the history
    saveToHistory(request.item);
  }
  // 2. 팝업에서 메뉴 설정 변경 요청
  else if (request.action === "updateContextMenus") {
    updateContextMenus();
  }
  // 4. content.js에서 히스토리 제목 업데이트 요청
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
const createPopupWindow = (url, checkInfo = null) => {
  if (!url) return;
  chrome.system.display.getInfo((displays) => {
    const primaryDisplay = displays.find((d) => d.isPrimary) || displays[0];
    const screenWidth = primaryDisplay.workArea.width;
    const screenHeight = primaryDisplay.workArea.height;
    const popupWidth = Math.round(screenWidth / 3);
    const popupHeight = screenHeight;
    const popupLeft = Math.round((screenWidth * 2) / 3);
    const popupTop = 0;

    // 1. 로딩 페이지를 먼저 띄워 즉각적인 반응을 보여줍니다.
    chrome.windows.create({
      url: chrome.runtime.getURL("loader.html"),
      type: "popup",
      width: popupWidth,
      height: popupHeight,
      left: Math.max(0, popupLeft),
      top: Math.max(0, popupTop),
    }, (newWindow) => {
      // 2. 새 창이 생성된 후, 실제 목표 URL로 이동시킵니다.
      if (newWindow && newWindow.tabs && newWindow.tabs.length > 0) {
        const tabId = newWindow.tabs[0].id;
        // V1.1.6: 404 확인이 필요한 경우, 탭 ID와 관련 정보를 맵에 저장
        if (checkInfo && checkInfo.isPrecedent) {
          console.log(`[CaseNote 검색기] 404 확인을 위해 tabId ${tabId}를 모니터링합니다.`, checkInfo);
          precedentCheckMap[tabId] = checkInfo;
        }
        chrome.tabs.update(tabId, { url: url });
      }
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

/**
 * 선택된 텍스트에서 판례 정보를 파싱하는 헬퍼 함수
 * @param {string} selection - 사용자가 선택한 텍스트
 * @returns {object|null} - 파싱 성공 시 판례 정보 객체, 실패 시 null
 */
const parsePrecedent = (selection) => {
  const match = 
    selection.match(CONST_COURT_REGEX) || 
    selection.match(SUPREME_COURT_REGEX) || 
    selection.match(PATENT_COURT_REGEX);

  if (!match) {
    return null;
  }

  const caseNumber = match[0];
  let courtInfo = { courtUrlName: "대법원", courtDisplayName: "대법원" }; // 기본값

  if (selection.match(CONST_COURT_REGEX)) {
    courtInfo = { courtUrlName: "헌법재판소", courtDisplayName: "헌법재판소" };
  } else if (selection.match(PATENT_COURT_REGEX)) {
    courtInfo = { courtUrlName: "특허법원", courtDisplayName: "특허법원" };
  }

  return { ...courtInfo, caseNumber };
};