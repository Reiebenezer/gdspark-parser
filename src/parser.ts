import { tokenize } from './lexer';
import type {
  CommandCode,
  CommandParam,
  NameEntry,
  ParsedCommand,
  SourceSpan,
  Token,
} from './types';

class ParseError extends Error {
  readonly span?: SourceSpan;

  constructor(message: string, span?: SourceSpan) {
    super(message);
    this.name = 'ParseError';
    this.span = span;
  }
}

type ParseInput = string | Token[];

const isCommandCode = (type: Token['type']): type is CommandCode =>
  ['AN', 'SS', 'NM', 'APM', 'APE', 'TKTL', 'ER', 'XE', 'FXP', 'FXB', 'TTK'].includes(type);

const MONTH_RE = /^[A-Za-z]{3}$/;
const AIRPORT_RE = /^[A-Za-z]{3}$/;
const BRAND_RE = /^[A-Za-z0-9]{2,4}$/;

const MONTH_CODES_RE = /^JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC$/;

class Parser {
  private readonly tokens: Token[];
  private index = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ParsedCommand {
    this.skipWs();
    const commandToken = this.peek();
    if (!commandToken || !isCommandCode(commandToken.type)) {
      throw new ParseError('Expected command code', commandToken?.span);
    }

    this.index += 1;
    const code = commandToken.type;
    const params: CommandParam[] = [];

    const parsed = this.parseByCode(code, params);
    parsed.span = this.buildCommandSpan(commandToken.span, parsed.span);

    this.skipWs();
    const tail = this.peek();
    if (tail && tail.type !== 'EOF') {
      throw new ParseError(`Unexpected token "${tail.lexeme}"`, tail.span);
    }

    return parsed;
  }

  private parseByCode(code: CommandCode, params: CommandParam[]): ParsedCommand {
    switch (code) {
      case 'AN':
        return this.parseAvailability(params);
      case 'SS':
        return this.parseSell(params);
      case 'NM':
        return this.parseNames(params);
      case 'APM':
        return this.parsePassengerMobile(params);
      case 'APE':
        return this.parsePassengerEmail(params);
      case 'TKTL':
        return this.parseTicketingLimit(params);
      case 'ER':
        return { code: 'ER', params };
      case 'XE':
        return this.parseDeleteLine(params);
      case 'FXP':
      case 'FXB':
        return { code, params };
      case 'TTK':
        return this.parseIssueTtk(params);
    }
  }

  private parseAvailability(params: CommandParam[]): ParsedCommand {
    const routeToken = this.readRequiredValue('Expected AN payload like 15SEPILOMNL');
    const match = routeToken.lexeme.match(/^(\d{2})([A-Za-z]{3})([A-Za-z]{3})([A-Za-z]{3})$/);
    if (!match) {
      throw new ParseError('AN payload must be DDMMM + origin + destination (e.g. 15SEPILOMNL)', routeToken.span);
    }

    const day = match[1];
    const month = match[2];
    const origin = match[3];
    const destination = match[4];
    if (!day || !month || !origin || !destination) {
      throw new ParseError('Invalid AN payload values', routeToken.span);
    }
    const travelDate = `${day}${month.toUpperCase()}`;
    if (!MONTH_RE.test(month) || !AIRPORT_RE.test(origin) || !AIRPORT_RE.test(destination)) {
      throw new ParseError('Invalid AN payload values', routeToken.span);
    }

    if (!MONTH_CODES_RE.test(month)) {
      throw new ParseError('Invalid AN date value', routeToken.span);
    }

    params.push({ name: 'travelDate', value: travelDate });
    params.push({ name: 'origin', value: origin.toUpperCase() });
    params.push({ name: 'destination', value: destination.toUpperCase() });

    this.skipWs();
    let airlineBrandCode: string | undefined;
    if (this.match('SLASH')) {
      this.skipWs();
      const brandToken = this.readRequiredValue('Expected airline brand code after "/"');
      if (!BRAND_RE.test(brandToken.lexeme)) {
        throw new ParseError('Airline brand code must be 2-4 alphanumeric characters', brandToken.span);
      }
      airlineBrandCode = brandToken.lexeme.toUpperCase();
      params.push({ name: 'airlineBrandCode', value: airlineBrandCode });
    }

    return {
      code: 'AN',
      params,
      travelDate,
      travelDay: day,
      travelMonth: month,
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      ...(airlineBrandCode ? { airlineBrandCode } : {}),
    };
  }

