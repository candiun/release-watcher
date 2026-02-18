function requireElement<T extends Element>(selector: string, ctor: { new (): T }): T {
  const element = document.querySelector(selector);
  if (!(element instanceof ctor)) {
    throw new Error(`Element not found or wrong type: ${selector}`);
  }
  return element;
}

export interface Elements {
  tbody: HTMLTableSectionElement;
  pollAllBtn: HTMLButtonElement;
  newSourceBtn: HTMLButtonElement;
  dialog: HTMLDialogElement;
  form: HTMLFormElement;
  dialogTitle: HTMLElement;
  cancelSourceBtn: HTMLButtonElement;
  sourceName: HTMLInputElement;
  sourceUrl: HTMLInputElement;
  sourceRequestHeaders: HTMLTextAreaElement;
  sourceType: HTMLSelectElement;
  jsonPathWrap: HTMLLabelElement;
  selectorWrap: HTMLLabelElement;
  attributeWrap: HTMLLabelElement;
  sourceJsonPath: HTMLInputElement;
  sourceSelector: HTMLInputElement;
  sourceAttribute: HTMLInputElement;
  sourceRegex: HTMLInputElement;
  sourceNotes: HTMLInputElement;
  autoPollEnabled: HTMLInputElement;
  autoPollMinutes: HTMLInputElement;
  saveSettingsBtn: HTMLButtonElement;
  toast: HTMLDivElement;
}

export function collectElements(): Elements {
  return {
    tbody: requireElement('#sources-body', HTMLTableSectionElement),
    pollAllBtn: requireElement('#poll-all-btn', HTMLButtonElement),
    newSourceBtn: requireElement('#new-source-btn', HTMLButtonElement),
    dialog: requireElement('#source-dialog', HTMLDialogElement),
    form: requireElement('#source-form', HTMLFormElement),
    dialogTitle: requireElement('#dialog-title', HTMLElement),
    cancelSourceBtn: requireElement('#cancel-source-btn', HTMLButtonElement),
    sourceName: requireElement('#source-name', HTMLInputElement),
    sourceUrl: requireElement('#source-url', HTMLInputElement),
    sourceRequestHeaders: requireElement('#source-request-headers', HTMLTextAreaElement),
    sourceType: requireElement('#source-type', HTMLSelectElement),
    jsonPathWrap: requireElement('#json-path-wrap', HTMLLabelElement),
    selectorWrap: requireElement('#selector-wrap', HTMLLabelElement),
    attributeWrap: requireElement('#attribute-wrap', HTMLLabelElement),
    sourceJsonPath: requireElement('#source-json-path', HTMLInputElement),
    sourceSelector: requireElement('#source-selector', HTMLInputElement),
    sourceAttribute: requireElement('#source-attribute', HTMLInputElement),
    sourceRegex: requireElement('#source-regex', HTMLInputElement),
    sourceNotes: requireElement('#source-notes', HTMLInputElement),
    autoPollEnabled: requireElement('#auto-poll-enabled', HTMLInputElement),
    autoPollMinutes: requireElement('#auto-poll-minutes', HTMLInputElement),
    saveSettingsBtn: requireElement('#save-settings-btn', HTMLButtonElement),
    toast: requireElement('#toast', HTMLDivElement),
  };
}
