import { homeMessage, TIPS, type HomeMessageInput } from '../homeMessage';

const base: HomeMessageInput = {
  pendingCheckin: false,
  discipline: { current: 0, weekDone: false },
  water: { totalMl: 2000, goalMl: 2500, isLimit: false },
  nowTime: '10:00',
  belt: null,
  championship: null,
  dayOfYear: 3,
};

describe('homeMessage', () => {
  it('pending check-in comes first', () => {
    expect(homeMessage({ ...base, pendingCheckin: true, discipline: { current: 4, weekDone: false } })).toBe(
      'Check-in enviado. Aguardando o professor.',
    );
  });

  it('disciplina at risk while the week is not done', () => {
    expect(homeMessage({ ...base, discipline: { current: 4, weekDone: false } })).toBe(
      'Cumpra a semana até domingo para manter sua disciplina de 4 semanas.',
    );
    expect(homeMessage({ ...base, discipline: { current: 4, weekDone: true } })).toBe(TIPS[3]);
  });

  it('late water only from 17:00 and under 60 % of the goal', () => {
    const late = { ...base, water: { totalMl: 1000, goalMl: 2500, isLimit: false } };
    expect(homeMessage({ ...late, nowTime: '16:59' })).toBe(TIPS[3]);
    expect(homeMessage({ ...late, nowTime: '17:00' })).toBe('Faltam 1.500 ml para a sua meta de hoje.');
    expect(homeMessage({ ...late, nowTime: '18:00', water: { totalMl: 1600, goalMl: 2500, isLimit: false } })).toBe(TIPS[3]);
  });

  it('belt close, then championship coming, then a tip', () => {
    expect(homeMessage({ ...base, belt: { left: 2, name: 'azul' } })).toBe('Faltam 2 aulas para a faixa azul.');
    expect(homeMessage({ ...base, belt: { left: 6, name: 'azul' }, championship: { days: 5, name: 'Copa' } })).toBe(
      'Faltam 5 dias para o Copa.',
    );
    expect(homeMessage({ ...base, championship: { days: 30, name: 'Copa' } })).toBe(TIPS[3]);
  });
});