  private parseSell(params: CommandParam[]): ParsedCommand {
    const sellToken = this.readRequiredValue('Expected SS payload like 1Y3');
    const match = sellToken.lexeme.match(/^(\d+)([A-Za-z])(\d+)$/);
    if (!match) {
      throw new ParseError('SS payload must be <passengers><bookingClass><flightNumber> (e.g. 1Y3)', sellToken.span);
    }

    const passengerGroup = match[1];
    const classGroup = match[2];
    const flightGroup = match[3];
    if (!passengerGroup || !classGroup || !flightGroup) {
      throw new ParseError('Invalid SS payload values', sellToken.span);
    }

    const passengerCount = Number(passengerGroup);
    const bookingClass = classGroup.toUpperCase();
    const flightNumber = Number(flightGroup);

    params.push({ name: 'passengerCount', value: String(passengerCount) });
    params.push({ name: 'bookingClass', value: bookingClass });
    params.push({ name: 'flightNumber', value: String(flightNumber) });

    return { code: 'SS', params, passengerCount, bookingClass, flightNumber };
  }

  private parseNames(params: CommandParam[]): ParsedCommand {
    const rawNames = this.collectRemainingText(true).trim();
    if (rawNames.length === 0) {
      throw new ParseError('Expected passenger name payload after NM', this.peek()?.span);
    }

    let namesCore = rawNames;
    let title: string | undefined;
    const lastSpace = rawNames.lastIndexOf(' ');
    if (lastSpace > 0) {
      const maybeTitle = rawNames.slice(lastSpace + 1).trim();
      if (/^[A-Za-z.]{2,6}$/.test(maybeTitle)) {
        title = maybeTitle;
        namesCore = rawNames.slice(0, lastSpace).trim();
      }
    }

    const entries = namesCore
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => this.parseNameEntry(part));

    if (entries.length === 0) {
      throw new ParseError('No valid NM name entries found', this.peek(-1)?.span);
    }

    params.push({ name: 'rawNames', value: rawNames });
    if (title) {
      params.push({ name: 'title', value: title });
    }

