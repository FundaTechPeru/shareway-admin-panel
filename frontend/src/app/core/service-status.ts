import type {ServiceStatus} from './models';

export interface StatusLabel {
  text: string;
  /** Suffix of the sw-badge class that paints it. */
  badge: 'ok' | 'warn' | 'down' | 'idle';
}

const STATUS_LABELS: Record<ServiceStatus, StatusLabel> = {
  OPERATIONAL: {text: 'Operativo', badge: 'ok'},
  RECOVERING: {text: 'Recuperándose', badge: 'warn'},
  DOWN: {text: 'Caído', badge: 'down'},
  NOT_CONFIGURED: {text: 'No configurado', badge: 'idle'},
  UNKNOWN: {text: 'Sin datos', badge: 'idle'},
};

/** What the services screen paints for a state the BFF reported. */
export function statusLabel(status: ServiceStatus): StatusLabel {
  return STATUS_LABELS[status] ?? STATUS_LABELS.UNKNOWN;
}

const SERVICE_LABELS: Record<string, string> = {
  'driver-management': 'Gestión de conductores',
  'trip-planning-matching': 'Planificación y emparejamiento',
  'booking-pricing': 'Reservas y tarifas',
  'payments-settlement': 'Pagos y liquidaciones',
  'trip-execution': 'Ejecución de viajes',
};

/** Name of a service in Spanish; an unknown one keeps the name the gateway reported. */
export function serviceLabel(name: string): string {
  return SERVICE_LABELS[name] ?? name;
}
