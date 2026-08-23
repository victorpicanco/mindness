import { describe, expect, it } from 'vitest'

import { LocalCalendar } from './index.js'

describe('LocalCalendar', () => {
  it('derives the local day before the UTC day changes in Sao Paulo', () => {
    expect(
      LocalCalendar.localDayOf(new Date('2026-08-22T02:00:00.000Z'), 'America/Sao_Paulo'),
    ).toBe('2026-08-21')
  })

  it('derives the local day after the UTC day changes in Sao Paulo', () => {
    expect(
      LocalCalendar.localDayOf(new Date('2026-08-22T12:00:00.000Z'), 'America/Sao_Paulo'),
    ).toBe('2026-08-22')
  })

  it('derives different days for the same instant in distinct time zones', () => {
    const at = new Date('2026-08-22T02:00:00.000Z')

    expect(LocalCalendar.localDayOf(at, 'Asia/Tokyo')).not.toBe(
      LocalCalendar.localDayOf(at, 'America/Sao_Paulo'),
    )
  })

  it('derives the local time', () => {
    expect(
      LocalCalendar.localTimeOf(new Date('2026-08-22T02:00:00.000Z'), 'America/Sao_Paulo'),
    ).toBe('23:00')
  })

  it('represents local midnight as 00:00', () => {
    expect(
      LocalCalendar.localTimeOf(new Date('2026-08-22T03:00:00.000Z'), 'America/Sao_Paulo'),
    ).toBe('00:00')
  })

  it('keeps every time zone answering for itself when they are interleaved', () => {
    const at = new Date('2026-08-22T02:00:00.000Z')
    const zones = ['America/Sao_Paulo', 'Asia/Tokyo', 'UTC', 'America/Sao_Paulo', 'Asia/Tokyo']

    expect(zones.map((zone) => LocalCalendar.localDayOf(at, zone))).toEqual([
      '2026-08-21',
      '2026-08-22',
      '2026-08-22',
      '2026-08-21',
      '2026-08-22',
    ])
    expect(zones.map((zone) => LocalCalendar.localTimeOf(at, zone))).toEqual([
      '23:00',
      '11:00',
      '02:00',
      '23:00',
      '11:00',
    ])
  })
})
