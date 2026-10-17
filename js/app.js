// =========================================================
// ATHENAEUM :: 메인 앱 로직
// 검색 / Firebase / 서재 / 책등 보기
// =========================================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  getDocs,
  query,
  where,
  doc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ---------------------------------------------------------
// 상태
// ---------------------------------------------------------
let currentBookData = null;
let currentUser = null;
let currentTab = 'my';
let isSaving = false;
let loadedBooksMap = {};
let currentRating = 5.0;

let bookshelfView =
  localStorage.getItem('athenaeum_bookshelf_view') || 'cover';

// 검색 별칭: 입력이 한국어/번역명이어도 검색이 잘 되도록 보조
const ALIAS_MAP = {
  '어린왕자': 'The Little Prince',
  '어린 왕자': 'The Little Prince',
  '데미안': 'Demian Hermann Hesse',
  '죄와 벌': 'Crime and Punishment Fyodor Dostoevsky',
  '이방인': 'L Etranger Albert Camus',
  '폭풍의 언덕': 'Wuthering Heights Emily Bronte',
  '도리언 그레이의 초상': 'The Picture of Dorian Gray Oscar Wilde',
  '첫사랑': 'First Love Ivan Turgenev',
  '자유론': 'On Liberty John Stuart Mill'
};

// ---------------------------------------------------------
// Firebase
// ---------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCMMD3KiYIl1nzx2vHp-aiA5BtPPTLz9us",
  authDomain: "ridksjl.firebaseapp.com",
  projectId: "ridksjl",
  storageBucket: "ridksjl.firebasestorage.app",
  messagingSenderId: "742461525284",
  appId: "1:742461525284:web:ec4e19235dba6ddc9877b1",
  measurementId: "G-F63HYQFTEB"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);

// 기존 코드가 사용하던 window.fbAuth 형태도 유지
window.fbAuth = {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  deleteDoc,
  updateDoc
};

window.auth = auth;
window.googleProvider = googleProvider;
window.db = db;

// ---------------------------------------------------------
// 공통 유틸
// ---------------------------------------------------------
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[“”"'‘’:;,.!?()[\]{}]/g, '');
}

function toHttps(url) {
  if (!url) return '';
  return String(url).replace(/^http:\/\//i, 'https://');
}

// ---------------------------------------------------------
// 화면 전환
// ---------------------------------------------------------
function showView(viewName) {
  const views = ['hero', 'reading', 'form', 'explore', 'map', 'library', 'home', 'cafe'];

  views.forEach(view => {
    const element = document.getElementById(`view-${view}`);
    if (!element) return;
    element.classList.toggle('hidden', view !== viewName);
  });

  if (viewName === 'explore') {
    switchTab(currentTab);
  }

  if (viewName === 'reading') {
    loadReadingBooks();
  }

  if (viewName === 'library') {
    initLibraryView();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.showView = showView;
window.closeLoginModal = closeLoginModal;

// ---------------------------------------------------------
// 로그인
// ---------------------------------------------------------
function openLoginModal() {
  const modal = document.getElementById('login-modal');

  if (modal) {
    modal.classList.remove('hidden');
  }
}

function closeLoginModal() {
  const modal = document.getElementById('login-modal');

  if (modal) {
    modal.classList.add('hidden');
  }
}


function initAuth() {
  const btnGoogle =
    document.getElementById('btn-google-login');

  const btnNaver =
    document.getElementById('btn-naver-login');

  const btnLogout =
    document.getElementById('btn-logout');

  const btnLoginModal =
    document.getElementById('btn-login-modal');

  const userProfile =
    document.getElementById('user-profile');

  const btnCloseLoginModal =
    document.getElementById('btn-close-login-modal');

  if (btnCloseLoginModal && !btnCloseLoginModal.dataset.bound) {
    btnCloseLoginModal.dataset.bound = 'true';

    btnCloseLoginModal.addEventListener(
      'click',
      () => {
        closeLoginModal();
      }
    );
  }

  // 한 번만 연결
  if (btnGoogle && !btnGoogle.dataset.bound) {
    btnGoogle.dataset.bound = 'true';

    btnGoogle.addEventListener(
      'click',
      async () => {
        try {
          await signInWithPopup(
            auth,
            googleProvider
          );

          closeLoginModal();
        } catch (error) {
          console.error(
            '로그인 실패:',
            error
          );

          alert(
            '구글 로그인에 실패했습니다.'
          );
        }
      }
    );
  }

  if (btnNaver && !btnNaver.dataset.bound) {
    btnNaver.dataset.bound = 'true';

    btnNaver.addEventListener(
      'click',
      () => {
        alert(
          '네이버 로그인 연동 준비 중입니다.'
        );

        closeLoginModal();
      }
    );
  }

  if (btnLogout && !btnLogout.dataset.bound) {
    btnLogout.dataset.bound = 'true';

    btnLogout.addEventListener(
      'click',
      async () => {
        try {
          await signOut(auth);
        } catch (error) {
          console.error(
            '로그아웃 실패:',
            error
          );
        }
      }
    );
  }

  onAuthStateChanged(
    auth,
    user => {
      currentUser = user;

      if (user) {
        if (btnLoginModal) {
          btnLoginModal.classList.add('hidden');
        }

        if (btnLogout) {
          btnLogout.classList.remove('hidden');
        }

        if (userProfile) {
          userProfile.textContent =
            `${user.displayName || '학자'}님`;

          userProfile.classList.remove(
            'hidden'
          );
        }

        if (currentTab === 'my') {
         loadUserBooks();
        }

/*
 * 로그인 직후 '읽는 중인 책' 캐시도 확보
 */
        loadReadingBooks();

/*
 * 로그인 전에 Library 화면을 열어둔 경우
 * 로그인 완료 후 Library를 다시 초기화
 */
        const libraryView =
          document.getElementById(
            'view-library'
          );

        if (
         libraryView &&
         !libraryView.classList.contains('hidden')
        ) {
          initLibraryView();
        }
      } else {
        if (btnLoginModal) {
          btnLoginModal.classList.remove('hidden');
        }

        if (btnLogout) {
          btnLogout.classList.add('hidden');
        }

        if (userProfile) {
          userProfile.classList.add('hidden');
        }

        const myBookList =
          document.getElementById(
            'my-book-list'
          );

        if (myBookList) {
          myBookList.className =
            `library-grid ${bookshelfView}-mode`;

          myBookList.innerHTML =
            '<div class="shelf-row empty-row">' +
            '<div class="shelf-empty-note">' +
            '로그인 후 당신의 서재 기록을 확인하실 수 있습니다.' +
            '</div>' +
            '</div>';
        }
      }
    }
  );
}

// ---------------------------------------------------------
// Google Books 검색
// ※ 기존 코드의 /vulumes 오타 및 문자열 따옴표 문제를 수정
// ---------------------------------------------------------
async function fetchGoogleBooks(queryText) {
  if (!queryText) return [];

  const apiUrl =
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(queryText)}&maxResults=10&printType=books`;

  try {
    let response = await fetch(apiUrl);

    if (!response.ok) {
      const proxyUrl =
        `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;

      response = await fetch(proxyUrl);
    }

    if (!response.ok) return [];

    const data = await response.json();

    if (!Array.isArray(data.items)) {
      return [];
    }

    return data.items
      .map(item => {
        const info = item.volumeInfo || {};

        let coverUrl =
          info.imageLinks?.thumbnail ||
          info.imageLinks?.smallThumbnail ||
          '';

        coverUrl = toHttps(coverUrl);

        return {
          id: item.id || '',
          title: info.title || '',
          originalInput: queryText,

          authors:
            Array.isArray(info.authors)
              ? info.authors.join(', ')
              : '저자 미상',

          publisher:
            info.publisher || '',

          coverUrl,

          totalPages:
            Number(info.pageCount) || 0,

          publishedDate:
            info.publishedDate || '',

          isbn: (
            info.industryIdentifiers?.find(
              x => x.type === 'ISBN_13'
            ) ||
            info.industryIdentifiers?.find(
              x => x.type === 'ISBN_10'
            )
          )?.identifier || '',

          ...physicalBookFields(info),
          source: 'Google Books'
        };
      })
      .filter(book => book.title);

  } catch (error) {
    console.warn(
      'Google Books 검색 실패:',
      error
    );

    return [];
  }
}

// ---------------------------------------------------------
// Kakao 검색
// ---------------------------------------------------------
const KAKAO_REST_API_KEY =
  'cc089d5d94af9250dbb8fe1b67bade19';

async function fetchKakaoBooks(queryText) {
  if (
    !queryText ||
    !KAKAO_REST_API_KEY
  ) {
    return [];
  }

  const targetUrl =
    `https://dapi.kakao.com/v3/search/book?query=${encodeURIComponent(queryText)}&size=10`;

  try {
    let response;

    try {
      response = await fetch(
        targetUrl,
        {
          headers: {
            Authorization:
              `KakaoAK ${KAKAO_REST_API_KEY}`
          }
        }
      );
    } catch {
      response = null;
    }

    // 브라우저에서 CORS가 막히는 경우 프록시를 한 번 더 시도
    if (!response || !response.ok) {
      const proxyUrl =
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

      response = await fetch(
        proxyUrl,
        {
          headers: {
            Authorization:
              `KakaoAK ${KAKAO_REST_API_KEY}`
          }
        }
      );
    }

    if (!response.ok) {
      return [];
    }

    const data =
      await response.json();

    if (!Array.isArray(data.documents)) {
      return [];
    }

    return data.documents
      .map(item => ({
        id: item.isbn || '',

        title:
          item.title || '제목 없음',

        originalInput:
          queryText,

        authors:
          Array.isArray(item.authors)
            ? item.authors.join(', ')
            : '저자 미상',

        publisher:
          item.publisher || '',

        coverUrl:
          toHttps(item.thumbnail || ''),

        totalPages: 0,

        publishedDate:
          item.datetime || '',

        isbn:
          item.isbn || '',

        source: 'Kakao'
      }))
      .filter(book => book.title);

  } catch (error) {
    console.warn(
      'Kakao 검색 실패:',
      error
    );

    return [];
  }
}

