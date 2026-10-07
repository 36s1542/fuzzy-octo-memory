// 다국어 텍스트 데이터
const translations = {
  ko: {
    pageTitle: "ATHENAEUM :: 세월의 흔적이 머무는 서재",
    headerSubtitle: "Archive of Solitary Thought",

    heroTitle:
      "밤의 고요 속, 문장들이 깃드는 곳",

    heroDesc:
      "오랜 책들 사이의 서재에서 당신만의 책을 기록하세요.<br>스쳐 지나간 문장들은 누군가의 밤을 밝히는 한 자루 촛불이 됩니다.",

    formTitle:
      "완독 서적 기록",

    searchPlaceholder:
      "도서명 또는 저자를 입력하세요...",

    btnSearch:
      "검색",

    noCover:
      "이미지 첨부<br>(클릭)",

    inputTitle:
      "책 제목",

    inputAuthor:
      "저자",

    inputPublisher:
      "출판사",

    labelRating:
      "평점",

    labelReadPeriod:
      "독서 기간",

    labelVisibility:
      "공개 설정",

    optionPublic:
      "공개 서재",

    optionPrivate:
      "비밀 서재",

    inputMusic:
      "배경 음악 URL (YouTube / Spotify)",

    inputReview:
      "이 책이 당신에게 남긴 문장과 사유를 기록하세요...",

    btnSave:
      "서재에 저장하기"
  },

  en: {
    pageTitle:
      "ATHENAEUM :: Archive of Solitary Thought",

    headerSubtitle:
      "Archive of Solitary Thought",

    heroTitle:
      "Where Sentences Dwell in the Quiet Night",

    heroDesc:
      "Record your own books in the library among ancient volumes.<br>Passing sentences become a candle lighting someone's night.",

    formTitle:
      "Record Completed Book",

    searchPlaceholder:
      "Enter book title or author...",

    btnSearch:
      "Search",

    noCover:
      "Attach Image<br>(Click)",

    inputTitle:
      "Book Title",

    inputAuthor:
      "Author",

    inputPublisher:
      "Publisher",

    labelRating:
      "Rating",

    labelReadPeriod:
      "Reading Period",

    labelVisibility:
      "Visibility",

    optionPublic:
      "Public Library",

    optionPrivate:
      "Private Library",

    inputMusic:
      "Background Music URL (YouTube / Spotify)",

    inputReview:
      "Record the sentences and thoughts this book left with you...",

    btnSave:
      "Save to Library"
  }
};

let currentLang = 'ko';

function changeLanguage(lang) {
  currentLang = lang;

  const btnKo =
    document.getElementById(
      'btn-ko'
    );

  const btnEn =
    document.getElementById(
      'btn-en'
    );

  if (
    btnKo &&
    btnEn
  ) {
    btnKo.classList.toggle(
      'active',
      lang === 'ko'
    );

    btnEn.classList.toggle(
      'active',
      lang === 'en'
    );
  }

  document
    .querySelectorAll(
      '[data-i18n]'
    )
    .forEach(el => {

      const key =
        el.getAttribute(
          'data-i18n'
        );

      if (
        translations[lang]?.[key]
      ) {
        el.innerHTML =
          translations[lang][key];
      }
    });

  document
    .querySelectorAll(
      '[data-i18n-placeholder]'
    )
    .forEach(el => {

      const key =
        el.getAttribute(
          'data-i18n-placeholder'
        );

      if (
        translations[lang]?.[key]
      ) {
        el.placeholder =
          translations[lang][key];
      }
    });

  const title =
    document.querySelector(
      'title[data-i18n="pageTitle"]'
    );

  if (
    title &&
    translations[lang]?.pageTitle
  ) {
    title.textContent =
      translations[lang].pageTitle;
  }
}

window.changeLanguage =
  changeLanguage;