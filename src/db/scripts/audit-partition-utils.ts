/** Utilidades compartidas para particiones mensuales de `audit_logs`. */

export type MonthSlice = {
  /** schema_auth.audit_logs_pYYYY_MM */
  partitionName: string;
  /** Inicio inclusivo (YYYY-MM-DD) */
  fromInclusive: string;
  /** Fin exclusivo (YYYY-MM-DD) */
  toExclusive: string;
};

export function utcMonthStart(year: number, monthIndex0: number): Date {
  return new Date(Date.UTC(year, monthIndex0, 1, 0, 0, 0, 0));
}

export function sliceForUtcMonth(d: Date): MonthSlice {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const start = utcMonthStart(y, m);
  const end = utcMonthStart(y, m + 1);
  const mm = String(m + 1).padStart(2, "0");
  return {
    partitionName: `audit_logs_p${y}_${mm}`,
    fromInclusive: start.toISOString().slice(0, 10),
    toExclusive: end.toISOString().slice(0, 10),
  };
}

/** Meses desde `start` hasta `end` (ambos en UTC, día ignorado → primer día del mes). */
export function enumerateUtcMonths(start: Date, end: Date): MonthSlice[] {
  const out: MonthSlice[] = [];
  let cur = utcMonthStart(start.getUTCFullYear(), start.getUTCMonth());
  const endM = utcMonthStart(end.getUTCFullYear(), end.getUTCMonth());
  while (cur <= endM) {
    out.push(sliceForUtcMonth(cur));
    cur = utcMonthStart(cur.getUTCFullYear(), cur.getUTCMonth() + 1);
  }
  return out;
}

/** Valida identificador audit_logs_pYYYY_MM */
export function assertSafePartitionName(name: string): void {
  if (!/^audit_logs_p\d{4}_\d{2}$/.test(name)) {
    throw new Error(`Nombre de partición inválido: ${name}`);
  }
}
