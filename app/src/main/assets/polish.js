(() => {
  const haptic = (style='light') => {
    try { if (window.Android?.haptic) Android.haptic(style); } catch (_) {}
  };

  function ensureToastRoot() {
    let root = document.getElementById('toastRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toastRoot';
      root.className = 'toast-root';
      document.body.appendChild(root);
    }
    return root;
  }

  window.showToast = function(message, tone='neutral', timeout=2600) {
    const root = ensureToastRoot();
    const el = document.createElement('div');
    el.className = 'app-toast ' + tone;
    el.innerHTML = '<span class="toast-dot"></span><span></span>';
    el.lastElementChild.textContent = String(message || '');
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 220);
    }, timeout);
  };

  const network = document.createElement('div');
  network.id = 'networkBanner';
  network.className = 'network-banner hidden';
  document.body.appendChild(network);

  function updateNetwork() {
    if (navigator.onLine) {
      network.classList.add('hidden');
      return;
    }
    network.textContent =
      currentLang === 'uk' ? 'Немає мережі · показуємо кешовані дані' :
      currentLang === 'ru' ? 'Нет сети · показываем кэшированные данные' :
      'Offline · showing cached data';
    network.classList.remove('hidden');
  }

  window.addEventListener('online', () => {
    updateNetwork();
    showToast(
      currentLang === 'uk' ? 'З’єднання відновлено' :
      currentLang === 'ru' ? 'Соединение восстановлено' :
      'Connection restored',
      'success'
    );
  });
  window.addEventListener('offline', updateNetwork);
  updateNetwork();

  document.addEventListener('pointerdown', (ev) => {
    const btn = ev.target.closest('button,.chip,.feature-card,.resource-card,.story-bubble,.story-add');
    if (!btn || btn.disabled) return;
    haptic(btn.classList.contains('sos') || btn.classList.contains('dashboard-sos') ? 'strong' : 'light');

    if (btn.matches('button,.chip,.feature-card,.resource-card')) {
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'tap-ripple';
      const size = Math.max(rect.width, rect.height) * 1.15;
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (ev.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (ev.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 520);
    }
  }, {passive:true});

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      document.querySelectorAll('.sheet.open').forEach(x => x.classList.remove('open'));
      document.getElementById('storyViewer')?.classList.add('hidden');
    }
  });

  const originalPage = window.page;
  if (typeof originalPage === 'function') {
    window.page = function(name, btn) {
      originalPage(name, btn);
      requestAnimationFrame(() => {
        const active = document.getElementById('p-' + name);
        if (active) {
          active.classList.remove('page-enter');
          void active.offsetWidth;
          active.classList.add('page-enter');
        }
      });
    };
  }

  const originalSetLanguage = window.setLanguage;
  if (typeof originalSetLanguage === 'function') {
    window.setLanguage = function(lang) {
      originalSetLanguage(lang);
      updateNetwork();
    };
  }

  document.documentElement.classList.add('polished-ui');
})();