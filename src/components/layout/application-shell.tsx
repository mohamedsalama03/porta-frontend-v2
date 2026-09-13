'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as m from 'motion/react-m';
import {
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  Eye,
  Home,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Package2,
  PanelRightClose,
  PanelRightOpen,
  Settings2,
  Sun,
  X,
} from 'lucide-react';
import {
  getCurrentModule,
  getNavigationHref,
  getNavigationItems,
  moduleLabels,
  type NavigationItem,
  type NavigationMode,
} from '@/lib/navigation';
import { can } from '@/lib/permissions';
import { CommandPalette } from './command-palette';
import { containDialogFocus } from './dialog-focus';
import { navigationIcons } from './navigation-icons';
import { useApplyPreferences, useSidebarPreference, useThemePreference } from './preferences';
import './shell.css';

export type ApplicationShellProps = {
  children: ReactNode;
  mode: NavigationMode;
  user: { name: string; email: string; permissions: readonly string[] } | null;
  onLogout?: () => Promise<void>;
};

const navigationSections = [
  { key: 'workspace', label: 'مساحة العمل' },
  { key: 'management', label: 'الإدارة' },
  { key: 'administration', label: 'المنظومة' },
] as const;

function SidebarContents({
  items,
  mode,
  collapsed,
  onNavigate,
}: {
  items: readonly NavigationItem[];
  mode: NavigationMode;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const current = getCurrentModule(pathname);

  return (
    <>
      <Link
        href={getNavigationHref('dashboard', mode)}
        className="shell-brand"
        aria-label="Porta Delivery — الرئيسية"
        onClick={onNavigate}
      >
        <span className="brand-symbol">
          <Package2 size={25} strokeWidth={1.65} aria-hidden="true" />
        </span>
        <span className="brand-wordmark" dir="ltr">
          <strong>
            PORTA<span>.</span>
          </strong>
          <small>DELIVERY</small>
        </span>
      </Link>
      <nav className="shell-navigation" aria-label="التنقل الرئيسي">
        {navigationSections.map((section) => {
          const sectionItems = items.filter((item) => item.section === section.key);
          if (!sectionItems.length) return null;
          return (
            <div className="navigation-section" key={section.key}>
              <p className="navigation-section-label">{section.label}</p>
              <ul>
                {sectionItems.map((item) => {
                  const Icon = navigationIcons[item.key];
                  return (
                    <li key={item.key}>
                      <Link
                        href={getNavigationHref(item.key, mode)}
                        className={`navigation-link${current === item.key ? ' is-active' : ''}`}
                        aria-current={current === item.key ? 'page' : undefined}
                        aria-label={collapsed ? item.label : undefined}
                        title={collapsed ? item.label : undefined}
                        onClick={onNavigate}
                        prefetch={false}
                      >
                        <Icon size={19} strokeWidth={1.65} aria-hidden="true" />
                        <span className="navigation-label">{item.label}</span>
                        {current === item.key && (
                          <span className="navigation-active-dot" aria-hidden="true" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {!items.length && <p className="navigation-empty">لا توجد صفحات متاحة لصلاحيات حسابك.</p>}
      </nav>
      <div className="sidebar-footer">
        <span className="sidebar-footer-symbol">
          <Package2 size={18} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <div>
          <strong>من مدينة إلى مدينة</strong>
          <p>كل شحنة، أقرب لوجهتها.</p>
        </div>
      </div>
    </>
  );
}

function AccountMenu({
  user,
  mode,
  onLogout,
}: Pick<ApplicationShellProps, 'user' | 'mode' | 'onLogout'>) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const settingsAllowed = mode === 'preview' || can(user, 'settings.view');
  const name = mode === 'preview' ? 'معاينة الواجهة' : user?.name || 'حساب المستخدم';

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener('pointerdown', onOutsideClick);
    return () => document.removeEventListener('pointerdown', onOutsideClick);
  }, [open]);

  async function logout() {
    if (!onLogout) return;
    setPending(true);
    setLogoutError(false);
    try {
      await onLogout();
      setOpen(false);
    } catch {
      setLogoutError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="account-menu-wrapper" ref={wrapperRef}>
      <button
        className="account-trigger"
        ref={triggerRef}
        aria-label={`قائمة ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="account-menu"
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="account-avatar">
          {mode === 'preview' ? (
            <Eye size={17} aria-hidden="true" />
          ) : (
            <span aria-hidden="true">{name.trim().slice(0, 1)}</span>
          )}
        </span>
        <span className="account-name">{name}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="account-popover shell-popover">
          <div className="account-summary">
            <strong>{name}</strong>
            <span dir={mode === 'preview' ? 'rtl' : 'ltr'}>
              {mode === 'preview' ? 'لا توجد جلسة مستخدم حقيقية' : user?.email}
            </span>
          </div>
          <div
            ref={menuRef}
            id="account-menu"
            role="menu"
            aria-label="خيارات الحساب"
            onKeyDown={(event) => {
              const options = Array.from(
                menuRef.current?.querySelectorAll<HTMLElement>(
                  '[role="menuitem"]:not(:disabled)',
                ) ?? [],
              );
              const current = options.findIndex((option) => option === document.activeElement);
              if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? options.length - 1
                      : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) %
                        options.length;
                options[next]?.focus();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
                triggerRef.current?.focus();
              }
              if (event.key === 'Tab') setOpen(false);
            }}
          >
            {settingsAllowed && (
              <Link
                role="menuitem"
                className="account-menu-item"
                href={getNavigationHref('settings', mode)}
                onClick={() => setOpen(false)}
              >
                <Settings2 size={17} aria-hidden="true" />
                تفضيلات الواجهة
              </Link>
            )}
            {mode === 'preview' ? (
              <Link role="menuitem" className="account-menu-item" href="/login">
                <LogOut size={17} aria-hidden="true" />
                الانتقال إلى تسجيل الدخول
              </Link>
            ) : onLogout ? (
              <button
                role="menuitem"
                className="account-menu-item"
                onClick={logout}
                disabled={pending}
              >
                <LogOut size={17} aria-hidden="true" />
                {pending ? 'جارٍ تسجيل الخروج…' : 'تسجيل الخروج'}
              </button>
            ) : (
              <span className="account-unavailable">تسجيل الخروج غير متاح قبل تهيئة الخدمة.</span>
            )}
          </div>
          {logoutError && (
            <p role="alert" className="account-error">
              تعذر تسجيل الخروج. حاول مرة أخرى.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationArea() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target))
        setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onOutsideClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onOutsideClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  return (
    <div className="notification-wrapper" ref={wrapperRef}>
      <button
        ref={triggerRef}
        className="icon-button"
        aria-label="الإشعارات"
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => setOpen(!open)}
      >
        <Bell size={19} strokeWidth={1.7} aria-hidden="true" />
      </button>
      {open && (
        <section
          className="notification-popover shell-popover"
          id="notification-panel"
          aria-label="الإشعارات"
        >
          <div className="notification-title">
            <strong>الإشعارات</strong>
            <button
              className="icon-button"
              aria-label="إغلاق الإشعارات"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div className="notification-empty">
            <Bell size={25} strokeWidth={1.3} aria-hidden="true" />
            <h2>الإشعارات غير متاحة بعد</h2>
            <p>ستظهر تحديثات العمل هنا بعد ربط خدمة الإشعارات.</p>
          </div>
        </section>
      )}
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useThemePreference();
  const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
  const labels = { system: 'النظام', light: 'الفاتح', dark: 'الداكن' };
  const Icon = theme === 'system' ? Monitor : theme === 'light' ? Sun : Moon;
  return (
    <button
      className="icon-button theme-toggle"
      aria-label={`المظهر الحالي: ${labels[theme]}؛ التبديل إلى ${labels[next]}`}
      title={`المظهر: ${labels[theme]}`}
      onClick={() => setTheme(next)}
    >
      <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
    </button>
  );
}

export function ApplicationShell({ children, mode, user, onLogout }: ApplicationShellProps) {
  useApplyPreferences();
  const pathname = usePathname();
  const current = getCurrentModule(pathname);
  const [collapsed, setCollapsed] = useSidebarPreference();
  const drawerRef = useRef<HTMLDialogElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const items = getNavigationItems(user, mode);
  const currentLabel = current ? moduleLabels[current] : 'مساحة العمل';
  const isDetail = pathname.split('/').filter(Boolean).length > (mode === 'preview' ? 2 : 1);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (media.matches && drawerRef.current?.open) drawerRef.current.close();
    };
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
  }, []);

  return (
    <div className={`application-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">
        انتقل إلى المحتوى الرئيسي
      </a>
      <aside className="desktop-sidebar" aria-label="القائمة الجانبية">
        <SidebarContents items={items} mode={mode} collapsed={collapsed} />
        <button
          className="sidebar-collapse"
          aria-label={collapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <PanelRightOpen size={18} aria-hidden="true" />
          ) : (
            <PanelRightClose size={18} aria-hidden="true" />
          )}
          <span>{collapsed ? 'توسيع' : 'طي القائمة'}</span>
        </button>
      </aside>
      <dialog
        ref={drawerRef}
        className="mobile-drawer"
        aria-labelledby="mobile-navigation-title"
        onKeyDown={containDialogFocus}
        onClose={() => mobileTriggerRef.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) drawerRef.current?.close();
        }}
      >
        <h2 id="mobile-navigation-title" className="sr-only">
          التنقل الرئيسي
        </h2>
        <button
          className="icon-button drawer-close"
          aria-label="إغلاق القائمة"
          onClick={() => drawerRef.current?.close()}
        >
          <X size={20} />
        </button>
        <SidebarContents
          items={items}
          mode={mode}
          collapsed={false}
          onNavigate={() => drawerRef.current?.close()}
        />
      </dialog>
      <div className="shell-workspace">
        <header className="shell-header">
          <div className="header-leading">
            <button
              ref={mobileTriggerRef}
              className="icon-button mobile-menu-trigger"
              aria-label="فتح قائمة التنقل"
              aria-haspopup="dialog"
              onClick={() => drawerRef.current?.showModal()}
            >
              <Menu size={21} aria-hidden="true" />
            </button>
            <nav className="shell-breadcrumb" aria-label="مسار التنقل">
              <Link href={getNavigationHref('dashboard', mode)} aria-label="الرئيسية">
                <Home size={15} aria-hidden="true" />
              </Link>
              <ChevronLeft size={13} aria-hidden="true" />
              <span aria-current={isDetail ? undefined : 'page'}>{currentLabel}</span>
              {isDetail && (
                <>
                  <ChevronLeft size={13} aria-hidden="true" />
                  <span aria-current="page">
                    {pathname.endsWith('/new') ? 'إضافة جديد' : 'التفاصيل'}
                  </span>
                </>
              )}
            </nav>
          </div>
          <div className="header-actions">
            <CommandPalette items={items} mode={mode} />
            <span className="header-action-divider" aria-hidden="true" />
            <ThemeToggle />
            <NotificationArea />
            <AccountMenu user={user} mode={mode} onLogout={onLogout} />
          </div>
        </header>
        {mode === 'preview' && (
          <div className="preview-notice">
            <span>
              <Eye size={14} aria-hidden="true" />
              <strong>معاينة الواجهة</strong>
            </span>
            <p>بيانات توضيحية لتجربة التصميم. لا توجد عمليات أو بيانات حقيقية.</p>
            <Link href="/login">
              تسجيل الدخول
              <ChevronLeft size={13} aria-hidden="true" />
            </Link>
          </div>
        )}
        <main id="main-content" className="shell-main" tabIndex={-1}>
          <m.div key={pathname} initial={false} animate={{ opacity: 1 }} className="page-enter">
            {children}
          </m.div>
        </main>
        <footer className="workspace-footer">
          <span dir="ltr">Porta Delivery</span>
          <span>مساحة واحدة، لكل تفاصيل التوصيل.</span>
          {mode === 'preview' ? (
            <span>
              <CircleHelp size={12} aria-hidden="true" />
              نسخة معاينة
            </span>
          ) : (
            <span>
              <Check size={12} aria-hidden="true" />
              مساحة العمل
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
