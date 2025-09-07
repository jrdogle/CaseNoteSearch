// 페이지 로딩이 완료된 후 실행되도록 합니다.
window.addEventListener('load', () => {
    // Casenote 404 페이지인지 제목(title)으로 확인합니다.
    const isErrorPage = document.title.includes('에러(404)');

    // 만약 오류 페이지가 맞다면, 내용을 더 명확한 메시지로 교체합니다.
    if (isErrorPage) {
        document.body.innerHTML = `
            <style>
                /* 기본 스타일 초기화 및 설정 */
                body {
                    margin: 0;
                    padding: 0;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    background-color: #ffffff; /* 흰색 배경 */
                    color: #333;
                }
                /* 콘텐츠 컨테이너에 여백 추가 */
                .error-container {
                    padding: 2em; /* 위, 아래, 좌, 우에 여백 */
                }
                .error-icon {
                    font-size: 3em; /* 아이콘 크기 */
                    margin-bottom: 0.5em;
                    display: block;
                }
                h2 {
                    margin: 0 0 10px 0;
                    color: #d9534f;
                    font-size: 1.5em;
                }
                p {
                    margin: 0 0 0.5em 0; /* 단락 아래에 약간의 여백 */
                    color: #000000;
                    line-height: 1.6;
                }
            </style>
            <div class="error-container">
                <div class="error-icon">🚫</div>
                <h2>검색 결과를 찾을 수 없습니다</h2>
                <p>선택하신 내용에 해당하는 정보를 CaseNote에서 찾지 못했습니다.</p>
                <p>입력하신 법률/판례 번호 또는 조문 형식을 다시 확인해주세요.</p>
            </div>
        `;
    }
});