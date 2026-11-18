/** A call to the BFF that did not work out, with the status code it answered. */
export class PanelError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PanelError';
  }
}

/** Message to show the user; the BFF and the services answer in English. */
export function messageOf(error: unknown, fallback: string): string {
  if (error instanceof PanelError && error.status === 0) {
    return 'No pudimos conectarnos con el panel. Revisa tu conexión.';
  }
  if (error instanceof PanelError && error.status === 502) {
    return 'ShareWay no respondió. Vuelve a intentarlo en un momento.';
  }
  return fallback;
}
