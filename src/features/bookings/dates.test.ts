import { describe, expect, it } from 'vitest'
import { shiftLocalDate } from './dates.ts'

describe('shiftLocalDate', () => {
  it('moves across month and year boundaries without UTC shifting', () => {
    expect(shiftLocalDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftLocalDate('2024-03-01', -1)).toBe('2024-02-29')
    expect(shiftLocalDate('2026-12-31', 1)).toBe('2027-01-01')
  })
})
