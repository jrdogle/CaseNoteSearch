let currentIcon = null;

const createSearchIcon = (x, y, selectedText) => {
  console.log("3. createSearchIcon 함수 실행됨");
  if (currentIcon) {
    currentIcon.remove();
    currentIcon = null;
    console.log(" - 기존 아이콘 제거됨");
  }

  const icon = document.createElement("div");
  icon.id = "casenote-search-icon";
  icon.style.cssText = `
    position: absolute;
    top: ${y + window.scrollY}px;
    left: ${x + window.scrollX}px;
    z-index: 99999;
    cursor: pointer;
    background-color: white;
    border: 1px solid #ccc;
    border-radius: 10%;
    width: 32px;
    height: 32px;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    padding: 0;
  `;
  const img = document.createElement("img");
  img.src = chrome.runtime.getURL("images/icon48.png");
  console.log(" - 이미지 경로:", img.src); // 이미지 경로가 올바른지 확인
  img.style.width = "30px";
  img.style.height = "30px";
  icon.appendChild(img);

  icon.addEventListener("click", (event) => {
    event.stopPropagation();
    chrome.runtime.sendMessage({
      action: "intelligentSearchFromIcon",
      selection: selectedText,
    });
    icon.remove();
    currentIcon = null;
  });

  document.body.appendChild(icon);
  currentIcon = icon;
  console.log("4. 아이콘이 body에 추가됨", icon);
};

const hideSearchIcon = (event) => {
  if (
    currentIcon &&
    event.target !== currentIcon &&
    !currentIcon.contains(event.target)
  ) {
    currentIcon.remove();
    currentIcon = null;
    console.log("hideSearchIcon: 아이콘 숨김 처리됨");
  }
};

document.addEventListener("mouseup", (event) => {
  console.log("1. mouseup 이벤트 감지됨");
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    if (selectedText.length > 0 && selection.rangeCount > 0) {
      console.log("2. 텍스트 선택 확인:", selectedText);
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      console.log(" - 선택 영역 좌표:", rect);
      createSearchIcon(rect.right - 32, rect.bottom + 5, selectedText);
    }
  }, 1);
});

document.addEventListener("mousedown", hideSearchIcon);
document.addEventListener("scroll", hideSearchIcon);

// 페이지 로딩이 완료된 후 100ms 정도 후에 실행
window.setTimeout(() => {
  const originalTitle = document.title;
  const suffix = " - CaseNote";
  const cleanedTitle = originalTitle.endsWith(suffix)
    ? originalTitle.slice(0, -suffix.length)
    : originalTitle;

  const isSearchPage = window.location.href.includes("/search/");

  if (!isSearchPage && cleanedTitle) {
    chrome.runtime.sendMessage({
      action: "updateHistoryTitle",
      url: window.location.href,
      newTitle: cleanedTitle.trim(),
    });
  }
}, 100);
