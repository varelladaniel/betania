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

function buildNavDropdown(selectId, listVarName, currentSlug) {
  var select = document.getElementById(selectId);
  if (!select) return;
  var list = window[listVarName];
  if (!list || !list.length) return;
  select.innerHTML = '';
  list.forEach(function (item) {
    var opt = document.createElement('option');
    opt.value = item.slug + '.html';
    opt.textContent = item.dataLabel + ' · ' + item.timeLabel + ' — ' + item.teamsLabel;
    if (currentSlug && item.slug === currentSlug) opt.selected = true;
    select.appendChild(opt);
  });
}

function setInfoTab(groupId, tabKey) {
  var nav = document.getElementById(groupId + '-nav');
  var panels = document.getElementById(groupId + '-panels');
  if (!nav || !panels) return;
  nav.querySelectorAll('.info-tab-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabKey);
  });
  panels.querySelectorAll('.info-tab-panel').forEach(function (p) {
    p.classList.toggle('active', p.getAttribute('data-tab') === tabKey);
  });
}

function setMarketTab(groupId, marketKey) {
  var nav = document.getElementById(groupId + '-nav');
  if (!nav) return;
  nav.querySelectorAll('.market-tab-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.getAttribute('data-market') === marketKey);
  });
  document.querySelectorAll('.market-panel[data-group="' + groupId + '"]').forEach(function (p) {
    p.classList.toggle('active', p.getAttribute('data-market') === marketKey);
  });
}

function expandRank(btnEl, tbodyExtraId) {
  var extra = document.getElementById(tbodyExtraId);
  if (!extra) return;
  var expanded = extra.classList.toggle('expanded');
  btnEl.textContent = expanded ? 'Recolher ranking ▲' : 'Expandir ranking (65–70%) ▼';
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

function groupHistoryByDate(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var cards = Array.prototype.slice.call(container.querySelectorAll('.history-card'));
  if (!cards.length) return;

  var order = [];
  var byDate = {};
  cards.forEach(function (card) {
    var m = card.getAttribute('href').match(/(\d{4}-\d{2}-\d{2})/);
    var date = m ? m[1] : 'sem-data';
    if (!byDate[date]) { byDate[date] = []; order.push(date); }
    byDate[date].push(card);
  });

  function cardTimeKey(card) {
    var badge = card.querySelector('.history-date-badge');
    var m = badge && badge.textContent.match(/(\d{1,2}):(\d{2})/);
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 0;
  }
  order.forEach(function (date) {
    byDate[date].sort(function (a, b) { return cardTimeKey(a) - cardTimeKey(b); });
  });

  var mostRecent = order[0];
  var frag = document.createDocumentFragment();
  order.forEach(function (date) {
    var group = document.createElement('section');
    group.className = 'history-date-group';
    if (date !== mostRecent) group.classList.add('collapsed');

    var parts = date.split('-');
    var label = parts.length === 3 ? parts[2] + '/' + parts[1] : date;
    var count = byDate[date].length;

    var toggle = document.createElement('button');
    toggle.className = 'history-date-toggle';
    toggle.innerHTML =
      '<span class="history-date-toggle-label">' + label + '</span>' +
      '<span class="history-date-toggle-count">(' + count + (count === 1 ? ' jogo' : ' jogos') + ')</span>' +
      '<span class="history-date-toggle-icon">▼</span>';
    toggle.addEventListener('click', function () {
      group.classList.toggle('collapsed');
    });

    var grid = document.createElement('div');
    grid.className = 'history-grid';
    byDate[date].forEach(function (card) { grid.appendChild(card); });

    group.appendChild(toggle);
    group.appendChild(grid);
    frag.appendChild(group);
  });

  container.innerHTML = '';
  container.className = '';
  container.appendChild(frag);
}
