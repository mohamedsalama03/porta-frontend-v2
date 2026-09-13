import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReferencePicker } from '@/features/lookups';
import { api } from '@/lib/api/client';
import { createQueryClient } from '@/lib/query/client';

const { subject } = vi.hoisted(() => ({ subject: { permissions: ['cities.manage'] } }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: subject }) }));
vi.mock('@/lib/config', () => ({ config: { apiBaseUrl: null } }));
const first = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  city_id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  name: 'فرع البداية',
  address: 'عنوان اختبار',
  phone: null,
  active: true,
};
const second = { ...first, id: '01ARZ3NDEKTSV4RRFFQ69G5FAX', name: 'فرع الصفحة الثانية' };
const envelope = { request_id: '123e4567-e89b-42d3-a456-426614174000' };

function Harness({ value = '', disabled = false }: { value?: string; disabled?: boolean }) {
  const [selected, setSelected] = useState(value);
  const [client] = useState(createQueryClient);
  return (
    <QueryClientProvider client={client}>
      <label htmlFor="test-reference">الفرع</label>
      <ReferencePicker
        kind="branch"
        id="test-reference"
        value={selected}
        onChange={setSelected}
        disabled={disabled}
        selectedLabel="الفرع المحفوظ"
      />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  subject.permissions = ['cities.manage'];
});

describe('paged reference picker', () => {
  it('fetches only the chosen page and preserves the selected record off-page', async () => {
    const request = vi
      .spyOn(api, 'request')
      .mockResolvedValueOnce({
        ...envelope,
        data: [first],
        meta: { page: 1, last_page: 2, total: 21 },
      })
      .mockResolvedValueOnce({
        ...envelope,
        data: [second],
        meta: { page: 2, last_page: 2, total: 21 },
      });
    render(<Harness />);
    await screen.findByRole('option', { name: first.name });
    expect(request).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'الصفحة السابقة من الفروع' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('الفرع'), { target: { value: first.id } });
    fireEvent.click(screen.getByRole('button', { name: 'الصفحة التالية من الفروع' }));
    await screen.findByRole('option', { name: second.name });
    expect(request).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('الفرع')).toHaveValue(first.id);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'الصفحة التالية من الفروع' })).toBeDisabled();
  });

  it('uses an explicit approved-ID fallback without fetching an unauthorized directory', async () => {
    subject.permissions = ['users.manage'];
    const request = vi.spyOn(api, 'request');
    render(<Harness value={first.id} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('الفرع')).toHaveValue(first.id);
    expect(screen.getByText(/لا تتوفر صلاحية استعراض الفروع/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('الفرع'), { target: { value: second.id } });
    });
    expect(screen.getByLabelText('الفرع')).toHaveValue(second.id);
    expect(request).not.toHaveBeenCalled();
  });

  it('keeps a disabled current selection without starting a directory request', async () => {
    const request = vi.spyOn(api, 'request');
    render(<Harness value={first.id} disabled />);
    await waitFor(() => expect(screen.getByLabelText('الفرع')).toBeDisabled());
    expect(screen.getByRole('option', { name: 'الفرع المحفوظ' })).toBeInTheDocument();
    expect(screen.getByLabelText('الفرع')).toHaveValue(first.id);
    expect(request).not.toHaveBeenCalled();
  });
});
