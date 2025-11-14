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
let isUpdatingMenus = false;

const updateContextMenus = async () => {
  // 1. 이미 메뉴 업데이트가 실행 중인지 확인 (잠금 확인)
  if (isUpdatingMenus) {
    console.log("Context menu update already in progress, skipping.");
    return;
  }
  // 2. 잠금 설정
  isUpdatingMenus = true;
  console.log("Starting context menu update...");

  try {
    // 3. 메뉴 생성에 필요한 모든 데이터를 *미리* 로드합니다.
    const combinedLaws = await getCombinedLaws();
    const result = await chrome.storage.local.get(DEFAULT_SETTINGS);
    const { settings, favoriteLaws } = result;

    // 4. 모든 메뉴를 제거하고, 콜백 함수 안에서 새 메뉴를 생성합니다.
    chrome.contextMenus.removeAll(() => {
      // removeAll이 완료된 후 이 콜백이 실행됩니다.
      
      if (chrome.runtime.lastError) {
        console.error(`removeAll 오류: ${chrome.runtime.lastError.message}`);
        // 오류가 발생해도 생성을 시도합니다.
      }

      // 5. 메뉴 생성 (오류 처리를 위해 헬퍼 함수 사용)
      const createMenuItem = (options) => {
        chrome.contextMenus.create(options, () => {
          if (chrome.runtime.lastError) {
            // ID 중복 오류 등이 여기서 잡힐 수 있지만, 잠금 로직 하에서는 발생 빈도가 줄어듭니다.
            console.warn(`메뉴 생성 오류 (ID: ${options.id}): ${chrome.runtime.lastError.message}`);
          }
        });
      };

      try {
        createMenuItem({ id: "casenoteParent", title: "CaseNote에서 검색", contexts: ["selection"] });
        createMenuItem({ id: "PrecedentSearch", parentId: "casenoteParent", title: "판례 검색", contexts: ["selection"] });

        if (favoriteLaws && favoriteLaws.length > 0) {
          createMenuItem({ id: "separator_favorites", parentId: "casenoteParent", type: "separator", contexts: ["selection"] });
          favoriteLaws.forEach(lawId => {
            const law = combinedLaws[lawId];
            if (law) {
              createMenuItem({ id: `favorite_${lawId}`, parentId: "casenoteParent", title: `${law.displayName} 조문 검색`, contexts: ["selection"] });
            }
          });
        }

        createMenuItem({ id: "separator_laws", parentId: "casenoteParent", type: "separator", contexts: ["selection"] });

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
            createMenuItem({ id: categoryParentId, parentId: "casenoteParent", title: categoryName, contexts: ["selection"] });
            categoryLaws.forEach(law => {
              createMenuItem({ id: law.id, parentId: categoryParentId, title: `${law.displayName} 조문 검색`, contexts: ["selection"] });
            });
          }
        });
      
      } catch (e) {
          // 동기적 오류 (예: createMenuItem 함수 자체의 문제)
          console.error("컨텍스트 메뉴 생성 중 동기적 오류:", e.message);
      } finally {
        // 6. 콜백 내의 모든 작업이 완료되면 잠금을 해제합니다.
        console.log("Context menu update finished.");
        isUpdatingMenus = false;
      }
    }); // removeAll 콜백 끝

  } catch (error) {
    // await (데이터 로드) 중 오류 발생 시
    console.error("메뉴 업데이트를 위한 데이터 로드 중 오류:", error);
    isUpdatingMenus = false; // 잠금 해제
  }
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
const DIRECT_URL_MARKERS = new Set(['다', '도', '모', '오', '우', '초', '추', '트', '후']); 

const parsePrecedent = (selection) => {
  const match = selection.match(COURT_REGEX);
  if (!match) return null;

  const caseNumber = match[0];
  const caseMarker = caseNumber.replace(/\d/g, ''); 
  
  let courtInfo = {};
  let searchType = 'GENERAL';

  if (/[헌]/.test(caseNumber)) {
    courtInfo = { courtUrlName: "헌법재판소", courtDisplayName: "헌법재판소" };
    searchType = 'DIRECT';
  } else if (/[허흐]|카허/.test(caseNumber)) {
    courtInfo = { courtUrlName: "특허법원", courtDisplayName: "특허법원" };
    searchType = 'DIRECT';
  } else if (DIRECT_URL_MARKERS.has(caseMarker)) {
    courtInfo = { courtUrlName: "대법원", courtDisplayName: "대법원" };
    searchType = 'DIRECT';
  }

  return { ...courtInfo, caseNumber, searchType };
};


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
    if (precedent.searchType === 'DIRECT') {
      const directURL = `https://casenote.kr/${precedent.courtUrlName}/${encodeURIComponent(precedent.caseNumber)}`;
      const displayText = `${precedent.courtDisplayName} ${precedent.caseNumber}`;
      await openCheckedUrl(directURL, selection, displayText);
    } else {
      openGeneralSearch(selection);
    }
    return;
  }

  openGeneralSearch(selection);
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
  if (combinedLaws[lawId]) {
    const item = combinedLaws[lawId];
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
    sendResponse({ status: "ok" });
    return true;
  }
  
  if (request.action === "intelligentSearchFromIcon") {
    if (request.selection) {
      handleIntelligentSearch(request.selection);
    }
    return true;
  }
  else if (request.action === "intelligentSearchFromPopup") {
    if (request.text) {
      handleIntelligentSearch(request.text);
    }
    return true;
  }
  else if (request.action === "openFromHistory") {
    createPopupWindow(request.item.url);
    saveToHistory(request.item);
    return true;
  }
  else if (request.action === "updateContextMenus") {
    updateContextMenus();
    return true;
  }
  else if (request.action === "getLawList") {
    (async () => {
      const combinedLaws = await getCombinedLaws();
      const lawDisplayNames = Object.values(combinedLaws).map(law => law.displayName);
      sendResponse({ lawList: lawDisplayNames });
    })();
    return true;
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
    return true;
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

// 일반 검색을 실행하고 히스토리에 저장하는 함수
const openGeneralSearch = (query) => {
    const searchURL = `https://casenote.kr/search/?q=${encodeURIComponent(query)}`;
    createPopupWindow(searchURL);
    saveToHistory({ url: searchURL, displayText: query });
}