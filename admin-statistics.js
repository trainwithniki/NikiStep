(function () {
  'use strict';
  let selectedMonth = '';
  let sortMode = 'visits';
  let rules = { aliases: [], ignored: [], configured: false };
  let busy = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const token = value => encodeURIComponent(String(value ?? ''));
  const fromToken = value => decodeURIComponent(String(value ?? ''));
  const nameKey = value => String(value || '').normalize('NFKC').trim().toLocaleLowerCase('bg-BG').replace(/\s+/g, ' ').slice(0, 140);
  const phoneKey = value => String(value || '').replace(/\D/g, '').slice(-24);
  const formatPhone = value => {
    const phone = phoneKey(value);
    if (!phone) return '';
    if (phone.length === 9 && phone.startsWith('0')) return `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`;
    if (phone.length === 12 && phone.startsWith('359')) return `+359 ${phone.slice(3, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
    return `+${phone}`;
  };
  const sourceKeyFor = person => {
    const phone = phoneKey(person.phone);
    const name = nameKey(person.name);
    // A profile is a concrete written registration. Equal names or equal phones
    // are deliberately shown as a review suggestion instead of silently merging.
    return phone.length >= 7 ? `phone:${phone}|name:${name}` : `name:${name}`;
  };
  const sourcePairKey = (first, second) => [String(first), String(second)].sort().join('|');
  const sessionDateTime = session => new Date(`${session.date}T${String(session.time || '00:00').slice(0, 5)}:00`);
  const isCompleted = session => sessionDateTime(session).getTime() <= Date.now();

  function monthLabel(key) {
    const [year, month] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('bg-BG', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
  }

  function ensureStatisticsSection() {
    if (document.getElementById('statisticsView')) return;
    document.getElementById('paymentsTab').insertAdjacentHTML('afterend', '<button class="adminSectionTab" id="statisticsTab" type="button" onclick="switchAdminSection(\'statistics\')">Статистика</button>');
    document.getElementById('paymentsView').insertAdjacentHTML('afterend', `
      <section class="statisticsView" id="statisticsView" aria-label="Статистика на посещенията">
        <div class="statisticsHeader"><div><h2>Статистика</h2><p>Посещенията са от проведени тренировки и изключват отписаните.</p></div><button class="statisticsRefresh" type="button" onclick="loadAdminStatistics(true)">Обнови</button></div>
        <div class="statisticsMonthBar"><button type="button" onclick="moveStatisticsMonth(-1)" aria-label="Предишен месец">‹</button><select id="statisticsMonth" onchange="selectStatisticsMonth(this.value)" aria-label="Месец"></select><button type="button" onclick="moveStatisticsMonth(1)" aria-label="Следващ месец">›</button></div>
        <div class="statisticsSetup" id="statisticsSetup" hidden>За да се запазват обединяванията между устройства, изпълнете миграцията <strong>20260908_add_attendance_statistics.sql</strong>.</div>
        <details class="statisticsManualMerge" id="statisticsManualMerge"><summary>Обедини хора ръчно</summary><div class="statisticsManualMergeBody"><p>Избери конкретния човек, който е използвал различно име, и към кой профил да се отнесе. При наличен телефон правилото важи само за този човек.</p><select id="statisticsMergeSource" aria-label="Човек с различно име"></select><select id="statisticsMergeTarget" aria-label="Обедини към"></select><button type="button" onclick="mergeStatisticsFromSelects()">Обедини</button></div></details>
        <div class="statisticsSummary" id="statisticsSummary"></div>
        <div class="statisticsPeople" id="statisticsPeople"></div>
        <details class="statisticsMatches" id="statisticsMatches"><summary>Провери възможни съвпадения <span id="statisticsMatchCount"></span></summary><div id="statisticsMatchList"></div></details>
        <details class="statisticsRules" id="statisticsRules"><summary>Запазени решения за имена</summary><div id="statisticsRuleList"></div></details>
      </section>`);
  }

  function attendanceRecords() {
    return (window.loadData?.().sessions || [])
      .filter(isCompleted)
      .flatMap(session => (session.registrations || [])
        .filter(person => !person.cancelledAt && String(person.name || '').trim())
        .map(person => ({
          month: String(session.date).slice(0, 7), sessionId: session.id,
          name: String(person.name).trim(), phone: String(person.phone || ''),
          sourceKey: sourceKeyFor(person)
        })));
  }

  function availableMonths(records) {
    return [...new Set(records.map(item => item.month))].sort().reverse();
  }

  function identities(records) {
    const items = new Map();
    records.forEach(record => {
      const item = items.get(record.sourceKey) || { key: record.sourceKey, names: new Map(), phone: phoneKey(record.phone), count: 0, months: new Set() };
      item.names.set(record.name, (item.names.get(record.name) || 0) + 1);
      item.count++;
      item.months.add(record.month);
      items.set(record.sourceKey, item);
    });
    for (const item of items.values()) {
      item.name = [...item.names.entries()].sort((a, b) => b[0].length - a[0].length || b[1] - a[1] || a[0].localeCompare(b[0], 'bg'))[0]?.[0] || 'Без име';
    }
    return items;
  }

  function resolveIdentity(sourceKey) {
    const bySource = new Map((rules.aliases || []).map(item => [item.alias_key, item]));
    let key = sourceKey;
    for (let index = 0; index < 10; index++) {
      const phoneOnlyKey = key.startsWith('phone:') ? key.split('|')[0] : '';
      const rule = bySource.get(key) || (phoneOnlyKey ? bySource.get(phoneOnlyKey) : null);
      if (!rule) break;
      const next = String(rule.canonical_key || `legacy:${nameKey(rule.canonical_name)}`);
      if (next === key) break;
      key = next;
    }
    return key;
  }

  function labelForIdentity(item) {
    const phone = item?.phone || '';
    return `${item?.name || 'Без име'}${phone ? ` · ${formatPhone(phone)}` : ''}`;
  }

  function canonicalLabel(key, sourceIdentities) {
    const identity = sourceIdentities.get(key);
    if (identity) return identity.name;
    if (key.startsWith('phone:') && !key.includes('|')) {
      const phoneIdentity = [...sourceIdentities.values()].find(item => item.key.startsWith(`${key}|`));
      if (phoneIdentity) return phoneIdentity.name;
    }
    const direct = (rules.aliases || []).find(item => item.alias_key === key);
    return direct?.canonical_name || 'Без име';
  }

  function levenshtein(first, second) {
    const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
    for (let row = 1; row <= first.length; row++) {
      let diagonal = previous[0];
      previous[0] = row;
      for (let col = 1; col <= second.length; col++) {
        const old = previous[col];
        previous[col] = Math.min(previous[col] + 1, previous[col - 1] + 1, diagonal + (first[row - 1] === second[col - 1] ? 0 : 1));
        diagonal = old;
      }
    }
    return previous[second.length];
  }

  function matchReason(first, second) {
    if (first.phone && second.phone && first.phone === second.phone) return 'Съвпада телефон';
    if (nameKey(first.name) === nameKey(second.name)) return 'Съвпада име';
    const firstText = nameKey(first.name).replace(/[^\p{L}\p{N}]/gu, '');
    const secondText = nameKey(second.name).replace(/[^\p{L}\p{N}]/gu, '');
    if (Math.min(firstText.length, secondText.length) >= 4 && firstText[0] === secondText[0] && levenshtein(firstText, secondText) <= 1) return 'Сходни имена';
    return '';
  }

  function similarPairs(sourceIdentities, currentSourceKeys) {
    const identitiesList = [...sourceIdentities.values()];
    const ignored = new Set((rules.ignored || []).map(item => item.pair_key));
    const result = [];
    for (let firstIndex = 0; firstIndex < identitiesList.length; firstIndex++) {
      for (let secondIndex = firstIndex + 1; secondIndex < identitiesList.length; secondIndex++) {
        const first = identitiesList[firstIndex], second = identitiesList[secondIndex];
        if (resolveIdentity(first.key) === resolveIdentity(second.key)) continue;
        if (!currentSourceKeys.has(first.key) && !currentSourceKeys.has(second.key)) continue;
        if (ignored.has(sourcePairKey(first.key, second.key))) continue;
        const reason = matchReason(first, second);
        if (reason) result.push({ first, second, reason });
      }
    }
    return result.slice(0, 20);
  }

  function renderManualMerge(sourceIdentities) {
    const choices = [...sourceIdentities.values()].sort((a, b) => a.name.localeCompare(b.name, 'bg'));
    const options = choices.map(item => `<option value="${esc(item.key)}">${esc(labelForIdentity(item))}</option>`).join('');
    document.getElementById('statisticsMergeSource').innerHTML = `<option value="">Избери човек</option>${options}`;
    document.getElementById('statisticsMergeTarget').innerHTML = `<option value="">Отнеси към…</option>${options}`;
    document.getElementById('statisticsManualMerge').hidden = choices.length < 2;
  }

  function renderRules(sourceIdentities) {
    const aliases = rules.aliases || [];
    const ignored = rules.ignored || [];
    const aliasRows = aliases.map(item => `<div class="statisticsRule"><span>${esc(item.alias_name)} → <strong>${esc(item.canonical_name)}</strong></span><button type="button" onclick="removeStatisticAlias('${token(item.alias_key)}')">Премахни</button></div>`);
    const ignoredRows = ignored.map(item => `<div class="statisticsRule"><span>${esc(item.first_name)} и ${esc(item.second_name)} · различни хора</span><button type="button" onclick="removeStatisticIgnoredPair('${token(item.pair_key)}')">Премахни</button></div>`);
    document.getElementById('statisticsRuleList').innerHTML = [...aliasRows, ...ignoredRows].join('') || '<div class="statisticsEmpty">Няма запазени решения.</div>';
    void sourceIdentities;
  }

  function render() {
    const records = attendanceRecords();
    const months = availableMonths(records);
    if (!selectedMonth || !months.includes(selectedMonth)) selectedMonth = months[0] || '';
    document.getElementById('statisticsMonth').innerHTML = months.map(month => `<option value="${esc(month)}" ${month === selectedMonth ? 'selected' : ''}>${esc(monthLabel(month))}</option>`).join('') || '<option value="">Няма проведени тренировки</option>';

    const sourceIdentities = identities(records);
    renderManualMerge(sourceIdentities);
    const current = records.filter(item => item.month === selectedMonth);
    const aggregated = new Map();
    current.forEach(record => {
      const canonicalKey = resolveIdentity(record.sourceKey);
      const item = aggregated.get(canonicalKey) || { key: canonicalKey, name: canonicalLabel(canonicalKey, sourceIdentities), count: 0, names: new Set(), phones: new Set(), sources: new Set() };
      item.count++;
      item.names.add(record.name);
      if (phoneKey(record.phone)) item.phones.add(phoneKey(record.phone));
      item.sources.add(record.sourceKey);
      aggregated.set(canonicalKey, item);
    });
    const people = [...aggregated.values()].sort((a, b) => sortMode === 'name'
      ? a.name.localeCompare(b.name, 'bg') || b.count - a.count
      : b.count - a.count || a.name.localeCompare(b.name, 'bg'));
    document.getElementById('statisticsSummary').innerHTML = `<div class="statisticsMetric"><span>Посещения</span><strong>${current.length}</strong></div><div class="statisticsMetric"><span>Различни хора</span><strong>${people.length}</strong></div><div class="statisticsMetric"><span>Тренировки</span><strong>${new Set(current.map(item => item.sessionId)).size}</strong></div>`;
    document.getElementById('statisticsPeople').innerHTML = '<div class="statisticsPeopleTitle"><span>Посещения по име</span><label class="statisticsSort">Подреди <select onchange="selectStatisticsSort(this.value)" aria-label="Подреди статистиката"><option value="visits" ' + (sortMode === 'visits' ? 'selected' : '') + '>По посещения</option><option value="name" ' + (sortMode === 'name' ? 'selected' : '') + '>По име</option></select></label></div>' + (people.length
      ? people.map((person, index) => `<div class="statisticsPerson"><span class="statisticsPersonNo">${index + 1}.</span><div class="statisticsPersonName"><strong>${esc(person.name)}</strong>${person.phones?.size ? `<small class="statisticsPersonPhone">${esc([...person.phones].map(formatPhone).join(' · '))}</small>` : ''}${person.names.size > 1 ? `<small>Обединени имена: ${esc([...person.names].join(', '))}</small>` : ''}</div><div class="statisticsVisits"><strong>${person.count}</strong></div></div>`).join('')
      : '<div class="statisticsEmpty">Няма посещения за този месец.</div>');

    const pairs = similarPairs(sourceIdentities, new Set(current.map(item => item.sourceKey)));
    document.getElementById('statisticsMatchCount').textContent = `(${pairs.length})`;
    document.getElementById('statisticsMatches').hidden = !pairs.length;
    document.getElementById('statisticsMatchList').innerHTML = pairs.map(pair => `<div class="statisticsMatch"><div class="statisticsMatchQuestion"><span class="statisticsMatchReason">${esc(pair.reason)}</span> „${esc(labelForIdentity(pair.first))}“ и „${esc(labelForIdentity(pair.second))}“ един и същ човек ли са?</div><div class="statisticsMatchActions"><button class="merge" type="button" onclick="mergeStatisticPeople('${token(pair.second.key)}','${token(pair.first.key)}')">Обедини като „${esc(pair.first.name)}“</button><button class="merge" type="button" onclick="mergeStatisticPeople('${token(pair.first.key)}','${token(pair.second.key)}')">Обедини като „${esc(pair.second.name)}“</button><button class="separate" type="button" onclick="ignoreStatisticPeople('${token(pair.first.key)}','${token(pair.second.key)}')">Различни хора</button></div></div>`).join('');
    document.getElementById('statisticsSetup').hidden = rules.configured;
    renderRules(sourceIdentities);
  }

  async function reloadRules() {
    const result = await window.nikiAdmin.statisticsNameRules();
    rules = !result.error ? { aliases: result.aliases || [], ignored: result.ignored || [], configured: result.configured !== false } : { aliases: [], ignored: [], configured: false };
  }

  async function mergePeople(sourceKey, targetKey) {
    const sourceIdentities = identities(attendanceRecords());
    const source = sourceIdentities.get(sourceKey), target = sourceIdentities.get(targetKey);
    if (!source || !target || source.key === target.key) return window.showToast?.('Избери два различни профила.');
    const result = await window.nikiAdmin.saveStatisticsAlias(source.key, source.name, target.name, target.key);
    if (result.error) return window.showToast?.('Обединяването не беше запазено. Изпълнете SQL миграцията.');
    window.showToast?.(`„${source.name}“ е отнесен към „${target.name}“.`);
    await window.loadAdminStatistics(true);
  }

  window.loadAdminStatistics = async function (force = false) {
    if (busy && !force) return;
    busy = true;
    await reloadRules();
    busy = false;
    render();
  };
  window.selectStatisticsMonth = value => { selectedMonth = value; render(); };
  window.selectStatisticsSort = value => { sortMode = value === 'name' ? 'name' : 'visits'; render(); };
  window.moveStatisticsMonth = step => {
    const months = availableMonths(attendanceRecords());
    const index = months.indexOf(selectedMonth);
    const next = Math.min(months.length - 1, Math.max(0, index - step));
    if (months[next]) { selectedMonth = months[next]; render(); }
  };
  window.mergeStatisticsFromSelects = () => mergePeople(document.getElementById('statisticsMergeSource').value, document.getElementById('statisticsMergeTarget').value);
  window.mergeStatisticPeople = (sourceKey, targetKey) => mergePeople(fromToken(sourceKey), fromToken(targetKey));
  window.ignoreStatisticPeople = async function (firstKey, secondKey) {
    const identitiesBySource = identities(attendanceRecords());
    const first = identitiesBySource.get(fromToken(firstKey)), second = identitiesBySource.get(fromToken(secondKey));
    if (!first || !second) return;
    const result = await window.nikiAdmin.ignoreStatisticsPair(sourcePairKey(first.key, second.key), first.name, second.name);
    if (result.error) return window.showToast?.('Решението не беше запазено.');
    await window.loadAdminStatistics(true);
  };
  window.removeStatisticAlias = async function (aliasKey) {
    const result = await window.nikiAdmin.removeStatisticsAlias(fromToken(aliasKey));
    if (result.error) return window.showToast?.('Обединяването не беше премахнато.');
    window.showToast?.('Обединяването е премахнато.');
    await window.loadAdminStatistics(true);
  };
  window.removeStatisticIgnoredPair = async function (pair) {
    const result = await window.nikiAdmin.removeStatisticsIgnoredPair(fromToken(pair));
    if (result.error) return window.showToast?.('Решението не беше премахнато.');
    await window.loadAdminStatistics(true);
  };
  window.initializeAdminStatistics = function () {
    ensureStatisticsSection();
    let wanted = '';
    try { wanted = localStorage.getItem('nikiAdminActiveSection'); } catch (_) {}
    if (wanted === 'statistics') window.switchAdminSection('statistics');
  };
})();