// ---------------------------------------------------------
// Wikidata 보조 검색
// ---------------------------------------------------------
async function fetchWikidataBooks(queryText) {
  if (!queryText) {
    return [];
  }

  try {
    const apiUrl =
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(queryText)}&language=ko&uselang=ko&type=item&format=json&origin=*`;

    const response =
      await fetch(apiUrl);

    if (!response.ok) {
      return [];
    }

    const data =
      await response.json();

    if (!Array.isArray(data.search)) {
      return [];
    }

    return data.search
      .slice(0, 3)
      .map(item => ({
        id: item.id || '',

        title:
          item.label || queryText,

        originalInput:
          queryText,

        authors:
          item.description ||
          '도서 정보',

        publisher:
          'Wikidata',

        coverUrl: '',

        totalPages: 0,

        isbn: '',

        source: 'Wikidata'
      }));

  } catch {
    return [];
  }
}

// ---------------------------------------------------------
// 검색 결과 병합
// 같은 제목이어도 출판사/에디션이 다르면 남겨둔다.
// → 사용자가 자신이 읽은 판본을 직접 고를 수 있음.
// ---------------------------------------------------------
function combineAndFilterResults(...lists) {
  const merged =
    lists.flat().filter(Boolean);

  const seen = new Set();

  return merged
    .filter(book => {
      if (!book?.title) {
        return false;
      }

      const key = [
        normalizeTitle(book.title),
        normalizeTitle(book.authors),
        normalizeTitle(book.publisher)
      ].join('|');

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    })
    .slice(0, 20);
}

// ---------------------------------------------------------
// 검색 결과 표시
// ---------------------------------------------------------
function renderSearchResults(items) {
  const resultsContainer =
    document.getElementById(
      'search-results'
    );

  if (!resultsContainer) {
    return;
  }

  resultsContainer.innerHTML = '';

  items.forEach(item => {
    const itemEl =
      document.createElement('button');

    itemEl.type = 'button';

    itemEl.className =
      'search-item';

    itemEl.innerHTML = `
      ${
        item.coverUrl
          ? `<img class="search-item-thumb" src="${escapeHtml(item.coverUrl)}" alt="표지">`
          : `<div class="search-item-thumb search-item-no-cover">표지 없음</div>`
      }

      <div class="search-item-info">

        <div class="search-item-title">
          ${escapeHtml(item.title)}
        </div>

        <div class="search-item-sub">
          ${escapeHtml(
            item.authors || '저자 미상'
          )}
          ${
            item.publisher
              ? ` · ${escapeHtml(item.publisher)}`
              : ''
          }
        </div>

        <div class="search-item-source">
          ${escapeHtml(item.source || '')}
          ${
            item.totalPages
              ? ` · ${item.totalPages}p`
              : ''
          }
        </div>

      </div>
    `;

    itemEl.addEventListener(
      'click',
      () => {
        selectBook(item);

        resultsContainer.classList.add(
          'hidden'
        );
      }
    );

    resultsContainer.appendChild(
      itemEl
    );
  });
}

// ---------------------------------------------------------
// 검색 실행
// ---------------------------------------------------------
async function searchBooks() {
  const searchInput =
    document.getElementById(
      'book-search-input'
    );

  const resultsContainer =
    document.getElementById(
      'search-results'
    );

  if (
    !searchInput ||
    !resultsContainer
  ) {
    return;
  }

  const originalQuery =
    searchInput.value.trim();

  if (!originalQuery) {
    alert(
      '검색어를 입력해 주세요.'
    );

    return;
  }

  resultsContainer.classList.remove(
    'hidden'
  );

  resultsContainer.innerHTML =
    '<div class="search-item search-loading">' +
    '전 세계 도서 검색 중...' +
    '</div>';

  const targetQuery =
    ALIAS_MAP[originalQuery] ||
    originalQuery;

  const [
    kakaoResult,
    googleResult,
    wikiResult
  ] =
    await Promise.allSettled([
      fetchKakaoBooks(originalQuery),
      fetchGoogleBooks(targetQuery),
      fetchWikidataBooks(targetQuery)
    ]);

  const kakaoBooks =
    kakaoResult.status === 'fulfilled'
      ? kakaoResult.value
      : [];

  const googleBooks =
    googleResult.status === 'fulfilled'
      ? googleResult.value
      : [];

  const wikiBooks =
    wikiResult.status === 'fulfilled'
      ? wikiResult.value
      : [];

  const combinedBooks =
    combineAndFilterResults(
      kakaoBooks,
      googleBooks,
      wikiBooks
    );

  if (!combinedBooks.length) {
    resultsContainer.innerHTML = `
      <button
        type="button"
        class="search-item search-no-result"
      >
        <strong>
          '${escapeHtml(originalQuery)}'
        </strong>
        검색 결과가 없습니다.<br>

        <span>
          이 제목으로 직접 등록하기
        </span>
      </button>
    `;

    resultsContainer
      .querySelector(
        '.search-no-result'
      )
      ?.addEventListener(
        'click',
        () =>
          useCustomTitle(
            originalQuery
          )
      );

    return;
  }

  renderSearchResults(
    combinedBooks
  );
}

function useCustomTitle(rawTitle) {
  selectBook({
    title: rawTitle,
    originalInput: rawTitle,
    authors: '',
    publisher: '',
    coverUrl: '',
    totalPages: 0,
    source: '직접 입력'
  });

  document
    .getElementById(
      'search-results'
    )
    ?.classList.add('hidden');
}

// ---------------------------------------------------------
// 검색 결과 선택 → 표지 + 제목 + 저자 + 출판사 자동 입력
// ---------------------------------------------------------
function selectBook(book) {
  currentBookData = {
    ...book,
    coverUrl:
      toHttps(book.coverUrl || '')
  };

  const titleInput =
    document.getElementById(
      'book-title'
    );

  const authorInput =
    document.getElementById(
      'book-author'
    );

  const publisherInput =
    document.getElementById(
      'book-publisher'
    );

  const previewCover =
    document.getElementById(
      'preview-cover'
    );

  const noCover =
    document.getElementById(
      'no-cover'
    );

  if (titleInput) {
    titleInput.value =
      book.title ||
      book.originalInput ||
      '';
  }

  if (authorInput) {
    authorInput.value =
      book.authors || '';
  }

  if (publisherInput) {
    publisherInput.value =
      book.publisher || '';
  }

  if (
    previewCover &&
    noCover
  ) {
    if (book.coverUrl) {
      previewCover.src =
        toHttps(book.coverUrl);

      previewCover.classList.remove(
        'hidden'
      );

      noCover.classList.add(
        'hidden'
      );
    } else {
      previewCover.src = '';

      previewCover.classList.add(
        'hidden'
      );

      noCover.classList.remove(
        'hidden'
      );
    }
  }

  // 검색으로 선택한 책은 페이지 수도 함께 기억한다.
  currentBookData.totalPages =
    Number(book.totalPages) || 0;
}

// 기존 HTML/외부 코드와의 호환
window.selectSearchBook =
  function (
    title,
    author,
    publisher,
    cover
  ) {
    selectBook({
      title,
      authors: author,
      publisher,
      coverUrl: cover || '',
      originalInput: title,
      totalPages: 0
    });
  };

// ---------------------------------------------------------
// 표지에서 대표 색상 추출
// ---------------------------------------------------------
// 책등의 색은 임의의 랜덤 색을 사용하지 않는다.
// 저장된 표지 이미지에서 실제 픽셀을 샘플링해 가장 많이 등장하는
// 유효한 색을 찾아 어둡고 고서재다운 색으로 변환한다.
async function extractDominantColor(imageUrl) {
  if (!imageUrl) {
    return '';
  }

  const imageSources = [
    toHttps(imageUrl),
    `https://corsproxy.io/?${encodeURIComponent(
      toHttps(imageUrl)
    )}`
  ];

  for (
    const source of imageSources
  ) {
    try {
      const image =
        new Image();

      image.crossOrigin =
        'anonymous';

      const loaded =
        await new Promise(
          (resolve, reject) => {
            const timeout =
              setTimeout(
                () =>
                  reject(
                    new Error(
                      'image timeout'
                    )
                  ),
                7000
              );

            image.onload =
              () => {
                clearTimeout(
                  timeout
                );

                resolve(image);
              };

            image.onerror =
              () => {
                clearTimeout(
                  timeout
                );

                reject(
                  new Error(
                    'image load failed'
                  )
                );
              };

            image.src =
              source;
          }
        );

      const canvas =
        document.createElement(
          'canvas'
        );

      const ctx =
        canvas.getContext(
          '2d',
          {
            willReadFrequently: true
          }
        );

      if (!ctx) {
        continue;
      }

      const maxSide = 80;

      const ratio =
        Math.min(
          1,
          maxSide /
            Math.max(
              loaded.naturalWidth ||
                loaded.width,
              loaded.naturalHeight ||
                loaded.height
            )
        );

      canvas.width =
        Math.max(
          1,
          Math.round(
            (
              loaded.naturalWidth ||
              loaded.width
            ) * ratio
          )
        );

      canvas.height =
        Math.max(
          1,
          Math.round(
            (
              loaded.naturalHeight ||
              loaded.height
            ) * ratio
          )
        );

      ctx.drawImage(
        loaded,
        0,
        0,
        canvas.width,
        canvas.height
      );

      let pixels;

      try {
        pixels =
          ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
          ).data;
      } catch {
        continue;
      }

      // 32단계 양자화로 비슷한 색을 하나로 묶는다.
      const histogram =
        new Map();

      for (
        let i = 0;
        i < pixels.length;
        i += 16
      ) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        if (a < 180) {
          continue;
        }

        const max =
          Math.max(r, g, b);

        const min =
          Math.min(r, g, b);

        // 거의 검정/흰색은 책등 색으로 쓰지 않도록 약간 제외
        if (
          max < 22 ||
          min > 245
        ) {
          continue;
        }

        const qr =
          Math.round(r / 16) * 16;

        const qg =
          Math.round(g / 16) * 16;

        const qb =
          Math.round(b / 16) * 16;

        const key =
          `${qr},${qg},${qb}`;

        histogram.set(
          key,
          (histogram.get(key) || 0) + 1
        );
      }

      if (!histogram.size) {
        continue;
      }

      let best = null;
      let bestScore = -Infinity;

      histogram.forEach(
        (count, key) => {
          const [
            r,
            g,
            b
          ] = key
            .split(',')
            .map(Number);

          const max =
            Math.max(r, g, b);

          const min =
            Math.min(r, g, b);

          const brightness =
            (r + g + b) / 3;

          const saturation =
            max === 0
              ? 0
              : (max - min) / max;

          // 빈도가 높은 색을 기본으로 하되,
          // 너무 회색/검정인 색보다 표지의 특징적인 색을 약간 우선.
          const score =
            count *
            (0.72 + saturation * 0.38) *
            (brightness < 32 ? 0.25 : 1);

          if (
            score > bestScore
          ) {
            bestScore = score;

            best = {
              r,
              g,
              b
            };
          }
        }
      );

      if (!best) {
        continue;
      }

      // 실제 표지 색을 그대로 쓰면 너무 밝아질 수 있어
      // 책등용으로 명도만 낮춘다.
      const factor = 0.68;

      const r =
        Math.max(
          25,
          Math.min(
            125,
            Math.round(
              best.r * factor
            )
          )
        );

      const g =
        Math.max(
          22,
          Math.min(
            110,
            Math.round(
              best.g * factor
            )
          )
        );

      const b =
        Math.max(
          18,
          Math.min(
            105,
            Math.round(
              best.b * factor
            )
          )
        );

      return `rgb(${r}, ${g}, ${b})`;

    } catch {
      // 다음 이미지 소스로 재시도
    }
  }

  return '';
}

// ---------------------------------------------------------
// 판형이 있으면 실제 치수 우선. 없으면 표지 비율/쪽수 기반 추정.
// 표지 비율만으로 실제 높이를 알 수 없으므로 추정임을 명시한다.
// ---------------------------------------------------------
const bookCoverRatios = new Map();
const bookCoverRequests = new Map();
const bookCoverFinished = new Set();
const shelfLayouts = new WeakMap();

function measureLengthMm(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0;
  const text = String(value || '').trim().toLowerCase();
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(mm|cm|inches|inch|in|["″])?$/);
  if (!match) return 0;
  const n = Number(match[1]);
  return n * (match[2] === 'cm' ? 10 : /^(inches|inch|in|["″])$/.test(match[2] || '') ? 25.4 : 1);
}

function getPhysicalDimensions(book) {
  const value = book.physicalDimensions || book.dimensions || {};
  const google = book.volumeInfo?.dimensions || {};
  return {
    heightMm: measureLengthMm(book.heightMm || value.heightMm || value.height || google.height),
    widthMm: measureLengthMm(book.widthMm || value.widthMm || value.width || google.width),
    thicknessMm: measureLengthMm(book.thicknessMm || value.thicknessMm || value.thickness || google.thickness)
  };
}

function physicalBookFields(book) {
  const d = getPhysicalDimensions(book || {});
  return d.heightMm || d.widthMm || d.thicknessMm ? { physicalDimensions: d } : {};
}

function estimateBookDimensions(book) {
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const physical = getPhysicalDimensions(book);
  const pages = Number(book.totalPages || book.pageCount || 0);
  const ratio = bookCoverRatios.get(book.coverUrl);
  // Same visual scale for every volume. Cover shape is only a fallback proxy.
  const heightMm = physical.heightMm || (ratio ? clamp(145 * ratio, 155, 285) : 210);
  const thicknessMm = physical.thicknessMm || (pages > 0 ? 3 + pages * 0.055 : 22);
  return {
    height: Math.round(clamp(heightMm * 0.84, 110, 250)),
    width: Math.round(clamp(thicknessMm * 1.15, 13, 95)),
    sizeDescription: [
      physical.heightMm ? `높이 ${physical.heightMm}mm` : ratio ? '높이: 표지 비율 기반 추정' : '높이: 판형 정보 없음 · 기본값',
      physical.thicknessMm ? `두께 ${physical.thicknessMm}mm` : pages > 0 ? `두께: ${pages}쪽 기준 추정` : '두께: 쪽수 정보 없음 · 기본값'
    ].join(' / ')
  };
}

function loadBookCoverRatio(url) {
  if (!url || bookCoverRatios.has(url)) return Promise.resolve();
  if (bookCoverRequests.has(url)) return bookCoverRequests.get(url);
  const request = new Promise(resolve => {
    const img = new Image();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      img.onload = img.onerror = null;
      bookCoverFinished.add(url);
      resolve();
    };
    const timer = setTimeout(finish, 5000);
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const ratio = img.naturalHeight / img.naturalWidth;
        if (ratio >= 0.6 && ratio <= 2.8) bookCoverRatios.set(url, ratio);
      }
      finish();
    };
    img.onerror = finish;
    img.src = url;
  });
  bookCoverRequests.set(url, request);
  return request;
}

function rememberShelfLayout(container, books, options) {
  let state = shelfLayouts.get(container);
  if (!state) {
    state = { books, options, width: Math.round(container.clientWidth), frame: 0 };
    shelfLayouts.set(container, state);
    if (typeof ResizeObserver !== 'undefined') {
      state.observer = new ResizeObserver(() => {
        const width = Math.round(container.clientWidth);
        if (!width || Math.abs(width - state.width) < 2) return;
        state.width = width;
        cancelAnimationFrame(state.frame);
        state.frame = requestAnimationFrame(() => renderBookshelf(container, state.books, state.options));
      });
      state.observer.observe(container);
    }
  }
  state.books = books;
  state.options = options;
  state.width = Math.round(container.clientWidth);
  return state;
}

// ---------------------------------------------------------
// 책 상세보기 (통합 모달)
// ---------------------------------------------------------

function openBookDetail(docId) {
  const book = loadedBooksMap[docId];

  if (!book) {
    alert('책 정보를 찾을 수 없습니다. 공유서재를 새로고침해 주세요.');
    return;
  }

  // 별도의 상세 페이지로 이동하면서 책 ID 전달
  window.location.href =
    `book-detail.html?id=${encodeURIComponent(docId)}`;
}

function closeBookDetail() {
  // 기존 팝업을 호출하는 코드와의 호환성을 위한 함수
  const detailModal =
    document.getElementById('book-detail-modal');

  if (detailModal) {
    detailModal.classList.add('hidden');
  }
}


// ---------------------------------------------------------
// Firebase 저장
// ---------------------------------------------------------
async function saveBookToFirestore(
  bookData
) {
  if (isSaving) {
    return;
  }

  if (!currentUser) {
    alert(
      '기록을 저장하시려면 로그인이 필요합니다.'
    );

    openLoginModal();

    return;
  }

  isSaving = true;

  try {
    await addDoc(
      collection(
        db,
        'books'
      ),
      {
        userId:
          currentUser.uid,

        ...physicalBookFields(bookData),

        title:
          bookData.title,

        author:
          bookData.author,

        publisher:
          bookData.publisher,

        coverUrl:
          bookData.coverUrl ||
          '',

        coverDominantColor:
          bookData.coverDominantColor ||
          '',

        totalPages:
          Number(
            bookData.totalPages
          ) || 0,

        rating:
          Number(
            bookData.rating
          ) || 5.0,

        visibility:
          bookData.visibility ||
          'public',

        musicUrl:
          bookData.musicUrl ||
          '',

        review:
          bookData.review ||
          '',

        startDate:
          bookData.startDate ||
          '',

        endDate:
          bookData.endDate ||
          '',

        currentPage: 0,

        readingStatus:
          true,

        totalReadingSeconds:
          0,

        createdAt:
          new Date().toISOString()
      }
    );

    alert(
      '서재에 성공적으로 기록되었습니다.'
    );

    resetBookForm();

    showView(
      'explore'
    );

  } catch (error) {
    console.error(
      '저장 오류:',
      error
    );

    alert(
      `저장 도중 오류가 발생했습니다: ${
        error.message || error
      }`
    );

  } finally {
    isSaving = false;
  }
}

function resetBookForm() {
  const bookForm =
    document.getElementById(
      'book-form'
    );

  const searchInput =
    document.getElementById(
      'book-search-input'
    );

  const previewCover =
    document.getElementById(
      'preview-cover'
    );

  const noCover =
    document.getElementById(
      'no-cover'
    );

  bookForm?.reset();

  if (searchInput) {
    searchInput.value = '';
  }

  if (previewCover) {
    previewCover.src = '';

    previewCover.classList.add(
      'hidden'
    );
  }

  if (noCover) {
    noCover.classList.remove(
      'hidden'
    );
  }

  currentBookData = null;
  currentRating = 5.0;

  renderStars(
    currentRating
  );
}

// ---------------------------------------------------------
// 책장 보기 모드
// ---------------------------------------------------------
function setBookshelfView(
  view
) {
  bookshelfView =
    view === 'spine'
      ? 'spine'
      : 'cover';

  localStorage.setItem(
    'athenaeum_bookshelf_view',
    bookshelfView
  );

  document
    .getElementById(
      'btn-cover-view'
    )
    ?.classList.toggle(
      'active',
      bookshelfView ===
        'cover'
    );

  document
    .getElementById(
      'btn-spine-view'
    )
    ?.classList.toggle(
      'active',
      bookshelfView ===
        'spine'
    );

  applyBookshelfMode();
}

function applyBookshelfMode() {
  [
    'my-book-list',
    'public-book-list'
  ].forEach(id => {
    const grid =
      document.getElementById(
        id
      );

    if (!grid) {
      return;
    }

    grid.classList.remove(
      'cover-mode',
      'spine-mode'
    );

    grid.classList.add(
      `${bookshelfView}-mode`
    );
  });
}

// ---------------------------------------------------------
// 책장 행 구성
// ---------------------------------------------------------
function buildRows(books, container) {
  if (!books.length) return [];
  if (bookshelfView === 'cover') {
    const rows = [];
    // Exactly five slots per physical shelf; CSS never wraps inside a shelf.
    for (let i = 0; i < books.length; i += 5) rows.push(books.slice(i, i + 5));
    return rows;
  }
  const styles = getComputedStyle(container);
  const side = parseFloat(styles.getPropertyValue('--shelf-side')) || 14;
  const rail = parseFloat(styles.getPropertyValue('--shelf-rail')) || 6;
  const usableWidth = Math.max(1, (container.clientWidth || 600) - 2 * (side + rail));
  const rows = [];
  let row = [], used = 0;
  for (const entry of books) {
    const width = estimateBookDimensions(entry.book).width;
    const nextWidth = used + (row.length ? 2 : 0) + width;
    if (row.length && nextWidth > usableWidth) {
      rows.push(row);
      row = [];
      used = 0;
    }
    used += (row.length ? 2 : 0) + width;
    row.push(entry);
  }
  if (row.length) rows.push(row);
  return rows;
}

// ---------------------------------------------------------
// 책 한 권 DOM
// ---------------------------------------------------------
function createBookElement(
  book,
  docId
) {
  const wrapper =
    document.createElement(
      'div'
    );

  if (
    bookshelfView ===
    'cover'
  ) {
    wrapper.className =
      'cover-book';

    wrapper.title =
      `${book.title}${
        book.publisher
          ? ` · ${book.publisher}`
          : ''
      }`;

    wrapper.innerHTML = `
      <div class="cover-book-inner">

        ${
          book.coverUrl
            ? `
              <img
                src="${escapeHtml(
                  book.coverUrl
                )}"
                alt="${escapeHtml(
                  book.title
                )}"
              >
            `
            : `
              <div class="cover-book-placeholder">

                <div class="cover-book-title">
                  ${escapeHtml(
                    book.title
                  )}
                </div>

                <div class="cover-book-author">
                  ${escapeHtml(
                    book.author ||
                    ''
                  )}
                </div>

              </div>
            `
        }

      </div>

      <button
        type="button"
        class="book-delete-btn"
        title="삭제"
      >
        &times;
      </button>
    `;

  } else {
    const dimensions =
      estimateBookDimensions(
        book
      );

    const color =
      book.coverDominantColor ||
      '#4a3425';

    wrapper.className =
      'spine-book';

    wrapper.title =
      `${book.title}` +
      `${
        book.author
          ? ` · ${book.author}`
          : ''
      }` +
      `${
        book.publisher
          ? ` · ${book.publisher}`
          : ''
      }`;

    wrapper.title += ` · ${dimensions.sizeDescription}`;

    wrapper.style.setProperty(
      '--book-width',
      `${dimensions.width}px`
    );

    wrapper.style.setProperty(
      '--book-height',
      `${dimensions.height}px`
    );

    wrapper.style.setProperty(
      '--spine-color',
      color
    );

    wrapper.innerHTML = `
      <div class="spine-book-title">
        ${escapeHtml(
          book.title
        )}
      </div>

      <div class="spine-book-author">
        ${escapeHtml(
          book.author ||
          ''
        )}
      </div>

      <button
        type="button"
        class="book-delete-btn"
        title="삭제"
      >
        &times;
      </button>
    `;
  }

  wrapper.addEventListener(
    'click',
    event => {
      if (
        event.target.closest(
          '.book-delete-btn'
        )
      ) {
        return;
      }

      openBookDetail(
        docId
      );
    }
  );

  wrapper
    .querySelector(
      '.book-delete-btn'
    )
    ?.addEventListener(
      'click',
      event => {
        event.stopPropagation();

        deleteBook(
          docId
        );
      }
    );

  return wrapper;
}

// ---------------------------------------------------------
// 책장 렌더링
// ---------------------------------------------------------
async function renderBookshelf(
  container,
  books,
  options = {}
) {
  if (!container) {
    return;
  }

  const emptyMessage =
    options.emptyMessage ||
    '아직 서재에 꽂힌 책이 없습니다. 첫 번째 책을 기록해 보세요.';

  const layout = rememberShelfLayout(container, books, options);
  const renderToken = {};
  layout.renderToken = renderToken;

  container.className =
    `library-grid shelf-library ${bookshelfView}-mode`;

  container.innerHTML = '';

  if (!books.length) {
    const row =
      document.createElement(
        'div'
      );

    row.className =
      'shelf-row empty-row';

    row.innerHTML = `
      <div class="shelf-empty-note">
        ${escapeHtml(
          emptyMessage
        )}
      </div>
    `;

    container.appendChild(
      row
    );

    return;
  }

  const rows =
    buildRows(books, container);

  rows.forEach(
    (rowBooks, rowIndex) => {
      const row =
        document.createElement(
          'div'
        );

      row.className =
        'shelf-row';

      // 마지막 행이 아니라면 선반 끝까지 채우는 행
      if (
        bookshelfView ===
          'spine' &&
        rowIndex <
          rows.length - 1
      ) {
        row.classList.add(
          'shelf-row-full'
        );
      }

      rowBooks.forEach(
        bookEntry => {
          const {
            book,
            docId
          } = bookEntry;

          const bookElement =
            createBookElement(
              book,
              docId
            );

          if (
            bookshelfView ===
            'spine'
          ) {
            const dimensions =
              estimateBookDimensions(
                book
              );

            // 실제 pageCount에 비례한 자연스러운 두께
            bookElement.style.setProperty(
              '--book-grow',
              String(
                Math.max(
                  0.6,
                  dimensions.width
                )
              )
            );
          }

          row.appendChild(
            bookElement
          );
        }
      );

      container.appendChild(
        row
      );
    }
  );

  // Fetch only image geometry. No database writes and no title-based random size.
  if (bookshelfView === 'spine') {
    const unknown = books.map(({ book }) => book.coverUrl)
      .filter(url => url && !bookCoverRatios.has(url) && !bookCoverFinished.has(url));
    if (unknown.length) {
      Promise.allSettled([...new Set(unknown)].map(loadBookCoverRatio)).then(() => {
        if (layout.renderToken === renderToken && bookshelfView === 'spine') {
          renderBookshelf(container, books, options);
        }
      });
    }
  }

  // 오래된 데이터에 dominant color가 없으면 표지에서 계산해 화면에 즉시 반영한다.
  // 가능하면 Firestore에도 한 번 저장하여 다음 방문부터 바로 사용한다.
  if (
    bookshelfView ===
    'spine'
  ) {
    books.forEach(
      async ({
        book,
        docId
      }) => {
        if (
          !book.coverUrl ||
          book.coverDominantColor
        ) {
          return;
        }

        const color =
          await extractDominantColor(
            book.coverUrl
          );

        if (!color) {
          return;
        }

        book.coverDominantColor =
          color;

        const bookEls =
          Array.from(
            container.querySelectorAll(
              '.spine-book'
            )
          );

        const matching =
          bookEls.find(
            el =>
              el.title.startsWith(
                String(
                  book.title ||
                  ''
                )
              )
          );

        if (matching) {
          matching.style.setProperty(
            '--spine-color',
            color
          );
        }

        // 현재 사용자의 책이면 새 색을 저장
        if (
          currentUser &&
          book.userId ===
            currentUser.uid
        ) {
          try {
            await updateDoc(
              doc(
                db,
                'books',
                docId
              ),
              {
                coverDominantColor:
                  color
              }
            );
          } catch (error) {
            console.warn(
              '대표 색상 저장 실패:',
              error
            );
          }
        }
      }
    );
  }
}

// ---------------------------------------------------------
// 내 서재
// ---------------------------------------------------------
async function loadUserBooks() {
  const myBookList =
    document.getElementById(
      'my-book-list'
    );

  if (!myBookList) {
    return;
  }

  applyBookshelfMode();

  if (!currentUser) {
    myBookList.innerHTML = `
      <div class="shelf-row empty-row">
        <div class="shelf-empty-note">
          로그인 후 당신의 서재 기록을 확인하실 수 있습니다.
        </div>
      </div>
    `;

    return;
  }

  myBookList.innerHTML = `
    <div class="shelf-row empty-row">
      <div class="shelf-empty-note">
        서재를 정리하는 중입니다...
      </div>
    </div>
  `;

  try {
    const q =
      query(
        collection(
          db,
          'books'
        ),
        where(
          'userId',
          '==',
          currentUser.uid
        )
      );

    const querySnapshot =
      await getDocs(q);

    loadedBooksMap = {};

    const books = [];

    querySnapshot.forEach(
      bookDoc => {
        const book =
          bookDoc.data();

        const docId =
          bookDoc.id;

        loadedBooksMap[
          docId
        ] = book;

        books.push({
          book,
          docId
        });
      }
    );

    // 최근 기록부터
    books.sort(
      (a, b) =>
        String(
          b.book.createdAt ||
          ''
        ).localeCompare(
          String(
            a.book.createdAt ||
            ''
          )
        )
    );

    await renderBookshelf(
      myBookList,
      books
    );

  } catch (error) {
    console.error(
      '데이터 불러오기 실패:',
      error
    );

    myBookList.innerHTML = `
      <div class="shelf-row empty-row">
        <div class="shelf-empty-note">
          서재를 불러오는 중 오류가 발생했습니다.
        </div>
      </div>
    `;
  }
}

// ---------------------------------------------------------
// 책 삭제
// ---------------------------------------------------------

async function deleteBook(docId) {
  if (!currentUser) {
    alert("로그인 후 이용해 주세요.");
    return;
  }

  try {
    const bookRef = doc(db, "books", docId);
    const bookSnapshot = await getDocs(
      query(
        collection(db, "books"),
        where("__name__", "==", docId)
      )
    );

    if (bookSnapshot.empty) {
      alert("책 기록을 찾을 수 없습니다.");
      return;
    }

    const book = bookSnapshot.docs[0].data();

    // 작성자 본인만 삭제 가능
    const isOwner = book.userId === currentUser.uid;

    // 관리자 권한은 실제 인증된 계정으로 확인해야 함
    const isAdmin = currentUser.getIdTokenResult
      ? (await currentUser.getIdTokenResult()).claims.admin === true
      : false;

    if (!isOwner && !isAdmin) {
      alert("본인이 작성한 기록만 삭제할 수 있습니다.");
      return;
    }

    if (!confirm("이 책 기록을 삭제하시겠습니까?")) {
      return;
    }

    await deleteDoc(bookRef);

    delete loadedBooksMap[docId];

    alert("삭제되었습니다.");

    if (currentTab === "my") {
      await loadUserBooks();
    } else {
      await loadPublicBooks();
    }
} catch (error) {
    console.error("삭제 오류:", error);
    alert("삭제에 실패했습니다. 권한 설정을 확인해 주세요.");
  }
}


// ---------------------------------------------------------
// 공유 서재
// ---------------------------------------------------------
async function loadPublicBooks() {
  const publicBookList = document.getElementById('public-book-list');
  if (!publicBookList) return;

  applyBookshelfMode();

  publicBookList.innerHTML = `
    <div class="shelf-row empty-row">
      <div class="shelf-empty-note">
        공유 서재를 탐색 중입니다...
      </div>
    </div>
  `;

  try {
    const q = query(
      collection(db, 'books'),
      where('visibility', '==', 'public')
    );

    const querySnapshot = await getDocs(q);
    const groupedMap = new Map();

    querySnapshot.forEach(bookDoc => {
      const book = bookDoc.data();
      const docId = bookDoc.id;

      const key = `${normalizeTitle(book.title)}|${normalizeTitle(book.author)}`;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          representativeBook: { ...book },
          docId: docId,
          reviews: []
        });
      }

      groupedMap.get(key).reviews.push({
        docId: docId,
        review: book.review || '등록된 감상평이 없습니다.',
        rating: Number(book.rating || 5.0),
        userName: book.userName || book.userId || '익명의 학자',
        musicUrl: book.musicUrl || '',
        createdAt: book.createdAt || ''
      });
    });

    const groupedBooks = [];
    loadedBooksMap = {};

    groupedMap.forEach((groupData) => {
      const representativeBook = groupData.representativeBook;
      const docId = groupData.docId;
      const reviews = groupData.reviews;

      representativeBook.reviewCount = reviews.length;
      representativeBook.allReviews = reviews;

      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      representativeBook.rating = avgRating;

      loadedBooksMap[docId] = representativeBook;

      groupedBooks.push({
        book: representativeBook,
        docId: docId
      });
    });

    groupedBooks.sort((a, b) =>
      String(b.book.createdAt || '').localeCompare(String(a.book.createdAt || ''))
    );

    await renderBookshelf(publicBookList, groupedBooks, {
      emptyMessage: '아직 공유된 책이 없습니다. 첫 번째로 책을 공유해 보세요!'
    });

  } catch (error) {
    console.error('공유 서재 불러오기 실패:', error);
    publicBookList.innerHTML = `
      <div class="shelf-row empty-row">
        <div class="shelf-empty-note">
          공유 서재를 불러오는 중 오류가 발생했습니다.
        </div>
      </div>
    `;
  }
}
// ---------------------------------------------------------
// 탭
// ---------------------------------------------------------
function switchTab(
  tabType
) {
  currentTab =
    tabType;

  const tabMy =
    document.getElementById(
      'tab-my'
    );

  const tabPublic =
    document.getElementById(
      'tab-public'
    );

  const myGrid =
    document.getElementById(
      'my-book-list'
    );

  const publicGrid =
    document.getElementById(
      'public-book-list'
    );

  if (
    !tabMy ||
    !tabPublic ||
    !myGrid ||
    !publicGrid
  ) {
    return;
  }

  const isMy =
    tabType === 'my';

  tabMy.classList.toggle(
    'secondary',
    !isMy
  );

  tabPublic.classList.toggle(
    'secondary',
    isMy
  );

  myGrid.classList.toggle(
    'hidden',
    !isMy
  );

  publicGrid.classList.toggle(
    'hidden',
    isMy
  );

  applyBookshelfMode();

  if (isMy) {
    loadUserBooks();
  } else {
    loadPublicBooks();
  }
}

// ---------------------------------------------------------
// 별점
// ---------------------------------------------------------
function renderStars(
  ratingValue
) {
  const value =
    Number(
      ratingValue
    ) || 5;

  const starContainer =
    document.getElementById(
      'star-rating'
    );

  const ratingText =
    document.getElementById(
      'rating-text'
    );

  const hiddenInput =
    document.getElementById(
      'book-rating'
    );

  if (!starContainer) {
    return;
  }

  starContainer
    .querySelectorAll(
      '.star'
    )
    .forEach(
      (
        star,
        index
      ) => {
        const starValue =
          index + 1;

        if (
          value >=
          starValue
        ) {
          star.style.setProperty(
            '--fill-percent',
            '100%'
          );

        } else if (
          value >=
          starValue -
            0.5
        ) {
          star.style.setProperty(
            '--fill-percent',
            '50%'
          );

        } else {
          star.style.setProperty(
            '--fill-percent',
            '0%'
          );
        }
      }
    );

  if (ratingText) {
    ratingText.textContent =
      value.toFixed(1);
  }

  if (hiddenInput) {
    hiddenInput.value =
      value.toFixed(1);
  }
}

function initStarRating() {
  const starContainer =
    document.getElementById(
      'star-rating'
    );

  if (!starContainer) {
    return;
  }

  const getRatingFromPointer =
    event => {
      const star =
        event.target.closest(
          '.star'
        );

      if (!star) {
        return null;
      }

      const rect =
        star.getBoundingClientRect();

      const leftHalf =
        event.clientX -
          rect.left <
        rect.width / 2;

      const base =
        Number(
          star.dataset.value
        );

      return leftHalf
        ? base - 0.5
        : base;
    };

  starContainer.addEventListener(
    'mousemove',
    event => {
      const value =
        getRatingFromPointer(
          event
        );

      if (value != null) {
        renderStars(
          value
        );
      }
    }
  );

  starContainer.addEventListener(
    'mouseleave',
    () => {
      renderStars(
        currentRating
      );
    }
  );

  starContainer.addEventListener(
    'click',
    event => {
      const value =
        getRatingFromPointer(
          event
        );

      if (value == null) {
        return;
      }

      currentRating =
        value;

      renderStars(
        currentRating
      );
    }
  );

  renderStars(
    currentRating
  );
}

// =========================================================
// ATHENAEUM :: 지도 / 도서관 / 독서 타이머
// =========================================================

let readingBooksCache = [];
let selectedReadingBook = null;
let readingTimerInterval = null;
let activeReadingSession = null;

// ---------------------------------------------------------
// 날짜 / 시간 표시
// ---------------------------------------------------------
function todayISO() {
  const d = new Date();

  const y =
    d.getFullYear();

  const m =
    String(
      d.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      d.getDate()
    ).padStart(2, '0');

  return `${y}-${m}-${day}`;
}

function formatDuration(seconds) {
  const total =
    Math.max(
      0,
      Math.floor(
        Number(seconds) || 0
      )
    );

  const h =
    Math.floor(
      total / 3600
    );

  const m =
    Math.floor(
      (total % 3600) / 60
    );

  const s =
    total % 60;

  return h > 0
    ? `${h}시간 ${String(m).padStart(2, '0')}분`
    : `${m}분 ${String(s).padStart(2, '0')}초`;
}

function formatTimer(seconds) {
  const total =
    Math.max(
      0,
      Math.floor(
        Number(seconds) || 0
      )
    );

  const h =
    String(
      Math.floor(
        total / 3600
      )
    ).padStart(2, '0');

  const m =
    String(
      Math.floor(
        (total % 3600) / 60
      )
    ).padStart(2, '0');

  const s =
    String(
      total % 60
    ).padStart(2, '0');

  return `${h}:${m}:${s}`;
}

// ---------------------------------------------------------
// 진행 중인 독서 세션을 브라우저에 임시 저장
// 페이지를 새로고침해도 타이머를 복구할 수 있도록 한다.
// ---------------------------------------------------------
function readingSessionStorageKey() {
  return currentUser
    ? `athenaeum_active_reading_${currentUser.uid}`
    : 'athenaeum_active_reading_guest';
}

function saveActiveSessionLocal(
  session
) {
  localStorage.setItem(
    readingSessionStorageKey(),
    JSON.stringify(session)
  );
}

function loadActiveSessionLocal() {
  try {
    return JSON.parse(
      localStorage.getItem(
        readingSessionStorageKey()
      ) || 'null'
    );
  } catch {
    return null;
  }
}

function clearActiveSessionLocal() {
  localStorage.removeItem(
    readingSessionStorageKey()
  );
}

// ---------------------------------------------------------
// 현재 읽는 책 불러오기
// ---------------------------------------------------------
async function loadReadingBooks() {
  const select =
    document.getElementById(
      'reading-book-select'
    );

  if (!select) {
    return;
  }

  if (!currentUser) {
    select.innerHTML =
      '<option value="">로그인 후 책을 선택할 수 있습니다.</option>';

    renderReadingTimeSummary(
      null
    );

    return;
  }

  try {
    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            'books'
          ),
          where(
            'userId',
            '==',
            currentUser.uid
          )
        )
      );

    readingBooksCache = [];

    snapshot.forEach(
      bookDoc => {
        const book =
          bookDoc.data();

        const isFinished =
          !!book.endDate &&
          !book.readingStatus;

        if (!isFinished) {
          readingBooksCache.push({
            id: bookDoc.id,
            ...book
          });
        }
      }
    );

    readingBooksCache.sort(
      (a, b) =>
        String(
          b.createdAt || ''
        ).localeCompare(
          String(
            a.createdAt || ''
          )
        )
    );

    select.innerHTML =
      '<option value="">현재 읽을 책을 선택하세요...</option>';

    readingBooksCache.forEach(
      book => {
        const option =
          document.createElement(
            'option'
          );

        option.value =
          book.id;

        option.textContent =
          `${book.title}${
            book.publisher
              ? ` · ${book.publisher}`
              : ''
          }`;

        select.appendChild(
          option
        );
      }
    );

    if (
      selectedReadingBook &&
      readingBooksCache.some(
        book =>
          book.id ===
          selectedReadingBook.id
      )
    ) {
      select.value =
        selectedReadingBook.id;

    } else if (
      readingBooksCache.length ===
      1
    ) {
      select.value =
        readingBooksCache[0].id;
    }

    const selected =
      readingBooksCache.find(
        book =>
          book.id ===
          select.value
      );

    if (selected) {
      selectedReadingBook =
        selected;

      const currentPage =
        document.getElementById(
          'reading-current-page'
        );

      const totalPages =
        document.getElementById(
          'reading-total-pages'
        );

      const startDate =
        document.getElementById(
          'reading-start-date'
        );

      if (currentPage) {
        currentPage.value =
          Number(
            selected.currentPage ||
            0
          );
      }

      if (totalPages) {
        totalPages.value =
          Number(
            selected.totalPages ||
            0
          );
      }

      if (startDate) {
        startDate.value =
          selected.startDate ||
          todayISO();
      }

      updateReadingProgressUI();

      renderReadingTimeSummary(
        selected
      );
    }

  } catch (error) {
    console.error(
      '현재 읽는 책 불러오기 실패:',
      error
    );
  }
}

// ---------------------------------------------------------
// 독서 진행률
// ---------------------------------------------------------
function updateReadingProgressUI() {
  const current =
    Number(
      document.getElementById(
        'reading-current-page'
      )?.value || 0
    );

  const total =
    Number(
      document.getElementById(
        'reading-total-pages'
      )?.value || 0
    );

  const value =
    total > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              current /
              total *
              100
            )
          )
        )
      : 0;

  const text =
    document.getElementById(
      'reading-progress-percent'
    );

  const fill =
    document.getElementById(
      'reading-progress-bar-fill'
    );

  if (text) {
    text.textContent =
      `${value}%`;
  }

  if (fill) {
    fill.style.width =
      `${value}%`;
  }
}

// ---------------------------------------------------------
// 책별 누적 독서 시간 표시
// ---------------------------------------------------------
function renderReadingTimeSummary(
  book
) {
  const box =
    document.getElementById(
     'reading-book-time-note'
    );

  if (!box) {
    return;
  }

  if (!book) {
    box.innerHTML =
      '책을 선택하면 누적 독서 시간이 표시됩니다.';

    return;
  }

  box.innerHTML =
    `⏳ 이 책의 누적 독서 시간 <strong>${formatDuration(
      book.totalReadingSeconds ||
      0
    )}</strong>`;
}

// ---------------------------------------------------------
// 기존 '읽는 중인 책' 진행 상황 저장
// ---------------------------------------------------------
async function saveReadingProgress() {
  if (!currentUser) {
    openLoginModal();

    return;
  }

  const id =
    document.getElementById(
      'reading-book-select'
    )?.value;

  if (!id) {
    alert(
      '먼저 현재 읽을 책을 선택해 주세요.'
    );

    return;
  }

  const current =
    Number(
      document.getElementById(
        'reading-current-page'
      )?.value || 0
    );

  const total =
    Number(
      document.getElementById(
        'reading-total-pages'
      )?.value || 0
    );

  const startDate =
    document.getElementById(
      'reading-start-date'
    )?.value ||
    todayISO();

  if (
    current < 0 ||
    (
      total > 0 &&
      current > total
    )
  ) {
    alert(
      '현재 페이지를 확인해 주세요.'
    );

    return;
  }

  try {
    await updateDoc(
      doc(
        db,
        'books',
        id
      ),
      {
        currentPage:
          current,

        totalPages:
          total,

        startDate,

        readingStatus:
          true,

        updatedAt:
          new Date().toISOString()
      }
    );

    await loadReadingBooks();

    alert(
      '현재 독서 진행 상황이 저장되었습니다.'
    );

  } catch (error) {
    console.error(
      error
    );

    alert(
      `저장하지 못했습니다: ${
        error.message ||
        error
      }`
    );
  }
}

// ---------------------------------------------------------
// Reading 화면 → Library 화면
// ---------------------------------------------------------
function openLibraryFromReading() {
  showView(
    'library'
  );
}

async function initLibraryView() {
  await loadReadingBooks();

  const active =
    loadActiveSessionLocal();

  if (
    active &&
    currentUser &&
    active.userId ===
      currentUser.uid
  ) {
    activeReadingSession =
      active;

    selectedReadingBook =
      readingBooksCache.find(
        book =>
          book.id ===
          active.bookId
      ) ||
      active.book;

    renderActiveReadingSession();

  } else {
    activeReadingSession =
      null;

    renderLibrarySetup();
  }

  await loadLibraryStats();
}

function renderLibrarySetup() {
  const setup =
    document.getElementById(
      'library-start-form'
    );

  const timerPanel =
    document.getElementById(
      'library-timer-panel'
    );

  if (setup) {
    setup.classList.remove(
      'hidden'
    );
  }

  if (timerPanel) {
    timerPanel.classList.add(
      'hidden'
    );
  }

  const status =
    document.getElementById(
      'library-session-status'
    );

  if (status) {
    status.textContent =
      '대기 중';
  }

  const select =
    document.getElementById(
      'library-book-select'
    );

  if (!select) {
    return;
  }

  select.innerHTML =
    '<option value="">현재 읽는 책을 선택하세요...</option>';

  readingBooksCache.forEach(
    book => {
      const option =
        document.createElement(
          'option'
        );

      option.value =
        book.id;

      option.textContent =
        `${book.title}${
          book.publisher
            ? ` · ${book.publisher}`
            : ''
        }`;

      select.appendChild(
        option
      );
    }
  );

  if (
    selectedReadingBook &&
    readingBooksCache.some(
      book =>
        book.id ===
        selectedReadingBook.id
    )
  ) {
    select.value =
      selectedReadingBook.id;
  } else if (
    readingBooksCache.length === 1
  ) {
    select.value =
      readingBooksCache[0].id;
  }

  const selected =
    readingBooksCache.find(
      book =>
        book.id ===
        select.value
    );

  const startPage =
    document.getElementById(
      'library-start-page'
    );

  if (selected) {
    selectedReadingBook =
      selected;

    const current =
      Number(
        selected.currentPage || 0
      );

    if (startPage) {
      startPage.value =
        current > 0
          ? current + 1
          : 1;
    }
  } else if (startPage) {
    startPage.value = '';
  }
}

// ---------------------------------------------------------
// 도서관 책 목록 새로고침
// ---------------------------------------------------------
async function refreshLibraryBooks() {
  await loadReadingBooks();

  renderLibrarySetup();
}

// ---------------------------------------------------------
// 도서관 이벤트
// ---------------------------------------------------------
function initLibraryEvents() {
  // --------------------------------------------
  // 현재 읽는 책 선택
  // --------------------------------------------
  const bookSelect =
    document.getElementById('library-book-select');

  if (bookSelect && !bookSelect.dataset.libraryBound) {
    bookSelect.dataset.libraryBound = 'true';

    bookSelect.addEventListener('change', () => {
      const id = bookSelect.value;

      const book =
        readingBooksCache.find(
          item => item.id === id
        );

      const startPage =
        document.getElementById('library-start-page');

      if (book && startPage) {
        const current =
          Number(book.currentPage || 0);

        startPage.value =
          current > 0
            ? current + 1
            : 1;
      }

      selectedReadingBook = book || null;
    });
  }


  // --------------------------------------------
  // ★ 독서 시작 버튼
  // --------------------------------------------
  const startButton =
    document.getElementById('btn-start-reading');

  if (startButton && !startButton.dataset.libraryBound) {
    startButton.dataset.libraryBound = 'true';

    startButton.addEventListener(
      'click',
      startLibraryReading
    );
  }


  // --------------------------------------------
  // ★ 독서 중단 버튼
  // --------------------------------------------
  const stopButton =
    document.getElementById('btn-stop-reading');

  if (stopButton && !stopButton.dataset.libraryBound) {
    stopButton.dataset.libraryBound = 'true';

    stopButton.addEventListener(
      'click',
      stopLibraryReading
    );
  }


  // --------------------------------------------
  // 새 책 검색
  // --------------------------------------------
  const searchButton =
    document.getElementById(
      'btn-library-book-search'
    );

  if (searchButton && !searchButton.dataset.libraryBound) {
    searchButton.dataset.libraryBound = 'true';

    searchButton.addEventListener(
      'click',
      searchLibraryBooks
    );
  }


  // --------------------------------------------
  // 검색창 Enter
  // --------------------------------------------
  const searchInput =
    document.getElementById(
      'library-book-search-input'
    );

  if (searchInput && !searchInput.dataset.libraryBound) {
    searchInput.dataset.libraryBound = 'true';

    searchInput.addEventListener(
      'keydown',
      event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          searchLibraryBooks();
        }
      }
    );
  }
}

async function startLibraryReading() {
  console.log('[ATHENAEUM] 독서 시작 버튼 클릭');

  if (!currentUser) {
    console.warn('[ATHENAEUM] 로그인 정보가 아직 없습니다.');
    openLoginModal();
    return;
  }

  /*
   * 중요:
   * Library 화면이 로그인 인증보다 먼저 열렸다면
   * readingBooksCache가 아직 비어 있을 수 있다.
   * 따라서 시작 버튼을 누르는 순간에도 최신 책 목록을 확보한다.
   */
  if (!readingBooksCache.length) {
    console.log('[ATHENAEUM] 책 목록이 없어 다시 불러옵니다.');
    await loadReadingBooks();
  }

  const select =
    document.getElementById('library-book-select');

  const startPageInput =
    document.getElementById('library-start-page');

  const id =
    select?.value || '';

  const startPage =
    Number(
      startPageInput?.value || 1
    );

  console.log('[ATHENAEUM] 선택된 책 ID:', id);
  console.log('[ATHENAEUM] 시작 페이지:', startPage);
  console.log('[ATHENAEUM] 책 캐시:', readingBooksCache);

  let book =
    readingBooksCache.find(
      item => item.id === id
    );

  /*
   * 캐시가 갱신되는 과정에서 select의 value가
   * 아직 반영되지 않은 경우 한 번 더 확인
   */
  if (!book && selectedReadingBook) {
    book =
      readingBooksCache.find(
        item =>
          item.id ===
          selectedReadingBook.id
      );
  }

  if (!book) {
    alert(
      '읽을 책을 선택해 주세요.'
    );
    return;
  }

  if (
    !Number.isFinite(startPage) ||
    startPage < 1
  ) {
    alert(
      '시작 페이지를 확인해 주세요.'
    );
    return;
  }

  if (
    book.totalPages &&
    startPage > Number(book.totalPages)
  ) {
    alert(
      '시작 페이지가 전체 페이지 수를 초과했습니다.'
    );
    return;
  }

  selectedReadingBook = book;

  /*
   * ★ 실제 독서 세션 생성
   */
  const session = {
    userId: currentUser.uid,

    bookId: book.id,

    book: {
      title:
        book.title || '제목 없음',

      author:
        book.author ||
        book.authors ||
        '',

      publisher:
        book.publisher ||
        '',

      coverUrl:
        book.coverUrl ||
        ''
    },

    startPage: startPage,

    /*
     * 반드시 숫자로 저장
     */
    startedAt: Date.now()
  };

  console.log(
    '[ATHENAEUM] 독서 세션 생성:',
    session
  );

  activeReadingSession =
    session;

  /*
   * 새로고침해도 복구할 수 있도록 저장
   */
  saveActiveSessionLocal(
    session
  );

  /*
   * ★★★★★
   * 기존 interval이 혹시 남아 있다면 먼저 제거
   */
  clearInterval(
    readingTimerInterval
  );

  readingTimerInterval =
    null;

  /*
   * ★ 타이머 화면으로 전환
   */
  renderActiveReadingSession();

  /*
   * 화면 전환 직후 한 번 더 즉시 갱신
   */
  updateLibraryTimer();

  console.log(
    '[ATHENAEUM] 타이머 시작 완료'
  );
}

function renderActiveReadingSession() {
  const startForm =
    document.getElementById(
      'library-start-form'
    );

  const timerPanel =
    document.getElementById(
      'library-timer-panel'
    );

  const title =
    document.getElementById(
      'library-timer-book-title'
    );

  const pageNote =
    document.getElementById(
      'library-timer-page-note'
    );

  const status =
    document.getElementById(
      'library-session-status'
    );

  const timer =
    document.getElementById(
      'library-timer'
    );

  /*
   * 세션이 없으면 완전히 정지 상태
   */
  if (!activeReadingSession) {
    clearInterval(
      readingTimerInterval
    );

    readingTimerInterval =
      null;

    if (startForm) {
      startForm.classList.remove(
        'hidden'
      );
    }

    if (timerPanel) {
      timerPanel.classList.add(
        'hidden'
      );
    }

    if (status) {
      status.textContent =
        '대기 중';
    }

    if (timer) {
      timer.textContent =
        '00:00:00';
    }

    return;
  }

  /*
   * 세션 데이터 검증
   */
  const startedAt =
    Number(
      activeReadingSession.startedAt
    );

  if (
    !Number.isFinite(startedAt) ||
    startedAt <= 0
  ) {
    console.error(
      '[ATHENAEUM] 잘못된 startedAt:',
      activeReadingSession.startedAt
    );

    clearActiveSessionLocal();

    activeReadingSession =
      null;

    renderActiveReadingSession();

    return;
  }

  /*
   * 시작 화면 숨기기
   */
  if (startForm) {
    startForm.classList.add(
      'hidden'
    );
  }

  /*
   * 타이머 화면 표시
   */
  if (timerPanel) {
    timerPanel.classList.remove(
      'hidden'
    );
  }

  /*
   * 책 제목
   */
  if (title) {
    title.textContent =
      activeReadingSession.book?.title ||
      selectedReadingBook?.title ||
      '현재 읽는 책';
  }

  /*
   * 시작 페이지
   */
  if (pageNote) {
    pageNote.textContent =
      `${activeReadingSession.startPage}쪽부터 읽는 중`;
  }

  /*
   * 상태
   */
  if (status) {
    status.textContent =
      '독서 중';
  }

  /*
   * 기존 interval 제거
   */
  clearInterval(
    readingTimerInterval
  );

  /*
   * ★★★ 즉시 표시
   */
  updateLibraryTimer();

  /*
   * ★★★ 1초마다 갱신
   */
  readingTimerInterval =
    window.setInterval(
      () => {
        updateLibraryTimer();
      },
      1000
    );

  console.log(
    '[ATHENAEUM] interval 시작:',
    readingTimerInterval
  );
}

 function updateLibraryTimer() {
  const timer =
    document.getElementById(
      'library-timer'
    );

  if (!timer) {
    return;
  }

  if (!activeReadingSession) {
    timer.textContent =
      '00:00:00';
    return;
  }

  const startedAt =
    Number(
      activeReadingSession.startedAt
    );

  if (
    !Number.isFinite(startedAt) ||
    startedAt <= 0
  ) {
    timer.textContent =
      '00:00:00';
    return;
  }

  const elapsed =
    Math.max(
      0,
      Math.floor(
        (Date.now() - startedAt) / 1000
      )
    );

  timer.textContent =
    formatTimer(elapsed);
}

// ---------------------------------------------------------
// 독서 종료
// → 종료 페이지 입력
// → readingSessions 저장
// → 책의 현재 페이지/누적 시간 업데이트
// ---------------------------------------------------------
async function stopLibraryReading() {
  if (!activeReadingSession) {
    return;
  }

  clearInterval(
    readingTimerInterval
  );

  const elapsed =
    Math.floor(
      (
        Date.now() -
        activeReadingSession.startedAt
      ) / 1000
    );

  const endPageRaw =
    prompt(
      `몇 쪽까지 읽었나요?\n(${activeReadingSession.startPage}쪽부터 시작)`,
      String(
        activeReadingSession.startPage
      )
    );

  if (
    endPageRaw === null
  ) {
    readingTimerInterval =
      setInterval(
        updateLibraryTimer,
        1000
      );

    return;
  }

  const endPage =
    Number(
      endPageRaw
    );

  if (
    !Number.isFinite(
      endPage
    ) ||
    endPage <
      activeReadingSession.startPage
  ) {
    alert(
      '종료 페이지를 확인해 주세요.'
    );

    readingTimerInterval =
      setInterval(
        updateLibraryTimer,
        1000
      );

    return;
  }

  try {
    // 1. 독서 세션 자체를 기록
    await addDoc(
      collection(
        db,
        'readingSessions'
      ),
      {
        userId:
          currentUser.uid,

        bookId:
          activeReadingSession.bookId,

        bookTitle:
          activeReadingSession.book.title,

        startPage:
          activeReadingSession.startPage,

        endPage,

        durationSeconds:
          elapsed,

        startedAt:
          new Date(
            activeReadingSession.startedAt
          ).toISOString(),

        endedAt:
          new Date().toISOString(),

        date:
          todayISO()
      }
    );

    // 2. 책 데이터에 누적 시간과 현재 페이지 반영
    const bookRef =
      doc(
        db,
        'books',
        activeReadingSession.bookId
      );

    const book =
      readingBooksCache.find(
        item =>
          item.id ===
          activeReadingSession.bookId
      ) || {};

    const oldTotal =
      Number(
        book.totalReadingSeconds ||
        0
      );

    const isFinished =
      Number(
        book.totalPages ||
        0
      ) > 0 &&
      endPage >=
        Number(
          book.totalPages
        );

    await updateDoc(
      bookRef,
      {
        currentPage:
          endPage,

        totalReadingSeconds:
          oldTotal +
          elapsed,

        readingStatus:
          !isFinished,

        endDate:
          isFinished
            ? todayISO()
            : (
                book.endDate ||
                ''
              )
      }
    );

    const savedStartPage =
      activeReadingSession.startPage;

    clearActiveSessionLocal();

    activeReadingSession =
      null;

    selectedReadingBook =
      null;

    renderLibrarySetup();

    await loadReadingBooks();

    await loadLibraryStats();

    alert(
      `독서 세션이 저장되었습니다.\n` +
      `독서 시간: ${formatDuration(
        elapsed
      )}\n` +
      `읽은 페이지: ${savedStartPage}쪽 → ${endPage}쪽`
    );

  } catch (error) {
    console.error(
      '독서 세션 저장 실패:',
      error
    );

    alert(
      `독서 기록 저장에 실패했습니다: ${
        error.message ||
        error
      }`
    );

    readingTimerInterval =
      setInterval(
        updateLibraryTimer,
        1000
      );
  }
}

// ---------------------------------------------------------
// 도서관에서 새 책 검색 패널
// ---------------------------------------------------------
function openLibraryBookSearch() {
  document
    .getElementById(
      'library-search-panel'
    )
    ?.classList.toggle(
      'hidden'
    );
}

// ---------------------------------------------------------
// 도서관 새 책 검색
// ---------------------------------------------------------
async function searchLibraryBooks() {
  const input =
    document.getElementById(
      'library-book-search-input'
    );

  const results =
    document.getElementById(
      'library-book-search-results'
    );

  const queryText =
    input?.value.trim();

  if (
    !queryText ||
    !results
  ) {
    return;
  }

  results.classList.remove(
    'hidden'
  );

  results.innerHTML =
    '<div class="library-search-loading">도서를 찾는 중입니다...</div>';

  const [
    kakaoResult,
    googleResult
  ] =
    await Promise.allSettled([
      fetchKakaoBooks(
        queryText
      ),

      fetchGoogleBooks(
        ALIAS_MAP[
          queryText
        ] ||
        queryText
      )
    ]);

  const books =
    combineAndFilterResults(
      kakaoResult.status ===
        'fulfilled'
        ? kakaoResult.value
        : [],

      googleResult.status ===
        'fulfilled'
        ? googleResult.value
        : []
    );

  if (!books.length) {
    results.innerHTML =
      '<div class="library-search-empty">검색 결과가 없습니다.</div>';

    return;
  }

  results.innerHTML = '';

  books
    .slice(
      0,
      12
    )
    .forEach(
      book => {
        const button =
          document.createElement(
            'button'
          );

        button.type =
          'button';

        button.className =
          'library-search-result';

        button.innerHTML = `
          ${
            book.coverUrl
              ? `
                <img
                  src="${escapeHtml(
                    book.coverUrl
                  )}"
                  alt=""
                >
              `
              : `
                <div class="library-result-no-cover">
                  ▦
                </div>
              `
          }

          <span>
            <strong>
              ${escapeHtml(
                book.title
              )}
            </strong>

            <small>
              ${escapeHtml(
                book.authors ||
                ''
              )}

              ${
                book.publisher
                  ? ` · ${escapeHtml(
                      book.publisher
                    )}`
                  : ''
              }
            </small>
          </span>
        `;

        button.addEventListener(
          'click',
          () =>
            useLibrarySearchBook(
              book
            )
        );

        results.appendChild(
          button
        );
      }
    );
}

// ---------------------------------------------------------
// 검색한 책을 현재 읽는 책으로 등록
// ---------------------------------------------------------
async function useLibrarySearchBook(
  book
) {
  if (!currentUser) {
    openLoginModal();

    return;
  }

  try {
    const existing =
      readingBooksCache.find(
        existingBook =>
          normalizeTitle(
            existingBook.title
          ) ===
            normalizeTitle(
              book.title
            ) &&
          normalizeTitle(
            existingBook.publisher
          ) ===
            normalizeTitle(
              book.publisher
            )
      );

    if (existing) {
      const select =
        document.getElementById(
          'library-book-select'
        );

      const start =
        document.getElementById(
          'library-start-page'
        );

      if (select) {
        select.value =
          existing.id;
      }

      if (start) {
        const current =
          Number(
            existing.currentPage ||
            0
          );

        start.value =
          current > 0
            ? current + 1
            : 1;
      }

    } else {
      const ref =
        await addDoc(
          collection(
            db,
            'books'
          ),
          {
            userId:
              currentUser.uid,

            title:
              book.title,

            author:
              book.authors ||
              '',

            publisher:
              book.publisher ||
              '',

            coverUrl:
              book.coverUrl ||
              '',

            totalPages:
              Number(
                book.totalPages ||
                0
              ),

            rating:
              5,

            visibility:
              'private',

            musicUrl:
              '',

            review:
              '',

            startDate:
              todayISO(),

            endDate:
              '',

            currentPage:
              0,

            readingStatus:
              true,

            totalReadingSeconds:
              0,

            createdAt:
              new Date().toISOString()
          }
        );

      await loadReadingBooks();

      const select =
        document.getElementById(
          'library-book-select'
        );

      const start =
        document.getElementById(
          'library-start-page'
        );

      if (select) {
        select.value =
          ref.id;
      }

      if (start) {
        start.value =
          1;
      }
    }

    document
      .getElementById(
        'library-book-search-results'
      )
      ?.classList.add(
        'hidden'
      );

    

  } catch (error) {
    console.error(
      error
    );

    alert(
      `책을 등록하지 못했습니다: ${
        error.message ||
        error
      }`
    );
  }
}

// ---------------------------------------------------------
// 독서 통계
// ---------------------------------------------------------
async function loadLibraryStats() { // 1. 여는 중괄호 '{' 추가
  if (!currentUser) {
    return;
  }

  try {
    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            'readingSessions'
          ),
          where(
            'userId',
            '==',
            currentUser.uid
          )
        )
      );

    let total = 0;
    let today = 0;
    let selected = 0;

    const todayKey =
      todayISO();

    snapshot.forEach(
      sessionDoc => {
        const data =
          sessionDoc.data();

        const sec =
          Number(
            data.durationSeconds ||
            0
          );

        total += sec;

        if (
          data.date ===
          todayKey
        ) {
          today += sec;
        }

        if (
          selectedReadingBook &&
          data.bookId ===
            selectedReadingBook.id
        ) {
          selected += sec;
        }
      }
    );

    const totalEl =
      document.getElementById(
        'stat-total-reading-time'
      );

    const todayEl =
      document.getElementById(
        'stat-today-reading-time'
      );

    const bookEl =
      document.getElementById(
        'stat-book-reading-time'
      );

    window.athenaeumLibraryStats = {
      total,
      today,
      book: selected
    };

    if (totalEl) {
      totalEl.textContent =
        formatDuration(
          total
        );
    }

    if (todayEl) {
      todayEl.textContent =
        formatDuration(
          today
        );
    }

    if (bookEl) {
      bookEl.textContent =
        formatDuration(
          selected
        );
    }
  } catch (error) { // 2. try 문을 닫는 catch 블록 추가
    console.error('Library stats 로드 실패:', error);
  }
} 

// ---------------------------------------------------------
// 읽는 중인 책
// 기존 화면/기능은 유지 수현아 안녕~~ 에러 생기니까 너무 재밌어지네 하하하하하  ㅋㅋㅋㅋㅋㅋㅋ 나 지금 스트레스성 폭식 중이야 하하하 살 찌겠다 3시에 먹다니
// ---------------------------------------------------------
function initReadingProgress() {
  const select =
    document.getElementById(
      'reading-book-select'
    );

  const currentPage =
    document.getElementById(
      'reading-current-page'
    );

  const totalPages =
    document.getElementById(
      'reading-total-pages'
    );

  const startDate =
    document.getElementById(
      'reading-start-date'
    );

  const percent =
    document.getElementById(
      'reading-progress-percent'
    );

  const fill =
    document.getElementById(
      'reading-progress-bar-fill'
    );

  if (!select) {
    return;
  }

  const calculate = () => {
    const current =
      Number(
        currentPage?.value || 0
      );

    const total =
      Number(
        totalPages?.value || 0
      );

    const value =
      total > 0
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round(
                current /
                total *
                100
              )
            )
          )
        : 0;

    if (percent) {
      percent.textContent =
        `${value}%`;
    }

    if (fill) {
      fill.style.width =
        `${value}%`;
    }
  };

  currentPage?.addEventListener(
    'input',
    calculate
  );

  select.addEventListener(
    'change',
    () => {
      const book =
        readingBooksCache.find(
          item =>
            item.id ===
            select.value
        );

      if (!book) {
        if (currentPage) {
          currentPage.value = '';
        }

        if (totalPages) {
          totalPages.value = '';
        }

        calculate();

        renderReadingTimeSummary(
          null
        );

        return;
      }

      selectedReadingBook =
        book;

      if (currentPage) {
        currentPage.value =
          Number(
            book.currentPage ||
            0
          );
      }

      if (totalPages) {
        totalPages.value =
          Number(
            book.totalPages ||
            0
          );
      }

      if (startDate) {
        startDate.value =
          book.startDate ||
          todayISO();
      }

      calculate();

      renderReadingTimeSummary(
        book
      );

      loadLibraryStats();
    }
  );

  document
    .getElementById(
      'btn-save-current-reading'
    )
    ?.addEventListener(
      'click',
      saveReadingProgress
    );

  document
    .getElementById(
      'btn-start-library-reading'
    )
    ?.addEventListener(
      'click',
      openLibraryFromReading
    );

  loadReadingBooks();
  // 플러스(+) 버튼 클릭 시 검색창 토글
const btnToggleSearch = document.getElementById('btn-toggle-reading-search');
const searchPanel = document.getElementById('reading-search-panel');

if (btnToggleSearch && searchPanel) {
  btnToggleSearch.addEventListener('click', () => {
    searchPanel.classList.toggle('hidden');
  });
}
}

// ---------------------------------------------------------
// 표지 직접 첨부
// ---------------------------------------------------------
function initCoverUpload() {
  const uploadTrigger =
    document.getElementById(
      'cover-upload-trigger'
    );

  const fileInput =
    document.getElementById(
      'cover-file-input'
    );

  const previewCover =
    document.getElementById(
      'preview-cover'
    );

  const noCover =
    document.getElementById(
      'no-cover'
    );

  if (
    !uploadTrigger ||
    !fileInput
  ) {
    return;
  }

  uploadTrigger.addEventListener(
    'click',
    () => {
      fileInput.click();
    }
  );

  fileInput.addEventListener(
    'change',
    event => {
      const file =
        event.target.files?.[0];

      if (!file) {
        return;
      }

      const reader =
        new FileReader();

      reader.onload =
        async loadEvent => {
          const dataUrl =
            loadEvent.target.result;

          if (
            previewCover &&
            noCover
          ) {
            previewCover.src =
              dataUrl;

            previewCover.classList.remove(
              'hidden'
            );

            noCover.classList.add(
              'hidden'
            );
          }

          currentBookData = {
            ...(currentBookData || {}),

            coverUrl:
              dataUrl,

            totalPages:
              currentBookData?.totalPages ||
              0
          };

          // 직접 업로드한 표지에서 대표색 추출
          currentBookData.coverDominantColor =
            await extractDominantColor(
              dataUrl
            );
        };

      reader.readAsDataURL(
        file
      );
    }
  );
}

// ---------------------------------------------------------
// 완독 기록 저장
// ---------------------------------------------------------
function initBookForm() {
  const bookForm =
    document.getElementById(
      'book-form'
    );

  if (
    !bookForm ||
    bookForm.dataset.bound
  ) {
    return;
  }

  bookForm.dataset.bound =
    'true';

  bookForm.addEventListener(
    'submit',
    async event => {
      event.preventDefault();

      const rating =
        Number(
          document.getElementById(
            'book-rating'
          )?.value || 5
        );

      const bookData = {
        ...physicalBookFields(currentBookData || {}),
        title:
          document.getElementById(
            'book-title'
          )?.value.trim() ||
          '',

        author:
          document.getElementById(
            'book-author'
          )?.value.trim() ||
          '',

        publisher:
          document.getElementById(
            'book-publisher'
          )?.value.trim() ||
          '',

        visibility:
          document.getElementById(
            'book-visibility'
          )?.value ||
          'public',

        musicUrl:
          document.getElementById(
            'book-music'
          )?.value.trim() ||
          '',

        review:
          document.getElementById(
            'book-review'
          )?.value ||
          '',

        startDate:
          document.getElementById(
            'book-start-date'
          )?.value ||
          '',

        endDate:
          document.getElementById(
            'book-end-date'
          )?.value ||
          '',

        coverUrl:
          currentBookData?.coverUrl ||
          '',

        coverDominantColor:
          currentBookData?.coverDominantColor ||
          '',

        totalPages:
          Number(
            currentBookData?.totalPages ||
            0
          ),

        rating
      };

      if (!bookData.title) {
        alert(
          '책 제목을 입력해 주세요.'
        );

        return;
      }

      // 검색으로 가져온 표지의 대표색이 아직 없으면
      // 저장하기 전에 한 번 계산한다.
      if (
        bookData.coverUrl &&
        !bookData.coverDominantColor
      ) {
        bookData.coverDominantColor =
          await extractDominantColor(
            bookData.coverUrl
          );
      }

      await saveBookToFirestore(
        bookData
      );
    }
  );
}

// ---------------------------------------------------------
// 검색 이벤트
// ---------------------------------------------------------
function initSearch() {
  const btnSearch =
    document.getElementById(
      'btn-search'
    );

  const searchInput =
    document.getElementById(
      'book-search-input'
    );

  if (
    btnSearch &&
    !btnSearch.dataset.bound
  ) {
    btnSearch.dataset.bound =
      'true';

    btnSearch.addEventListener(
      'click',
      searchBooks
    );
  }

  if (
    searchInput &&
    !searchInput.dataset.bound
  ) {
    searchInput.dataset.bound =
      'true';

    searchInput.addEventListener(
      'keydown',
      event => {
        if (
          event.key ===
          'Enter'
        ) {
          event.preventDefault();

          searchBooks();
        }
      }
    );
  }

  document.addEventListener(
    'click',
    event => {
      const searchSection =
        document.querySelector(
          '.search-section'
        );

      const resultsContainer =
        document.getElementById(
          'search-results'
        );

      if (
        searchSection &&
        resultsContainer &&
        !searchSection.contains(
          event.target
        )
      ) {
        resultsContainer.classList.add(
          'hidden'
        );
      }
    }
  );
}

// ---------------------------------------------------------
// 날짜 기본값
// ---------------------------------------------------------
function initDates() {
  const today =
    new Date()
      .toISOString()
      .split('T')[0];

  [
    'reading-start-date',
    'book-start-date',
    'book-end-date'
  ].forEach(
    id => {
      const element =
        document.getElementById(
          id
        );

      if (
        element &&
        !element.value
      ) {
        element.value =
          today;
      }
    }
  );
}

// ---------------------------------------------------------
// 책등 / 표지 버튼
// ---------------------------------------------------------
function initBookshelfViewControls() {
  const coverButton =
    document.getElementById(
      'btn-cover-view'
    );

  const spineButton =
    document.getElementById(
      'btn-spine-view'
    );

  coverButton?.addEventListener(
    'click',
    () => {
      setBookshelfView(
        'cover'
      );

      if (
        currentTab ===
        'my'
      ) {
        loadUserBooks();
      } else {
        loadPublicBooks();
      }
    }
  );

  spineButton?.addEventListener(
    'click',
    () => {
      setBookshelfView(
        'spine'
      );

      if (
        currentTab ===
        'my'
      ) {
        loadUserBooks();
      } else {
        loadPublicBooks();
      }
    }
  );

  setBookshelfView(
    bookshelfView
  );
}

// ---------------------------------------------------------
// 전역 등록
// ---------------------------------------------------------
window.showView =
  showView;

window.switchTab =
  switchTab;

window.openLoginModal =
  openLoginModal;

window.closeLoginModal =
  closeLoginModal;

window.closeBookDetail =
  closeBookDetail;

window.useCustomTitle =
  useCustomTitle;

window.deleteBook =
  deleteBook;

window.searchBooks =
  searchBooks;

window.selectBook =
  selectBook;

window.setBookshelfView =
  setBookshelfView;

window.refreshLibraryBooks =
  refreshLibraryBooks;

window.showLibrary =
  () =>
    showView(
      'library'
    );

window.showMap =
  () =>
    showView(
      'map'
    );

// ---------------------------------------------------------
// 초기화
// ---------------------------------------------------------
document.addEventListener(
  'DOMContentLoaded',
  () => {
    initDates();

    initReadingProgress();

    initCoverUpload();

    initStarRating();

    initSearch();

    initBookForm();

    initBookshelfViewControls();

    initLibraryEvents();
    initTodayReadingSearch();
        const mapLibraryButton =
      document.getElementById('map-library-button');

    if (mapLibraryButton) {
      mapLibraryButton.addEventListener(
        'click',
        () => {
          showView('library');
        }
      );
    }

   
const mapCafeButton =
  document.getElementById('map-cafe-button');

if (mapCafeButton) {
  mapCafeButton.addEventListener('click', () => {
    window.openAthenaeumRoom('cafe');
  });
}


    const mapHomeButton =
      document.getElementById('map-home-button');

    if (mapHomeButton) {
      mapHomeButton.addEventListener(
        'click',
        () => {
          window.openAthenaeumRoom('home');
        }
      );
    }

    showView(
      'hero'
    );

    initAuth();
    
    
  }
);

// =========================================================
// [오늘의 독서 기록] 전용 독립 검색 로직
// =========================================================

// 1. 검색 실행 함수
async function executeTodayReadingSearch() {
  const input = document.getElementById('reading-book-search-input');
  const resultsContainer = document.getElementById('reading-book-search-results');

  if (!input || !resultsContainer) return;

  const queryText = input.value.trim();
  if (!queryText) {
    alert('검색어를 입력해 주세요.');
    return;
  }

  // 검색 결과 창 열기 및 로딩 표시
  resultsContainer.classList.remove('hidden');
  resultsContainer.innerHTML = '<div class="search-item search-loading">전 세계 도서 검색 중...</div>';

  const targetQuery = ALIAS_MAP[queryText] || queryText;

  try {
    // 기존 검색 API 동시 호출
    const [kakaoResult, googleResult, wikiResult] = await Promise.allSettled([
      fetchKakaoBooks(queryText),
      fetchGoogleBooks(targetQuery),
      fetchWikidataBooks(targetQuery)
    ]);

    const kakaoBooks = kakaoResult.status === 'fulfilled' ? kakaoResult.value : [];
    const googleBooks = googleResult.status === 'fulfilled' ? googleResult.value : [];
    const wikiBooks = wikiResult.status === 'fulfilled' ? wikiResult.value : [];

    const combinedBooks = combineAndFilterResults(kakaoBooks, googleBooks, wikiBooks);

    if (!combinedBooks.length) {
      resultsContainer.innerHTML = `
        <div class="search-item search-no-result">
          <strong>'${escapeHtml(queryText)}'</strong> 검색 결과가 없습니다.
        </div>`;
      return;
    }

    // 결과 렌더링
    resultsContainer.innerHTML = '';
    combinedBooks.forEach(book => {
      const itemEl = document.createElement('button');
      itemEl.type = 'button';
      itemEl.className = 'search-item';
      itemEl.innerHTML = `
        ${
          book.coverUrl
            ? `<img class="search-item-thumb" src="${escapeHtml(book.coverUrl)}" alt="표지">`
            : `<div class="search-item-thumb search-item-no-cover">표지 없음</div>`
        }
        <div class="search-item-info">
          <div class="search-item-title">${escapeHtml(book.title)}</div>
          <div class="search-item-sub">
            ${escapeHtml(book.authors || '저자 미상')}${book.publisher ? ` · ${escapeHtml(book.publisher)}` : ''}
          </div>
        </div>
      `;

      // 선택 시 처리
      itemEl.addEventListener('click', () => {
        applySelectedBookToTodayReading(book);
        resultsContainer.classList.add('hidden');
        document.getElementById('reading-search-panel')?.classList.add('hidden');
      });

      resultsContainer.appendChild(itemEl);
    });

  } catch (error) {
    console.error('독서 기록 검색 오류:', error);
    resultsContainer.innerHTML = '<div class="search-item search-no-result">검색 중 오류가 발생했습니다.</div>';
  }
}

// 2. 검색에서 선택한 책 정보를 화면에 적용하는 함수

async function applySelectedBookToTodayReading(book) {
  if (!currentUser) {
    openLoginModal();
    return;
  }

  try {
    // 이미 내 목록에 있는 책인지 확인 (제목 + 출판사)
    let existing = readingBooksCache.find(b =>
      normalizeTitle(b.title) === normalizeTitle(book.title) &&
      normalizeTitle(b.publisher) === normalizeTitle(book.publisher)
    );

    let bookId = existing?.id;

    if (!bookId) {
      const ref = await addDoc(collection(db, 'books'), {
        userId: currentUser.uid,
        title: book.title,
        author: book.authors || '',
        publisher: book.publisher || '',
        coverUrl: book.coverUrl || '',
        totalPages: Number(book.totalPages || 0),
        ...physicalBookFields(book),
        rating: 5,
        visibility: 'private',
        musicUrl: '',
        review: '',
        startDate: todayISO(),
        endDate: '',
        currentPage: 0,
        readingStatus: true,
        totalReadingSeconds: 0,
        createdAt: new Date().toISOString()
      });
      bookId = ref.id;
    }

    // 목록을 다시 불러온 뒤 방금 책을 선택
    await loadReadingBooks();

    const select = document.getElementById('reading-book-select');
    if (select) {
      select.value = bookId;
      // initReadingProgress의 change 핸들러가 페이지/날짜/진행률을 채워 줌
      select.dispatchEvent(new Event('change'));
    }

    // 선택된 책 안내 영역
    const selectedBox = document.getElementById('selected-reading-book');
    if (selectedBox) {
      selectedBox.classList.remove('empty');
      selectedBox.innerHTML = `
        <span class="selected-reading-book-mark">📖</span>
        <div>
          <strong>${escapeHtml(book.title)}</strong>
          <p>${escapeHtml(book.authors || '저자 미상')}${
            book.publisher ? ' · ' + escapeHtml(book.publisher) : ''
          }</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('읽는 중인 책 등록 실패:', error);
    alert(`책을 등록하지 못했습니다: ${error.message || error}`);
  }
}
function initTodayReadingSearch() {
  const input = document.getElementById('reading-book-search-input');
  // 버튼 id는 HTML에 있는 것에 맞추세요 (아래 후보 중 존재하는 것을 사용)
  const button =
    document.getElementById('btn-reading-book-search') ||
    document.getElementById('reading-book-search-button') ||
    document.getElementById('btn-reading-search');

  if (button && !button.dataset.bound) {
    button.dataset.bound = 'true';
    button.addEventListener('click', executeTodayReadingSearch);
  }

  if (input && !input.dataset.bound) {
    input.dataset.bound = 'true';
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        executeTodayReadingSearch();
      }
    });
  }
}

