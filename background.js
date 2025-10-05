import {
  ALL_SUPPORTED_LAWS,
  DEFAULT_SETTINGS,
  COURT_REGEX,
  LAW_ARTICLE_REGEX,
  CATEGORY_ORDER,
} from "./constants.js";

const getCombinedLaws = async () => {
  const result = await chrome.storage.local.get({ userAddedLaws: {} });
  return { ...ALL_SUPPORTED_LAWS, ...result.userAddedLaws };
};

let popupWindowId = null;
let debounceTimer = null;

const updateContextMenus = async () => {
  const combinedLaws = await getCombinedLaws();

  chrome.contextMenus.removeAll(async () => {
    chrome.contextMenus.create({ id: "casenoteParent", title: "CaseNote에서 검색", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "PrecedentSearch", parentId: "casenoteParent", title: "판례 검색", contexts: ["selection"] });

    const result = await chrome.storage.local.get(DEFAULT_SETTINGS);
    const { settings, favoriteLaws } = result;
    
    if (favoriteLaws && favoriteLaws.length > 0) {
      chrome.contextMenus.create({ id: "separator_favorites", parentId: "casenoteParent", type: "separator", contexts: ["selection"] });
      favoriteLaws.forEach(lawId => {
        const law = combinedLaws[lawId];
        if (law) {
          chrome.contextMenus.create({ id: `favorite_${lawId}`, parentId: "casenoteParent", title: `${law.displayName} 조문 검색`, contexts: ["selection"] });
        }
      });
    }

    chrome.contextMenus.create({ id: "separator_laws", parentId: "casenoteParent", type: "separator", contexts: ["selection"] });

    const enabledLaws = Object.keys(combinedLaws).filter(id => settings[id]).map(id => ({ id, ...combinedLaws[id] }));
    const nonFavoriteEnabledLaws = enabledLaws.filter(law => !favoriteLaws.includes(law.id));
    const categories = nonFavoriteEnabledLaws.reduce((acc, law) => {
      (acc[law.category] = acc[law.category] || []).push(law);
      return acc;
    }, {});

    const customCategories = Object.keys(categories).filter(c => !CATEGORY_ORDER.includes(c));
    const finalCategoryOrder = [...CATEGORY_ORDER, ...customCategories.sort()];

    finalCategoryOrder.forEach(categoryName => {
      if (categories[categoryName]) {
          const categoryLaws = categories[categoryName];
          const categoryParentId = `category-${categoryName}`;
          chrome.contextMenus.create({ id: categoryParentId, parentId: "casenoteParent", title: categoryName, contexts: ["selection"] });
          categoryLaws.forEach(law => {
            chrome.contextMenus.create({ id: law.id, parentId: categoryParentId, title: `${law.displayName} 조문 검색`, contexts: ["selection"] });
          });
      }
    });
  });
};

chrome.runtime.onInstalled.addListener(updateContextMenus);
chrome.runtime.onStartup.addListener(updateContextMenus);
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === popupWindowId) {
    popupWindowId = null;
  }
});
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
  const combinedLaws = await getCombinedLaws();
  for (const id in combinedLaws) {
    const item = combinedLaws[id];
    if (selection.includes(item.displayName)) {
      const match = selection.match(LAW_ARTICLE_REGEX);
      if (match) {
        let articleTextForUrl = match[0].replace(/\s/g, "");
        if (!articleTextForUrl.startsWith("제")) { articleTextForUrl = "제" + articleTextForUrl; }
        const directURL = `https://casenote.kr/법령/${item.urlName}/${articleTextForUrl}`;
        await openCheckedUrl(directURL, selection, selection);
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
  const combinedLaws = await getCombinedLaws();

  // "판례 검색" 메뉴를 클릭한 경우
  if (menuItemId === "PrecedentSearch") {
    const precedent = parsePrecedent(selection);
    if (precedent) {
      const directURL = `https://casenote.kr/${precedent.courtUrlName}/${encodeURIComponent(precedent.caseNumber)}`;
      await openCheckedUrl(directURL, selection, `${precedent.courtDisplayName} ${precedent.caseNumber}`);
    } else {
      openGeneralSearch(selection);
    }
    return;
  }

  // 즐겨찾기 메뉴 또는 일반 법률 메뉴 클릭
  const lawId = menuItemId.startsWith("favorite_") ? menuItemId.replace("favorite_", "") : menuItemId;
  // --- ▼▼▼ 수정된 부분: combinedLaws를 사용하도록 변경 ---
  if (combinedLaws[lawId]) {
    const item = combinedLaws[lawId];
  // --- ▲▲▲ 수정 끝 ---
    const match = selection.match(LAW_ARTICLE_REGEX);
    if (match) {
      let articleTextForUrl = match[0].replace(/\s/g, "");
      if (!articleTextForUrl.startsWith("제")) { articleTextForUrl = "제" + articleTextForUrl; }
      const directURL = `https://casenote.kr/법령/${item.urlName}/${articleTextForUrl}`;
      const displayText = `${item.displayName} ${match[0]}`;
      await openCheckedUrl(directURL, `${item.displayName} ${selection}`, displayText);
    } else {
      openGeneralSearch(`${item.displayName} ${selection}`);
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
    if (response.ok) {
      createPopupWindow(directUrl);
      saveToHistory({ url: directUrl, displayText: displayText });
    } else {
      openGeneralSearch(fallbackQuery);
    }
  } catch (error) {
    console.error("URL 확인 중 오류:", error);
    openGeneralSearch(fallbackQuery);
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
  const match = selection.match(COURT_REGEX);

  if (!match) {
    return null;
  }

  const caseNumber = match[0];
  let courtInfo = { courtUrlName: "대법원", courtDisplayName: "대법원" };

  if (/[헌]/.test(caseNumber)) {
    courtInfo = { courtUrlName: "헌법재판소", courtDisplayName: "헌법재판소" };
  } else if (/[허후흐히]|카허/.test(caseNumber)) {
    courtInfo = { courtUrlName: "특허법원", courtDisplayName: "특허법원" };
  }

  return { ...courtInfo, caseNumber };
};

// 일반 검색을 실행하고 히스토리에 저장하는 함수
const openGeneralSearch = (query) => {
    const searchURL = `https://casenote.kr/search/?q=${encodeURIComponent(query)}`;
    createPopupWindow(searchURL);
    saveToHistory({ url: searchURL, displayText: query });
}