// content.js

// 페이지 로딩이 완료된 후 500ms 정도 후에 실행하여
// 페이지 제목이 완전히 렌더링될 시간을 확보합니다.
window.setTimeout(() => {
  const isErrorPage = document.title.includes("에러(404)");

  // 1. 404 에러 페이지 처리 (기존과 동일)
  if (isErrorPage) {
    document.body.innerHTML = `
            <style>
                body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #ffffff; color: #333; }
                .error-container { padding: 2em; }
                .error-icon { font-size: 3em; margin-bottom: 0.5em; display: block; }
                h2 { margin: 0 0 10px 0; color: #d9534f; font-size: 1.5em; }
                p { margin: 0 0 0.5em 0; color: #000000; line-height: 1.6; }
            </style>
            <div class="error-container">
                <div class="error-icon">🚫</div>
                <h2>검색 결과를 찾을 수 없습니다</h2>
                <p>선택하신 내용에 해당하는 정보를 CaseNote에서 찾지 못했습니다.</p>
                <p>입력하신 법률/판례 번호 또는 조문 형식을 다시 확인해주세요.</p>
            </div>
        `;
    return; // 에러 페이지 처리 후 종료
  }

  // 2. 페이지 제목을 정리하여 background로 전송
  const originalTitle = document.title;

  // " - CaseNote" 라는 접미사가 있는지 확인하고, 있다면 제거
  const suffix = " - CaseNote";
  const cleanedTitle = originalTitle.endsWith(suffix)
    ? originalTitle.slice(0, -suffix.length)
    : originalTitle;

  // 검색 결과 페이지는 히스토리를 업데이트하지 않도록 제외
  const isSearchPage = window.location.href.includes("/search/");

  if (!isSearchPage && cleanedTitle) {
    chrome.runtime.sendMessage({
      action: "updateHistoryTitle",
      url: window.location.href,
      newTitle: cleanedTitle.trim(), // 앞뒤 공백 제거
    });
  }
}, 100); // 0.5초 지연
