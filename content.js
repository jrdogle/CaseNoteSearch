const PRECEDENT_MARKERS = '가합|가단|가소|가|나|다|라|마|바|사|아|자|차|카|타|파|하|거|너|더|러|머|버|서|어|저|처|커|터|퍼|허|고합|고단|고정|고|노|도|로|모|보|소|오|조|초|코|토|포|호|구합|구단|구|누|두|루|무|부|수|우|주|추|쿠|투|푸|후|그|느|드|르|므|브|스|으|즈|츠|크|트|프|흐|기|니|디|리|미|비|시|이|지|치|키|티|피|히|카허|카합|카단|카기|카|크|재심|재|특별|특|인|헌가|헌나|헌다|헌라|헌마|헌바|헌사|헌아|헌자|헌차|헌카|헌타|헌파|헌하|B';
const COURT_REGEX = new RegExp(`\\d{2,4}(${PRECEDENT_MARKERS})\\d+(?![0-9])`, 'g');
const LAW_ARTICLE_PART_REGEX = /제?\s*\d+조(의\d+)?/g; 

let searchIcon;
let autoHighlightEnabled = true;
let dragToSearchEnabled = true;
let strictRegex;

// --- 검색 아이콘 기능 ---
const createSearchIcon = () => {
    if (document.getElementById("casenote-search-icon")) return;

    searchIcon = document.createElement("div");
    searchIcon.id = "casenote-search-icon";
    const iconImage = document.createElement("img");
    iconImage.src = chrome.runtime.getURL("images/icon48.png");
    iconImage.style.width = "20px";
    iconImage.style.height = "20px";
    searchIcon.appendChild(iconImage);
    document.body.appendChild(searchIcon);

    searchIcon.addEventListener("click", (e) => {
        e.stopPropagation();
        const selectedText = e.currentTarget.dataset.selection;
        if (selectedText) {
            chrome.runtime.sendMessage({ action: "intelligentSearchFromIcon", selection: selectedText });
        }
        hideSearchIcon();
    });
};

const hideSearchIcon = () => {
    if (searchIcon) searchIcon.style.display = "none";
};

// --- 하이라이트 기능 로직 ---

const highlightTextInNode = (node, combinedRegex) => {
    if (!combinedRegex || node.nodeType !== Node.TEXT_NODE || node.textContent.trim() === '') {
        return;
    }

    const parent = node.parentNode;
    
    if (!parent || 
        ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'HEAD'].includes(parent.tagName) || 
        parent.isContentEditable || 
        parent.closest('a') ||
        parent.closest('[role="listbox"], [role="option"], [role="menu"]')
    ) {
        return;
    }
    
    if (parent.querySelector(':scope > br')) {
        return;
    }

    if (parent.closest('.casenote-highlight-wrapper')) {
        return;
    }

    const textContent = node.textContent;
    const matches = [...textContent.matchAll(combinedRegex)];

    if (matches.length > 0) {
        for (const match of matches.reverse()) {
            if (!match[0]) continue;
            try {
                const range = document.createRange();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match[0].length);

                const styleSpan = document.createElement('span');
                styleSpan.className = 'casenote-highlight';
                styleSpan.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    chrome.runtime.sendMessage({
                        action: "intelligentSearchFromIcon",
                        selection: match[0],
                    });
                });
                
                range.surroundContents(styleSpan);

                const wrapperSpan = document.createElement('span');
                wrapperSpan.className = 'casenote-highlight-wrapper';

                styleSpan.parentNode.insertBefore(wrapperSpan, styleSpan);
                
                wrapperSpan.appendChild(styleSpan);

            } catch(e) {
                console.error("CaseNote Search: 하이라이트 적용 실패", e, node);
            }
        }
    }
};

const scanAndHighlight = (rootNode, combinedRegex) => {
    if (!rootNode) return;
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
    const nodesToProcess = [];
    let node;
    while(node = walker.nextNode()) {
        nodesToProcess.push(node);
    }
    nodesToProcess.forEach(node => highlightTextInNode(node, combinedRegex));
};


const applyHighlighting = (combinedRegex) => {
    if (!autoHighlightEnabled || !combinedRegex) return;
    scanAndHighlight(document.body, combinedRegex);
};

