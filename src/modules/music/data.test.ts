import { describe, expect, it } from 'vitest';
import { guessFromFilename, shuffled } from './data';

describe('guessFromFilename', () => {
  it('rozdělí „Interpret - Název"', () => {
    expect(guessFromFilename('Kabát - Malá dáma.mp3')).toEqual({
      artist: 'Kabát', title: 'Malá dáma',
    });
  });

  it('pomlčku v názvu skladby nerozbije', () => {
    expect(guessFromFilename('Chinaski - Dobrák od kosti - live.mp3')).toEqual({
      artist: 'Chinaski', title: 'Dobrák od kosti - live',
    });
  });

  it('bez pomlčky použije celý název souboru', () => {
    expect(guessFromFilename('nahravka01.m4a')).toEqual({ title: 'nahravka01' });
  });
});

describe('shuffled', () => {
  it('zachová všechny prvky a původní pole nechá být', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffled(input);
    expect(out).toHaveLength(5);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it('prázdné pole nevadí', () => {
    expect(shuffled([])).toEqual([]);
  });
});
