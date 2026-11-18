import {describe, expect, it} from 'vitest';
import {serviceLabel, statusLabel} from './service-status';

describe('service status', () => {
  it('paints each state of the circuit as the screen says it', () => {
    expect(statusLabel('OPERATIONAL')).toEqual({
      text: 'Operativo',
      badge: 'ok',
    });
    expect(statusLabel('RECOVERING').badge).toBe('warn');
    expect(statusLabel('DOWN')).toEqual({text: 'Caído', badge: 'down'});
    expect(statusLabel('NOT_CONFIGURED').text).toBe('No configurado');
    expect(statusLabel('UNKNOWN').text).toBe('Sin datos');
  });

  it('names the services in Spanish and keeps an unknown one as it came', () => {
    expect(serviceLabel('payments-settlement')).toBe('Pagos y liquidaciones');
    expect(serviceLabel('chat')).toBe('chat');
  });
});
