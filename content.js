const COURT_REGEX = /\d{2,4}[가-힣]+\d+/;
const LAW_ARTICLE_REGEX = /제?\s*\d+조(의\d+)?/;

// 모든 정규식을 배열로 관리하여 쉽게 확장할 수 있도록 함
const allRegex = [
  COURT_REGEX,
  LAW_ARTICLE_REGEX,
];

let currentIcon = null;

const isValidFormat = (text) => {
  return allRegex.some(regex => regex.test(text));
};

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
    if (selectedText.length > 0 && selection.rangeCount > 0 && isValidFormat(selectedText)) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      createSearchIcon(rect.right, rect.bottom + 5, selectedText);
    }
  }, 1);
});

document.addEventListener("mousedown", (event) => {
  hideSearchIcon(event);
  try {
    chrome.runtime.sendMessage({ action: "ping" });
  } catch (e) {
  }
});
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

// 복사 버튼 기능
window.addEventListener('load', () => {
    // 1. 법령 페이지: 조문 복사 버튼
    if (decodeURIComponent(window.location.href).includes('/법령/')) {
        const mainContainer = document.querySelector('#text_wo_hanja') || document.querySelector('#text_original');
        let articleContent = null;

        if (mainContainer) {
            articleContent = mainContainer.querySelector('.law_article');
            if (!articleContent) articleContent = mainContainer;
        }

        const parentContainer = document.querySelector('.cn-law-left');
        const referenceNode = document.querySelector('.cn-law-body');

        if (articleContent && parentContainer && referenceNode) {
            const copyButton = document.createElement('button');
            copyButton.id = 'casenote-copy-btn';
            copyButton.textContent = '조문 복사';

            copyButton.addEventListener('click', () => {
                const contentClone = articleContent.cloneNode(true);
                const titleElement = contentClone.querySelector('.article-title');
                if (titleElement) {
                    titleElement.remove();
                }
                const textToCopy = contentClone.innerText
                    .replace(/\[[^\]]*\]/g, '')
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
            parentContainer.insertBefore(copyButton, referenceNode);
        }
    }
    // 2. 판례 페이지: 판시사항, 판결요지 복사 버튼
    else {
        const createPrecedentCopyButton = (contentElement, parentElement, id, defaultText) => {
            const button = document.createElement('button');
            button.id = id;
            button.textContent = defaultText;
            button.classList.add('casenote-precedent-copy-btn');

            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const textToCopy = contentElement.innerText
                    .replace(/\n\s*\n/g, '\n').trim();

                navigator.clipboard.writeText(textToCopy).then(() => {
                    const originalText = button.textContent;
                    button.textContent = '복사 완료!';
                    setTimeout(() => { button.textContent = originalText; }, 1500);
                }).catch(err => {
                    console.error(`${button.textContent} 실패:`, err);
                    button.textContent = '복사 실패';
                });
            });
            parentElement.appendChild(button);
            return button;
        };

        const headings = document.querySelectorAll('.panel-heading');

        if (headings.length > 0) {
            headings.forEach(heading => {
                const headingText = heading.textContent.trim();
                const contentElement = heading.nextElementSibling;

                if (!contentElement) return;

                if (headingText.includes('판시사항')) {
                    if (contentElement.id === 'summary_text' && contentElement.textContent.trim() === '') return;
                    
                    if (!document.getElementById('casenote-copy-issue-btn')) {
                        createPrecedentCopyButton(contentElement, heading, 'casenote-copy-issue-btn', '판시사항 복사');
                    }
                } else if (headingText.includes('판결요지') || headingText.includes('결정요지')) {
                    if (!document.getElementById('casenote-copy-summary-btn')) {
                        const buttonText = headingText.includes('결정요지') ? '결정요지 복사' : '판결요지 복사';
                        createPrecedentCopyButton(contentElement, heading, 'casenote-copy-summary-btn', buttonText);
                    }
                }
            });
        }
    }
});