/* =========================================================
   Positive Badges – app.js
   ========================================================= */

'use strict';

// ─── State ────────────────────────────────────────────────
let badges = [];
let currentGenre = 'All';
let currentSearch = '';
let pendingImageSrc = null;  // base64 data URL of the image waiting to be saved
let activeBadgeId = null;    // id of the badge currently shown in the detail modal

// ─── DOM refs ─────────────────────────────────────────────
const badgeGrid        = document.getElementById('badge-grid');
const emptyState       = document.getElementById('empty-state');

// Genre picker
const genreBtn         = document.getElementById('genre-btn');
const genreBtnLabel    = document.getElementById('genre-btn-label');
const genrePicker      = document.getElementById('genre-picker');
const genrePickerClose = document.getElementById('genre-picker-close');
const genrePickerList  = document.getElementById('genre-picker-list');
const genreAddBtn      = document.getElementById('genre-add-btn');
const genreAddRow      = document.getElementById('genre-add-row');
const genreAddInput    = document.getElementById('genre-add-input');
const genreAddConfirm  = document.getElementById('genre-add-confirm');

// Search
const searchInput      = document.getElementById('search-input');
const searchSuggestions = document.getElementById('search-suggestions');

// FAB
const fabAddBadge      = document.getElementById('fab-add-badge');

// Add-badge modal
const modalAddBadge    = document.getElementById('modal-add-badge');
const closeAddBadge    = document.getElementById('close-add-badge');
const badgeGenre       = document.getElementById('badge-genre');
const badgeTitle       = document.getElementById('badge-title');
const badgeDesc        = document.getElementById('badge-desc');
const btnGenerate      = document.getElementById('btn-generate');
const generateBtnText  = document.getElementById('generate-btn-text');
const generateSpinner  = document.getElementById('generate-spinner');
const badgeUpload      = document.getElementById('badge-upload');
const previewArea      = document.getElementById('preview-area');
const previewImg       = document.getElementById('preview-img');
const btnDownloadPreview = document.getElementById('btn-download-preview');
const btnAddToCollection = document.getElementById('btn-add-to-collection');

// API key (inline in add-badge modal)
const apiKeyInput      = document.getElementById('api-key-input');

// Detail modal
const modalBadgeDetail = document.getElementById('modal-badge-detail');
const closeBadgeDetail = document.getElementById('close-badge-detail');
const detailImg        = document.getElementById('detail-img');
const detailBadgeTitle = document.getElementById('detail-badge-title');
const detailMeta       = document.getElementById('detail-meta');
const btnPrintBadge    = document.getElementById('btn-print-badge');
const btnShareBadge    = document.getElementById('btn-share-badge');
const btnDeleteBadge   = document.getElementById('btn-delete-badge');

// ─── localStorage helpers ────────────────────────────────
function loadBadges() {
  try {
    const raw = localStorage.getItem('positiveBadges');
    badges = raw ? JSON.parse(raw) : [];
  } catch (e) {
    badges = [];
  }
}

function saveBadges() {
  try {
    localStorage.setItem('positiveBadges', JSON.stringify(badges));
  } catch (e) {
    showToast('Storage full — try deleting an old badge first.');
  }
}

// ─── Genre helpers ───────────────────────────────────────
const DEFAULT_GENRES = [
  { value: 'Running',  label: '🏃 Running'  },
  { value: 'Skills',   label: '⚡ Skills'   },
  { value: 'Learning', label: '📚 Learning' },
  { value: 'School',   label: '🎓 School'   },
  { value: 'Custom',   label: '✨ Custom'   },
];

let customGenres = [];

function loadGenres() {
  try {
    customGenres = JSON.parse(localStorage.getItem('positiveGenres') || '[]');
  } catch(e) { customGenres = []; }
}

function saveGenres() {
  localStorage.setItem('positiveGenres', JSON.stringify(customGenres));
}

function allGenres() {
  return [...DEFAULT_GENRES, ...customGenres];
}

