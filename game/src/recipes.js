// SATE BAKAR — the four recipes and their ordered step paths.
// Each recipe is a UNIQUE order of steps; serving in the wrong order fails the dish.
// Steps: skewer <ingredient>, chop, grill, sauce <id>, garnish <id>, serve.
export const RECIPES = [
  {
    id: 'ayam',
    name: 'Sate Ayam Madura',
    color: '#f2a65a',
    steps: [
      { kind: 'skewer', item: 'chicken', label: 'Tusuk Ayam' },
      { kind: 'chop', label: 'Potong' },
      { kind: 'grill', label: 'Bakar' },
      { kind: 'sauce', item: 'peanut', label: 'Saus Kacang' },
      { kind: 'sauce', item: 'kecap', label: 'Kecap' },
      { kind: 'garnish', item: 'ketupat', label: 'Ketupat' },
      { kind: 'garnish', item: 'onion', label: 'Bawang' },
    ],
    base: 100,
  },
  {
    id: 'sapi',
    name: 'Sate Sapi Ponorogo',
    color: '#c0392b',
    steps: [
      { kind: 'skewer', item: 'beef', label: 'Tusuk Sapi' },
      { kind: 'skewer', item: 'mushroom', label: '+ Jamur' },
      { kind: 'chop', label: 'Potong' },
      { kind: 'grill', label: 'Bakar' },
      { kind: 'sauce', item: 'kecap', label: 'Kecap' },
      { kind: 'garnish', item: 'cucumber', label: 'Timun' },
    ],
    base: 120,
  },
  {
    id: 'tahu',
    name: 'Sate Tahu-Tempe',
    color: '#fdf3d0',
    steps: [
      { kind: 'skewer', item: 'tofu', label: 'Tusuk Tahu' },
      { kind: 'skewer', item: 'tempeh', label: '+ Tempe' },
      { kind: 'chop', label: 'Potong' },
      { kind: 'grill', label: 'Bakar' },
      { kind: 'sauce', item: 'sambal', label: 'Sambal' },
      { kind: 'garnish', item: 'krupuk', label: 'Krupuk' },
    ],
    base: 90,
  },
  {
    id: 'campur',
    name: 'Sate Campur',
    color: '#ffd166',
    steps: [
      { kind: 'skewer', item: 'chicken', label: 'Tusuk Ayam' },
      { kind: 'skewer', item: 'beef', label: '+ Sapi' },
      { kind: 'skewer', item: 'tofu', label: '+ Tahu' },
      { kind: 'chop', label: 'Potong' },
      { kind: 'grill', label: 'Bakar' },
      { kind: 'sauce', item: 'peanut', label: 'Saus Kacang' },
      { kind: 'sauce', item: 'kecap', label: 'Kecap' },
      { kind: 'garnish', item: 'onion', label: 'Bawang' },
    ],
    base: 150,
  },
];

// The shift's bonus recipe (Pesanan Emas / Bahan Langka) is chosen
// deterministically from the seed in fun.js and registered here, so every
// lookup — customers, the pilot, the path validator — sees the same list.
let BONUS_RECIPE = null;
export function setBonusRecipe(r) { BONUS_RECIPE = r; }
export function getBonusRecipe() { return BONUS_RECIPE; }
export function allRecipes() { return BONUS_RECIPE ? [...RECIPES, BONUS_RECIPE] : RECIPES; }

export function recipeById(id) {
  if (id === 'langka' && BONUS_RECIPE) return BONUS_RECIPE;
  return RECIPES.find((r) => r.id === id) || null;
}

// The ordered-path validator: given the steps a plate has actually taken and the
// recipe it claims to be, return how far along the true path it is and whether it
// has gone wrong. A wrong step fails the dish (the plate must restart).
export function validatePath(taken, recipe) {
  let matched = 0;
  for (let i = 0; i < taken.length; i += 1) {
    const want = recipe.steps[i];
    const got = taken[i];
    if (!want || got.kind !== want.kind || (want.item && got.item !== want.item)) {
      return { matched, ok: false, wrongAt: i, complete: false };
    }
    matched = i + 1;
  }
  return { matched, ok: true, wrongAt: -1, complete: matched === recipe.steps.length };
}

// Next step the plate still needs, for the pulsing path line on screen.
export function nextStep(taken, recipe) {
  return recipe.steps[taken.length] || null;
}
