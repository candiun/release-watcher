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

function getChildValue(parent: unknown, key: string): unknown {
  if (parent === null || parent === undefined) {
    return undefined;
  }

  if (Array.isArray(parent) && /^\d+$/.test(key)) {
    return parent[Number(key)];
  }

  if (typeof parent === 'object') {
    return (parent as Record<string, unknown>)[key];
  }

  return undefined;
}

// Supports jq-like selectors such as `.data[].id` and simple dot/index paths like `0.name`.
function selectJsonValue(input: unknown, selectorExpression: string): unknown {
  const trimmed = selectorExpression.trim();
  if (!trimmed) {
    return input;
  }

  const normalized = trimmed.startsWith('.') ? trimmed.slice(1) : trimmed;
  if (!normalized) {
    return input;
  }

  const segments = normalized
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

  let current: unknown[] = [input];

  for (const segment of segments) {
    const wildcardMatch = /^(.*)\[\]$/.exec(segment);
    const indexedMatch = /^(.*)\[(\d+)\]$/.exec(segment);

    const next: unknown[] = [];

    if (wildcardMatch) {
      const key = wildcardMatch[1];
      for (const value of current) {
        const target = key ? getChildValue(value, key) : value;
        if (Array.isArray(target)) {
          for (const item of target as unknown[]) {
            next.push(item);
          }
        }
      }
      current = next;
      continue;
    }

    if (indexedMatch) {
      const key = indexedMatch[1];
      const index = Number(indexedMatch[2]);

      for (const value of current) {
        const target = key ? getChildValue(value, key) : value;
        if (Array.isArray(target)) {
          const item = (target as unknown[])[index];
          if (item !== undefined) {
            next.push(item);
          }
        }
      }

      current = next;
      continue;
    }

    for (const value of current) {
      const item = getChildValue(value, segment);
      if (item !== undefined) {
        next.push(item);
      }
    }

    current = next;
  }

  if (current.length === 0) {
    return undefined;
  }

  return current.length === 1 ? current[0] : current;
}

function extractFromJson(textBody: string, source: SourceRecord): unknown {
  let parsed: unknown;

  try {
    parsed = JSON.parse(textBody) as unknown;
  } catch {
    throw new Error('Response was not valid JSON.');
  }

  const selected = selectJsonValue(parsed, source.outputSelector);
  if (selected === undefined) {
    throw new Error(`Selector did not resolve any value: ${source.outputSelector}`);
  }

  if (!source.regex) {
    return selected;
  }

  const normalized = normalizeExtractedValue(selected);
  return normalizeExtractedValue(applyRegexIfNeeded(normalized, source.regex));
}

function extractFromHtml(textBody: string, source: SourceRecord): string {
  const $ = cheerio.load(textBody);
  const selector = source.selector || 'body';
  const element = $(selector).first();

  if (element.length === 0) {
    throw new Error(`Selector did not match any element: ${selector}`);
  }

  const rawValue = source.attribute ? element.attr(source.attribute) : element.text();
  if (rawValue === undefined) {
    throw new Error(`Attribute did not exist on selected element: ${source.attribute}`);
  }

  const normalized = normalizeExtractedValue(rawValue);
  return normalizeExtractedValue(applyRegexIfNeeded(normalized, source.regex));
}

export function extractSourceValue(textBody: string, source: SourceRecord): unknown {
  return source.type === 'json'
    ? extractFromJson(textBody, source)
    : extractFromHtml(textBody, source);
}
