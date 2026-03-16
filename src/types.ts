export const COMMAND_CODES = [
  'AN',
  'SS',
  'NM',
  'APM',
  'APE',
  'TKTL',
  'ER',
  'XE',
  'FXP',
  'FXB',
  'TTK',
  'TT',
] as const;

export type CommandCode = (typeof COMMAND_CODES)[number];

export const TOKEN_TYPES = [
  ...COMMAND_CODES,
  'WS',
  'SLASH',
  'STAR',
  'DASH',
  'INTEGER',
  'WORD',
  'FREETEXT',
  'EOF',
  'UNKNOWN',
] as const;

export type TokenType = (typeof TOKEN_TYPES)[number];

export type SourcePosition = {
  offset: number;
  line: number;
  column: number;
};

export type SourceSpan = {
  start: SourcePosition;
  end: SourcePosition;
};

type TokenBase<TType extends TokenType> = {
  type: TType;
  lexeme: string;
  span: SourceSpan;
};

export type CommandToken = TokenBase<CommandCode>;
export type WsToken = TokenBase<'WS'>;
export type SlashToken = TokenBase<'SLASH'>;
export type StarToken = TokenBase<'STAR'>;
export type DashToken = TokenBase<'DASH'>;
export type IntegerToken = TokenBase<'INTEGER'> & { value: number };
export type WordToken = TokenBase<'WORD'> & { value: string };
export type FreeTextToken = TokenBase<'FREETEXT'> & { value: string };
export type EofToken = TokenBase<'EOF'>;
export type UnknownToken = TokenBase<'UNKNOWN'>;

export type Token =
  | CommandToken
  | WsToken
  | SlashToken
  | StarToken
  | DashToken
  | IntegerToken
  | WordToken
  | FreeTextToken
  | EofToken
  | UnknownToken;

export type LexError = {
  message: string;
  span: SourceSpan;
  lexeme?: string;
};

export type LexerResult = {
  tokens: Token[];
  errors: LexError[];
};

export type CommandParam = {
  name: string;
  value: string;
};

export type Command = {
  code: CommandCode;
  params: CommandParam[];
  span?: SourceSpan;
};

export type AvailabilityCommand = Command & {
  code: 'AN';
  travelDay: string;
  travelMonth: string;
  origin: string;
  destination: string;
  airlineBrandCode?: string;
};

export type SellCommand = Command & {
  code: 'SS';
  passengerCount: number;
  bookingClass: string;
  flightNumber: number;
};

export type NameEntry = {
  count: number;
  surname: string;
  givenNames: string[];
};

export type NameCommand = Command & {
  code: 'NM';
  rawNames: string;
  entries: NameEntry[];
  title?: string;
};

export type PassengerMobileCommand = Command & {
  code: 'APM';
  mobile: string;
};

export type PassengerEmailCommand = Command & {
  code: 'APE';
  email: string;
};

export type TicketingLimitCommand = Command & {
  code: 'TKTL';
  dateCode: string;
  day: number;
  month: string;
};

export type EndRecordCommand = Command & {
  code: 'ER';
};

export type DeleteLineCommand = Command & {
  code: 'XE';
  lineNumber: number;
};

export type PricingCommand = Command & {
  code: 'FXP' | 'FXB';
};

export type TicketIssueTtkCommand = Command & {
  code: 'TTK';
  mode: 'all' | 'single';
  tstType?: number;
};

export type TicketIssueTtCommand = Command & {
  code: 'TT';
  tstType: number;
  quantity: number;
};

export type ParsedCommand =
  | AvailabilityCommand
  | SellCommand
  | NameCommand
  | PassengerMobileCommand
  | PassengerEmailCommand
  | TicketingLimitCommand
  | EndRecordCommand
  | DeleteLineCommand
  | PricingCommand
  | TicketIssueTtkCommand
  | TicketIssueTtCommand;
