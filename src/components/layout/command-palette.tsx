'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpLeft, Search, X } from 'lucide-react';
import { getNavigationHref, type NavigationItem, type NavigationMode } from '@/lib/navigation';
import { navigationIcons } from './navigation-icons';
import { containDialogFocus } from './dialog-focus';

type CommandPaletteProps = {
  items: readonly NavigationItem[];
  mode: NavigationMode;
};

export function CommandPalette({ items, mode }: CommandPaletteProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const query = search.trim().toLocaleLowerCase('ar');
  const results = items.filter((item) =>
    `${item.label} ${item.keywords} ${item.key}`.toLocaleLowerCase('ar').includes(query),
  );
  const selectedIndex = Math.min(activeIndex, Math.max(0, results.length - 1));

  function openPalette() {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSearch('');
    setActiveIndex(0);
    dialogRef.current?.showModal();
    inputRef.current?.focus();
  }

  function closePalette() {
    dialogRef.current?.close();
  }

  function goTo(item: NavigationItem) {
    closePalette();
    router.push(getNavigationHref(item.key, mode));
  }

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (dialogRef.current?.open) {
          dialogRef.current.close();
        } else {
          previousFocusRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setSearch('');
          setActiveIndex(0);
          dialogRef.current?.showModal();
          inputRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (dialogRef.current?.open) {
      document
        .getElementById(`porta-command-${selectedIndex}`)
        ?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <>
      <button
        ref={triggerRef}
        className="shell-search"
        onClick={openPalette}
        aria-label="البحث والتنقل السريع"
        aria-haspopup="dialog"
      >
        <Search size={17} aria-hidden="true" />
        <span>ابحث أو انتقل إلى صفحة…</span>
        <kbd dir="ltr">Ctrl K</kbd>
      </button>
      <dialog
        ref={dialogRef}
        className="command-dialog"
        aria-labelledby="command-title"
        onKeyDown={containDialogFocus}
        onClose={() => (previousFocusRef.current ?? triggerRef.current)?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) closePalette();
        }}
      >
        <div className="command-content">
          <h2 id="command-title" className="sr-only">
            البحث والتنقل السريع
          </h2>
          <div className="command-input-row">
            <Search size={20} aria-hidden="true" />
            <input
              ref={inputRef}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  const direction = event.key === 'ArrowDown' ? 1 : -1;
                  setActiveIndex((current) =>
                    results.length ? (current + direction + results.length) % results.length : 0,
                  );
                }
                if (event.key === 'Enter' && results[selectedIndex]) {
                  event.preventDefault();
                  goTo(results[selectedIndex]);
                }
              }}
              role="combobox"
              aria-label="ابحث عن صفحة"
              aria-autocomplete="list"
              aria-controls="command-results"
              aria-expanded="true"
              aria-activedescendant={results.length ? `porta-command-${selectedIndex}` : undefined}
              placeholder="إلى أين تريد الانتقال؟"
              autoComplete="off"
            />
            <button className="icon-button" onClick={closePalette} aria-label="إغلاق البحث">
              <X size={18} />
            </button>
          </div>
          <p className="command-group-label">الصفحات</p>
          <ul
            id="command-results"
            className="command-results"
            role="listbox"
            aria-label="نتائج البحث"
          >
            {results.map((item, index) => {
              const Icon = navigationIcons[item.key];
              return (
                <li
                  key={item.key}
                  id={`porta-command-${index}`}
                  role="option"
                  aria-selected={selectedIndex === index}
                >
                  <button
                    tabIndex={-1}
                    onClick={() => goTo(item)}
                    onPointerMove={() => setActiveIndex(index)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                    <ArrowUpLeft size={16} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
            {!results.length && (
              <li role="option" aria-selected="false" className="command-no-results">
                لا توجد صفحة بهذا الاسم.
              </li>
            )}
          </ul>
          <p className="command-note">البحث برقم التتبع يتاح بعد ربط خدمة الشحنات.</p>
          <div className="command-footer">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> للتنقل
            </span>
            <span>
              <kbd>Enter</kbd> للفتح
            </span>
            <span>
              <kbd>Esc</kbd> للإغلاق
            </span>
          </div>
        </div>
      </dialog>
    </>
  );
}
