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

document.addEventListener("mousedown", (event) => {
  hideSearchIcon(event);
  // V1.1.5 개선: 서비스 워커(백그라운드 스크립트)가 잠들어 있을 때 발생하는 지연을 줄이기 위해
  // 사용자가 검색을 시작할 가능성이 있는 mousedown 시점에 미리 'ping'을 보내 깨워줍니다.
  try {
    chrome.runtime.sendMessage({ action: "ping" });
  } catch (e) {
    // 팝업이 열려있는 등, 메시지를 받을 대상이 없는 경우 오류가 발생할 수 있으나 무시해도 괜찮습니다.
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
                const textToCopy = contentClone.innerText
                    .replace(/\[[^\]]*\]/g, '')
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
    // 2. 판례 페이지: 판시사항, 판결요지 복사 버튼
    else {
        const createPrecedentCopyButton = (element, id, defaultText) => {
            const button = document.createElement('button');
            button.id = id;
            button.textContent = defaultText;

            button.addEventListener('click', () => {
                const textToCopy = element.innerText
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
            document.body.appendChild(button);
            return button;
        };

        // 제목 텍스트를 기반으로 요소를 찾아 버튼을 생성하는 더 안정적인 방법
        const headings = document.querySelectorAll('.panel-heading');
        let issueButtonCreated = false;

        if (headings.length > 0) {
            headings.forEach(heading => {
                const headingText = heading.textContent.trim();
                // 제목 바로 다음 형제 요소를 내용으로 간주
                const contentElement = heading.nextElementSibling;

                if (!contentElement) {
                    return; // 다음 제목으로 넘어감
                }

                if (headingText.includes('판시사항')) {
                    // 내용이 없는 특정 요소를 건너뛰는 로직
                    if (contentElement.id === 'summary_text' && contentElement.textContent.trim() === '') {
                        return; // 이 요소를 건너뛰고 다음 heading으로 이동
                    }
                    // 중복 생성을 막는 안전장치
                    if (!document.getElementById('casenote-copy-issue-btn')) {
                        createPrecedentCopyButton(contentElement, 'casenote-copy-issue-btn', '판시사항 복사');
                        issueButtonCreated = true;
                    }
                } else if (headingText.includes('판결요지') || headingText.includes('결정요지')) {
                    if (!document.getElementById('casenote-copy-summary-btn')) {
                        const buttonText = headingText.includes('결정요지') ? '결정요지 복사' : '판결요지 복사';
                        createPrecedentCopyButton(contentElement, 'casenote-copy-summary-btn', buttonText);
                    }
                }
            });

            // 모든 제목 확인 후, 판시사항 버튼이 없는 경우에만 판결요지 버튼 위치 조정
            const summaryButton = document.getElementById('casenote-copy-summary-btn');
            if (summaryButton && !issueButtonCreated) {
                summaryButton.classList.add('casenote-copy-btn-single');
            }
        }
    }
});