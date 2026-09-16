window.PrototypeShell = {
  notify: function notify(message, tone) {
    var el = document.getElementById('notice');
    if (!el) return;
    el.textContent = message;
    el.dataset.tone = tone || 'info';
  }
};
