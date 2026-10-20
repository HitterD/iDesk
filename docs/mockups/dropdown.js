// Shared body-mounted prototype controls. No network or ticket persistence.
(function () {
  'use strict';
  const EDGE = 12, GAP = 8, MENU_WIDTH = 272, MAX_HEIGHT = 380;
  let active = null, sequence = 0;
  function node(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function icon(name) {
    const el = node('i'); el.dataset.lucide = name; el.setAttribute('aria-hidden', 'true'); return el;
  }
  function restore(trigger) {
    const target = trigger?.id ? document.getElementById(trigger.id) : trigger;
    if (target?.isConnected) target.focus({ preventScroll: true });
  }
  function close(focus = true) {
    if (!active) return;
    const { trigger, pop } = active;
    active = null; pop.remove(); trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-controls');
    if (focus) restore(trigger);
  }
  function position() {
    if (!active) return;
    const { trigger, pop } = active;
    if (!trigger.isConnected) return close(false);
    const vv = window.visualViewport;
    const width = vv ? vv.width : innerWidth, height = vv ? vv.height : innerHeight;
    const vx = vv ? vv.offsetLeft : 0, vy = vv ? vv.offsetTop : 0;
    const rect = trigger.getBoundingClientRect();
    pop.style.width = `${Math.min(Math.max(rect.width, MENU_WIDTH), width - EDGE * 2)}px`;
    const below = height + vy - rect.bottom - GAP - EDGE, above = rect.top - vy - GAP - EDGE;
    const flip = below < Math.min(pop.scrollHeight, MAX_HEIGHT) && above > below;
    pop.style.maxHeight = `${Math.max(0, Math.min(MAX_HEIGHT, flip ? above : below))}px`;
    const box = pop.getBoundingClientRect();
    pop.style.left = `${Math.max(vx + EDGE, Math.min(rect.left, vx + width - box.width - EDGE))}px`;
    pop.style.top = `${Math.max(vy + EDGE, Math.min(flip ? rect.top - GAP - box.height : rect.bottom + GAP, vy + height - box.height - EDGE))}px`;
  }
  function focusOption(index) {
    if (!active.items.length) return;
    const next = (index + active.items.length) % active.items.length;
    active.items.forEach((item, i) => { item.tabIndex = i === next ? 0 : -1; });
    active.items[next].focus(); active.items[next].scrollIntoView({ block: 'nearest' });
  }
  function menuKeys(event) {
    if (!active) return;
    const index = active.items.indexOf(document.activeElement);
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === 'Tab') close(false);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusOption(index < 0 ? (event.key === 'ArrowDown' ? 0 : active.items.length - 1) : index + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Home' && index >= 0) { event.preventDefault(); focusOption(0); }
    else if (event.key === 'End' && index >= 0) { event.preventDefault(); focusOption(active.items.length - 1); }
    else if (event.key === 'Enter' && index < 0 && active.items.length) { event.preventDefault(); active.items[0].click(); }
  }
  function paintOption(opt, current, config) {
    const selected = opt.value === current, button = node('button', 'dd-option');
    button.type = 'button'; button.tabIndex = -1;
    button.setAttribute('role', config.actions ? 'menuitem' : 'menuitemradio');
    if (!config.actions) button.setAttribute('aria-checked', String(selected));
    if (opt.icon) button.append(icon(opt.icon));
    else if (opt.color) { const dot = node('span', 'dd-dot'); dot.style.backgroundColor = opt.color; button.append(dot); }
    const copy = node('span', 'dd-copy'); copy.append(node('span', '', opt.label));
    if (opt.detail) copy.append(node('small', '', opt.detail));
    button.append(copy);
    if (selected && !config.actions) button.append(icon('check'));
    button.disabled = !!opt.disabled;
    const trigger = active.trigger;
    button.onclick = () => {
      close(); config.onSelect(opt.value, opt);
      queueMicrotask(() => { if (!document.querySelector('dialog[open]')) restore(trigger); });
    };
    return button;
  }
  function paintOptions(config, query) {
    const { list } = active; list.replaceChildren(); active.items = [];
    const current = typeof config.value === 'function' ? config.value() : config.value;
    const options = typeof config.options === 'function' ? config.options() : config.options;
    options.filter((opt) => `${opt.label} ${opt.detail || ''}`.toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id'))).forEach((opt) => {
      const button = paintOption(opt, current, config);
      list.append(button); if (!opt.disabled) active.items.push(button);
    });
    if (!list.children.length) list.append(node('p', 'dd-empty', 'Tidak ditemukan. Coba kata lain.'));
    if (active.items.length) (active.items.find((item) => item.getAttribute('aria-checked') === 'true') || active.items[0]).tabIndex = 0;
    window.lucide?.createIcons(); position();
  }
  function open(trigger, config, last = false) {
    if (active?.trigger === trigger) return close();
    close(false);
    const pop = node('div', 'dd-popover'), heading = node('div', 'dd-heading', config.title || 'Pilih nilai');
    pop.id = `dd-${++sequence}`; pop.setAttribute('role', 'dialog');
    heading.id = `${pop.id}-title`; pop.setAttribute('aria-labelledby', heading.id); pop.append(heading);
    const list = node('div', 'dd-options'); list.setAttribute('role', 'menu'); list.setAttribute('aria-label', config.title || 'Pilihan');
    active = { trigger, pop, list, items: [] };
    if (config.search) {
      const label = node('label', 'dd-search'); label.append(icon('search'));
      const search = node('input'); search.type = 'search'; search.placeholder = config.search;
      search.setAttribute('aria-label', config.search); search.autocomplete = 'off';
      search.oninput = () => paintOptions(config, search.value); label.append(search); pop.append(label);
      active.search = search;
    }
    pop.append(list); pop.addEventListener('keydown', menuKeys); document.body.append(pop);
    trigger.setAttribute('aria-expanded', 'true'); trigger.setAttribute('aria-controls', pop.id);
    paintOptions(config, '');
    if (active.search) active.search.focus();
    else focusOption(last ? active.items.length - 1 : Math.max(0, active.items.findIndex((item) => item.getAttribute('aria-checked') === 'true')));
  }
  function bind(trigger, config) {
    if (!trigger) return;
    trigger.type = 'button'; trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-expanded', 'false');
    if (config.title) trigger.setAttribute('aria-label', config.title);
    trigger.onclick = (event) => { event.stopPropagation(); open(trigger, config); };
    trigger.onkeydown = (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); open(trigger, config, event.key === 'ArrowUp'); }
    };
  }
  function reasonField(form) {
    const label = node('label', 'demo-reason', 'Alasan perubahan PIC'), input = node('textarea');
    input.required = true; input.minLength = 3; input.maxLength = 500; input.rows = 3;
    input.placeholder = 'Jelaskan alasan pengalihan (min. 3 karakter)'; label.append(input); form.append(label);
    input.oninput = () => input.setCustomValidity('');
    return input;
  }
  function confirm({ title, description, reason = false, confirmLabel = 'Konfirmasi' }) {
    close(false);
    const previous = document.activeElement, dialog = node('dialog', 'demo-dialog');
    const form = node('form'), titleEl = node('h2', '', title), desc = node('p', '', description);
    titleEl.id = `dialog-title-${++sequence}`; desc.id = `dialog-desc-${sequence}`;
    dialog.setAttribute('aria-labelledby', titleEl.id); dialog.setAttribute('aria-describedby', desc.id);
    form.append(titleEl, desc); const input = reason ? reasonField(form) : null;
    const note = node('small', 'demo-note', 'Prototype saja. Tidak mengubah tiket, akun, atau layanan produksi.');
    const actions = node('div', 'demo-dialog-actions'), cancel = node('button', 'btn', 'Batal'), submit = node('button', 'btn primary', confirmLabel);
    cancel.type = 'button'; submit.type = 'submit'; actions.append(cancel, submit); form.append(note, actions); dialog.append(form);
    document.body.append(dialog);
    return new Promise((resolve) => {
      const finish = (value) => { dialog.close(); dialog.remove(); restore(previous); resolve(value); };
      cancel.onclick = () => finish(null);
      dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(null); });
      dialog.onclick = (event) => {
        const rect = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) finish(null);
      };
      form.onsubmit = (event) => {
        event.preventDefault();
        if (input && input.value.trim().length < 3) { input.setCustomValidity('Tulis alasan minimal 3 karakter.'); input.reportValidity(); return; }
        finish(input ? input.value.trim() : true);
      };
      dialog.showModal(); (input || cancel).focus();
    });
  }
  function notice(message) {
    let region = document.getElementById('demo-notice');
    if (!region) { region = node('div', 'demo-notice'); region.id = 'demo-notice'; region.setAttribute('role', 'status'); document.body.append(region); }
    region.textContent = message; region.hidden = false;
    clearTimeout(notice.timer); notice.timer = setTimeout(() => { region.hidden = true; }, 6000);
  }
  document.addEventListener('pointerdown', (event) => {
    if (active && !active.pop.contains(event.target) && !active.trigger.contains(event.target)) close(false);
  });
  document.addEventListener('focusin', (event) => {
    if (active && !active.pop.contains(event.target) && event.target !== active.trigger) close(false);
  });
  addEventListener('resize', position); addEventListener('scroll', position, true);
  window.visualViewport?.addEventListener('resize', position);
  window.visualViewport?.addEventListener('scroll', position);
  window.iDeskDropdown = { bind, close, confirm, notice, node, icon };
})();
