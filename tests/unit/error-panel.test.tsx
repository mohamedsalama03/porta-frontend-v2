import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { ApiError } from '@/lib/api/errors';

afterEach(() => vi.useRealTimers());

describe('manual error retry', () => {
  it('waits for each new error, preserves the deadline on rerender, and never retries automatically', () => {
    vi.useFakeTimers();
    const retry = vi.fn();
    const first = new ApiError({ status: 429, retryAfter: 3_000 });
    const { rerender } = render(<ErrorPanel error={first} retry={retry} />);
    const button = screen.getByRole('button', { name: 'إعادة المحاولة' });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(retry).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1_000));
    rerender(<ErrorPanel error={first} retry={retry} />);
    expect(screen.getByRole('timer')).toHaveTextContent('2 ثانية');
    act(() => vi.advanceTimersByTime(2_000));
    expect(button).toBeEnabled();
    expect(retry).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(retry).toHaveBeenCalledOnce();

    rerender(<ErrorPanel error={new ApiError({ status: 429, retryAfter: 2_000 })} retry={retry} />);
    expect(button).toBeDisabled();
    act(() => vi.advanceTimersByTime(1_000));
    expect(button).toBeDisabled();
    rerender(<ErrorPanel error={null} retry={retry} />);
    expect(button).toBeEnabled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps a delay above the maximum browser timer blocked until its deadline', () => {
    vi.useFakeTimers();
    const arrival = Date.UTC(2026, 8, 13);
    vi.setSystemTime(arrival);
    const delay = 2_147_483_647 + 10_000;
    const retry = vi.fn();
    render(<ErrorPanel error={new ApiError({ status: 429, retryAfter: delay })} retry={retry} />);
    const button = screen.getByRole('button', { name: 'إعادة المحاولة' });
    act(() => vi.advanceTimersByTime(1_000));
    expect(button).toBeDisabled();
    vi.setSystemTime(arrival + delay - 2_000);
    act(() => vi.advanceTimersByTime(1_000));
    expect(button).toBeDisabled();
    act(() => vi.advanceTimersByTime(1_000));
    expect(button).toBeEnabled();
    expect(retry).not.toHaveBeenCalled();
  });
});
