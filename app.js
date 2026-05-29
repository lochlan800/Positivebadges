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
const hintBanner       = document.getElementById('hint-banner');
const hintDismiss      = document.getElementById('hint-dismiss');

// Genre select + search
const genreSelect      = document.getElementById('genre-select');
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

// Settings modal
const modalSettings    = document.getElementById('modal-settings');
const btnOpenSettings  = document.getElementById('btn-open-settings');
const closeSettings    = document.getElementById('close-settings');
const apiKeyInput      = document.getElementById('api-key-input');
const btnSaveSettings  = document.getElementById('btn-save-settings');
const btnClearSettings = document.getElementById('btn-clear-settings');

// Detail modal
const modalBadgeDetail = document.getElementById('modal-badge-detail');
const closeBadgeDetail = document.getElementById('close-badge-detail');
const detailImg        = document.getElementById('detail-img');
const detailBadgeTitle = document.getElementById('detail-badge-title');
const detailMeta       = document.getElementById('detail-meta');
const btnDownloadDetail = document.getElementById('btn-download-detail');
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
  localStorage.setItem('positiveBadges', JSON.stringify(badges));
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

// ─── Genre select ────────────────────────────────────────
genreSelect.addEventListener('change', () => {
  currentGenre = genreSelect.value;
  renderBadges();
  renderSuggestions();
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

// ─── Modal helpers ───────────────────────────────────────
function openModal(modal) {
  modal.hidden = false;
  // Trap focus on the first focusable element
  const firstFocusable = modal.querySelector('button, input, select, textarea, a[href]');
  if (firstFocusable) firstFocusable.focus();
}

function closeModal(modal) {
  modal.hidden = true;
}

// Close modal on overlay click
[modalAddBadge, modalSettings, modalBadgeDetail].forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal(modal);
  });
});

// Close on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    [modalAddBadge, modalSettings, modalBadgeDetail].forEach(m => {
      if (!m.hidden) closeModal(m);
    });
  }
});

// ─── Add Badge modal ─────────────────────────────────────
fabAddBadge.addEventListener('click', openAddBadgeModal);
closeAddBadge.addEventListener('click', () => closeModal(modalAddBadge));

function openAddBadgeModal() {
  // Reset form
  badgeGenre.value = 'Running';
  badgeTitle.value = '';
  badgeDesc.value  = '';
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
  const apiKey = getApiKey();

  if (!title) {
    showToast('Please describe your achievement first.');
    badgeTitle.focus();
    return;
  }

  if (!apiKey) {
    showToast('Add your OpenAI API key in Settings first.');
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
    const b64 = data.data[0].b64_json;
    const src = `data:image/png;base64,${b64}`;

    showPreview(src);
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
  reader.onload = e => {
    showPreview(e.target.result);
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

// ─── Settings modal ──────────────────────────────────────
btnOpenSettings.addEventListener('click', openSettingsModal);
closeSettings.addEventListener('click', () => closeModal(modalSettings));

function openSettingsModal() {
  apiKeyInput.value = getApiKey();
  openModal(modalSettings);
}

btnSaveSettings.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  setApiKey(key);
  closeModal(modalSettings);
  showToast(key ? 'API key saved!' : 'API key cleared.');
  updateHintBanner();
});

btnClearSettings.addEventListener('click', () => {
  apiKeyInput.value = '';
  setApiKey('');
  showToast('API key cleared.');
  updateHintBanner();
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
  btnDownloadDetail.href = badge.src;
  btnDownloadDetail.download = `${badge.title.replace(/[^a-z0-9]/gi, '_')}.png`;

  openModal(modalBadgeDetail);
}

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

// ─── Hint banner ─────────────────────────────────────────
function updateHintBanner() {
  const dismissed = sessionStorage.getItem('hintDismissed') === 'true';
  hintBanner.hidden = !!getApiKey() || dismissed;
}

hintDismiss.addEventListener('click', () => {
  hintBanner.hidden = true;
  sessionStorage.setItem('hintDismissed', 'true');
});

// ─── Init ────────────────────────────────────────────────
(function init() {
  loadBadges();
  renderBadges();
  updateHintBanner();
})();
