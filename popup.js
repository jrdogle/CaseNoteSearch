import { ALL_SUPPORTED_LAWS, DEFAULT_SETTINGS, CATEGORY_ORDER, MAX_FAVORITES } from "./constants.js";

document.addEventListener("DOMContentLoaded", () => {
  const quickSearchInput = document.getElementById("quick-search-input");
  const quickSearchBtn = document.getElementById("quick-search-btn");

  const selectedLawsContainer = document.getElementById("settings-container");
  const settingsEmptyMsg = document.getElementById("settings-empty-msg");
  const favoriteLawsList = document.getElementById("favorite-laws-list");
  const favoritesEmptyMsg = document.getElementById("favorites-empty-msg");

  const historyListEl = document.getElementById("history-list");
  const historyEmptyMsg = document.getElementById("history-empty-msg");
  const saveFeedback = document.getElementById("save-feedback");

  const manageLawsBtn = document.getElementById("manage-laws-btn");
  const lawModal = document.getElementById("law-modal");
  const modalLawsListEl = document.getElementById("modal-laws-list");
  const modalSaveBtn = document.getElementById("modal-save-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const modalSearchInput = document.getElementById("modal-search-input");
  const clearHistoryBtn = document.getElementById("clear-history-btn");

  let tempFavoriteLaws = [];
  let currentModalSettings = {};

  quickSearchBtn.addEventListener("click", () => {
    const searchText = quickSearchInput.value.trim();
    if (searchText) {
      chrome.runtime.sendMessage({ action: "intelligentSearchFromPopup", text: searchText });
      window.close();
    }
  });

  quickSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      quickSearchBtn.click();
    }
  });

  manageLawsBtn.addEventListener("click", () => {
    chrome.storage.local.get(DEFAULT_SETTINGS, (result) => {
      tempFavoriteLaws = [...result.favoriteLaws];
      currentModalSettings = result.settings;
      modalSearchInput.value = "";
      renderModalLaws(currentModalSettings, tempFavoriteLaws, "");
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

    const newFavoriteLaws = tempFavoriteLaws;

    chrome.storage.local.set({ settings: newSettings, favoriteLaws: newFavoriteLaws }, () => {
      chrome.runtime.sendMessage({ action: "updateContextMenus" });
      saveFeedback.style.visibility = "visible";
      modalSaveBtn.disabled = true;

      setTimeout(() => {
        saveFeedback.style.visibility = "hidden";
        modalSaveBtn.disabled = false;
        lawModal.style.display = "none";
      }, 500);
    });
  });

  modalSearchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value;
    // storage를 다시 읽는 대신, 캐싱된 설정 값을 사용합니다.
    renderModalLaws(currentModalSettings, tempFavoriteLaws, searchTerm);
  });

  // --- 렌더링 로직 ---

  const renderModalLaws = (currentSettings, currentFavorites, searchTerm) => {
    modalLawsListEl.innerHTML = "";
    
    const filteredLaws = Object.keys(ALL_SUPPORTED_LAWS)
      .map(id => ({ id, ...ALL_SUPPORTED_LAWS[id] })) // 각 법률 객체에 id 속성 추가
      .filter(law => 
        law.displayName.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const lawsByCategory = groupLawsByCategory(filteredLaws);

    CATEGORY_ORDER.forEach((categoryName) => {
      if (lawsByCategory[categoryName]) {
        const categoryDiv = document.createElement("div");
        categoryDiv.classList.add("modal-category-container");
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

          const lawNameSpan = document.createElement("span");
          lawNameSpan.className = "law-name";
          lawNameSpan.textContent = law.displayName;
          
          const star = document.createElement("span");
          star.className = "favorite-star";
          star.innerHTML = "★";
          if (currentFavorites.includes(law.id)) {
            star.classList.add("favorited");
          }

          star.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(law.id, star);
          });

          label.appendChild(checkbox);
          label.appendChild(lawNameSpan);
          label.appendChild(star);
          categoryDiv.appendChild(label);
        });
        modalLawsListEl.appendChild(categoryDiv);
      }
    });
  };
  
  const toggleFavorite = (lawId, starElement) => {
    const isFavorited = tempFavoriteLaws.includes(lawId);
    if (isFavorited) {
      tempFavoriteLaws = tempFavoriteLaws.filter(id => id !== lawId);
      starElement.classList.remove("favorited");
    } else {
      if (tempFavoriteLaws.length < MAX_FAVORITES) {
        tempFavoriteLaws.push(lawId);
        starElement.classList.add("favorited");
      } else {
        alert(`즐겨찾기는 최대 ${MAX_FAVORITES}개까지 추가할 수 있습니다.`);
      }
    }
  };


  const renderUI = () => {
    chrome.storage.local.get(DEFAULT_SETTINGS, (result) => {
      const { settings, favoriteLaws } = result;
      
      // 즐겨찾기 목록 렌더링
      favoriteLawsList.innerHTML = "";
      if (favoriteLaws.length > 0) {
        favoritesEmptyMsg.style.display = "none";
        favoriteLaws.forEach(lawId => {
          const li = document.createElement("li");
          li.textContent = ALL_SUPPORTED_LAWS[lawId].displayName;
          favoriteLawsList.appendChild(li);
        });
      } else {
        favoritesEmptyMsg.style.display = "block";
      }

      // 선택된 법률 목록 렌더링 (즐겨찾기 제외)
      const enabledLaws = Object.keys(ALL_SUPPORTED_LAWS)
        .filter((id) => settings[id] === true)
        .map((id) => ({ id, ...ALL_SUPPORTED_LAWS[id] }));

      selectedLawsContainer.innerHTML = "";

      if (enabledLaws.length === 0) {
        settingsEmptyMsg.style.display = "block";
        selectedLawsContainer.appendChild(settingsEmptyMsg);
      } else {
        settingsEmptyMsg.style.display = "none";
        const lawsByCategory = groupLawsByCategory(enabledLaws);

        CATEGORY_ORDER.forEach((categoryName) => {
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
      }
    });
  };

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
  historyListEl.addEventListener("click", (event) => {
    if (event.target.classList.contains("history-delete-btn")) {
      const indexToDelete = parseInt(event.target.dataset.index, 10);
      if (!isNaN(indexToDelete)) {
        deleteHistoryItem(indexToDelete);
      }
    }
  });

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
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "history-delete-btn";
        deleteBtn.innerHTML = "&times;"; // The 'x' symbol
        deleteBtn.title = "기록 삭제";
        deleteBtn.dataset.index = index; // 삭제할 인덱스를 data 속성으로 저장
        // 개별 이벤트 리스너는 제거합니다.
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
    if (changes.settings || changes.favoriteLaws) renderUI();
  });

  // --- 초기 로드 ---
  renderUI();
  renderHistory();
});