/* ==========================================
   ATHENAEUM - HOME & CAFE 기능 추가
   기존 app.js 코드 아래에 붙여넣기
   ========================================== */

(() => {
  // 화면 전환 목록에 HOME과 CAFÉ를 추가해
  // 기존 showView 함수를 안전하게 확장한다.
  const originalShowView = window.showView;

  if (typeof originalShowView === 'function') {
    window.showView = function (viewName) {
      originalShowView(viewName);

      if (viewName === 'home' || viewName === 'cafe') {
        document.querySelectorAll(
          '#view-home, #view-cafe'
        ).forEach((view) => {
          view.classList.toggle(
            'hidden',
            view.id !== `view-${viewName}`
          );
        });
      }
    };
  }

  // 기존 화면 전환 함수가 참조하는 목록에
  // 새 화면이 포함되지 않으므로 별도 전환 함수로 보완한다.
  function openRoom(viewName) {
    const allViews = [
      'hero',
      'reading',
      'form',
      'explore',
      'map',
      'library',
      'home',
      'cafe'
    ];

    allViews.forEach((name) => {
      const element = document.getElementById(`view-${name}`);
      if (element) {
        element.classList.toggle('hidden', name !== viewName);
      }
    });

    if (viewName === 'library' && typeof window.showView === 'function') {
      window.showView('library');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 새 화면 안에서 메인 화면으로 돌아가는 버튼과
  // 외부 메뉴에서 호출할 수 있도록 연결한다.
  window.openAthenaeumRoom = openRoom;

  // HOME/CAFÉ 집중 타이머
  let selectedMinutes = 25;
  let remainingSeconds = selectedMinutes * 60;
  let timerInterval = null;
  let isRunning = false;

  const timerDisplays = [
    document.getElementById('home-timer'),
    document.getElementById('cafe-timer')
  ];

  const timerMessages = [
    document.getElementById('home-timer-message'),
    document.getElementById('cafe-timer-message')
  ];

  function renderTimer() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const formatted =
      `${String(minutes).padStart(2, '0')}:` +
      `${String(seconds).padStart(2, '0')}`;

    timerDisplays.forEach((display) => {
      if (display) display.textContent = formatted;
    });
  }

  function setMessage(message) {
    timerMessages.forEach((element) => {
      if (element) element.textContent = message;
    });
  }

  function stopTimer() {
    if (timerInterval !== null) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    isRunning = false;

    document.querySelectorAll(
      '#home-timer-start, #cafe-timer-start'
    ).forEach((button) => {
      button.textContent = '집중 시작';
    });
  }

  function resetTimer() {
    stopTimer();
    remainingSeconds = selectedMinutes * 60;
    renderTimer();
    setMessage('새로운 집중 시간을 준비했어요.');
  }

  function startTimer() {
    if (isRunning) {
      stopTimer();
      setMessage('잠시 멈췄어요. 준비되면 다시 시작해요.');
      return;
    }

    if (remainingSeconds <= 0) {
      remainingSeconds = selectedMinutes * 60;
    }

    isRunning = true;

    document.querySelectorAll(
      '#home-timer-start, #cafe-timer-start'
    ).forEach((button) => {
      button.textContent = '잠시 멈춤';
    });

    setMessage('좋아, 지금은 나에게 집중하는 시간이에요.');

    timerInterval = setInterval(() => {
      remainingSeconds -= 1;
      renderTimer();

      if (remainingSeconds <= 0) {
        stopTimer();
        remainingSeconds = 0;
        renderTimer();
        setMessage('집중 시간이 끝났어요. 수고했어요!');
      }
    }, 1000);
  }

  document.querySelectorAll('[data-focus-minutes]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedMinutes = Number(button.dataset.focusMinutes);

      document.querySelectorAll('[data-focus-minutes]').forEach((item) => {
        item.classList.toggle(
          'selected',
          Number(item.dataset.focusMinutes) === selectedMinutes
        );
      });

      resetTimer();
    });
  });

  document.getElementById('home-timer-start')
    ?.addEventListener('click', startTimer);

  document.getElementById('cafe-timer-start')
    ?.addEventListener('click', startTimer);

  document.getElementById('home-timer-reset')
    ?.addEventListener('click', resetTimer);

  document.getElementById('cafe-timer-reset')
    ?.addEventListener('click', resetTimer);

})();

