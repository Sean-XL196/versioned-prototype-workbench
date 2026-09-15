(function () {
  var search = document.getElementById('search');
  var statusFilter = document.getElementById('status-filter');
  var rows = document.getElementById('rows');
  var empty = document.getElementById('empty-state');

  function statusLabel(status) {
    return status === 'Ready' ? '可处理' : status === 'Blocked' ? '已阻塞' : status;
  }

  function filteredRecords() {
    var query = search.value.trim().toLowerCase();
    var status = statusFilter.value;
    return window.PAGE_FIXTURES.filter(function (item) {
      return (!query || item.id.toLowerCase().includes(query)) && (!status || item.status === status);
    });
  }

  function render() {
    var records = filteredRecords();
    rows.innerHTML = records.map(function (item) {
      return '<tr><td><span class="record-id">' + item.id + '<small>' + item.owner + '</small></span></td><td><span class="status-cell" data-status="' + item.status + '">' + statusLabel(item.status) + '</span></td><td class="amount">' + item.amount.toLocaleString() + '</td></tr>';
    }).join('');
    rows.closest('table').hidden = records.length === 0;
    empty.hidden = records.length !== 0;
  }

  document.getElementById('metric-total').textContent = window.PAGE_FIXTURES.length;
  document.getElementById('metric-ready').textContent = window.PAGE_FIXTURES.filter(function (item) { return item.status === 'Ready'; }).length;
  document.getElementById('metric-blocked').textContent = window.PAGE_FIXTURES.filter(function (item) { return item.status === 'Blocked'; }).length;
  search.addEventListener('input', render);
  statusFilter.addEventListener('change', render);
  document.getElementById('reset-filters').addEventListener('click', function () { search.value = ''; statusFilter.value = ''; render(); search.focus(); });
  document.getElementById('secondary-action').addEventListener('click', function () {
    var content = ['记录编号,状态,金额'].concat(filteredRecords().map(function (item) { return [item.id, statusLabel(item.status), item.amount].join(','); })).join('\n');
    var url = URL.createObjectURL(new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' }));
    var link = document.createElement('a');
    link.href = url;
    link.download = '原型记录.csv';
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    window.PrototypeShell.notify('已按当前筛选结果生成 CSV 文件。', 'success');
  });
  document.getElementById('primary-action').addEventListener('click', function () {
    var blocked = filteredRecords().some(function (item) { return item.status === 'Blocked'; });
    window.PrototypeShell.notify(blocked ? '当前结果中存在已阻塞记录，处理后才能完成操作。' : '已完成当前结果集的操作。', blocked ? 'danger' : 'success');
  });
  render();
}());
