import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/errors';
import { UserActions, userWritePayload } from '@/features/users/user-actions';
import type { User } from '@/lib/api/generated';

vi.mock('@/lib/config', () => ({ config: { apiBaseUrl: null } }));
const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  request: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { permissions: mocks.permissions }, refresh: mocks.refresh }),
}));
vi.mock('@/lib/api/client', () => ({ api: { request: mocks.request } }));
beforeEach(() => {
  mocks.permissions = [];
  mocks.request.mockReset();
});
const record: User = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  name: 'Test operator',
  email: 'test@example.test',
  role: 'BRANCH_OPERATOR',
};
const values = {
  name: record.name,
  email: record.email,
  password: 'Test-Password-123',
  role: record.role,
  branch_id: '',
  active: 'unchanged' as const,
};

describe('staff account contract writes', () => {
  it('keeps an uncertain create request locked and replays the same body/key after closing and reopening', async () => {
    mocks.permissions = ['users.manage'];
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.removeAttribute('open');
      },
    });
    mocks.request
      .mockRejectedValueOnce(new ApiError({ code: 'network' }))
      .mockResolvedValueOnce({ data: record });
    const ui = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <UserActions />
      </QueryClientProvider>,
    );
    await ui.click(screen.getByRole('button', { name: 'إضافة مستخدم' }));
    await ui.type(screen.getByLabelText('الاسم'), 'Test user');
    await ui.type(screen.getByLabelText('البريد الإلكتروني'), 'staff@example.test');
    await ui.type(screen.getByLabelText('كلمة المرور الأولية'), 'Test-Password-123');
    await ui.selectOptions(screen.getByLabelText('الدور الوظيفي'), 'ADMIN');
    await ui.click(screen.getByRole('button', { name: 'إنشاء الحساب' }));
    await screen.findByRole('button', { name: 'إعادة محاولة الطلب نفسه' });
    expect(screen.getByLabelText('الاسم')).toBeDisabled();
    await ui.click(screen.getByRole('button', { name: 'إغلاق' }));
    await ui.click(screen.getByRole('button', { name: 'إضافة مستخدم' }));
    expect(screen.getByLabelText('الاسم')).toHaveValue('Test user');
    expect(screen.getByLabelText('الاسم')).toBeDisabled();
    await ui.click(screen.getByRole('button', { name: 'إعادة محاولة الطلب نفسه' }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2));
    expect(mocks.request.mock.calls[1][1].idempotencyKey).toBe(
      mocks.request.mock.calls[0][1].idempotencyKey,
    );
    expect(mocks.request.mock.calls[1][1].body).toEqual(mocks.request.mock.calls[0][1].body);
    await screen.findByText('تم حفظ الحساب.');
  });
  it('does not expose create or edit controls without users.manage', () => {
    render(
      <>
        <UserActions />
        <UserActions record={record} />
      </>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('leaves omitted optional state untouched and sends only changed editable fields', () => {
    expect(userWritePayload(values, record)).toEqual({});
    expect(
      userWritePayload(
        {
          ...values,
          name: 'Ignore unsupported edit',
          email: 'new@example.test',
          password: 'Ignore unsupported password',
          active: 'false',
        },
        record,
      ),
    ).toEqual({ active: false });
  });
  it('distinguishes an explicit branch removal from an absent branch', () => {
    expect(
      userWritePayload(values, { ...record, branch_id: '01ARZ3NDEKTSV4RRFFQ69G5FAW' }),
    ).toEqual({ branch_id: null });
    expect(userWritePayload({ ...values, role: 'ADMIN' }, record)).toEqual({ role: 'ADMIN' });
  });
  it('validates create payload with the supplied conditional branch requirement', () => {
    expect(() => userWritePayload(values)).toThrow();
    const created = userWritePayload({ ...values, branch_id: '01ARZ3NDEKTSV4RRFFQ69G5FAW' });
    expect(created).not.toHaveProperty('active');
    expect(created).toHaveProperty('password', 'Test-Password-123');
  });
});
