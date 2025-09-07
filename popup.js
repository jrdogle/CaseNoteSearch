import { ALL_SUPPORTED_LAWS, DEFAULT_SETTINGS } from "./constants.js";

document.addEventListener("DOMContentLoaded", () => {
  const selectedLawsContainer = document.getElementById("settings-container");
  const settingsEmptyMsg = document.getElementById("settings-empty-msg");
  const historyListEl = document.getElementById("history-list");
  const historyEmptyMsg = document.getElementById("history-empty-msg");
  const saveFeedback = document.getElementById("save-feedback");

  const manageLawsBtn = document.getElementById("manage-laws-btn");
  const lawModal = document.getElementById("law-modal");
  const modalLawsListEl = document.getElementById("modal-laws-list");
  const modalSaveBtn = document.getElementById("modal-save-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const clearHistoryBtn = document.getElementById("clear-history-btn");
  const categoryOrder = ["공법", "민사법", "형사법", "지적재산권법"];

  manageLawsBtn.addEventListener("click", () => {
    chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, (result) => {
      renderModalLaws(result.settings);
      lawModal.style.display = "flex";
    });
  });

  modalCancelBtn.addEventListener("click", () => {
    lawModal.style.display = "none";
  });

  modalSaveBtn.addEventListener("click", () => {
    const newSettings = {};
    const checkboxes = modalLawsListEl.querySelectorAll(
      "input[type='checkbox']"
    );
    checkboxes.forEach((checkbox) => {
      newSettings[checkbox.dataset.id] = checkbox.checked;
    });

    chrome.storage.local.set({ settings: newSettings }, () => {
      chrome.runtime.sendMessage({ action: "updateContextMenus" });
      saveFeedback.style.opacity = "1";
      modalSaveBtn.disabled = true;

      setTimeout(() => {
        saveFeedback.style.opacity = "0";
        modalSaveBtn.disabled = false;
        lawModal.style.display = "none";
      }, 1200);
    });
  });

  // --- 렌더링 로직 (카테고리별 그룹화) ---

  // 모달에 전체 법률 목록을 카테고리별로 렌더링
  const renderModalLaws = (currentSettings) => {
    modalLawsListEl.innerHTML = "";

    const lawsByCategory = groupLawsByCategory(ALL_SUPPORTED_LAWS);

    categoryOrder.forEach((categoryName) => {
      if (lawsByCategory[categoryName]) {
        const categoryDiv = document.createElement("div");
        const categoryTitle = document.createElement("div");
        categoryTitle.className = "modal-category-title";
        categoryTitle.textContent = categoryName;
        categoryDiv.appendChild(categoryTitle);

        lawsByCategory[categoryName].forEach((law) => {
          const label = document.createElement("label");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.dataset.id = law.id;
          checkbox.checked = currentSettings[law.id] === true;

          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(law.displayName));
          categoryDiv.appendChild(label);
        });
        modalLawsListEl.appendChild(categoryDiv);
      }
    });
  };

  // 선택된 법률 목록을 메인 화면에 카테고리별로 렌더링
  const renderSelectedLaws = () => {
    chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, (result) => {
      const settings = result.settings;
      const enabledLaws = Object.keys(ALL_SUPPORTED_LAWS)
        .filter((id) => settings[id] === true)
        .map((id) => ({ id, ...ALL_SUPPORTED_LAWS[id] }));

      selectedLawsContainer.innerHTML = "";

      if (enabledLaws.length === 0) {
        settingsEmptyMsg.style.display = "block";
        return;
      }

      settingsEmptyMsg.style.display = "none";
      const lawsByCategory = groupLawsByCategory(enabledLaws);

      categoryOrder.forEach((categoryName) => {
        if (lawsByCategory[categoryName]) {
          const groupDiv = document.createElement("div");
          groupDiv.className = "law-category-group";

          const titleSpan = document.createElement("span");
          titleSpan.className = "law-category-title";
          titleSpan.textContent = categoryName;

          const ul = document.createElement("ul");
          ul.className = "selected-laws-list";

          lawsByCategory[categoryName].forEach((law) => {
            const li = document.createElement("li");
            li.textContent = law.displayName;
            ul.appendChild(li);
          });

          groupDiv.appendChild(titleSpan);
          groupDiv.appendChild(ul);
          selectedLawsContainer.appendChild(groupDiv);
        }
      });
    });
  };

  // --- Helper 함수: 법률 목록을 카테고리별로 그룹화 ---
  const groupLawsByCategory = (laws) => {
    const lawMap = Array.isArray(laws)
      ? laws
      : Object.keys(laws).map((id) => ({ id, ...laws[id] }));
    return lawMap.reduce((acc, law) => {
      (acc[law.category] = acc[law.category] || []).push(law);
      return acc;
    }, {});
  };

  // --- 히스토리 관련 로직 ---

  clearHistoryBtn.addEventListener("click", () => {
    if (confirm("정말로 모든 조회 기록을 삭제하시겠습니까?")) {
      chrome.storage.local.set({ history: [] });
    }
  });

  const renderHistory = () => {
    chrome.storage.local.get({ history: [] }, (result) => {
      const history = result.history.slice(0, 5);
      historyListEl.innerHTML = "";
      historyEmptyMsg.style.display = history.length === 0 ? "block" : "none";

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
    });
  };

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

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.history) renderHistory();
    if (changes.settings) renderSelectedLaws(); // 설정 변경 시에도 목록 새로고침
  });

  // --- 초기 로드 ---
  renderSelectedLaws();
  renderHistory();
});
