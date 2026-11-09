import type { TrailEnvironment, TrailStopKind } from '@domain/Classes';

/**
 * Texts of the trail stops (pt-BR), by environment (1 Amanhecer … 5
 * Tempestade) and stop kind. Tone: direct, like a teacher on the mat; one or
 * two sentences. Each group has a few variations; the stop's position picks
 * one, so the same stop always shows the same text.
 */
export const TRAIL_TEXTS: Record<TrailEnvironment, Record<TrailStopKind, string[]>> = {
  1: {
    start: [
      'Todo faixa preta já esteve exatamente aqui. Continue aparecendo.',
      'O primeiro passo é entrar no tatame. Você já deu.',
      'Ninguém nasce sabendo cair. Por isso a gente treina.',
    ],
    middle: [
      'Aparecer é metade do caminho. A outra metade é voltar amanhã.',
      'Cada aula deixa um detalhe. Junte todos.',
      'Ainda é cedo. Constância agora vale mais que força.',
    ],
    near: [
      'O básico está entrando no corpo. Não pare agora.',
      'Falta pouco. Treine como se a faixa já fosse sua.',
      'Você já não é quem entrou aqui no primeiro dia.',
    ],
    graduation: [
      'A primeira faixa é a prova de que você voltou. Muitos não voltam.',
      'Aqui termina o começo. O professor decide quando você atravessa.',
    ],
  },
  2: {
    start: [
      'Faixa nova, contagem zerada. O trabalho recomeça.',
      'Agora você conhece o caminho. Ande nele com mais atenção.',
      'O que era difícil virou rotina. Procure o próximo difícil.',
    ],
    middle: [
      'Repetição não é tédio. É assim que a técnica fica.',
      'Treine com quem é melhor que você. É de propósito.',
      'Um dia ruim no tatame ainda conta. Volte.',
    ],
    near: [
      'Os detalhes começam a aparecer. Preste atenção neles.',
      'Mais algumas aulas. Chegue cedo, saia por último.',
      'Você já ensina sem perceber. Quem chegou depois está olhando.',
    ],
    graduation: [
      'Graduar é consequência. Continue fazendo o que te trouxe até aqui.',
      'Essa faixa se conquista nos dias em que você quase não veio.',
    ],
  },
  3: {
    start: [
      'O caminho ficou mais pesado. Você também ficou mais forte.',
      'Daqui pra frente, o progresso é mais lento. E mais seu.',
      'A faixa mudou. A exigência também.',
    ],
    middle: [
      'Cansaço faz parte. Desistir não precisa fazer.',
      'Quem chega aqui já perdeu muitas vezes. E voltou todas.',
      'Agora não é sobre aprender mais. É sobre errar menos.',
    ],
    near: [
      'Faltam poucas aulas. Não deixe a pressa estragar o trabalho.',
      'Você está perto. Mantenha o ritmo que te trouxe.',
      'O tatame lembra de cada treino. Faça os últimos valerem.',
    ],
    graduation: [
      'Poucos chegam até aqui. Quem chega sabe o preço.',
      'Essa faixa pesa diferente. Você vai sentir quando amarrar.',
    ],
  },
  4: {
    start: [
      'Pouca gente anda por aqui. Continue mesmo assim.',
      'Ninguém mais te empurra. Agora o motivo é seu.',
      'A noite é longa nessa faixa. Treine no escuro também.',
    ],
    middle: [
      'Disciplina é treinar quando a vontade não aparece.',
      'Você já sabe o que fazer. Agora faça melhor.',
      'Os outros olham pra você no treino. Dê o exemplo.',
    ],
    near: [
      'Está quase. Respeite o processo até o fim.',
      'Mais um bloco. Não afrouxe agora.',
      'Você chegou longe demais para parar aqui.',
    ],
    graduation: [
      'Essa faixa é de quem ficou quando todo mundo foi embora.',
      'Anos de tatame cabem num nó. O professor sabe a hora.',
    ],
  },
  5: {
    start: [
      'Aqui o caminho não fica mais fácil. Você fica mais firme.',
      'A tempestade não passa. Você aprende a treinar dentro dela.',
      'Quem chega aqui não treina pela faixa. Treina pelo tatame.',
    ],
    middle: [
      'Todo treino agora é exemplo para alguém.',
      'Volte ao básico. É ele que segura tudo.',
      'Ainda há o que aprender. Sempre vai haver.',
    ],
    near: [
      'O fim da trilha está perto. O caminho não termina.',
      'Continue aparecendo. É o que sempre funcionou.',
      'Mais algumas aulas. Faça cada uma como a primeira.',
    ],
    graduation: [
      'Você atravessou a tempestade. Agora ensine o caminho.',
      'Faixa nenhuma termina a jornada. Essa só muda quem você é no tatame.',
    ],
  },
};

/** Text of the last belt ("Faixa máxima"). */
export const TRAIL_FINAL_TEXT = 'Você chegou ao topo da trilha. O tatame continua te esperando todo dia.';

/** Same stop, same text: the variation comes from the section and stop positions. */
export function trailText(environment: TrailEnvironment, kind: TrailStopKind, section: number, stop: number): string {
  const options = TRAIL_TEXTS[environment][kind];
  return options[(section * 7 + stop * 3) % options.length]!;
}
