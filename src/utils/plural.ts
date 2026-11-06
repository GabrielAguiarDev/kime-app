/** "1 aula" / "6 aulas". */
export const countOf = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Falta 1 aula" / "Faltam 6 aulas" (verb agrees with the count). */
export const missing = (n: number, one: string, many: string) => `${n === 1 ? 'Falta' : 'Faltam'} ${countOf(n, one, many)}`;
