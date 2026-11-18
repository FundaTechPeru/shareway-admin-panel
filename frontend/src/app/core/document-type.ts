import type {DriverDocumentType} from './models';

const DOCUMENT_LABELS: Record<DriverDocumentType, string> = {
  DRIVERS_LICENSE: 'Licencia de conducir',
  NATIONAL_ID: 'Documento de identidad',
  CRIMINAL_RECORD: 'Antecedentes penales',
  VEHICLE_REGISTRATION: 'Tarjeta de propiedad',
};

/** Name of a document type in Spanish; an unknown one keeps the code the service reported. */
export function documentLabel(type: string): string {
  return DOCUMENT_LABELS[type as DriverDocumentType] ?? type;
}

/** Shortest reason the services accept when a document is rejected. */
export const MIN_REASON_LENGTH = 5;
