import { describe, expect, test } from 'bun:test';
import { parse } from '../src/parser';
import { tokenize } from '../src/lexer';

describe('parse', () => {
  test('parses AN with airline brand', () => {
    const parsed = parse('AN15SEPILOMNL/A5J');
    expect(parsed.code).toBe('AN');
    if (parsed.code === 'AN') {
      expect(parsed.travelDate).toBe('15SEP');
      expect(parsed.origin).toBe('ILO');
      expect(parsed.destination).toBe('MNL');
      expect(parsed.airlineBrandCode).toBe('A5J');
    }
  });

  test('parses SS compact format', () => {
    const parsed = parse('SS2T5');
    expect(parsed.code).toBe('SS');
    if (parsed.code === 'SS') {
      expect(parsed.passengerCount).toBe(2);
      expect(parsed.bookingClass).toBe('T');
      expect(parsed.flightNumber).toBe(5);
    }
  });

  test('parses NM entries with title', () => {
    const parsed = parse('NM2SMITH/John/Peter Mr');
    expect(parsed.code).toBe('NM');
    if (parsed.code === 'NM') {
      expect(parsed.title).toBe('Mr');
      expect(parsed.entries).toHaveLength(1);
      expect(parsed.entries[0]).toEqual({
        count: 2,
        surname: 'SMITH',
        givenNames: ['John', 'Peter'],
      });
    }
  });

  test('parses NM comma-separated entries', () => {
    const parsed = parse('NM1SMITH/John,1ROXAS/Peter');
    expect(parsed.code).toBe('NM');
    if (parsed.code === 'NM') {
      expect(parsed.entries).toHaveLength(2);
      expect(parsed.entries[1]).toEqual({
        count: 1,
        surname: 'ROXAS',
        givenNames: ['Peter'],
      });
    }
  });

  test('parses APM and APE', () => {
    const apm = parse('APM - 09171234567');
    expect(apm.code).toBe('APM');
    if (apm.code === 'APM') {
      expect(apm.mobile).toBe('09171234567');
    }

    const ape = parse('APE - r@r.com');
    expect(ape.code).toBe('APE');
    if (ape.code === 'APE') {
      expect(ape.email).toBe('r@r.com');
    }
  });

  test('parses TKTL and ER', () => {
    const tktl = parse('TKTL05MAR');
    expect(tktl.code).toBe('TKTL');
    if (tktl.code === 'TKTL') {
      expect(tktl.dateCode).toBe('05MAR');
      expect(tktl.day).toBe(5);
      expect(tktl.month).toBe('MAR');
    }

    expect(parse('ER').code).toBe('ER');
  });

  test('parses XE', () => {
    const parsed = parse('XE 2');
    expect(parsed.code).toBe('XE');
    if (parsed.code === 'XE') {
      expect(parsed.lineNumber).toBe(2);
    }
  });

  test('parses pricing commands', () => {
    expect(parse('FXP').code).toBe('FXP');
    expect(parse('FXB').code).toBe('FXB');
  });

  test('parses ticket issuance commands', () => {
    const ttk = parse('TTK/T1-3');
    expect(ttk.code).toBe('TTK');
    if (ttk.code === 'TTK') {
      expect(ttk.tstType).toBe(1);
      expect(ttk.quantity).toBe(3);
    }
  });

  test('accepts token array input', () => {
    const tokens = tokenize('FXP').tokens;
    const parsed = parse(tokens);
    expect(parsed.code).toBe('FXP');
  });

  test('throws on invalid command', () => {
    expect(() => parse('ZZ')).toThrow('Expected command code');
  });

  test('throws for invalid AN payload', () => {
    expect(() => parse('AN15SEPILOMN')).toThrow('AN payload must be DDMMM + origin + destination');
  });

  test('throws for invalid SS payload', () => {
    expect(() => parse('SSY3')).toThrow('SS payload must be <passengers><bookingClass><flightNumber>');
  });

  test('throws for missing XE whitespace separator', () => {
    expect(() => parse('XE2')).toThrow('Expected whitespace after XE');
  });

  test('throws for invalid TTK selector', () => {
    expect(() => parse('TTK/TX')).toThrow('Expected T selector format like T1');
  });

  test('throws on unexpected trailing token', () => {
    expect(() => parse('ER extra')).toThrow('Unexpected token "extra"');
  });

  test('terminates on long invalid payload (no infinite loop guard)', () => {
    const bad = `AN${'Z'.repeat(20000)}`;
    expect(() => parse(bad)).toThrow();
  });
});
