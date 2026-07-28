function setWindow(tableId, n) {
  var table = document.getElementById(tableId);
  if (!table) return;
  table.querySelectorAll('tbody tr[data-rank]').forEach(function (row) {
    var rank = parseInt(row.getAttribute('data-rank'), 10);
    row.style.display = rank <= n ? '' : 'none';
  });
  var group = document.getElementById(tableId + '-toggle');
  if (group) {
    group.querySelectorAll('button').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-n') === String(n));
    });
  }
}

function setAvgWindow(tableId, n) {
  var table = document.getElementById(tableId);
  if (!table) return;
  table.querySelectorAll('[data-5]').forEach(function (cell) {
    cell.textContent = cell.getAttribute('data-' + n);
  });
  var group = document.getElementById(tableId + '-toggle');
  if (group) {
    group.querySelectorAll('button').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-n') === String(n));
    });
  }
}

function toggleRow(rowId) {
  var row = document.getElementById(rowId);
  if (!row) return;
  var isHidden = row.style.display === 'none' || !row.style.display;
  row.style.display = isHidden ? 'table-row' : 'none';
  var btn = document.querySelector('[data-toggle-target="' + rowId + '"]');
  if (btn) btn.textContent = isHidden ? 'Ocultar jogos' : 'Ver jogos';
}

function setQuarterTips(groupId, q) {
  var container = document.getElementById(groupId);
  if (!container) return;
  container.querySelectorAll('[data-q]').forEach(function (el) {
    el.style.display = el.getAttribute('data-q') === String(q) ? '' : 'none';
  });
  var toggle = document.getElementById(groupId + '-toggle');
  if (toggle) {
    toggle.querySelectorAll('button').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-q') === String(q));
    });
  }
}
