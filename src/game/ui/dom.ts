export interface ElementOptions {
  className?: string;
  text?: string;
  attributes?: Readonly<Record<string, string>>;
}

/** Builds an element without touching `innerHTML`, so interface text can never be parsed as markup. */
export function createElement<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  options: ElementOptions = {},
  children: readonly (Node | string)[] = [],
): HTMLElementTagNameMap[Tag] {
  const element = document.createElement(tag);
  if (options.className) {
    element.className = options.className;
  }
  if (options.text !== undefined) {
    element.textContent = options.text;
  }
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    element.setAttribute(name, value);
  }
  element.append(...children);
  return element;
}

/**
 * Sets an attribute afresh, so that a CSS animation keyed to it runs again
 * even if the attribute was already there.
 */
export function restartAnimation(element: HTMLElement, attribute: string): void {
  element.removeAttribute(attribute);
  void element.offsetWidth; // Reading a layout value makes the browser register the removal before the attribute returns.
  element.setAttribute(attribute, '');
}

let nextId = 0;

/** Document-unique id, for wiring `aria-labelledby` between generated elements. */
export function uniqueId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}
