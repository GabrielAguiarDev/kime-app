export const points = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
export const percent = (rate: number) => `${Math.round(rate * 100)}%`;
export const days = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