// CAFE 음료 선택 및 공용 독서방 로직
(() => {
  const cafeView = document.getElementById('view-cafe');
  if (!cafeView) return;

  const menuPaper = cafeView.querySelector('.cafe-menu-paper');
  if (!menuPaper) return;

  // 기존 메뉴판 하단에 입장 버튼과 독서방이 없다면 동적으로 생성하거나 배치합니다.
  // 여기서는 기존 요소를 활용하고 필요한 요소를 주입합니다.
  let footerMsg = document.getElementById('cafe-drink-message');
  if (footerMsg) {
    footerMsg.onclick = null;
    footerMsg.style.cursor = 'default';
    footerMsg.title = '';
  }

  // 입장 버튼이 없다면 메뉴판 아래에 생성
  let enterBtn = document.getElementById('cafe-enter-room');
  if (!enterBtn && footerMsg) {
    enterBtn = document.createElement('button');
    enterBtn.id = 'cafe-enter-room';
    enterBtn.type = 'button';
    enterBtn.className = 'cafe-primary-button';
    enterBtn.disabled = true;
    enterBtn.textContent = '음료를 먼저 골라주세요';
    footerMsg.after(enterBtn);
  }

  // 공용 독서방 영역이 없다면 메뉴판 아래에 생성
  let sharedRoom = document.getElementById('cafe-shared-room');
  if (!sharedRoom && menuPaper) {
    sharedRoom = document.createElement('div');
    sharedRoom.id = 'cafe-shared-room';
    sharedRoom.className = 'cafe-shared-room hidden';
    sharedRoom.innerHTML = `
      <div class="cafe-shared-header">
        <p class="cafe-eyebrow">READING TOGETHER</p>
        <h2>함께 읽는 카페</h2>
        <p>각자의 책을 펼치고, 같은 공간에서 함께 읽어요.</p>
      </div>
      <div class="cafe-my-seat">
        <p id="cafe-my-drink"></p>
        <h3>나의 독서 시간</h3>
        <div id="cafe-shared-clock" class="cafe-shared-clock">00:00:00</div>
        <p id="cafe-shared-status">준비되면 독서를 시작해 주세요.</p>
        <div class="cafe-room-actions">
          <button id="cafe-shared-toggle" class="cafe-primary-button" type="button">독서 시작</button>
          <button id="cafe-shared-leave" class="cafe-secondary-button" type="button">독서방 나가기</button>
        </div>
      </div>
      <section class="cafe-members-section">
        <div class="cafe-members-heading">
          <h3>함께 있는 사람들</h3>
          <span id="cafe-member-count">연결 중</span>
        </div>
        <p id="cafe-room-notice"></p>
        <div id="cafe-member-list" class="cafe-member-grid"></div>
      </section>
    `;
    menuPaper.after(sharedRoom);
  }

  const myDrink = document.getElementById('cafe-my-drink');
  const clock = document.getElementById('cafe-shared-clock');
  const statusText = document.getElementById('cafe-shared-status');
  const toggleButton = document.getElementById('cafe-shared-toggle');
  const leaveButton = document.getElementById('cafe-shared-leave');
  const memberCount = document.getElementById('cafe-member-count');
  const memberList = document.getElementById('cafe-member-list');
  const notice = document.getElementById('cafe-room-notice');

  const dbInstance = window.db;
  const authInstance = window.auth;

  const drinks = {
    americano: '아이스 아메리카노',
    mocha: '카페모카',
    greentea: '그린티 라떼',
    cocoa: '핫초코',
    strawberry: '딸기 라떼'
  };

  let selectedDrink = null;
  let activeSession = null;
  let entering = false;
  let changingStatus = false;
  let members = [];
  let unsubscribeMembers = null;
  let heartbeatTimer = null;
  let displayTimer = null;

  const HEARTBEAT_MS = 30 * 1000;
  const STALE_MS = 2 * 60 * 1000;

  function updateEntryButton() {
    if (!enterBtn) return;
    enterBtn.disabled = !selectedDrink || entering;
    if (entering) {
      enterBtn.textContent = '카페에 입장하는 중…';
    } else if (!selectedDrink) {
      enterBtn.textContent = '음료를 먼저 골라주세요';
    } else if (!authInstance?.currentUser) {
      enterBtn.textContent = '로그인하고 함께 읽기 →';
    } else {
      enterBtn.textContent = '함께 책 읽으러 가기 →';
    }
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  }

})();

  // CAFE 음료 선택 및 공용 독서방 로직 (안전 장치 포함)
