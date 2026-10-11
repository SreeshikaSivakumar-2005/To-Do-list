/* ==========================================================================
   TaskFlow — Smart To-Do List
   Vanilla JavaScript, no dependencies. Data is stored in the browser's
   LocalStorage.

   File outline
   1. Constants and state
   2. Small helpers (dates, ids, text)
   3. Storage (load / save / sample data)
   4. Task actions (add, update, toggle, delete, bulk actions)
   5. Filtering and sorting
   6. Rendering (stats, navigation, list)
   7. Dialogs, form validation, toasts
   8. Theme and mobile menu
   9. Event listeners and start-up
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     1. CONSTANTS AND STATE
     ------------------------------------------------------------------------ */
  var STORAGE_KEYS = {
    tasks: 'taskflow.tasks',
    theme: 'taskflow.theme',
    seeded: 'taskflow.seeded' // set once the sample tasks have been offered
  };

  var PRIORITIES = ['low', 'medium', 'high'];
  var CATEGORIES = ['Personal', 'Work', 'Study', 'Shopping'];
  var PRIORITY_RANK = { high: 0, medium: 1, low: 2 }; // lower number sorts first
  var PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

  // The single source of truth for the UI. Render functions only read from it.
  var state = {
    tasks: [],
    filters: { view: 'all', search: '', priority: 'all', category: 'all' },
    sort: 'created',
    editingId: null, // null = the dialog is adding a new task
    lastAddedId: null // used to play a one-off highlight animation
  };

  // Cache DOM references once.
  var $ = function (id) { return document.getElementById(id); };
  var els = {
    taskList: $('taskList'),
    emptyState: $('emptyState'),
    emptyTitle: $('emptyTitle'),
    emptyText: $('emptyText'),
    emptyActions: $('emptyActions'),
    resultCount: $('resultCount'),
    searchInput: $('searchInput'),
    priorityFilter: $('priorityFilter'),
    categoryFilter: $('categoryFilter'),
    sortSelect: $('sortSelect'),
    resetFiltersBtn: $('resetFiltersBtn'),
    addTaskBtn: $('addTaskBtn'),
    todayLabel: $('todayLabel'),
    statTotal: $('statTotal'),
    statPending: $('statPending'),
    statCompleted: $('statCompleted'),
    statOverdue: $('statOverdue'),
    percentText: $('percentText'),
    progressLabel: $('progressLabel'),
    progressBar: $('progressBar'),
    progressFill: $('progressFill'),
    themeToggle: $('themeToggle'),
    themeToggleLabel: $('themeToggleLabel'),
    clearCompletedBtn: $('clearCompletedBtn'),
    removeSamplesBtn: $('removeSamplesBtn'),
    deleteAllBtn: $('deleteAllBtn'),
    sidebar: $('sidebar'),
    scrim: $('scrim'),
    openMenuBtn: $('openMenuBtn'),
    closeMenuBtn: $('closeMenuBtn'),
    taskDialog: $('taskDialog'),
    taskForm: $('taskForm'),
    dialogTitle: $('dialogTitle'),
    dialogCloseBtn: $('dialogCloseBtn'),
    dialogCancelBtn: $('dialogCancelBtn'),
    saveTaskBtn: $('saveTaskBtn'),
    titleInput: $('titleInput'),
    descInput: $('descInput'),
    priorityInput: $('priorityInput'),
    categoryInput: $('categoryInput'),
    dueInput: $('dueInput'),
    titleError: $('titleError'),
    descError: $('descError'),
    dueError: $('dueError'),
    confirmDialog: $('confirmDialog'),
    confirmTitle: $('confirmTitle'),
    confirmText: $('confirmText'),
    confirmOkBtn: $('confirmOkBtn'),
    confirmCancelBtn: $('confirmCancelBtn'),
    toasts: $('toasts')
  };

  /* ------------------------------------------------------------------------
     2. SMALL HELPERS
     ------------------------------------------------------------------------ */

  // Make a unique id. crypto.randomUUID is used when available.
  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  // Turn a Date into 'YYYY-MM-DD' using the user's LOCAL time zone.
  // (toISOString() would use UTC and can show the wrong day.)
  function toDateKey(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function todayKey() {
    return toDateKey(new Date());
  }

  // Return the date key for "today + offset days".
  function dayOffsetKey(offset) {
    var date = new Date();
    date.setDate(date.getDate() + offset);
    return toDateKey(date);
  }

  // Parse 'YYYY-MM-DD' into a local Date at midnight. Returns null if invalid.
  function parseDateKey(key) {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    var parts = key.split('-').map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    // Reject impossible dates like 2026-02-31 (JS would roll them over).
    if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1 || date.getDate() !== parts[2]) {
      return null;
    }
    return date;
  }

  // Whole days between two date keys (b - a).
  function daysBetween(aKey, bKey) {
    var a = parseDateKey(aKey);
    var b = parseDateKey(bKey);
    return Math.round((b - a) / 86400000);
  }

  function formatDate(key) {
    var date = parseDateKey(key);
    if (!date) return '';
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatCreated(isoString) {
    var date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // A task is overdue when it is not completed and its due date is before today.
  function isOverdue(task) {
    return !task.completed && !!task.dueDate && task.dueDate < todayKey();
  }

  // Friendly text for the due date, e.g. "Due tomorrow" or "Overdue by 2 days".
  function dueText(task) {
    if (!task.dueDate) return 'No due date';
    var diff = daysBetween(todayKey(), task.dueDate);
    if (task.completed) return 'Due ' + formatDate(task.dueDate);
    if (diff === 0) return 'Due today';
    if (diff === 1) return 'Due tomorrow';
    if (diff === -1) return 'Overdue by 1 day';
    if (diff < 0) return 'Overdue by ' + Math.abs(diff) + ' days';
    return 'Due ' + formatDate(task.dueDate);
  }

  // Create an element safely. Text is always added with textContent, so
  // anything a user types can never be interpreted as HTML.
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Inline SVG icons. These strings are written by us (never by users), so
  // using innerHTML for them is safe.
  var ICONS = {
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
    tag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1"/></svg>'
  };

  function iconSpan(name) {
    var span = el('span', 'icon');
    span.innerHTML = ICONS[name];
    return span;
  }

  /* ------------------------------------------------------------------------
     3. STORAGE
     ------------------------------------------------------------------------ */

  // Clean one stored object so bad or old data can never break the app.
  // Returns null if the object cannot be used as a task.
  function sanitizeTask(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (!title) return null;

    var created = new Date(raw.createdAt);
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : createId(),
      title: title.slice(0, 80),
      description: typeof raw.description === 'string' ? raw.description.trim().slice(0, 300) : '',
      priority: PRIORITIES.indexOf(raw.priority) !== -1 ? raw.priority : 'medium',
      category: CATEGORIES.indexOf(raw.category) !== -1 ? raw.category : 'Personal',
      dueDate: parseDateKey(raw.dueDate) ? raw.dueDate : '',
      completed: raw.completed === true,
      createdAt: isNaN(created.getTime()) ? new Date().toISOString() : created.toISOString(),
      isSample: raw.isSample === true
    };
  }

  function loadTasks() {
    try {
      var stored = localStorage.getItem(STORAGE_KEYS.tasks);
      if (!stored) return [];
      var parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];

      var seen = {};
      var tasks = [];
      parsed.forEach(function (item) {
        var task = sanitizeTask(item);
        if (!task) return;
        // Guarantee unique ids even if the stored data contains duplicates.
        if (seen[task.id]) task.id = createId();
        seen[task.id] = true;
        tasks.push(task);
      });
      return tasks;
    } catch (error) {
      console.warn('TaskFlow: could not read saved tasks.', error);
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(state.tasks));
      return true;
    } catch (error) {
      console.warn('TaskFlow: could not save tasks.', error);
      showToast('Could not save to this browser. Storage may be full or blocked.', 'error');
      return false;
    }
  }

  function hasBeenSeeded() {
    try { return localStorage.getItem(STORAGE_KEYS.seeded) === '1'; } catch (e) { return true; }
  }

  function markSeeded() {
    try { localStorage.setItem(STORAGE_KEYS.seeded, '1'); } catch (e) { /* ignore */ }
  }

  // Demo tasks with dates relative to today, so overdue / today / upcoming
  // examples are always visible on first launch.
  function buildSampleTasks() {
    var now = new Date();
    function sample(title, description, priority, category, dueOffset, completed, daysAgo) {
      var created = new Date(now.getTime() - daysAgo * 86400000);
      return {
        id: createId(),
        title: title,
        description: description,
        priority: priority,
        category: category,
        dueDate: dueOffset === null ? '' : dayOffsetKey(dueOffset),
        completed: completed,
        createdAt: created.toISOString(),
        isSample: true
      };
    }
    return [
      sample('Submit internship application', 'Attach the updated resume and portfolio link.', 'high', 'Work', -2, false, 5),
      sample('Revise data structures notes', 'Trees, graphs and hashing before the mock test.', 'high', 'Study', 0, false, 3),
      sample('Push TaskFlow to GitHub', 'Create the repository and enable GitHub Pages.', 'medium', 'Work', 2, false, 2),
      sample('Buy groceries', 'Vegetables, rice, milk and fruit.', 'low', 'Shopping', 1, false, 1),
      sample('Call family', '', 'medium', 'Personal', 4, false, 1),
      sample('Practise 3 coding problems', 'One easy, one medium and one hard.', 'medium', 'Study', null, true, 4)
    ];
  }

  function loadSampleTasks() {
    state.tasks = state.tasks.concat(buildSampleTasks());
    markSeeded();
    saveTasks();
    render();
  }

  /* ------------------------------------------------------------------------
     4. TASK ACTIONS
     ------------------------------------------------------------------------ */

  function findTask(id) {
    for (var i = 0; i < state.tasks.length; i++) {
      if (state.tasks[i].id === id) return state.tasks[i];
    }
    return null;
  }

  function addTask(data) {
    var task = {
      id: createId(),
      title: data.title,
      description: data.description,
      priority: data.priority,
      category: data.category,
      dueDate: data.dueDate,
      completed: false,
      createdAt: new Date().toISOString(),
      isSample: false
    };
    state.tasks.push(task);
    state.lastAddedId = task.id;
    saveTasks();
    render();
    showToast('Task added', 'success');
  }

  // Only the form fields change. id, createdAt and completed are preserved.
  function updateTask(id, data) {
    var task = findTask(id);
    if (!task) return;
    task.title = data.title;
    task.description = data.description;
    task.priority = data.priority;
    task.category = data.category;
    task.dueDate = data.dueDate;
    task.isSample = false; // once edited, it is the user's own task
    saveTasks();
    render();
    showToast('Changes saved', 'success');
  }

  function toggleTask(id) {
    var task = findTask(id);
    if (!task) return;
    task.completed = !task.completed;
    saveTasks();
    render();
    showToast(task.completed ? 'Marked as completed' : 'Moved back to active', 'success');
  }

  function deleteTask(id) {
    state.tasks = state.tasks.filter(function (task) { return task.id !== id; });
    saveTasks();
    render();
    showToast('Task deleted', 'success');
  }

  function clearCompleted() {
    var count = state.tasks.filter(function (t) { return t.completed; }).length;
    state.tasks = state.tasks.filter(function (t) { return !t.completed; });
    saveTasks();
    render();
    showToast(count + (count === 1 ? ' completed task cleared' : ' completed tasks cleared'), 'success');
  }

  function removeSamples() {
    state.tasks = state.tasks.filter(function (t) { return !t.isSample; });
    saveTasks();
    render();
    showToast('Sample tasks removed', 'success');
  }

  function deleteAll() {
    state.tasks = [];
    saveTasks();
    render();
    showToast('All tasks deleted', 'success');
  }

  /* ------------------------------------------------------------------------
     5. FILTERING AND SORTING
     All filters are applied together (AND logic): a task must pass the
     view, search, priority and category filters to be shown.
     ------------------------------------------------------------------------ */

  function matchesView(task, view) {
    if (view === 'active') return !task.completed;
    if (view === 'completed') return task.completed;
    if (view === 'overdue') return isOverdue(task);
    return true; // 'all'
  }

  function matchesSearch(task, query) {
    if (!query) return true;
    var haystack = (task.title + ' ' + task.description).toLowerCase();
    return haystack.indexOf(query) !== -1;
  }

  function sortTasks(tasks, sortKey) {
    var sorted = tasks.slice(); // never mutate the original array
    sorted.sort(function (a, b) {
      if (sortKey === 'due') {
        // Tasks without a due date go last.
        if (!a.dueDate && !b.dueDate) return b.createdAt.localeCompare(a.createdAt);
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate) || b.createdAt.localeCompare(a.createdAt);
      }
      if (sortKey === 'priority') {
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
      }
      if (sortKey === 'alpha') {
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      }
      return b.createdAt.localeCompare(a.createdAt); // 'created': newest first
    });
    return sorted;
  }

  function getVisibleTasks() {
    var f = state.filters;
    var query = f.search.trim().toLowerCase();
    var filtered = state.tasks.filter(function (task) {
      return matchesView(task, f.view) &&
        matchesSearch(task, query) &&
        (f.priority === 'all' || task.priority === f.priority) &&
        (f.category === 'all' || task.category === f.category);
    });
    return sortTasks(filtered, state.sort);
  }

  function hasActiveFilters() {
    var f = state.filters;
    return f.view !== 'all' || f.search.trim() !== '' || f.priority !== 'all' || f.category !== 'all';
  }

  function resetFilters() {
    state.filters = { view: 'all', search: '', priority: 'all', category: 'all' };
    els.searchInput.value = '';
    els.priorityFilter.value = 'all';
    els.categoryFilter.value = 'all';
    render();
  }

  /* ------------------------------------------------------------------------
     6. RENDERING
     ------------------------------------------------------------------------ */

  function renderStats() {
    var total = state.tasks.length;
    var completed = state.tasks.filter(function (t) { return t.completed; }).length;
    var overdue = state.tasks.filter(isOverdue).length;
    var pending = total - completed;
    var percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    els.statTotal.textContent = total;
    els.statPending.textContent = pending;
    els.statCompleted.textContent = completed;
    els.statOverdue.textContent = overdue;

    els.percentText.textContent = percent + '%';
    els.progressFill.style.width = percent + '%';
    els.progressBar.setAttribute('aria-valuenow', String(percent));
    els.progressLabel.textContent = total === 0
      ? 'Add a task to start tracking progress'
      : completed + ' of ' + total + (total === 1 ? ' task is done' : ' tasks are done');

    // Counts shown beside each navigation item
    var counts = { all: total, active: pending, completed: completed, overdue: overdue };
    document.querySelectorAll('[data-count]').forEach(function (node) {
      node.textContent = counts[node.getAttribute('data-count')];
    });

    // Contextual manage buttons
    els.removeSamplesBtn.hidden = !state.tasks.some(function (t) { return t.isSample; });
  }

  function renderViewButtons() {
    document.querySelectorAll('[data-view]').forEach(function (btn) {
      var active = btn.getAttribute('data-view') === state.filters.view;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function createTaskItem(task) {
    var overdue = isOverdue(task);
    var li = el('li', 'task task--' + task.priority);
    if (task.completed) li.classList.add('is-completed');
    if (overdue) li.classList.add('is-overdue');
    if (task.id === state.lastAddedId) li.classList.add('is-new');
    li.setAttribute('data-id', task.id);

    // Checkbox
    var check = el('input', 'task__check');
    check.type = 'checkbox';
    check.checked = task.completed;
    check.setAttribute('data-action', 'toggle');
    check.setAttribute('aria-label', (task.completed ? 'Mark as active: ' : 'Mark as completed: ') + task.title);

    // Main text
    var body = el('div', 'task__body');
    body.appendChild(el('h3', 'task__title', task.title));
    if (task.description) body.appendChild(el('p', 'task__desc', task.description));

    // Meta row
    var meta = el('div', 'task__meta');
    meta.appendChild(el('span', 'badge badge--' + task.priority, PRIORITY_LABEL[task.priority] + ' priority'));

    var cat = el('span', 'meta-item');
    cat.appendChild(iconSpan('tag'));
    cat.appendChild(document.createTextNode(task.category));
    meta.appendChild(cat);

    var due = el('span', 'meta-item meta-item--due');
    due.appendChild(iconSpan('calendar'));
    due.appendChild(document.createTextNode(dueText(task)));
    meta.appendChild(due);

    meta.appendChild(el('span', 'meta-item meta-item--created', 'Created ' + formatCreated(task.createdAt)));
    body.appendChild(meta);

    // Action buttons
    var actions = el('div', 'task__actions');
    var editBtn = el('button', 'icon-btn');
    editBtn.type = 'button';
    editBtn.setAttribute('data-action', 'edit');
    editBtn.setAttribute('aria-label', 'Edit task: ' + task.title);
    editBtn.appendChild(iconSpan('edit'));

    var deleteBtn = el('button', 'icon-btn icon-btn--danger');
    deleteBtn.type = 'button';
    deleteBtn.setAttribute('data-action', 'delete');
    deleteBtn.setAttribute('aria-label', 'Delete task: ' + task.title);
    deleteBtn.appendChild(iconSpan('trash'));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(check);
    li.appendChild(body);
    li.appendChild(actions);
    return li;
  }

  function renderEmptyState(visibleCount) {
    els.emptyActions.textContent = '';

    if (visibleCount > 0) {
      els.emptyState.hidden = true;
      return;
    }
    els.emptyState.hidden = false;

    if (state.tasks.length === 0) {
      els.emptyTitle.textContent = 'No tasks yet';
      els.emptyText.textContent = 'Add your first task, or load a few samples to see how TaskFlow works.';

      var addBtn = el('button', 'btn btn--primary', 'Add a task');
      addBtn.type = 'button';
      addBtn.addEventListener('click', function () { openTaskDialog(null); });

      var sampleBtn = el('button', 'btn btn--ghost', 'Load sample tasks');
      sampleBtn.type = 'button';
      sampleBtn.addEventListener('click', loadSampleTasks);

      els.emptyActions.appendChild(addBtn);
      els.emptyActions.appendChild(sampleBtn);
    } else {
      els.emptyTitle.textContent = 'No tasks match';
      els.emptyText.textContent = 'Try a different search or clear the filters to see all your tasks.';

      var resetBtn = el('button', 'btn btn--ghost', 'Clear filters');
      resetBtn.type = 'button';
      resetBtn.addEventListener('click', resetFilters);
      els.emptyActions.appendChild(resetBtn);
    }
  }

  function renderList() {
    var visible = getVisibleTasks();
    els.taskList.textContent = ''; // remove old items

    var fragment = document.createDocumentFragment();
    visible.forEach(function (task) { fragment.appendChild(createTaskItem(task)); });
    els.taskList.appendChild(fragment);

    state.lastAddedId = null; // the highlight plays only once

    renderEmptyState(visible.length);

    if (state.tasks.length === 0) {
      els.resultCount.textContent = '';
    } else {
      els.resultCount.textContent = 'Showing ' + visible.length + ' of ' + state.tasks.length +
        (state.tasks.length === 1 ? ' task' : ' tasks');
    }
    els.resetFiltersBtn.disabled = !hasActiveFilters();
  }

  function render() {
    renderStats();
    renderViewButtons();
    renderList();
  }

  /* ------------------------------------------------------------------------
     7. DIALOGS, FORM VALIDATION AND TOASTS
     ------------------------------------------------------------------------ */

  function clearFormErrors() {
    [els.titleInput, els.descInput, els.dueInput].forEach(function (input) {
      input.removeAttribute('aria-invalid');
    });
    els.titleError.textContent = '';
    els.descError.textContent = '';
    els.dueError.textContent = '';
  }

  function showFieldError(input, errorEl, message) {
    input.setAttribute('aria-invalid', 'true');
    errorEl.textContent = message;
  }

  // Open the dialog for a new task (id = null) or to edit an existing one.
  function openTaskDialog(id) {
    clearFormErrors();
    state.editingId = id;
    var task = id ? findTask(id) : null;

    if (id && !task) return; // task vanished; do nothing

    if (task) {
      els.dialogTitle.textContent = 'Edit task';
      els.saveTaskBtn.textContent = 'Save changes';
      els.titleInput.value = task.title;
      els.descInput.value = task.description;
      els.priorityInput.value = task.priority;
      els.categoryInput.value = task.category;
      els.dueInput.value = task.dueDate;
    } else {
      els.dialogTitle.textContent = 'New task';
      els.saveTaskBtn.textContent = 'Add task';
      els.taskForm.reset();
      els.priorityInput.value = 'medium';
      els.categoryInput.value = 'Personal';
    }

    els.taskDialog.showModal();
    els.titleInput.focus();
  }

  function closeTaskDialog() {
    if (els.taskDialog.open) els.taskDialog.close();
  }

  // Check the form. Returns the clean data, or null if something is invalid.
  function validateForm() {
    clearFormErrors();
    var title = els.titleInput.value.trim();
    var description = els.descInput.value.trim();
    var dueDate = els.dueInput.value;
    var firstInvalid = null;

    if (!title) {
      showFieldError(els.titleInput, els.titleError, 'Enter a title for the task.');
      firstInvalid = firstInvalid || els.titleInput;
    } else if (title.length > 80) {
      showFieldError(els.titleInput, els.titleError, 'Keep the title to 80 characters or fewer.');
      firstInvalid = firstInvalid || els.titleInput;
    }

    if (description.length > 300) {
      showFieldError(els.descInput, els.descError, 'Keep the description to 300 characters or fewer.');
      firstInvalid = firstInvalid || els.descInput;
    }

    if (dueDate && !parseDateKey(dueDate)) {
      showFieldError(els.dueInput, els.dueError, 'Enter a valid date.');
      firstInvalid = firstInvalid || els.dueInput;
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return null;
    }

    var priority = PRIORITIES.indexOf(els.priorityInput.value) !== -1 ? els.priorityInput.value : 'medium';
    var category = CATEGORIES.indexOf(els.categoryInput.value) !== -1 ? els.categoryInput.value : 'Personal';

    return { title: title, description: description, priority: priority, category: category, dueDate: dueDate };
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    var data = validateForm();
    if (!data) return;

    if (state.editingId) {
      updateTask(state.editingId, data);
    } else {
      addTask(data);
    }
    closeTaskDialog();
  }

  // A reusable confirmation dialog. `onConfirm` runs only if the user agrees.
  var pendingConfirm = null;

  function askConfirm(options) {
    els.confirmTitle.textContent = options.title;
    els.confirmText.textContent = options.message;
    els.confirmOkBtn.textContent = options.confirmLabel || 'Delete';
    pendingConfirm = options.onConfirm;
    els.confirmDialog.showModal();
    els.confirmCancelBtn.focus(); // safest default for destructive actions
  }

  function closeConfirm() {
    pendingConfirm = null;
    if (els.confirmDialog.open) els.confirmDialog.close();
  }

  // Toast notifications. Messages are added with textContent (safe).
  function showToast(message, type) {
    var toast = el('div', 'toast toast--' + (type || 'info'), message);
    els.toasts.appendChild(toast);
    // Keep the screen tidy: at most 3 toasts at once.
    while (els.toasts.children.length > 3) els.toasts.removeChild(els.toasts.firstChild);

    setTimeout(function () {
      toast.classList.add('is-leaving');
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 250);
    }, 2800);
  }

  /* ------------------------------------------------------------------------
     8. THEME AND MOBILE MENU
     ------------------------------------------------------------------------ */

  function applyTheme(theme, save) {
    document.documentElement.setAttribute('data-theme', theme);
    var isDark = theme === 'dark';
    els.themeToggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    els.themeToggleLabel.textContent = isDark ? 'Light mode' : 'Dark mode';
    if (save) {
      try { localStorage.setItem(STORAGE_KEYS.theme, theme); } catch (e) { /* ignore */ }
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark', true);
  }

  function openMenu() {
    els.sidebar.classList.add('is-open');
    els.scrim.hidden = false;
    els.openMenuBtn.setAttribute('aria-expanded', 'true');
    els.closeMenuBtn.focus();
  }

  function closeMenu() {
    if (!els.sidebar.classList.contains('is-open')) return;
    els.sidebar.classList.remove('is-open');
    els.scrim.hidden = true;
    els.openMenuBtn.setAttribute('aria-expanded', 'false');
    els.openMenuBtn.focus();
  }

  /* ------------------------------------------------------------------------
     9. EVENT LISTENERS AND START-UP
     ------------------------------------------------------------------------ */

  function bindEvents() {
    // Add task / dialog
    els.addTaskBtn.addEventListener('click', function () { openTaskDialog(null); });
    els.taskForm.addEventListener('submit', handleFormSubmit);
    els.dialogCancelBtn.addEventListener('click', closeTaskDialog);
    els.dialogCloseBtn.addEventListener('click', closeTaskDialog);

    // Clicking the dark backdrop (outside the dialog box) closes the dialogs.
    [els.taskDialog, els.confirmDialog].forEach(function (dialog) {
      dialog.addEventListener('mousedown', function (event) {
        if (event.target === dialog) dialog.close();
      });
    });
    els.confirmDialog.addEventListener('close', function () { pendingConfirm = null; });

    els.confirmCancelBtn.addEventListener('click', closeConfirm);
    els.confirmOkBtn.addEventListener('click', function () {
      var action = pendingConfirm;
      closeConfirm();
      if (typeof action === 'function') action();
    });

    // One listener for every task button (event delegation)
    els.taskList.addEventListener('click', function (event) {
      var target = event.target.closest('[data-action]');
      if (!target) return;
      var item = target.closest('.task');
      if (!item) return;
      var id = item.getAttribute('data-id');
      var action = target.getAttribute('data-action');

      if (action === 'toggle') {
        toggleTask(id);
      } else if (action === 'edit') {
        openTaskDialog(id);
      } else if (action === 'delete') {
        var task = findTask(id);
        if (!task) return;
        askConfirm({
          title: 'Delete this task?',
          message: '"' + task.title + '" will be removed permanently.',
          confirmLabel: 'Delete task',
          onConfirm: function () { deleteTask(id); }
        });
      }
    });

    // View buttons (sidebar and mobile tabs share data-view)
    document.querySelectorAll('[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.filters.view = btn.getAttribute('data-view');
        render();
        if (els.sidebar.classList.contains('is-open')) closeMenu();
      });
    });

    // Search, filters and sorting
    els.searchInput.addEventListener('input', function () {
      state.filters.search = els.searchInput.value;
      render();
    });
    els.priorityFilter.addEventListener('change', function () {
      state.filters.priority = els.priorityFilter.value;
      render();
    });
    els.categoryFilter.addEventListener('change', function () {
      state.filters.category = els.categoryFilter.value;
      render();
    });
    els.sortSelect.addEventListener('change', function () {
      state.sort = els.sortSelect.value;
      render();
    });
    els.resetFiltersBtn.addEventListener('click', resetFilters);

    // Manage actions
    els.themeToggle.addEventListener('click', toggleTheme);

    els.clearCompletedBtn.addEventListener('click', function () {
      var count = state.tasks.filter(function (t) { return t.completed; }).length;
      if (count === 0) {
        showToast('There are no completed tasks to clear', 'info');
        return;
      }
      askConfirm({
        title: 'Clear completed tasks?',
        message: count + (count === 1 ? ' completed task' : ' completed tasks') + ' will be removed permanently.',
        confirmLabel: 'Clear completed',
        onConfirm: clearCompleted
      });
      closeMenu();
    });

    els.removeSamplesBtn.addEventListener('click', function () {
      askConfirm({
        title: 'Remove sample tasks?',
        message: 'Only the demo tasks are removed. Tasks you created stay.',
        confirmLabel: 'Remove samples',
        onConfirm: removeSamples
      });
      closeMenu();
    });

    els.deleteAllBtn.addEventListener('click', function () {
      if (state.tasks.length === 0) {
        showToast('There are no tasks to delete', 'info');
        return;
      }
      askConfirm({
        title: 'Delete all tasks?',
        message: 'All ' + state.tasks.length + ' tasks will be removed permanently. This cannot be undone.',
        confirmLabel: 'Delete everything',
        onConfirm: deleteAll
      });
      closeMenu();
    });

    // Mobile menu
    els.openMenuBtn.addEventListener('click', openMenu);
    els.closeMenuBtn.addEventListener('click', closeMenu);
    els.scrim.addEventListener('click', closeMenu);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMenu();
    });

    // Keep "overdue" accurate if the tab stays open past midnight.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        els.todayLabel.textContent = formatLongToday();
        render();
      }
    });
  }

  function formatLongToday() {
    return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function init() {
    // Theme: the inline script in <head> already set data-theme.
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light', false);

    // Tasks: load saved data, or offer samples on the very first visit.
    state.tasks = loadTasks();
    if (state.tasks.length === 0 && !hasBeenSeeded()) {
      state.tasks = buildSampleTasks();
      markSeeded();
      saveTasks();
    }

    els.todayLabel.textContent = formatLongToday();
    bindEvents();
    render();
  }

  init();
})();
