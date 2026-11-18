import {describe, expect, it} from 'vitest';
import {documentLabel} from './document-type';

describe('document labels', () => {
  it('names each document type in Spanish', () => {
    expect(documentLabel('DRIVERS_LICENSE')).toBe('Licencia de conducir');
    expect(documentLabel('CRIMINAL_RECORD')).toBe('Antecedentes penales');
  });

  it('keeps an unknown type as the service reported it', () => {
    expect(documentLabel('SOAT')).toBe('SOAT');
  });
});
