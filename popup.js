// popup.js

document.addEventListener("DOMContentLoaded", () => {
  // 지원 목록 (background.js와 동일)
  const SUPPORTED_ITEMS = {
    civilLaw: { type: "law", displayName: "민법" },
    constitution: { type: "law", displayName: "헌법" },
    criminalLaw: { type: "law", displayName: "형법" },
  };

  // 기본 설정값 (법률 항목만 남김)
  const DEFAULT_SETTINGS = {
    civilLaw: true,
    constitution: true,
    criminalLaw: true,
  };

  const settingsContainer = document.getElementById("settings-container");
  const historyListEl = document.getElementById("history-list");
  const historyEmptyMsg = document.getElementById("history-empty-msg");

  // 저장된 설정을 불러와 토글 스위치를 그리는 함수
  const renderToggles = () => {
    chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, (result) => {
      const settings = result.settings;
      settingsContainer.innerHTML = "";

      for (const id in SUPPORTED_ITEMS) {
        const item = SUPPORTED_ITEMS[id];

        const itemDiv = document.createElement("div");
        itemDiv.className = "setting-item";

        const label = document.createElement("span");
        label.textContent = item.displayName;

        const switchLabel = document.createElement("label");
        switchLabel.className = "switch";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = settings[id] !== false;
        input.dataset.id = id;

        const slider = document.createElement("span");
        slider.className = "slider";

        switchLabel.appendChild(input);
        switchLabel.appendChild(slider);
        itemDiv.appendChild(label);
        itemDiv.appendChild(switchLabel);
        settingsContainer.appendChild(itemDiv);

        input.addEventListener("change", handleToggleChange);
      }
    });
  };

  // 토글 변경 핸들러
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
      const history = result.history.slice(0, 5);
      historyListEl.innerHTML = "";

      if (history.length === 0) {
        historyEmptyMsg.style.display = "block";
      } else {
        historyEmptyMsg.style.display = "none";
        history.forEach((item, index) => {
          const li = document.createElement("li");

          const textSpan = document.createElement("span");
          textSpan.className = "history-item-text";
          textSpan.textContent = item.displayText;
          textSpan.title = item.displayText;
          textSpan.addEventListener("click", () => openHistoryItem(item));

          const deleteBtn = document.createElement("span");
          deleteBtn.className = "history-delete-btn";
          deleteBtn.innerHTML = "&times;";
          deleteBtn.title = "기록 삭제";
          deleteBtn.addEventListener("click", () => deleteHistoryItem(index));

          li.appendChild(textSpan);
          li.appendChild(deleteBtn);
          historyListEl.appendChild(li);
        });
      }
    });
  };

  // 히스토리 아이템 열기/삭제 함수
  const openHistoryItem = (item) => {
    chrome.runtime.sendMessage({ action: "openFromHistory", item: item });
    window.close();
  };

  const deleteHistoryItem = (indexToDelete) => {
    chrome.storage.local.get({ history: [] }, (result) => {
      const updatedHistory = result.history.filter(
        (_, index) => index !== indexToDelete
      );
      chrome.storage.local.set({ history: updatedHistory });
    });
  };

  // chrome.storage의 데이터가 변경될 때마다 자동으로 히스토리를 다시 렌더링합니다.
  chrome.storage.onChanged.addListener((changes, namespace) => {
    // 'history' 데이터에 변경이 있을 경우에만 실행
    if (changes.history) {
      renderHistory();
    }
  });

  // 초기 로드
  renderToggles();
  renderHistory();
});
