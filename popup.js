import { ALL_SUPPORTED_LAWS, DEFAULT_SETTINGS, CATEGORY_ORDER, MAX_FAVORITES } from "./constants.js";

const getCombinedLaws = async () => {
  const result = await chrome.storage.local.get({ userAddedLaws: {} });
  return { ...ALL_SUPPORTED_LAWS, ...result.userAddedLaws };
};

document.addEventListener("DOMContentLoaded", async () => {
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

  const addNewLawBtn = document.getElementById("add-new-law-btn");
  const addLawModal = document.getElementById("add-law-modal");
  const addLawSaveBtn = document.getElementById("add-law-save-btn");
  const addLawCancelBtn = document.getElementById("add-law-cancel-btn");
  const addLawFeedback = document.getElementById("add-law-feedback");

  const newLawDisplayNameInput = document.getElementById("new-law-displayName");
  const newLawUrlNameInput = document.getElementById("new-law-urlName");

  let tempFavoriteLaws = [];
  let currentModalSettings = {};
  let combinedLaws = await getCombinedLaws();

  const deleteUserLaw = async (lawId) => {
    const data = await chrome.storage.local.get({ userAddedLaws: {}, favoriteLaws: [] });
    delete data.userAddedLaws[lawId];
    data.favoriteLaws = data.favoriteLaws.filter(id => id !== lawId);
    await chrome.storage.local.set({ 
        userAddedLaws: data.userAddedLaws,
        favoriteLaws: data.favoriteLaws 
    });
    delete currentModalSettings[lawId];
    tempFavoriteLaws = tempFavoriteLaws.filter(id => id !== lawId);
    combinedLaws = await getCombinedLaws();
    renderModalLaws(currentModalSettings, tempFavoriteLaws, modalSearchInput.value);
  };

  newLawDisplayNameInput.addEventListener('input', () => {
      const displayName = newLawDisplayNameInput.value;
      newLawUrlNameInput.value = displayName;
  });

  addNewLawBtn.addEventListener("click", () => {
    addLawModal.style.display = "flex";
    document.getElementById("new-law-displayName").value = "";
    document.getElementById("new-law-urlName").value = "";
    document.getElementById("new-law-category").value = "";
    addLawFeedback.style.visibility = "hidden";
  });

  addLawCancelBtn.addEventListener("click", () => { addLawModal.style.display = "none"; });

  addLawSaveBtn.addEventListener("click", async () => {
    const displayName = newLawDisplayNameInput.value.trim();
    const urlNameRaw = newLawUrlNameInput.value.trim();
    const urlName = urlNameRaw.replace(/ /g, '_');
    let category = document.getElementById("new-law-category").value.trim() || "기타";

    if (!displayName || !urlName) {
      addLawFeedback.textContent = "모든 필드를 입력하세요.";
      addLawFeedback.style.visibility = "visible";
      return;
    }

    addLawFeedback.style.visibility = "hidden";
    addLawSaveBtn.disabled = true;

    const validationUrl = `https://casenote.kr/법령/${encodeURIComponent(urlName)}/제1조`;

    try {
      const response = await fetch(validationUrl, { method: 'HEAD' });

      if (response.ok) {
        const newLawId = `user_${Date.now()}`;
        const newLaw = { displayName, urlName, category };

        const data = await chrome.storage.local.get({ userAddedLaws: {}, settings: {} });
        
        data.userAddedLaws[newLawId] = newLaw;
        data.settings[newLawId] = true;
        
        await chrome.storage.local.set({ 
            userAddedLaws: data.userAddedLaws,
            settings: data.settings
        });

        currentModalSettings[newLawId] = true;
        
        combinedLaws = await getCombinedLaws();
        renderModalLaws(currentModalSettings, tempFavoriteLaws, modalSearchInput.value);
        addLawModal.style.display = "none";
      } else {
        addLawFeedback.textContent = "법률을 찾을 수 없습니다.";
        addLawFeedback.style.visibility = "visible";
      }
    } catch (error) {
      console.error("법률 유효성 검사 실패:", error);
      addLawFeedback.textContent = "법률 확인 오류 발생. 다시 시도해주세요.";
      addLawFeedback.style.visibility = "visible";
    } finally {
      addLawSaveBtn.disabled = false;
    }
  });

  quickSearchBtn.addEventListener("click", () => {
    const searchText = quickSearchInput.value.trim();
    if (searchText) {
      chrome.runtime.sendMessage({ action: "intelligentSearchFromPopup", text: searchText });
      window.close();
    }
  });

  quickSearchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); quickSearchBtn.click(); } });

  manageLawsBtn.addEventListener("click", async () => {
    const result = await chrome.storage.local.get(DEFAULT_SETTINGS);
    tempFavoriteLaws = [...result.favoriteLaws];
    currentModalSettings = result.settings;
    modalSearchInput.value = "";
    renderModalLaws(currentModalSettings, tempFavoriteLaws, "");
    lawModal.style.display = "flex";
  });

  modalCancelBtn.addEventListener("click", () => { lawModal.style.display = "none"; });

  modalSaveBtn.addEventListener("click", () => {
    const newSettings = {};
    modalLawsListEl.querySelectorAll("input[type='checkbox']").forEach(cb => { newSettings[cb.dataset.id] = cb.checked; });
    chrome.storage.local.set({ settings: newSettings, favoriteLaws: tempFavoriteLaws }, () => {
      chrome.runtime.sendMessage({ action: "updateContextMenus" });
      saveFeedback.style.visibility = "visible";
      setTimeout(() => {
        saveFeedback.style.visibility = "hidden";
        lawModal.style.display = "none";
      }, 500);
    });
  });

  modalSearchInput.addEventListener("input", (e) => renderModalLaws(currentModalSettings, tempFavoriteLaws, e.target.value));

  const renderModalLaws = (currentSettings, currentFavorites, searchTerm) => {
    modalLawsListEl.innerHTML = "";
    const filteredLaws = Object.keys(combinedLaws).map(id => ({ id, ...combinedLaws[id] })).filter(law => law.displayName.toLowerCase().includes(searchTerm.toLowerCase()));
    const lawsByCategory = groupLawsByCategory(filteredLaws);
    const customCategories = Object.keys(lawsByCategory).filter(c => !CATEGORY_ORDER.includes(c));
    const finalCategoryOrder = [...CATEGORY_ORDER, ...customCategories.sort()];

    finalCategoryOrder.forEach((categoryName) => {
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
          checkbox.addEventListener('change', () => {
              currentModalSettings[law.id] = checkbox.checked;
              if (!checkbox.checked && tempFavoriteLaws.includes(law.id)) {
                  tempFavoriteLaws = tempFavoriteLaws.filter(id => id !== law.id);
                  star.classList.remove('favorited');
              }
          });
          const lawNameSpan = document.createElement("span");
          lawNameSpan.className = "law-name";
          lawNameSpan.textContent = law.displayName;

          const star = document.createElement("span");
          star.className = "favorite-star";
          star.innerHTML = "★";
          if (currentFavorites.includes(law.id)) star.classList.add("favorited");
          star.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(law.id, star, checkbox); });
          
          label.append(checkbox, lawNameSpan);
          if (law.id.startsWith('user_')) {
              const deleteBtn = document.createElement('button');
              deleteBtn.className = 'delete-law-btn';
              deleteBtn.innerHTML = '&times;';
              deleteBtn.title = '이 법률 삭제';
              deleteBtn.addEventListener('click', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (confirm(`'${law.displayName}' 법률을 삭제하시겠습니까?`)) {
                      deleteUserLaw(law.id);
                  }
              });
              label.appendChild(deleteBtn);
          }
          label.appendChild(star);
          categoryDiv.appendChild(label);
        });
        modalLawsListEl.appendChild(categoryDiv);
      }
    });
  };
  
  const toggleFavorite = (lawId, starElement, checkboxElement) => {
    const isFavorited = tempFavoriteLaws.includes(lawId);
    if (isFavorited) {
      tempFavoriteLaws = tempFavoriteLaws.filter(id => id !== lawId);
      starElement.classList.remove("favorited");
    } else {
      if (tempFavoriteLaws.length < MAX_FAVORITES) {
        tempFavoriteLaws.push(lawId);
        starElement.classList.add("favorited");
        if (!checkboxElement.checked) {
          checkboxElement.checked = true;
          currentModalSettings[lawId] = true;
        }
      } else alert(`즐겨찾기는 최대 ${MAX_FAVORITES}개까지 추가할 수 있습니다.`);
    }
  };

  const renderUI = async () => {
    const result = await chrome.storage.local.get(DEFAULT_SETTINGS);
    const { settings, favoriteLaws } = result;
    favoriteLawsList.innerHTML = "";
    if (favoriteLaws.length > 0) {
      favoritesEmptyMsg.style.display = "none";
      favoriteLawsList.style.display = "flex";
      favoriteLaws.forEach(lawId => {
        const li = document.createElement("li");
        li.textContent = combinedLaws[lawId]?.displayName || "삭제된 법률";
        favoriteLawsList.appendChild(li);
      });
    } else {
      favoriteLawsList.style.display = "none";
      favoritesEmptyMsg.style.display = "block";
    }

    const enabledLaws = Object.keys(combinedLaws).filter((id) => settings[id]).map((id) => ({ id, ...combinedLaws[id] }));
    selectedLawsContainer.querySelectorAll('.law-category-group:not(#favorites-container)').forEach(el => el.remove());
    document.getElementById("non-favorite-laws-list")?.remove();
    const nonFavoriteLaws = enabledLaws.filter(law => !favoriteLaws.includes(law.id));
    document.getElementById("favorites-separator").style.display = "block";
    
    if (nonFavoriteLaws.length > 0) {
      settingsEmptyMsg.style.display = "none";
      const ul = document.createElement("ul");
      ul.id = "non-favorite-laws-list";
      ul.className = "selected-laws-list";
      nonFavoriteLaws.forEach((law) => {
        const li = document.createElement("li");
        li.textContent = law.displayName;
        ul.appendChild(li);
      });
      selectedLawsContainer.appendChild(ul);
    } else if (enabledLaws.length === 0) {
      settingsEmptyMsg.style.display = "block";
    } else settingsEmptyMsg.style.display = "none";
  };

  const groupLawsByCategory = (laws) => laws.reduce((acc, law) => { (acc[law.category] = acc[law.category] || []).push(law); return acc; }, {});

  const renderHistory = () => {
    chrome.storage.local.get({ history: [] }, (result) => {
      const history = result.history;
      historyListEl.innerHTML = "";
      historyEmptyMsg.style.display = history.length === 0 ? "block" : "none";
      history.forEach((item) => {
        const li = document.createElement("li");
        const textSpan = document.createElement("span");
        textSpan.className = "history-item-text";
        textSpan.textContent = item.displayText;
        textSpan.title = item.displayText;
        textSpan.addEventListener("click", () => openHistoryItem(item));
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "history-delete-btn";
        deleteBtn.innerHTML = "&times;";
        deleteBtn.title = "기록 삭제";
        deleteBtn.dataset.url = item.url;
        li.append(textSpan, deleteBtn);
        historyListEl.appendChild(li);
      });
    });
  };

  const openHistoryItem = (item) => {
    chrome.runtime.sendMessage({ action: "openFromHistory", item: item });
    window.close();
  };

  const deleteHistoryItem = (urlToDelete) => {
    chrome.storage.local.get({ history: [] }, (result) => {
      const updatedHistory = result.history.filter((item) => item.url !== urlToDelete);
      chrome.storage.local.set({ history: updatedHistory });
    });
  };

  historyListEl.addEventListener("click", (event) => {
    if (event.target.classList.contains("history-delete-btn")) {
      deleteHistoryItem(event.target.dataset.url);
    }
  });

  clearHistoryBtn.addEventListener("click", () => {
    if (confirm("정말로 모든 조회 기록을 삭제하시겠습니까?")) {
      chrome.storage.local.set({ history: [] });
    }
  });

  chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (changes.history) renderHistory();
    if (changes.settings || changes.favoriteLaws || changes.userAddedLaws) {
      if (changes.userAddedLaws) {
        combinedLaws = await getCombinedLaws();
      }
      renderUI();
    }
  });

  const resetSettingsBtn = document.getElementById("reset-settings-btn");
  resetSettingsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (confirm("정말로 모든 법률 설정을 초기화하시겠습니까?\n(즐겨찾기, 사용자 추가 법률, 최근 조회 기록이 모두 삭제됩니다.)")) {
      chrome.storage.local.set({
        settings: DEFAULT_SETTINGS.settings,
        favoriteLaws: [],
        userAddedLaws: {},
        history: []
      }, () => {
        alert("설정이 초기화되었습니다.");
      });
    }
  });

  const applyTheme = (isDark) => {
    document.body.classList.toggle('dark-mode', isDark);
  };
  const systemThemeListener = window.matchMedia('(prefers-color-scheme: dark)');
  applyTheme(systemThemeListener.matches);
  systemThemeListener.addEventListener('change', (e) => {
    applyTheme(e.matches);
  });

  renderUI();
  renderHistory();
});