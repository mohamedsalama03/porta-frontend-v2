import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DriverTripActions } from '@/features/driver-workspace/trip-actions';
import type { DriverTripAction, DriverTripDetail } from '@/features/driver-workspace/model';
import { getDriverTripsTripResponseSchema, tripStatusSchema } from '@/lib/api/generated';
import { driverTripFixture } from '../../scripts/driver-check-fixtures.mjs';

const controller = vi.hoisted(() => ({
  attemptAction: null as string | null,
  phase: 'idle',
  error: null as unknown,
  successAction: null as string | null,
  remainingMs: 0,
  busy: false,
  blocked: false,
  run: vi.fn(),
  retry: vi.fn(),
  review: vi.fn(),
}));
vi.mock('@/features/driver-workspace/trip-action-state', () => ({
  useDriverTripAction: () => controller,
}));

function detail(actions: DriverTripAction[] = [], status = 'LOADING'): DriverTripDetail {
  return getDriverTripsTripResponseSchema.parse({
    data: { ...driverTripFixture(), status },
    meta: { allowed_actions: actions, private_note: 'PRIVATE_METADATA' },
    request_id: '123e4567-e89b-42d3-a456-426614174000',
  });
}
beforeEach(() => {
  Object.assign(controller, {
    attemptAction: null,
    phase: 'idle',
    error: null,
    successAction: null,
    remainingMs: 0,
    busy: false,
    blocked: false,
  });
  vi.clearAllMocks();
});

describe('trip action presentation and deliberate confirmation', () => {
  it.each(tripStatusSchema.options)('does not authorize actions from %s', (status) => {
    const { container } = render(<DriverTripActions detail={detail([], status)} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('لا توجد إجراءات متاحة حاليًا.')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('PRIVATE_METADATA');
  });
  it('uses stable presentation order for only the supplied metadata', () => {
    render(
      <DriverTripActions detail={detail(['COMPLETE', 'START', 'CONFIRM_ARRIVAL'], 'SCHEDULED')} />,
    );
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'بدء الرحلة',
      'تأكيد الوصول',
      'إكمال الرحلة',
    ]);
  });
  it.each([
    ['START', 'بدء الرحلة', 'تأكيد بدء الرحلة'],
    ['CONFIRM_ARRIVAL', 'تأكيد الوصول', 'تأكيد الوصول إلى الوجهة'],
    ['COMPLETE', 'إكمال الرحلة', 'تأكيد إكمال الرحلة'],
  ] as const)(
    'requires confirmation with route, schedule and status for %s',
    (action, label, confirm) => {
      const response = detail([action]);
      const view = render(<DriverTripActions detail={response} />);
      fireEvent.click(screen.getByRole('button', { name: label }));
      const heading = screen.getByRole('heading', { name: label });
      expect(heading).toHaveFocus();
      expect(screen.getByText(/الحالة الحالية:/)).toBeVisible();
      expect(view.container.querySelector('time')).toHaveAttribute(
        'datetime',
        response.data.departure_at,
      );
      expect(screen.getByText(new RegExp(response.data.origin_city!.name_ar))).toBeVisible();
      expect(controller.run).not.toHaveBeenCalled();
      fireEvent.keyDown(heading, { key: 'Escape' });
      expect(screen.getByRole('button', { name: label })).toHaveFocus();
      expect(controller.run).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: label }));
      fireEvent.click(screen.getByRole('button', { name: 'رجوع' }));
      expect(screen.getByRole('button', { name: label })).toHaveFocus();
      fireEvent.click(screen.getByRole('button', { name: label }));
      fireEvent.click(screen.getByRole('button', { name: confirm }));
      expect(controller.run).toHaveBeenCalledExactlyOnceWith(action);
    },
  );
  it('does not revive an unsubmitted confirmation after metadata removes and later restores its capability', () => {
    const view = render(<DriverTripActions detail={detail(['START'])} />);
    fireEvent.click(screen.getByRole('button', { name: 'بدء الرحلة' }));
    view.rerender(<DriverTripActions detail={detail([])} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(controller.run).not.toHaveBeenCalled();
    view.rerender(<DriverTripActions detail={detail(['START'])} />);
    expect(screen.getByRole('button', { name: 'بدء الرحلة' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'تأكيد بدء الرحلة' })).not.toBeInTheDocument();
  });
  it('keeps mutation controls blocked while authoritative recovery is outstanding', () => {
    Object.assign(controller, {
      phase: 'review',
      blocked: true,
      busy: true,
      successAction: 'START',
    });
    render(<DriverTripActions detail={detail(['CONFIRM_ARRIVAL'])} />);
    expect(screen.queryByRole('button', { name: 'تأكيد الوصول' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تحديث الرحلة للمراجعة' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'تم بدء الرحلة بنجاح.' })).toHaveFocus();
  });
  it('announces pending and prevents cancellation or duplicate confirmation', () => {
    Object.assign(controller, {
      phase: 'pending',
      blocked: true,
      busy: true,
      attemptAction: 'START',
    });
    render(<DriverTripActions detail={detail(['START'])} />);
    expect(screen.getByRole('button', { name: 'جارٍ تأكيد الإجراء' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('جارٍ تأكيد إجراء الرحلة');
    expect(screen.queryByRole('button', { name: 'رجوع' })).not.toBeInTheDocument();
  });
});
