import * as cheerio from 'cheerio';
import type { SourceRecord } from '../../shared/types';

function compileRegex(expression: string): RegExp | null {
  if (!expression) {
    return null;
  }

  if (expression.startsWith('/') && expression.lastIndexOf('/') > 0) {
    const lastSlash = expression.lastIndexOf('/');
    const body = expression.slice(1, lastSlash);
    const flags = expression.slice(lastSlash + 1) || 'im';
    return new RegExp(body, flags);
  }

  return new RegExp(expression, 'im');
}

function pathTokens(pathExpression: string): Array<string | number> {
  const trimmed = String(pathExpression || '').trim();
  if (!trimmed) {
    return [];
  }

  const tokens: Array<string | number> = [];
  const matcher = /\[(\d+|".*?"|'.*?')\]|[^.[\]]+/g;

  for (const match of trimmed.matchAll(matcher)) {
    const raw = match[0];
    if (raw.startsWith('[')) {
      const inner = raw.slice(1, -1);
      if (/^\d+$/.test(inner)) {
        tokens.push(Number(inner));
      } else {
        tokens.push(inner.slice(1, -1));
      }
    } else {
      tokens.push(raw);
    }
  }

  return tokens;
}

function readByPath(input: unknown, pathExpression: string): unknown {
  const tokens = pathTokens(pathExpression);
  let current: unknown = input;

  for (const token of tokens) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof token === 'number' && Array.isArray(current)) {
      current = current[token];
      continue;
    }

    if (typeof current === 'object' && current !== null) {
      current = (current as Record<string, unknown>)[String(token)];
      continue;
    }

    return undefined;
  }

  return current;
}

function normalizeExtractedValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim().replace(/\s+/g, ' ');
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

function applyRegexIfNeeded(rawValue: string, regexExpression: string): string {
  const regex = compileRegex(regexExpression);
  if (!regex) {
    return rawValue;
  }

  const match = regex.exec(rawValue);
  if (!match) {
    throw new Error(`Regex did not match. Expression: ${regexExpression}`);
  }

  return match[1] ?? match[0];
}

function extractFromJson(textBody: string, source: SourceRecord): string {
  let parsed: unknown;

  try {
    parsed = JSON.parse(textBody) as unknown;
  } catch {
    throw new Error('Response was not valid JSON.');
  }

  const selected = source.jsonPath ? readByPath(parsed, source.jsonPath) : parsed;
  if (selected === undefined) {
    throw new Error(`JSON path did not resolve any value: ${source.jsonPath}`);
  }

  const normalized = normalizeExtractedValue(selected);
  return normalizeExtractedValue(applyRegexIfNeeded(normalized, source.regex));
}

function extractFromHtml(textBody: string, source: SourceRecord): string {
  const $ = cheerio.load(textBody);
  const selector = source.selector || 'body';
  const element = $(selector).first();

  if (!element || element.length === 0) {
    throw new Error(`Selector did not match any element: ${selector}`);
  }

  const rawValue = source.attribute ? element.attr(source.attribute) : element.text();
  if (rawValue === undefined) {
    throw new Error(`Attribute did not exist on selected element: ${source.attribute}`);
  }

  const normalized = normalizeExtractedValue(rawValue);
  return normalizeExtractedValue(applyRegexIfNeeded(normalized, source.regex));
}

export function extractSourceValue(textBody: string, source: SourceRecord): string {
  return source.type === 'json' ? extractFromJson(textBody, source) : extractFromHtml(textBody, source);
}