// --- 페이지 로딩 및 통합 관리 ---
const initialize = () => {
    chrome.storage.local.get({ autoHighlight: true, dragToSearch: true }, (settings) => {
        autoHighlightEnabled = settings.autoHighlight;
        dragToSearchEnabled = settings.dragToSearch;

        chrome.runtime.sendMessage({ action: "getLawList" }, (response) => {
            if (chrome.runtime.lastError || !response?.lawList) {
                // 법률 목록 로드 실패 시, 판례 번호만 인식하는 기본 정규식 설정
                strictRegex = new RegExp(`(${COURT_REGEX.source})`, 'g');
                return;
            };

            const lawList = response.lawList;
            if (lawList.length > 0) {
                const lawNamesPattern = lawList.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                const lawArticleFullPattern = `(?:${lawNamesPattern})\\s*${LAW_ARTICLE_PART_REGEX.source}`;
                strictRegex = new RegExp(`(${COURT_REGEX.source}|${lawArticleFullPattern})`, 'g');
            } else {
                strictRegex = new RegExp(`(${COURT_REGEX.source})`, 'g');
            }

            // 자동 하이라이트 기능이 켜져 있으면 실행
            if (autoHighlightEnabled) {
                scanAndHighlight(document.body, strictRegex);
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                scanAndHighlight(node, strictRegex);
                            } else {
                                highlightTextInNode(node, strictRegex);
                            }
                        });
                    });
                });
                observer.observe(document.body, { childList: true, subtree: true });
            }
        });
        
        // 드래그 검색 기능이 켜져 있으면 아이콘 생성
        if (dragToSearchEnabled) {
            createSearchIcon();
        }
    });

    // 히스토리 제목 업데이트 기능
    setTimeout(() => {
        const originalTitle = document.title;
        const suffix = " - CaseNote";
        const cleanedTitle = originalTitle.endsWith(suffix) ? originalTitle.slice(0, -suffix.length) : originalTitle;
        if (!window.location.href.includes("/search/") && cleanedTitle) {
            chrome.runtime.sendMessage({ action: "updateHistoryTitle", url: window.location.href, newTitle: cleanedTitle.trim() });
        }
    }, 100);
};

// --- 이벤트 리스너 등록 ---
document.addEventListener("mouseup", (e) => {
    if (!dragToSearchEnabled || !searchIcon || !strictRegex) return;
    if (e.target.closest("#casenote-search-icon, .casenote-highlight")) return;
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        hideSearchIcon();
        return;
    }
    setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        // 정규식 lastIndex 초기화
        strictRegex.lastIndex = 0;

        // 하이라이트와 동일한 '엄격한' 정규식을 사용하여 텍스트 검사
        if (selectedText && strictRegex.test(selectedText)) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            searchIcon.style.display = "flex";
            searchIcon.style.top = `${window.scrollY + rect.bottom + 5}px`;
            searchIcon.style.left = `${window.scrollX + rect.left}px`;
            searchIcon.dataset.selection = selectedText;
        } else {
            hideSearchIcon();
        }
    }, 10);
});

document.addEventListener("mousedown", (e) => {
    if (!dragToSearchEnabled) return;
    if (e.target.id !== "casenote-search-icon" && !e.target.closest("#casenote-search-icon")) {
        hideSearchIcon();
    }
});

window.addEventListener('load', () => {
    initialize();
    
    const copyButtonLogic = () => {
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
                if (document.getElementById('casenote-copy-btn')) return;
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
        else {
            const createPrecedentCopyButton = (contentElement, parentElement, id, defaultText) => {
                if (document.getElementById(id)) return;
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
                        
                        createPrecedentCopyButton(contentElement, heading, 'casenote-copy-issue-btn', '판시사항 복사');
                    } else if (headingText.includes('결정요지') || headingText.includes('판결요지')) {
                        const buttonText = headingText.includes('결정요지') ? '결정요지 복사' : '판결요지 복사';
                        createPrecedentCopyButton(contentElement, heading, 'casenote-copy-summary-btn', buttonText);
                    }
                });
            }
        }
    }

    const observer = new MutationObserver(() => copyButtonLogic());
    observer.observe(document.body, { childList: true, subtree: true });
});