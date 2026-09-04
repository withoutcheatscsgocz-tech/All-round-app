import { describe, expect, it } from 'vitest';
import {
  formatAmount, mergeShoppingItems, parseAmount, parseIngredient, parseIngredients,
  parseIsoDuration, parseRecipeFromHtml, scaleIngredients,
} from './parse';

describe('parseAmount', () => {
  it('rozumí číslům, desetinné čárce i zlomkům', () => {
    expect(parseAmount('250')).toBe(250);
    expect(parseAmount('1,5')).toBe(1.5);
    expect(parseAmount('½')).toBe(0.5);
    expect(parseAmount('1½')).toBe(1.5);
    expect(parseAmount('1 1/2')).toBe(1.5);
    expect(parseAmount('3/4')).toBe(0.75);
    expect(parseAmount('trocha')).toBeUndefined();
  });
});

describe('parseIngredient', () => {
  it('rozdělí běžný český zápis', () => {
    expect(parseIngredient('250 g hladké mouky')).toEqual({
      amount: 250, unit: 'g', name: 'hladké mouky',
    });
    expect(parseIngredient('2 lžíce oleje')).toEqual({
      amount: 2, unit: 'lžíce', name: 'oleje',
    });
    expect(parseIngredient('1,5 dl mléka')).toEqual({
      amount: 1.5, unit: 'dl', name: 'mléka',
    });
  });

  it('zvládne odrážky i množství bez jednotky', () => {
    expect(parseIngredient('- 3 vejce')).toEqual({ amount: 3, name: 'vejce' });
    expect(parseIngredient('• 2 stroužky česneku')).toEqual({
      amount: 2, unit: 'stroužky', name: 'česneku',
    });
  });

  it('když množství chybí, nechá celý text jako název', () => {
    expect(parseIngredient('sůl podle chuti')).toEqual({ name: 'sůl podle chuti' });
    expect(parseIngredient('   ')).toBeNull();
  });

  it('rozebere celý blok najednou a prázdné řádky přeskočí', () => {
    const out = parseIngredients('250 g mouky\n\n3 vejce\nsůl');
    expect(out).toHaveLength(3);
    expect(out[2]).toEqual({ name: 'sůl' });
  });
});

describe('scaleIngredients', () => {
  const base = [
    { amount: 250, unit: 'g', name: 'mouka' },
    { amount: 3, name: 'vejce' },
    { name: 'sůl' },
  ];

  it('přepočítá množství na jiný počet porcí', () => {
    const out = scaleIngredients(base, 4, 6);
    expect(out[0].amount).toBe(375);
    expect(out[1].amount).toBe(4.5);
    expect(out[2].amount).toBeUndefined();
  });

  it('zaokrouhluje tak, aby se to dalo odvážit', () => {
    // Nad deset jednotek nemá desetinné místo smysl, pod jednou naopak ano.
    expect(scaleIngredients([{ amount: 250, unit: 'g', name: 'x' }], 3, 1)[0].amount).toBe(83);
    expect(scaleIngredients([{ amount: 5, unit: 'dl', name: 'x' }], 4, 6)[0].amount).toBe(7.5);
    expect(scaleIngredients([{ amount: 1, unit: 'lžíce', name: 'x' }], 3, 1)[0].amount).toBe(0.33);
  });

  it('stejný počet porcí nechá recept beze změny', () => {
    expect(scaleIngredients(base, 4, 4)).toBe(base);
    expect(scaleIngredients(base, 0, 4)).toBe(base);
  });
});

describe('formatAmount', () => {
  it('píše čísla česky s čárkou', () => {
    expect(formatAmount({ amount: 250, unit: 'g', name: 'x' })).toBe('250 g');
    expect(formatAmount({ amount: 1.5, unit: 'dl', name: 'x' })).toBe('1,5 dl');
    expect(formatAmount({ amount: 3, name: 'x' })).toBe('3');
    expect(formatAmount({ name: 'x' })).toBe('');
  });
});

