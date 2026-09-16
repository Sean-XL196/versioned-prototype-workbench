(function () {
  var sidebar = document.querySelector('.wb-sidebar');
  var menuButton = document.querySelector('.wb-menu-button');
  var pageButtons = Array.prototype.slice.call(document.querySelectorAll('.wb-page-button'));
  var pages = Array.prototype.slice.call(document.querySelectorAll('.wb-page'));

  function activatePage(key, updateHash) {
    var target = pages.find(function (item) { return item.dataset.pageKey === key; }) || pages[0];
    if (!target) return;
    pages.forEach(function (item) { item.classList.toggle('is-active', item === target); });
    pageButtons.forEach(function (item) {
      if (item.dataset.pageKey === target.dataset.pageKey) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    if (updateHash) history.replaceState(null, '', '#' + encodeURIComponent(target.dataset.pageKey));
    if (sidebar) sidebar.classList.remove('is-open');
  }

  function activateTab(page, tabName) {
    var tabs = Array.prototype.slice.call(page.querySelectorAll('.wb-tab'));
    var panels = Array.prototype.slice.call(page.querySelectorAll('.wb-tab-panel'));
    tabs.forEach(function (tab) { tab.setAttribute('aria-selected', String(tab.dataset.tab === tabName)); });
    panels.forEach(function (panel) { panel.classList.toggle('is-active', panel.dataset.panel === tabName); });
  }

  function activateDocumentMode(panel, requestedMode) {
    if (!panel) return;
    var mode = requestedMode === 'snapshot' ? 'snapshot' : 'change';
    panel.dataset.documentMode = mode;
    panel.querySelectorAll('.wb-document-mode-button').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.documentMode === mode));
    });
    panel.querySelectorAll('.wb-document').forEach(function (documentView) {
      documentView.hidden = documentView.dataset.documentMode !== mode;
    });
    var selectedVersion = panel.querySelector('.wb-version-view:not([hidden])');
    var selectedDocument = selectedVersion && selectedVersion.querySelector('.wb-document[data-document-mode="' + mode + '"]');
    var download = panel.querySelector('[data-download-selected]');
    if (download && selectedDocument) {
      download.dataset.download = selectedDocument.id;
      download.dataset.filename = selectedDocument.dataset.filename;
      download.textContent = selectedDocument.dataset.downloadLabel;
    }
  }

  function activateVersion(select) {
    var panel = select.closest('.wb-tab-panel');
    if (!panel) return;
    panel.querySelectorAll('.wb-version-view').forEach(function (view) {
      var active = view.dataset.version === select.value;
      view.hidden = !active;
    });
    activateDocumentMode(panel, panel.dataset.documentMode || 'change');
  }

  pageButtons.forEach(function (button) {
    button.addEventListener('click', function () { activatePage(button.dataset.pageKey, true); });
  });
  pages.forEach(function (item) {
    item.querySelectorAll('.wb-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { activateTab(item, tab.dataset.tab); });
    });
    item.querySelectorAll('.wb-version-select').forEach(function (select) {
      select.addEventListener('change', function () { activateVersion(select); });
      activateVersion(select);
    });
    item.querySelectorAll('.wb-document-mode-button').forEach(function (button) {
      button.addEventListener('click', function () {
        activateDocumentMode(button.closest('.wb-tab-panel'), button.dataset.documentMode);
      });
    });
  });
  document.querySelectorAll('[data-download]').forEach(function (button) {
    button.addEventListener('click', function () {
      var source = document.getElementById(button.dataset.download);
      if (!source) return;
      var blob = new Blob([source.textContent], { type: 'text/markdown;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = button.dataset.filename || 'specification.md';
      link.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  });
  if (menuButton) menuButton.addEventListener('click', function () {
    var open = sidebar.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && sidebar) sidebar.classList.remove('is-open');
  });

  var requested = decodeURIComponent(location.hash.slice(1));
  activatePage(requested || (pages[0] && pages[0].dataset.pageKey), false);
}());
