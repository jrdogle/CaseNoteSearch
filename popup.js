document.addEventListener('DOMContentLoaded', () => {
    // 지원 목록 (background.js와 동일)
    const SUPPORTED_ITEMS = {
        civilLaw: { type: 'law', displayName: '민법', urlName: '민법' },
        constitution: { type: 'law', displayName: '헌법', urlName: '대한민국헌법' },
        criminalLaw: { type: 'law', displayName: '형법', urlName: '형법' },
        supremeCourt: { type: 'precedent', displayName: '대법원', urlName: '대법원' },
        constCourt: { type: 'precedent', displayName: '헌법재판소', urlName: '헌법재판소' },
    };
    
    // 기본 설정값
    const DEFAULT_SETTINGS = {
        civilLaw: true, constitution: true, criminalLaw: true,
        supremeCourt: true, constCourt: true,
    };

    const lawContainer = document.getElementById('law-settings-container');
    const precedentContainer = document.getElementById('precedent-settings-container');
    const historyListEl = document.getElementById('history-list');
    const historyEmptyMsg = document.getElementById('history-empty-msg');

    // 저장된 설정을 불러와 토글 스위치를 그리는 함수 (수정)
    const renderToggles = () => {
        chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, (result) => {
            const settings = result.settings;
            lawContainer.innerHTML = ''; 
            precedentContainer.innerHTML = '';

            for (const id in SUPPORTED_ITEMS) {
                const item = SUPPORTED_ITEMS[id];
                const container = item.type === 'law' ? lawContainer : precedentContainer;

                const itemDiv = document.createElement('div');
                itemDiv.className = 'setting-item';
                
                const label = document.createElement('span');
                label.textContent = item.displayName;

                const switchLabel = document.createElement('label');
                switchLabel.className = 'switch';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = settings[id] !== false;
                input.dataset.id = id;

                const slider = document.createElement('span');
                slider.className = 'slider';

                switchLabel.appendChild(input);
                switchLabel.appendChild(slider);
                itemDiv.appendChild(label);
                itemDiv.appendChild(switchLabel);
                container.appendChild(itemDiv);

                input.addEventListener('change', handleToggleChange);
            }
        });
    };

    // 토글 변경 핸들러 (이전과 동일)
    const handleToggleChange = (event) => {
        const id = event.target.dataset.id;
        const isEnabled = event.target.checked;
        chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, (result) => {
            const newSettings = { ...result.settings, [id]: isEnabled };
            chrome.storage.local.set({ settings: newSettings }, () => {
                chrome.runtime.sendMessage({ action: "updateContextMenus" });
            });
        });
    };
    
    // 히스토리 목록 렌더링 함수
    const renderHistory = () => {
        chrome.storage.local.get({ history: [] }, (result) => {
            const history = result.history;
            historyListEl.innerHTML = '';

            if (history.length === 0) {
                historyEmptyMsg.style.display = 'block';
            } else {
                historyEmptyMsg.style.display = 'none';
                history.forEach((item, index) => {
                    const li = document.createElement('li');
                    
                    const textSpan = document.createElement('span');
                    textSpan.className = 'history-item-text';
                    textSpan.textContent = item.displayText;
                    textSpan.title = item.displayText;
                    textSpan.addEventListener('click', () => openHistoryItem(item));

                    const deleteBtn = document.createElement('span');
                    deleteBtn.className = 'history-delete-btn';
                    deleteBtn.innerHTML = '&times;'; // 'X' 대신 곱셈 기호(&times;) 사용
                    deleteBtn.title = '기록 삭제';
                    deleteBtn.addEventListener('click', () => deleteHistoryItem(index));

                    li.appendChild(textSpan);
                    li.appendChild(deleteBtn);
                    historyListEl.appendChild(li);
                });
            }
        });
    };

    // 히스토리 아이템 열기/삭제
    const openHistoryItem = (item) => {
        chrome.runtime.sendMessage({ action: 'openFromHistory', item: item });
        window.close();
    };

    const deleteHistoryItem = (indexToDelete) => {
        chrome.storage.local.get({ history: [] }, (result) => {
            const updatedHistory = result.history.filter((_, index) => index !== indexToDelete);
            chrome.storage.local.set({ history: updatedHistory }, () => {
                renderHistory();
            });
        });
    };
    
    // 초기 로드
    renderToggles();
    renderHistory();
});