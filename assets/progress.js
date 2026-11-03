// Reader progress and preferences. All state lives under one localStorage key and is keyed by
// stable manifest IDs. Storage can throw in private windows, so every access is guarded.
(function () {
  'use strict';
  var KEY = 'principal-system-design-curriculum:v1';
  var STATUSES = ['in-progress', 'complete'];
  var memory = null;

  function blank() { return { version: 1, theme: 'system', topics: {}, lastVisited: null }; }
  function load() {
    if (memory) return memory;
    try {
      var parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
      memory = parsed && typeof parsed === 'object' ? Object.assign(blank(), parsed) : blank();
    } catch (e) { memory = blank(); }
    return memory;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(load())); } catch (e) { /* in-memory only */ } }

  window.CurriculumProgress = {
    KEY: KEY,
    get: load,
    status: function (id) { var t = load().topics[id]; return t ? t.status : 'not-started'; },
    setStatus: function (id, status) {
      var s = load();
      if (status === 'not-started') delete s.topics[id];
      else s.topics[id] = { status: status, updatedAt: new Date().toISOString() };
      save();
    },
    visit: function (id) { load().lastVisited = id; save(); },
    setTheme: function (theme) { load().theme = theme; save(); },
    resetAll: function () { var theme = load().theme; memory = blank(); memory.theme = theme; save(); },
    exportJson: function () { return JSON.stringify(load(), null, 2); },
    // Accepts only known IDs and known statuses so a hand-edited file cannot corrupt state.
    importJson: function (text, knownIds) {
      var data = JSON.parse(text);
      if (!data || typeof data.topics !== 'object') throw new Error('The file has no "topics" object.');
      var next = blank(), skipped = 0;
      next.theme = load().theme;
      Object.keys(data.topics).forEach(function (id) {
        var t = data.topics[id];
        if (knownIds.indexOf(id) >= 0 && t && STATUSES.indexOf(t.status) >= 0) next.topics[id] = { status: t.status, updatedAt: String(t.updatedAt || '') };
        else skipped++;
      });
      if (knownIds.indexOf(data.lastVisited) >= 0) next.lastVisited = data.lastVisited;
      memory = next; save();
      return { imported: Object.keys(next.topics).length, skipped: skipped };
    }
  };
})();