    return {
      code: 'NM',
      params,
      rawNames,
      entries,
      ...(title ? { title } : {}),
    };
  }

  private parseNameEntry(value: string): NameEntry {
    const match = value.match(/^(\d+)([A-Za-z]+)\/(.+)$/);
    if (!match) {
      throw new ParseError(`Invalid NM entry "${value}"; expected format like 1SMITH/John`);
    }

    const countGroup = match[1];
    const surnameGroup = match[2];
    const givenGroup = match[3];
    if (!countGroup || !surnameGroup || !givenGroup) {
      throw new ParseError(`Invalid NM entry "${value}"; expected format like 1SMITH/John`);
    }

    const count = Number(countGroup);
    const surname = surnameGroup.toUpperCase();
    const givenNames = givenGroup
      .split('/')
      .map((name) => name.trim())
      .filter(Boolean);

    if (givenNames.length === 0) {
      throw new ParseError(`NM entry "${value}" is missing given name`);
    }

    return { count, surname, givenNames };
  }

  private parsePassengerMobile(params: CommandParam[]): ParsedCommand {
    const mobile = this.parseAttachedValue('Expected mobile number immediately after APM');
    params.push({ name: 'mobile', value: mobile });
    return { code: 'APM', params, mobile };
  }

  private parsePassengerEmail(params: CommandParam[]): ParsedCommand {
    const email = this.parseAttachedValue('Expected email immediately after APE');
    params.push({ name: 'email', value: email });
    return { code: 'APE', params, email };
  }

  private parseAttachedValue(errorMessage: string): string {
    const token = this.peek();
    if (!token || ['EOF', 'WS', 'DASH'].includes(token.type)) {
      throw new ParseError(errorMessage, token?.span);
    }

    const text = this.collectRemainingText(false).trim();
    if (text.length === 0) {
      throw new ParseError(errorMessage, token.span);
    }

    return text;
  }

  private parseTicketingLimit(params: CommandParam[]): ParsedCommand {
    const dateToken = this.readRequiredValue('Expected TKTL date like 05MAR');
    const match = dateToken.lexeme.match(/^(\d{2})([A-Za-z]{3})$/);
    if (!match) {
      throw new ParseError('TKTL must be in DDMMM format (e.g. 05MAR)', dateToken.span);
    }

    const dayGroup = match[1];
    const monthGroup = match[2];
    if (!dayGroup || !monthGroup) {
      throw new ParseError('TKTL must be in DDMMM format (e.g. 05MAR)', dateToken.span);
    }

    const day = Number(dayGroup);
    const month = monthGroup.toUpperCase();
    const dateCode = `${dayGroup}${month}`;

    params.push({ name: 'dateCode', value: dateCode });
    params.push({ name: 'day', value: String(day) });
    params.push({ name: 'month', value: month });

    return { code: 'TKTL', params, dateCode, day, month };
  }

  private parseDeleteLine(params: CommandParam[]): ParsedCommand {
    const lineToken = this.peek();
    if (!lineToken || lineToken.type !== 'INTEGER') {
      throw new ParseError('XE expects a line number immediately after XE (e.g. XE2)', lineToken?.span);
    }

    this.index += 1;
    params.push({ name: 'lineNumber', value: String(lineToken.value) });
    return { code: 'XE', params, lineNumber: lineToken.value };
  }

  private parseIssueTtk(params: CommandParam[]): ParsedCommand {
    this.skipWs();
    this.expect('SLASH', 'Expected "/" after TTK');
    this.skipWs();

    const tstType = this.readTSelector(false);
    this.skipWs();

    this.expect('DASH', 'Expected "-" and quantity after TTK/T<n>');
    this.skipWs();

    const quantityToken = this.peek();
    if (!quantityToken || quantityToken.type !== 'INTEGER') {
      throw new ParseError('Expected ticket quantity after "-"', quantityToken?.span);
    }
    this.index += 1;

    params.push({ name: 'tstType', value: String(tstType) });
    params.push({ name: 'quantity', value: String(quantityToken.value) });

    return {
      code: 'TTK',
      params,
      tstType,
      quantity: quantityToken.value,
    };
  }

  private readTSelector(allowAll: true): number | '*';
  private readTSelector(allowAll: false): number;
  private readTSelector(allowAll: boolean): number | '*' {
    const token = this.peek();
    if (!token) {
      throw new ParseError('Expected TST selector after "/"');
    }

    if (token.type === 'WORD') {
      const upper = token.lexeme.toUpperCase();
      if (allowAll && upper === 'T' && this.peek(1)?.type === 'STAR') {
        this.index += 2;
        return '*';
      }

      const value = upper.match(/^T(\d+)$/);
      const valueGroup = value?.[1];
      if (value && valueGroup) {
        this.index += 1;
        return Number(valueGroup);
      }

      if (upper === 'T' && this.peek(1)?.type === 'INTEGER') {
        const numberToken = this.peek(1);
        this.index += 2;
        return (numberToken as Extract<Token, { type: 'INTEGER' }>).value;
      }
    }

    throw new ParseError(`Expected T selector format like ${allowAll ? 'T1 or T*' : 'T1'}`, token.span);
  }

  private readRequiredValue(errorMessage: string): Token {
    this.skipWs();
    const token = this.peek();
    if (!token || ['EOF', 'WS', 'SLASH', 'STAR', 'DASH'].includes(token.type)) {
      throw new ParseError(errorMessage, token?.span);
    }

    this.index += 1;
    return token;
  }

  private expect(type: Token['type'], message: string): Token {
    const token = this.peek();
    if (!token || token.type !== type) {
      throw new ParseError(message, token?.span);
    }

    this.index += 1;
    return token;
  }

  private match(type: Token['type']): boolean {
    const token = this.peek();
    if (token?.type === type) {
      this.index += 1;
      return true;
    }

    return false;
  }

  private collectRemainingText(trimLeadingWs: boolean): string {
    let text = '';
    while (!this.isAtEnd()) {
      const token = this.peek();
      if (!token || token.type === 'EOF') {
        break;
      }
      text += token.lexeme;
      this.index += 1;
    }

    return trimLeadingWs ? text.replace(/^\s+/, '') : text;
  }

  private skipWs(): void {
    while (this.peek()?.type === 'WS') {
      this.index += 1;
    }
  }

  private isAtEnd(): boolean {
    return this.peek()?.type === 'EOF';
  }

  private peek(offset = 0): Token | undefined {
    const index = this.index + offset;
    if (index < 0 || index >= this.tokens.length) {
      return undefined;
    }

    return this.tokens[index];
  }

  private buildCommandSpan(start: SourceSpan, existing?: SourceSpan): SourceSpan {
    if (existing) {
      return existing;
    }

    let end: SourceSpan = start;
    for (let i = this.tokens.length - 1; i >= 0; i -= 1) {
      const token = this.tokens[i];
      if (!token) {
        continue;
      }
      if (token.type !== 'EOF' && token.type !== 'WS') {
        end = token.span;
        break;
      }
    }

    return { start: start.start, end: end.end };
  }
}

export function parse(input: ParseInput): ParsedCommand {
  const sourceTokens = typeof input === 'string' ? tokenize(input).tokens : input;
  const parser = new Parser(sourceTokens);
  return parser.parse();
}
