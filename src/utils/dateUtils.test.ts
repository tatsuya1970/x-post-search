import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toJSTStartISO, toJSTEndISO } from './dateUtils';

describe('toJSTStartISO', () => {
  it('2026-03-08 を JST 00:00 として UTC ISO に変換する', () => {
    expect(toJSTStartISO('2026-03-08')).toBe('2026-03-07T15:00:00.000Z');
  });

  it('2026-01-01 を JST 00:00 として UTC ISO に変換する', () => {
    expect(toJSTStartISO('2026-01-01')).toBe('2025-12-31T15:00:00.000Z');
  });

  it('2026-12-31 を JST 00:00 として UTC ISO に変換する', () => {
    expect(toJSTStartISO('2026-12-31')).toBe('2026-12-30T15:00:00.000Z');
  });
});

describe('toJSTEndISO', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-08T12:00:00.000Z')); // JST 21:00
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('capToNow=false のとき、翌日 JST 00:00 を返す', () => {
    expect(toJSTEndISO('2026-03-08', false)).toBe('2026-03-08T15:00:00.000Z');
  });

  it('capToNow=true かつ過去の日付のとき、翌日 JST 00:00 を返す', () => {
    expect(toJSTEndISO('2026-03-01', true)).toBe('2026-03-01T15:00:00.000Z');
  });

  it('capToNow=true かつ今日の日付のとき、現在時刻にキャップする', () => {
    const result = toJSTEndISO('2026-03-08', true);
    expect(result).not.toBe('2026-03-08T15:00:00.000Z');
    expect(result <= '2026-03-08T12:00:00.000Z').toBe(true);
  });

  it('capToNow=true かつ未来の日付のとき、現在時刻にキャップする', () => {
    const result = toJSTEndISO('2026-03-15', true);
    expect(result <= '2026-03-08T12:00:00.000Z').toBe(true);
  });
});
