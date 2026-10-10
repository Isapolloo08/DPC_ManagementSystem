import { test, expect } from '@playwright/test';
import { formatDisplayDate } from '../../client/src/utils/displayDate';

test('shared display formatter keeps calendar dates unambiguous without changing stored data', () => {
  expect(formatDisplayDate('2026-10-09')).toBe('Oct 9, 2026');
  expect(formatDisplayDate('2026-01-01')).toBe('Jan 1, 2026');
  expect(formatDisplayDate(new Date(2026, 9, 9, 12))).toBe('Oct 9, 2026');
  expect(formatDisplayDate(null)).toBe('—');
  expect(formatDisplayDate('invalid')).toBe('—');
});
