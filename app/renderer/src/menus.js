// Popup menus. Every menu in the app opens through here so they behave the same way: anchored to
// the control that opened it (below a toolbar button, above a composer chip), kept inside the
// window, closed by Escape, by a click anywhere else, by resize, or by opening another menu.
const root = () => document.getElementById('app');
const q = s => root().querySelector(s);
const GAP = 6, EDGE = 8;

let open = null; // { menu, anchor }

// Place `menu` against `anchor`. side: 'below' | 'above'. The menu's horizontal edge lines up with
// the anchor's nearest window edge, so a menu from a right-aligned button grows leftwards.
export function placeMenu(menu, anchor, { side = 'below' } = {}) {
  const a = anchor.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.right = 'auto'; menu.style.bottom = 'auto'; menu.style.left = '0'; menu.style.top = '0';
  const w = menu.offsetWidth, h = menu.offsetHeight;
  const alignRight = a.left + a.width / 2 > innerWidth / 2;
  let left = alignRight ? a.right - w : a.left;
  left = Math.max(EDGE, Math.min(left, innerWidth - w - EDGE));
  let top = side === 'above' ? a.top - h - GAP : a.bottom + GAP;
  if (side === 'above' && top < EDGE) top = a.bottom + GAP;
  if (side === 'below' && top + h > innerHeight - EDGE) top = Math.max(EDGE, a.top - h - GAP);
  top = Math.max(EDGE, Math.min(top, innerHeight - h - EDGE));
  menu.style.left = left + 'px'; menu.style.top = top + 'px';
  menu.dataset.place = (top < a.top ? 'above' : 'below') + (alignRight ? '-end' : '-start');
}

export function hideMenus() {
  root().querySelectorAll('.bw-menu').forEach(m => { m.hidden = true; });
  root().querySelectorAll('[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  open = null;
}

// Show `menuSel` anchored to `anchorSel`; opening the same menu from the same anchor closes it.
export function toggleMenu(menuSel, anchorSel, opts = {}) {
  const menu = q(menuSel), anchor = q(anchorSel);
  const wasOpen = open && open.menu === menu && open.anchor === anchor;
  hideMenus();
  if (wasOpen) return false;
  menu.hidden = false;
  placeMenu(menu, anchor, opts);
  anchor.setAttribute('aria-expanded', 'true');
  open = { menu, anchor };
  const first = menu.querySelector('button:not([disabled])');
  if (opts.focus !== false && first && !menu.contains(document.activeElement)) first.focus({ preventScroll: true });
  return true;
}

export function menuOpen(menuSel) { return open && open.menu === q(menuSel); }

// One dismissal policy for every menu: outside pointer, Escape, window resize.
export function installMenuDismissal() {
  document.addEventListener('pointerdown', e => {
    if (!open) return;
    if (e.target.closest('.bw-menu') || e.target === open.anchor || open.anchor.contains(e.target)) return;
    hideMenus();
  }, true);
  document.addEventListener('keydown', e => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); const back = open.anchor; hideMenus(); back?.focus?.(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = [...open.menu.querySelectorAll('button:not([disabled])')];
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1) + (i < 0 ? 1 : 0)) % items.length].focus();
    }
  });
  window.addEventListener('resize', () => { if (open) placeMenu(open.menu, open.anchor, { side: open.menu.dataset.place?.startsWith('above') ? 'above' : 'below' }); });
}