describe('mergeShoppingItems', () => {
  it('sečte stejnou surovinu se stejnou jednotkou', () => {
    const out = mergeShoppingItems([
      { amount: 250, unit: 'g', name: 'Mouka' },
      { amount: 150, unit: 'g', name: 'mouka' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].amount).toBe(400);
  });

  it('různé jednotky nechá zvlášť, protože přepočet by byl hádání', () => {
    const out = mergeShoppingItems([
      { amount: 2, unit: 'lžíce', name: 'olej' },
      { amount: 30, unit: 'g', name: 'olej' },
    ]);
    expect(out).toHaveLength(2);
  });

  it('spočítá, kolikrát se surovina objevila bez množství', () => {
    const out = mergeShoppingItems([{ name: 'sůl' }, { name: 'sůl' }]);
    expect(out[0].countWithoutAmount).toBe(2);
    expect(out[0].amount).toBeUndefined();
  });
});

describe('parseIsoDuration', () => {
  it('převede ISO 8601 na minuty', () => {
    expect(parseIsoDuration('PT30M')).toBe(30);
    expect(parseIsoDuration('PT1H30M')).toBe(90);
    expect(parseIsoDuration('PT2H')).toBe(120);
    expect(parseIsoDuration('P1DT2H')).toBe(1560);
    expect(parseIsoDuration('nesmysl')).toBeUndefined();
    expect(parseIsoDuration(undefined)).toBeUndefined();
  });
});

describe('parseRecipeFromHtml', () => {
  const html = `
    <html><head>
    <script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[
      {"@type":"WebPage","name":"Stránka"},
      {"@type":"Recipe","name":"Bramborový salát",
       "description":"Klasika k řízku",
       "recipeYield":"6 porcí",
       "prepTime":"PT30M","cookTime":"PT20M",
       "keywords":"vánoce, příloha",
       "recipeIngredient":["1 kg brambor","3 vejce","sůl"],
       "recipeInstructions":[{"@type":"HowToStep","text":"Uvař brambory."},
                             {"@type":"HowToStep","text":"Nakrájej a smíchej."}]}
    ]}
    </script></head><body></body></html>`;

  it('vytáhne recept z JSON-LD včetně vnořeného @graph', () => {
    const recipe = parseRecipeFromHtml(html, 'https://example.cz/salat');
    expect(recipe).not.toBeNull();
    expect(recipe!.title).toBe('Bramborový salát');
    expect(recipe!.portions).toBe(6);
    expect(recipe!.prepMinutes).toBe(30);
    expect(recipe!.cookMinutes).toBe(20);
    expect(recipe!.tags).toEqual(['vánoce', 'příloha']);
    expect(recipe!.ingredients[0]).toEqual({ amount: 1, unit: 'kg', name: 'brambor' });
    expect(recipe!.steps).toEqual(['Uvař brambory.', 'Nakrájej a smíchej.']);
    expect(recipe!.source).toBe('https://example.cz/salat');
  });

  it('zvládne i samotný JSON bez HTML', () => {
    const json = '{"@type":"Recipe","name":"Toust","recipeIngredient":["2 plátky chleba"]}';
    expect(parseRecipeFromHtml(json)?.title).toBe('Toust');
  });

  it('zvládne instrukce jako jeden dlouhý text', () => {
    const json = '{"@type":"Recipe","name":"X","recipeInstructions":"Krok jedna.\\nKrok dva."}';
    expect(parseRecipeFromHtml(json)?.steps).toEqual(['Krok jedna.', 'Krok dva.']);
  });

  it('stránka bez receptu vrátí null', () => {
    expect(parseRecipeFromHtml('<html><body>nic tu není</body></html>')).toBeNull();
    expect(parseRecipeFromHtml('{"@type":"Article","name":"X"}')).toBeNull();
  });

  it('bez uvedeného počtu porcí použije čtyři', () => {
    expect(parseRecipeFromHtml('{"@type":"Recipe","name":"X"}')?.portions).toBe(4);
  });
});