function renderGenrePicker() {
  genrePickerList.innerHTML = '';
  const all = [{ value: 'All', label: '🏅 All Genres' }, ...allGenres()];
  all.forEach(g => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'genre-option' + (currentGenre === g.value ? ' is-selected' : '');
    btn.dataset.genre = g.value;
    btn.dataset.label = g.label;
    btn.textContent = g.label;
    btn.addEventListener('click', () => {
      currentGenre = g.value;
      genreBtnLabel.textContent = g.label;
      genrePicker.classList.remove('is-open');
      genreAddRow.style.display = 'none';
      renderBadges();
      renderSuggestions();
    });
    li.appendChild(btn);
    genrePickerList.appendChild(li);
  });
}

function renderBadgeGenreSelect() {
  badgeGenre.innerHTML = '';
  allGenres().forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.value;
    opt.textContent = g.value;
    badgeGenre.appendChild(opt);
  });
}

function getApiKey() {
  return localStorage.getItem('openaiApiKey') || '';
}

function setApiKey(key) {
  if (key) {
    localStorage.setItem('openaiApiKey', key);
  } else {
    localStorage.removeItem('openaiApiKey');
  }
}

// ─── Toast ───────────────────────────────────────────────
function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 2700);
}

// ─── Render ──────────────────────────────────────────────
function renderBadges() {
  const term = currentSearch.toLowerCase();
  const filtered = badges.filter(b => {
    const matchesGenre = currentGenre === 'All' || b.genre === currentGenre;
    const matchesSearch = !term ||
      b.title.toLowerCase().includes(term) ||
      b.genre.toLowerCase().includes(term);
    return matchesGenre && matchesSearch;
  });

  badgeGrid.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.hidden = false;
    emptyState.querySelector('.empty-sub').innerHTML = term
      ? `No badges match "<strong>${escapeHTML(term)}</strong>"`
      : 'Press the <strong>+</strong> button to add your first achievement!';
    return;
  }

  emptyState.hidden = true;

  filtered.forEach(badge => {
    const card = document.createElement('article');
    card.className = 'badge-card';
    card.setAttribute('role', 'listitem');
    card.dataset.id = badge.id;
    card.innerHTML = `
      <div class="badge-card-img-wrap">
        <img class="badge-card-img" src="${escapeAttr(badge.src)}" alt="${escapeAttr(badge.title)}" loading="lazy" />
      </div>
      <div class="badge-card-body">
        <p class="badge-card-title">${escapeHTML(badge.title)}</p>
        <p class="badge-card-genre">${escapeHTML(badge.genre)}</p>
      </div>
    `;
    card.addEventListener('click', () => openDetailModal(badge.id));
    badgeGrid.appendChild(card);
  });
}

// ─── Escape helpers ──────────────────────────────────────
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

// ─── Genre picker ────────────────────────────────────────
genreBtn.addEventListener('click', () => {
  renderGenrePicker();
  genrePicker.classList.add('is-open');
});

genrePickerClose.addEventListener('click', () => {
  genrePicker.classList.remove('is-open');
  genreAddRow.style.display = 'none';
});

genreAddBtn.addEventListener('click', () => {
  genreAddRow.style.display = 'flex';
  genreAddInput.value = '';
  genreAddInput.focus();
});

function confirmAddGenre() {
  const name = genreAddInput.value.trim();
  if (!name) return;
  if (allGenres().some(g => g.value.toLowerCase() === name.toLowerCase())) {
    showToast('That genre already exists.');
    return;
  }
  const genre = { value: name, label: name };
  customGenres.push(genre);
  saveGenres();
  renderGenrePicker();
  renderBadgeGenreSelect();
  genreAddRow.style.display = 'none';
  showToast(`"${name}" genre added!`);
}

genreAddConfirm.addEventListener('click', confirmAddGenre);
genreAddInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmAddGenre();
});

// ─── Search ──────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  currentSearch = searchInput.value.trim();
  renderBadges();
  renderSuggestions();
});

searchInput.addEventListener('focus', renderSuggestions);

// Hide the dropdown when clicking anywhere outside the search area
document.addEventListener('click', e => {
  if (!e.target.closest('.search-section-inner')) {
    hideSuggestions();
  }
});

// Close the dropdown on Escape
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    hideSuggestions();
    searchInput.blur();
  }
});

