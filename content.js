let currentIcon = null;

const createSearchIcon = (x, y, selectedText) => {
  if (currentIcon) {
    currentIcon.remove();
    currentIcon = null;
  }

  const icon = document.createElement("div");
  icon.id = "casenote-search-icon";
  const viewportWidth = window.innerWidth;

  let finalX = x;
  const iconWidth = 32;
  if (x + iconWidth > viewportWidth) {
    finalX = x - iconWidth - 50;
  } 
  icon.style.top = `${y + window.scrollY}px`;
  icon.style.left = `${finalX + window.scrollX}px`;

  const img = document.createElement("img");
  img.src = chrome.runtime.getURL("images/icon48.png");
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
};

const hideSearchIcon = (event) => {
  if (
    currentIcon &&
    event.target !== currentIcon &&
    !currentIcon.contains(event.target)
  ) {
    currentIcon.remove();
    currentIcon = null;
  }
};

document.addEventListener("mouseup", (event) => {
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    if (selectedText.length > 0 && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      createSearchIcon(rect.right, rect.bottom + 5, selectedText);
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

// --- V1.2: 조문 복사 버튼 추가 ---
window.addEventListener('load', () => {
    // 디코딩된 URL에 '/법령/'이 포함되어 있는지 확인
    if (decodeURIComponent(window.location.href).includes('/법령/')) {
        const targetContainer = document.querySelector('#text_wo_hanja');
        const articleContent = targetContainer ? targetContainer.querySelector('.law_article') : null;

        if (articleContent) {
            // 복사 버튼 생성
            const copyButton = document.createElement('button');
            copyButton.id = 'casenote-copy-btn';
            copyButton.textContent = '조문 복사';

            // 버튼 클릭 이벤트 리스너 추가
            copyButton.addEventListener('click', () => {
                const contentClone = articleContent.cloneNode(true);
                const titleElement = contentClone.querySelector('.article-title');
                if (titleElement) {
                    titleElement.remove();
                }
                let textToCopy = contentClone.innerText
                    .replace(/<[^>]*>/g, '')
                    .replace(/\n\s*\n/g, '\n')
                    .trim();
                navigator.clipboard.writeText(textToCopy).then(() => {
                    copyButton.textContent = '복사 완료!';
                    setTimeout(() => {
                        copyButton.textContent = '조문 복사';
                    }, 1500);
                }).catch(err => {
                    console.error('조문 복사 실패:', err);
                    copyButton.textContent = '복사 실패';
                });
            });

            // 페이지에 버튼 추가
            document.body.appendChild(copyButton);
        }
    }
});