(() => {
  const cafeView = document.getElementById('view-cafe');
  if (!cafeView) return;

  const menuPaper = cafeView.querySelector('.cafe-menu-paper');
  if (!menuPaper) return;

  let footerMsg = document.getElementById('cafe-drink-message');
  if (footerMsg) {
    footerMsg.onclick = null;
    footerMsg.style.cursor = 'default';
    footerMsg.title = '';
  }

})();

// CAFE 음료 선택 및 공용 독서방 로직
(() => {
  const cafeView = document.getElementById('view-cafe');
  if (!cafeView) return;

  const menuPaper = cafeView.querySelector('.cafe-menu-paper');
  if (!menuPaper) return;

  const footerMsg = document.getElementById('cafe-drink-message');
  if (footerMsg) {
    footerMsg.onclick = null;
    footerMsg.style.cursor = 'default';
    footerMsg.title = '';
  }

  // 입장 버튼이 HTML에 없으면 동적으로 생성
  let enterBtn = document.getElementById('cafe-enter-room');
  if (!enterBtn && footerMsg) {
    enterBtn = document.createElement('button');
    enterBtn.id = 'cafe-enter-room';
    enterBtn.type = 'button';
    enterBtn.className = 'cafe-primary-button';
    footerMsg.after(enterBtn);
  }

  // 독서방이 HTML에 없으면 동적으로 생성
  let sharedRoom = document.getElementById('cafe-shared-room');
  if (!sharedRoom) {
    sharedRoom = document.createElement('div');
    sharedRoom.id = 'cafe-shared-room';
    sharedRoom.className = 'cafe-shared-room hidden';
    sharedRoom.innerHTML = `
      <div class="cafe-shared-header">
        <p class="cafe-eyebrow">READING TOGETHER</p>
        <h2>함께 읽는 카페</h2>
        <p>각자의 책을 펼치고, 같은 공간에서 함께 읽어요.</p>
      </div>
      <div class="cafe-my-seat">
        <p id="cafe-my-drink"></p>
        <h3>나의 독서 시간</h3>
        <div id="cafe-shared-clock" class="cafe-shared-clock">00:00:00</div>
        <p id="cafe-shared-status">준비되면 독서를 시작해 주세요.</p>
        <div class="cafe-room-actions">
          <button id="cafe-shared-toggle" class="cafe-primary-button" type="button">독서 시작</button>
          <button id="cafe-shared-leave" class="cafe-secondary-button" type="button">독서방 나가기</button>
        </div>
      </div>
      <section class="cafe-members-section">
        <div class="cafe-members-heading">
          <h3>함께 있는 사람들</h3>
          <span id="cafe-member-count">연결 중</span>
        </div>
        <p id="cafe-room-notice"></p>
        <div id="cafe-member-list" class="cafe-member-grid"></div>
      </section>
    `;
    menuPaper.after(sharedRoom);
  }

  const myDrink = document.getElementById('cafe-my-drink');
  const clock = document.getElementById('cafe-shared-clock');
  const statusText = document.getElementById('cafe-shared-status');
  const toggleButton = document.getElementById('cafe-shared-toggle');
  const leaveButton = document.getElementById('cafe-shared-leave');
  const memberCount = document.getElementById('cafe-member-count');
  const memberList = document.getElementById('cafe-member-list');
  const notice = document.getElementById('cafe-room-notice');

  const dbInstance = window.db;
  const authInstance = window.auth;

  const drinks = {
    americano: '아이스 아메리카노',
    mocha: '카페모카',
    greentea: '그린티 라떼',
    cocoa: '핫초코',
    strawberry: '딸기 라떼'
  };

  let selectedDrink = null;
  let activeSession = null;
  let entering = false;
  let changingStatus = false;
  let members = [];
  let unsubscribeMembers = null;
  let heartbeatTimer = null;
  let displayTimer = null;

  const HEARTBEAT_MS = 30 * 1000;
  const STALE_MS = 2 * 60 * 1000;

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function refreshButtonState() {
    const btn = document.getElementById('cafe-enter-room');
    if (!btn) return;

    if (entering) {
      btn.disabled = true;
      btn.textContent = '카페에 입장하는 중…';
    } else if (!selectedDrink) {
      btn.disabled = true;
      btn.textContent = '음료를 먼저 골라주세요';
    } else {
      btn.disabled = false;
      btn.textContent = '함께 책 읽으러 가기 →';
    }
  }

  function formatTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
  }

  function resetRoomUi() {
    if (clock) clock.textContent = '00:00:00';
    if (statusText) statusText.textContent = '준비되면 독서를 시작해 주세요.';
    if (toggleButton) toggleButton.textContent = '독서 시작';
    if (notice) notice.textContent = '같은 취향의 독서가들과 함께해요.';
    if (myDrink) myDrink.textContent = '오늘의 음료 · 선택 전';
    if (memberCount) memberCount.textContent = '연결 중';
    if (memberList) memberList.innerHTML = '';
  }

  function renderMembers() {
    if (!memberList) return;
    const now = Date.now();
    const valid = members.filter(
      (m) => m.updatedAt && now - m.updatedAt.toMillis() < STALE_MS
    );

    if (memberCount) memberCount.textContent = `${valid.length}명 접속 중`;

    memberList.innerHTML = valid.map((m) => {
      const isMe = activeSession && m.id === activeSession.id;
      const add = (m.status === 'reading' && m.startedAt) ? now - m.startedAt.toMillis() : 0;
      const total = (m.elapsedMs || 0) + add;
      return `
        <div class="cafe-member-card ${isMe ? 'is-me' : ''}">
          <strong class="cafe-member-name">${escapeHtml(m.name)}${isMe ? ' (나)' : ''}</strong>
          <p class="cafe-member-detail">${escapeHtml(drinks[m.drink] || '음료')}</p>
          <p class="cafe-member-detail">${m.status === 'reading' ? '📖 독서 중' : '☕ 휴식 중'}</p>
          <span class="cafe-member-time">${formatTime(total)}</span>
        </div>
      `;
    }).join('');
  }

  // 음료 선택
  cafeView.addEventListener('click', (e) => {
    const drinkBtn = e.target.closest('[data-drink]');
    if (!drinkBtn || entering || activeSession) return;

    const drink = drinkBtn.dataset.drink;
    if (!drinks[drink]) return;

    selectedDrink = drink;

    cafeView.querySelectorAll('[data-drink]').forEach((item) => {
      item.classList.toggle('selected', item === drinkBtn);
    });

    if (footerMsg) {
      footerMsg.textContent = `${drinks[drink]}를 골랐어요. 아래 버튼을 눌러 입장하세요!`;
    }

    refreshButtonState();
  });

  // 입장
  document.addEventListener('click', async (e) => {
    const targetBtn = e.target.closest('#cafe-enter-room');
    if (!targetBtn || targetBtn.disabled || entering || activeSession) return;

    const user = authInstance?.currentUser;
    if (!user) {
      if (footerMsg) footerMsg.textContent = '먼저 로그인한 뒤 입장해 주세요.';
      document.getElementById('btn-login-modal')?.click();
      return;
    }

    entering = true;
    refreshButtonState();

    try {
      const sessionRef = doc(collection(dbInstance, 'cafeRooms', 'public', 'sessions'));
      const session = {
        id: sessionRef.id,
        ref: sessionRef,
        uid: user.uid,
        status: 'paused',
        elapsedMs: 0,
        startedAtMs: 0,
        drink: selectedDrink
      };

      await setDoc(sessionRef, {
        uid: user.uid,
        name: user.displayName || '독서가',
        drink: selectedDrink,
        status: 'paused',
        elapsedMs: 0,
        startedAt: null,
        updatedAt: serverTimestamp()
      });

      activeSession = session;
      resetRoomUi();
      menuPaper.classList.add('hidden');
      sharedRoom.classList.remove('hidden');

      if (myDrink) myDrink.textContent = `오늘의 음료 · ${drinks[session.drink]}`;

      unsubscribeMembers = onSnapshot(
        collection(dbInstance, 'cafeRooms', 'public', 'sessions'),
        (snapshot) => {
          // 방금 쓴 serverTimestamp가 null로 보이지 않도록 estimate 사용
          members = snapshot.docs.map((d) => ({
            ...d.data({ serverTimestamps: 'estimate' }),
            id: d.id
          }));
          renderMembers();
        }
      );

      heartbeatTimer = setInterval(() => {
        if (activeSession) {
          updateDoc(activeSession.ref, { updatedAt: serverTimestamp() }).catch(() => {});
        }
      }, HEARTBEAT_MS);

      displayTimer = setInterval(() => {
        if (activeSession) {
          const add = activeSession.status === 'reading'
            ? Date.now() - activeSession.startedAtMs
            : 0;
          if (clock) clock.textContent = formatTime(activeSession.elapsedMs + add);
        }
        renderMembers();
      }, 1000);

    } catch (err) {
      console.error(err);
      if (footerMsg) {
        footerMsg.textContent = `입장에 실패했습니다: ${err?.message || '알 수 없는 오류'}`;
      }
    } finally {
      entering = false;
      refreshButtonState();
    }
  });

  // 독서 시작 / 잠시 쉬기
  toggleButton?.addEventListener('click', async () => {
    if (!activeSession || changingStatus) return;
    changingStatus = true;

    const isReading = activeSession.status === 'reading';
    const add = isReading ? Date.now() - activeSession.startedAtMs : 0;
    const nextElapsed = activeSession.elapsedMs + add;
    const nextStatus = isReading ? 'paused' : 'reading';

    try {
      await updateDoc(activeSession.ref, {
        status: nextStatus,
        elapsedMs: nextElapsed,
        startedAt: isReading ? null : serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      activeSession.status = nextStatus;
      activeSession.elapsedMs = nextElapsed;
      activeSession.startedAtMs = isReading ? 0 : Date.now();

      toggleButton.textContent = nextStatus === 'reading' ? '잠시 쉬기' : '이어서 읽기';
      if (statusText) {
        statusText.textContent = nextStatus === 'reading'
          ? '지금 함께 책을 읽고 있어요.'
          : '잠시 쉬는 중입니다.';
      }
    } catch (err) {
      console.error(err);
      if (statusText) {
        statusText.textContent = `상태 변경에 실패했습니다: ${err?.message || '알 수 없는 오류'}`;
      }
    } finally {
      changingStatus = false;
    }
  });

  // 나가기
  leaveButton?.addEventListener('click', async () => {
    if (activeSession) {
      await deleteDoc(activeSession.ref).catch(() => {});
      if (unsubscribeMembers) unsubscribeMembers();
      unsubscribeMembers = null;
      clearInterval(heartbeatTimer);
      clearInterval(displayTimer);
      activeSession = null;
    }
    sharedRoom.classList.add('hidden');
    menuPaper.classList.remove('hidden');
    selectedDrink = null;
    cafeView.querySelectorAll('[data-drink]').forEach((i) => i.classList.remove('selected'));
    if (footerMsg) footerMsg.textContent = '오늘은 어떤 음료와 함께할까요?';
    resetRoomUi();
    refreshButtonState();
  });

  // 탭을 닫을 때 정리
  window.addEventListener('beforeunload', () => {
    if (activeSession) {
      deleteDoc(activeSession.ref).catch(() => {});
    }
    if (unsubscribeMembers) unsubscribeMembers();
    clearInterval(heartbeatTimer);
    clearInterval(displayTimer);
  });

  resetRoomUi();
  refreshButtonState();
})();
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('libBookInput');
  const submitBtn = document.getElementById('libSubmitBtn');
  const board = document.getElementById('libBoard');

  if (!board) return; // 도서관 화면이 아니면 실행 안 함

  // 로컬 스토리지에서 기록 불러오기
  let libraryRecords = JSON.parse(localStorage.getItem('athenaeum_library_records')) || [];

  const renderRecords = () => {
    board.innerHTML = '';
    
    if (libraryRecords.length === 0) {
      board.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #61554a; font-style: italic;">아직 서재에 기록된 책이 없습니다. 첫 사색을 남겨보세요.</p>';
      return;
    }

    libraryRecords.forEach((record, index) => {
      const card = document.createElement('div');
      card.className = 'lib-item-card';
      card.innerHTML = `
        <div class="lib-item-content">
          <div class="lib-book-title">📖 "${record.title}"</div>
          <div class="lib-user-name">- ${record.author}</div>
        </div>
        <button class="lib-delete-btn" onclick="window.removeLibRecord(${index})">지우기</button>
      `;
      board.appendChild(card);
    });
  };

  // 등록 버튼 클릭 이벤트
  submitBtn.addEventListener('click', () => {
    const title = input.value.trim();
    if (!title) {
      alert('책 제목을 입력해 주세요.');
      return;
    }

    // 로그인된 유저 이름이 있다면 사용, 없으면 '방문자'
    const userName = (window.currentUser && window.currentUser.displayName) 
      ? window.currentUser.displayName 
      : '익명의 사색가';

    libraryRecords.unshift({ title: title, author: userName }); // 최신글이 위로 오게
    localStorage.setItem('athenaeum_library_records', JSON.stringify(libraryRecords));
    
    input.value = '';
    renderRecords();
  });

  // 엔터키 입력 지원
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitBtn.click();
    }
  });

  // 전역 삭제 함수 연결
  window.removeLibRecord = (index) => {
    libraryRecords.splice(index, 1);
    localStorage.setItem('athenaeum_library_records', JSON.stringify(libraryRecords));
    renderRecords();
  };

  renderRecords();
});
// =========================================================
// 도서관 실시간 공유 세션 (Firebase v10 Modular 방식 적용)
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('libStartBtn');
  const stopBtn = document.getElementById('libStopBtn');
  const bookInput = document.getElementById('libCurrentBookInput');
  const timerDisplay = document.getElementById('libTimerDisplay');
  const userGrid = document.getElementById('libActiveUsersGrid');

  if (!startBtn || !userGrid) return;

  let timerInterval = null;
  let secondsElapsed = 0;
  let currentSessionDocId = null;
  let unsubscribeLibrary = null;

  // 타이머 포맷 함수 (HH:MM:SS)
  const formatTime = (totalSeconds) => {
    const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  // 1. 독서 시작 및 Firestore에 실시간 세션 등록 (v10 방식)
  startBtn.addEventListener('click', async () => {
    const bookTitle = bookInput.value.trim();
    if (!bookTitle) {
      alert('지금 읽고 있는 책 제목을 입력해주세요.');
      bookInput.focus();
      return;
    }

    const user = currentUser || auth.currentUser;
    if (!user) {
      alert('로그인이 필요한 기능입니다.');
      openLoginModal();
      return;
    }

    try {
      const sessionsRef = collection(db, 'libraryActiveSessions');
      const docRef = await addDoc(sessionsRef, {
        uid: user.uid,
        userName: user.displayName || '사색가',
        bookTitle: bookTitle,
        startTime: serverTimestamp(),
        duration: 0
      });

      currentSessionDocId = docRef.id;
      bookInput.disabled = true;
      startBtn.disabled = true;
      stopBtn.disabled = false;

      secondsElapsed = 0;
      timerInterval = setInterval(() => {
        secondsElapsed++;
        if (timerDisplay) {
          timerDisplay.textContent = formatTime(secondsElapsed);
        }
      }, 1000);

    } catch (err) {
      console.error('도서관 세션 시작 오류:', err);
      alert('서버 연결에 실패했습니다.');
    }
  });

  // 2. 기록 저장 및 퇴장 (v10 방식의 deleteDoc 사용)
  stopBtn.addEventListener('click', async () => {
    if (!currentSessionDocId) return;

    clearInterval(timerInterval);

    try {
      const sessionDocRef = doc(db, 'libraryActiveSessions', currentSessionDocId);
      await deleteDoc(sessionDocRef);

      alert(`총 ${formatTime(secondsElapsed)} 동안 집중하셨습니다. 기록이 저장되었습니다.`);
      
      currentSessionDocId = null;
      bookInput.disabled = false;
      startBtn.disabled = false;
      stopBtn.disabled = true;
      if (timerDisplay) timerDisplay.textContent = '00:00:00';
      bookInput.value = '';

    } catch (err) {
      console.error('세션 종료 오류:', err);
      alert('세션 종료 중 오류가 발생했습니다.');
    }
  });

  // 3. v10 실시간 리스너(onSnapshot)로 다른 사용자 현황 동기화
  const sessionsCollectionRef = collection(db, 'libraryActiveSessions');
  unsubscribeLibrary = onSnapshot(sessionsCollectionRef, (snapshot) => {
    userGrid.innerHTML = '';

    if (snapshot.empty) {
      userGrid.innerHTML = '<p style="color: #61554a; font-style: italic; grid-column: 1/-1;">현재 서재에 홀로 사색 중인 사용자가 없습니다. 첫 테이프를 끊어보세요.</p>';
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const card = document.createElement('div');
      card.className = 'library-user-card';
      card.innerHTML = `
        <div class="user-name">👤 ${escapeHtml(data.userName)}</div>
        <div class="reading-book">📖 "${escapeHtml(data.bookTitle)}"</div>
        <div class="session-time">집중하는 중...</div>
      `;
      userGrid.appendChild(card);
    });
  }, (error) => {
    console.warn('Library stats 로드 실패:', error);
  });

  // 페이지 이탈 시 세션 정리
  window.addEventListener('beforeunload', () => {
    if (currentSessionDocId) {
      deleteDoc(doc(db, 'libraryActiveSessions', currentSessionDocId)).catch(() => {});
    }
    if (unsubscribeLibrary) {
      unsubscribeLibrary();
    }
  });
});