// ─── Search suggestions dropdown ─────────────────────────
function matchingBadges() {
  const term = currentSearch.toLowerCase();
  return badges.filter(b => {
    const matchesGenre = currentGenre === 'All' || b.genre === currentGenre;
    const matchesSearch = !term ||
      b.title.toLowerCase().includes(term) ||
      b.genre.toLowerCase().includes(term);
    return matchesGenre && matchesSearch;
  });
}

function hideSuggestions() {
  searchSuggestions.hidden = true;
  searchInput.setAttribute('aria-expanded', 'false');
}

function renderSuggestions() {
  const results = matchingBadges();
  searchSuggestions.innerHTML = '';

  if (badges.length === 0) {
    const li = document.createElement('li');
    li.className = 'search-suggestion-empty';
    li.textContent = 'No badges yet — press + to add your first one!';
    searchSuggestions.appendChild(li);
  } else if (results.length === 0) {
    const li = document.createElement('li');
    li.className = 'search-suggestion-empty';
    li.textContent = `No badges match "${escapeHTML(currentSearch)}"`;
    searchSuggestions.appendChild(li);
  } else {
    results.forEach(badge => {
      const li = document.createElement('li');
      li.className = 'search-suggestion';
      li.setAttribute('role', 'option');
      li.innerHTML = `
        <img class="search-suggestion-thumb" src="${escapeAttr(badge.src)}" alt="" />
        <div class="search-suggestion-text">
          <div class="search-suggestion-title">${escapeHTML(badge.title)}</div>
          <div class="search-suggestion-genre">${escapeHTML(badge.genre)}</div>
        </div>
      `;
      li.addEventListener('mousedown', e => {
        e.preventDefault(); // prevent input blur before click fires
        hideSuggestions();
        openDetailModal(badge.id);
      });
      searchSuggestions.appendChild(li);
    });
  }

  searchSuggestions.hidden = false;
  searchInput.setAttribute('aria-expanded', 'true');
}

// ─── Image compression ───────────────────────────────────
function compressImage(src, maxDim = 400, quality = 0.82) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = src;
  });
}

// ─── Modal helpers ───────────────────────────────────────
function openModal(modal) {
  modal.classList.add('is-open');
}

function closeModal(modal) {
  modal.classList.remove('is-open');
}

// Close modal on overlay click
[modalAddBadge, modalBadgeDetail].forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal(modal);
  });
});

// Close on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    [modalAddBadge, modalBadgeDetail].forEach(m => {
      if (m.classList.contains('is-open')) closeModal(m);
    });
  }
});

// ─── Add Badge modal ─────────────────────────────────────
fabAddBadge.addEventListener('click', openAddBadgeModal);
closeAddBadge.addEventListener('click', () => closeModal(modalAddBadge));

function openAddBadgeModal() {
  badgeGenre.value = 'Running';
  badgeTitle.value = '';
  badgeDesc.value  = '';
  apiKeyInput.value = getApiKey();
  pendingImageSrc  = null;
  previewArea.hidden = true;
  previewImg.src = '';
  btnDownloadPreview.href = '';
  setGenerating(false);
  openModal(modalAddBadge);
}

// ─── AI Image Generation ─────────────────────────────────
function setGenerating(isLoading) {
  btnGenerate.disabled = isLoading;
  generateBtnText.textContent = isLoading ? 'Generating…' : '✨ Generate with AI';
  generateSpinner.hidden = !isLoading;
}

function buildPrompt(title, genre, desc) {
  const descPart = desc.trim()
    ? `Style notes: ${desc.trim()}.`
    : '';
  return `Design a circular achievement merit badge. Achievement: "${title}". Category: ${genre}. ${descPart} The badge should be colorful, bold, and celebratory with clean iconography, a decorative border, and show the achievement theme. Digital art style, white background.`;
}

