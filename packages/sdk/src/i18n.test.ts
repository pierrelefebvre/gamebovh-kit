import { describe, expect, it } from 'vitest';
import { detectLang } from './i18n.ts';

describe('detectLang', () => {
  it('prend la première langue prise en charge', () => {
    expect(detectLang(['fr-FR', 'en-US'])).toBe('fr');
    expect(detectLang(['en-GB', 'fr'])).toBe('en');
    expect(detectLang(['de-DE', 'fr-CA'])).toBe('fr');
  });
  it("passe en anglais si aucune n'est prise en charge", () => {
    expect(detectLang(['de-DE', 'it'])).toBe('en');
    expect(detectLang([])).toBe('en');
  });
});
