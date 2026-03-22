import { describe, expect, test } from 'bun:test';
import { tokenize } from '../src/lexer';

describe('tokenize', () => {
  test('tokenizes compact AN command', () => {
    const result = tokenize('AN15SEPILOMNL/A5J');
    expect(result.errors).toHaveLength(0);
    expect(result.tokens.map((t) => t.type)).toEqual(['AN', 'WORD', 'SLASH', 'WORD', 'EOF']);
  });

  test('tokenizes compact SS command', () => {
    const result = tokenize('SS1Y3');
    expect(result.tokens.map((t) => t.type)).toEqual(['SS', 'WORD', 'EOF']);
  });

  test('tokenizes APM/APE with dash separators', () => {
    const apm = tokenize('APM - 09171234567');
    expect(apm.tokens.map((t) => t.type)).toEqual(['APM', 'WS', 'DASH', 'WS', 'INTEGER', 'EOF']);

    const ape = tokenize('APE - r@r.com');
    expect(ape.tokens.map((t) => t.type)).toEqual(['APE', 'WS', 'DASH', 'WS', 'FREETEXT', 'EOF']);
  });

  test('tokenizes TTK issue command', () => {
    expect(tokenize('TTK/T1-3').tokens.map((t) => t.type)).toEqual(['TTK', 'SLASH', 'WORD', 'DASH', 'INTEGER', 'EOF']);
  });

  test('tokenizes with whitespace and multiline positions', () => {
    const result = tokenize('NM1SMITH/John\nMr');
    expect(result.tokens.map((t) => t.type)).toEqual(['NM', 'WORD', 'SLASH', 'WORD', 'WS', 'WORD', 'EOF']);

    const mr = result.tokens[5];
    expect(mr?.span.start.line).toBe(2);
    expect(mr?.span.start.column).toBe(1);
  });

  test('treats hyphen variants as DASH', () => {
    const ascii = tokenize('APM - 0917').tokens.map((t) => t.type);
    const en = tokenize('APM – 0917').tokens.map((t) => t.type);
    const em = tokenize('APM — 0917').tokens.map((t) => t.type);

    expect(ascii.includes('DASH')).toBe(true);
    expect(en.includes('DASH')).toBe(true);
    expect(em.includes('DASH')).toBe(true);
  });

  test('terminates on long mixed input (no infinite loop guard)', () => {
    const payload = `${'A/'.repeat(5000)}B ${'X'.repeat(5000)} -- end`;
    const result = tokenize(payload);
    expect(result.tokens.length).toBeGreaterThan(1);
    expect(result.tokens[result.tokens.length - 1]?.type).toBe('EOF');
  });
});