btnGenerate.addEventListener('click', async () => {
  const title = badgeTitle.value.trim();
  const genre = badgeGenre.value;
  const desc  = badgeDesc.value.trim();
  const apiKey = apiKeyInput.value.trim();
  if (apiKey) setApiKey(apiKey);

  if (!title) {
    showToast('Please describe your achievement first.');
    badgeTitle.focus();
    return;
  }

  if (!apiKey) {
    showToast('Enter your OpenAI API key above to generate with AI.');
    return;
  }

  setGenerating(true);

  const prompt = buildPrompt(title, genre, desc);

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json'
      })
    });

    if (!response.ok) {
      let errMsg = `OpenAI error ${response.status}`;
      try {
        const errData = await response.json();
        if (errData.error && errData.error.message) {
          errMsg = errData.error.message;
        }
      } catch (_) {}
      throw new Error(errMsg);
    }

    const data = await response.json();
    const src = `data:image/png;base64,${data.data[0].b64_json}`;
    const compressed = await compressImage(src);

    showPreview(compressed);
    showToast('Badge generated! Preview below.');

  } catch (err) {
    console.error('Generation error:', err);
    showToast(`Error: ${err.message}`);
  } finally {
    setGenerating(false);
  }
});

// ─── Upload own image ─────────────────────────────────────
badgeUpload.addEventListener('change', () => {
  const file = badgeUpload.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async e => {
    const compressed = await compressImage(e.target.result);
    showPreview(compressed);
    showToast('Image uploaded! Preview below.');
  };
  reader.readAsDataURL(file);
  // Reset the input so the same file can be re-selected later
  badgeUpload.value = '';
});

// ─── Preview ─────────────────────────────────────────────
function showPreview(src) {
  pendingImageSrc = src;
  previewImg.src = src;
  btnDownloadPreview.href = src;
  previewArea.hidden = false;
  // Scroll to preview
  previewArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── Add to collection ────────────────────────────────────
btnAddToCollection.addEventListener('click', () => {
  if (!pendingImageSrc) {
    showToast('No image to save yet.');
    return;
  }

  const title = badgeTitle.value.trim() || 'My Badge';
  const genre = badgeGenre.value;

  const badge = {
    id: Date.now(),
    title,
    genre,
    src: pendingImageSrc,
    date: new Date().toLocaleDateString()
  };

  badges.unshift(badge);
  saveBadges();
  renderBadges();

  closeModal(modalAddBadge);
  showToast(`"${title}" added to your collection!`);
});


// ─── Badge Detail modal ──────────────────────────────────
closeBadgeDetail.addEventListener('click', () => closeModal(modalBadgeDetail));

function openDetailModal(id) {
  const badge = badges.find(b => b.id === id);
  if (!badge) return;

  activeBadgeId = id;
  detailImg.src = badge.src;
  detailImg.alt = badge.title;
  detailBadgeTitle.textContent = badge.title;
  detailMeta.textContent = `${badge.genre} · Earned ${badge.date}`;
  openModal(modalBadgeDetail);
}

btnPrintBadge.addEventListener('click', () => {
  const badge = badges.find(b => b.id === activeBadgeId);
  if (!badge) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>${badge.title}</title><style>*{margin:0;padding:0}body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff}img{max-width:90vmin;max-height:90vmin}</style></head><body><img src="${badge.src}" onload="window.print();window.close();" /></body></html>`);
  win.document.close();
});

btnShareBadge.addEventListener('click', async () => {
  const badge = badges.find(b => b.id === activeBadgeId);
  if (!badge) return;
  try {
    const res = await fetch(badge.src);
    const blob = await res.blob();
    const file = new File([blob], `${badge.title}.jpg`, { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: badge.title, text: `My badge: ${badge.title}`, files: [file] });
    } else if (navigator.share) {
      await navigator.share({ title: badge.title, text: `My badge: ${badge.title}` });
    } else {
      showToast('Sharing not supported on this browser.');
    }
  } catch (err) {
    if (err.name !== 'AbortError') showToast('Could not share — try saving the image first.');
  }
});

btnDeleteBadge.addEventListener('click', () => {
  if (activeBadgeId === null) return;

  const badge = badges.find(b => b.id === activeBadgeId);
  const title = badge ? badge.title : 'Badge';

  badges = badges.filter(b => b.id !== activeBadgeId);
  saveBadges();
  renderBadges();

  closeModal(modalBadgeDetail);
  showToast(`"${title}" deleted.`);
  activeBadgeId = null;
});

// ─── Init ────────────────────────────────────────────────
(function init() {
  loadGenres();
  renderBadgeGenreSelect();
  loadBadges();
  renderBadges();
})();
