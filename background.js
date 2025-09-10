import {
  ALL_SUPPORTED_LAWS,
  DEFAULT_SETTINGS,
  CONST_COURT_REGEX,
  SUPREME_COURT_REGEX,
  PATENT_COURT_REGEX,
  LAW_ARTICLE_REGEX,
  CATEGORY_ORDER,
} from "./constants.js";

let popupWindowId = null;
let debounceTimer = null;

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

      // 즐겨찾기에 추가된 법률은 일반 목록에서 제외하여 중복 표시 방지
      const nonFavoriteEnabledLaws = enabledLaws.filter(law => !favoriteLaws.includes(law.id));

      const categories = nonFavoriteEnabledLaws.reduce((acc, law) => {
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

// 팝업 윈도우가 닫힐 때 ID 초기화
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popupWindowId) {
    popupWindowId = null;
  }
});

// 팝업 윈도우의 크기/위치 변경 시 저장 (디바운싱 적용)
chrome.windows.onBoundsChanged.addListener((window) => {
  if (window.id === popupWindowId && window.state !== 'minimized') {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const bounds = {
        left: window.left,
        top: window.top,
        width: window.width,
        height: window.height,
      };
      chrome.storage.local.set({ windowBounds: bounds });
    }, 500);
  }
});

// 지능형 검색 로직
const handleIntelligentSearch = async (selection) => {
  for (const id in ALL_SUPPORTED_LAWS) {
    const item = ALL_SUPPORTED_LAWS[id];
    if (selection.includes(item.displayName)) {
      const match = selection.match(LAW_ARTICLE_REGEX);
      if (match) {
        let articleTextForUrl = match[0].replace(/\s/g, "");
        if (!articleTextForUrl.startsWith("제")) {
          articleTextForUrl = "제" + articleTextForUrl;
        }
        const directURL = `https://casenote.kr/법령/${item.urlName}/${articleTextForUrl}`;
        const displayText = selection;
        
        await openCheckedUrl(directURL, selection, displayText);
        return;
      }
    }
  }

  const precedent = parsePrecedent(selection);
  if (precedent) {
    const directURL = `https://casenote.kr/${precedent.courtUrlName}/${encodeURIComponent(precedent.caseNumber)}`;
    const displayText = `${precedent.courtDisplayName} ${precedent.caseNumber}`;
    await openCheckedUrl(directURL, selection, displayText);
    return;
  }

  const finalURL = `https://casenote.kr/search/?q=${encodeURIComponent(selection)}`;
  const displayText = selection;
  createPopupWindow(finalURL);
  saveToHistory({ url: finalURL, displayText: displayText });
};

// 메뉴 클릭 이벤트 리스너
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selection = info.selectionText.trim();
  if (!selection) return;
  const menuItemId = info.menuItemId;

  // "판례 검색" 메뉴를 클릭한 경우
  if (menuItemId === "PrecedentSearch") {
    const precedent = parsePrecedent(selection);
    if (precedent) {
      const directURL = `https://casenote.kr/${precedent.courtUrlName}/${encodeURIComponent(precedent.caseNumber)}`;
      const displayText = `${precedent.courtDisplayName} ${precedent.caseNumber}`;
      await openCheckedUrl(directURL, selection, displayText);
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

    if (match) {
      let articleTextForUrl = match[0].replace(/\s/g, "");
      if (!articleTextForUrl.startsWith("제")) {
        articleTextForUrl = "제" + articleTextForUrl;
      }
      const directURL = `https://casenote.kr/법령/${item.urlName}/${articleTextForUrl}`;
      const displayText = `${item.displayName} ${match[0]}`;
      const fallbackQuery = `${item.displayName} ${selection}`;
      await openCheckedUrl(directURL, fallbackQuery, displayText);
    } else {
      const searchQuery = `${item.displayName} ${selection}`;
      const finalURL = `https://casenote.kr/search/?q=${encodeURIComponent(searchQuery)}`;
      const displayText = searchQuery;
      createPopupWindow(finalURL);
      saveToHistory({ url: finalURL, displayText: displayText });
    }
  }
});

// 팝업 및 content.js로부터 메시지를 받는 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    return;
  }
  
  if (request.action === "intelligentSearchFromIcon") {
    if (request.selection) {
      handleIntelligentSearch(request.selection);
    }
    return;
  }
  else if (request.action === "intelligentSearchFromPopup") {
    if (request.text) {
      handleIntelligentSearch(request.text);
    }
    return;
  }
  else if (request.action === "openFromHistory") {
    createPopupWindow(request.item.url);
    saveToHistory(request.item);
  }
  else if (request.action === "updateContextMenus") {
    updateContextMenus();
  }
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

  chrome.storage.local.get({ windowBounds: null }, (result) => {
    const lastBounds = result.windowBounds;

    chrome.system.display.getInfo((displays) => {
      const primaryDisplay = displays.find((d) => d.isPrimary) || displays[0];
      const screenWidth = primaryDisplay.workArea.width;
      const screenHeight = primaryDisplay.workArea.height;

      const creationData = {
        url: url,
        type: "popup",
        width: lastBounds?.width || Math.round(screenWidth / 3),
        height: lastBounds?.height || screenHeight,
        left: lastBounds?.left || Math.round((screenWidth * 2) / 3),
        top: lastBounds?.top || 0,
      };

      // 창이 화면 밖에서 생성되는 것을 방지
      if (lastBounds) {
        creationData.left = Math.max(0, Math.min(lastBounds.left, screenWidth - lastBounds.width));
        creationData.top = Math.max(0, Math.min(lastBounds.top, screenHeight - lastBounds.height));
      }

      chrome.windows.create(creationData, (newWindow) => {
        if (newWindow) {
          popupWindowId = newWindow.id;
        }
      });
    });
  });
};

// URL의 유효성을 체크하고 페이지를 엽니다.
const openCheckedUrl = async (directUrl, fallbackQuery, displayText) => {
  try {
    const response = await fetch(directUrl, { method: 'HEAD' });
    if (response.status === 200) {
      createPopupWindow(directUrl);
      saveToHistory({ url: directUrl, displayText: displayText });
    } else {
      const searchURL = `https://casenote.kr/search/?q=${encodeURIComponent(fallbackQuery)}`;
      createPopupWindow(searchURL);
      saveToHistory({ url: searchURL, displayText: fallbackQuery });
    }
  } catch (error) {
    const searchURL = `https://casenote.kr/search/?q=${encodeURIComponent(fallbackQuery)}`;
    createPopupWindow(searchURL);
    saveToHistory({ url: searchURL, displayText: fallbackQuery });
  }
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
  let courtInfo = { courtUrlName: "대법원", courtDisplayName: "대법원" };

  if (selection.match(CONST_COURT_REGEX)) {
    courtInfo = { courtUrlName: "헌법재판소", courtDisplayName: "헌법재판소" };
  } else if (selection.match(PATENT_COURT_REGEX)) {
    courtInfo = { courtUrlName: "특허법원", courtDisplayName: "특허법원" };
  }

  return { ...courtInfo, caseNumber };
};