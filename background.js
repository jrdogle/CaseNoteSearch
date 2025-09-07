const SUPPORTED_ITEMS = {
  civilLaw: { type: "law", displayName: "민법", urlName: "민법" },
  constitution: { type: "law", displayName: "헌법", urlName: "대한민국헌법" },
  criminalLaw: { type: "law", displayName: "형법", urlName: "형법" },
  supremeCourt: {
    type: "precedent",
    displayName: "대법원",
    urlName: "대법원",
  },
  constCourt: {
    type: "precedent",
    displayName: "헌법재판소",
    urlName: "헌법재판소",
  },
};

// 기본 설정값
const DEFAULT_SETTINGS = {
  civilLaw: true,
  constitution: true,
  criminalLaw: true,
  supremeCourt: true,
  constCourt: true,
};

// 우클릭 메뉴를 동적으로 업데이트하는 함수
const updateContextMenus = () => {
  chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, (result) => {
    const settings = result.settings;

    chrome.contextMenus.removeAll(() => {
      // 활성화된 항목만 필터링
      const enabledItems = Object.keys(SUPPORTED_ITEMS).filter(
        (id) => settings[id]
      );

      if (enabledItems.length === 0) return;

      chrome.contextMenus.create({
        id: "casenoteParent",
        title: "CaseNote에서 열기",
        contexts: ["selection"],
      });

      enabledItems.forEach((id) => {
        const item = SUPPORTED_ITEMS[id];
        chrome.contextMenus.create({
          id: id, // 메뉴 ID를 고유 ID로 사용
          parentId: "casenoteParent",
          title: `${item.displayName} ${
            item.type === "law" ? "조문" : "판례"
          } 열기`,
          contexts: ["selection"],
        });
      });
    });
  });
};

// 확장 프로그램 설치 시 또는 브라우저 시작 시 메뉴 생성
chrome.runtime.onInstalled.addListener(updateContextMenus);
chrome.runtime.onStartup.addListener(updateContextMenus);

// popup.js로부터 메뉴 업데이트 요청을 받기 위한 리스너
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateContextMenus") {
    updateContextMenus();
  } else if (request.action === "openFromHistory") {
    createPopupWindow(request.item.url);
  }
});

// 팝업 창 생성 로직
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

// 히스토리 저장 함수
const saveToHistory = (historyItem) => {
  chrome.storage.local.get({ history: [] }, (result) => {
    let history = result.history;
    // 중복 제거: 동일한 항목이 이미 있다면 제거
    history = history.filter(
      (item) => item.displayText !== historyItem.displayText
    );
    // 새 항목을 맨 앞에 추가
    history.unshift(historyItem);
    // 히스토리는 최대 5개까지만 저장
    const slicedHistory = history.slice(0, 5);
    chrome.storage.local.set({ history: slicedHistory });
  });
};

// 메뉴 클릭 이벤트 리스너
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const id = info.menuItemId;
  const item = SUPPORTED_ITEMS[id];
  if (!item) return;

  const selection = info.selectionText.trim();
  let finalURL = "";
  let displayText = "";

  if (item.type === "law") {
    const match = selection.match(/제?\s*\d+조(의\d+)?/);
    if (match) {
      const articleText = match[0].replace(/\s/g, "");
      finalURL = `https://casenote.kr/법령/${item.urlName}/${articleText}`;
      displayText = `${item.displayName} ${articleText}`; // 히스토리에 표시될 텍스트
    }
  } else if (item.type === "precedent") {
    if (selection) {
      finalURL = `https://casenote.kr/${item.urlName}/${selection}`;
      displayText = `${item.displayName} ${selection}`; // 히스토리에 표시될 텍스트
    }
  }

  if (finalURL) {
    createPopupWindow(finalURL); // 분리된 함수 호출
    // 히스토리에 저장할 객체 생성 및 저장
    saveToHistory({ url: finalURL, displayText: displayText });
  } else {
    console.error("선택 텍스트에서 유효한 형식을 찾지 못했습니다:", selection);
  }
});
