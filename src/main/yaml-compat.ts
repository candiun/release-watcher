export type YamlParser = (text: string) => unknown;
export type YamlStringifier = (value: unknown) => string;

let parseYaml: YamlParser;
let stringifyYaml: YamlStringifier;

try {
  const YAML = require('yaml') as {
    parse: (text: string) => unknown;
    stringify: (value: unknown) => string;
  };

  parseYaml = (text: string) => YAML.parse(text);
  stringifyYaml = (value: unknown) => YAML.stringify(value);
} catch {
  // JSON is valid YAML subset. This fallback avoids hard runtime dependency.
  parseYaml = (text: string) => JSON.parse(text) as unknown;
  stringifyYaml = (value: unknown) => JSON.stringify(value, null, 2);
}

export { parseYaml, stringifyYaml };
