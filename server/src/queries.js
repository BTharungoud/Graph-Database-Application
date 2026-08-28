import { requireDriver } from "./db.js";

const toNative = (value) => neo4jValue(value);
function neo4jValue(value) {
  if (value && typeof value.toNumber === "function") return value.toNumber();
  if (Array.isArray(value)) return value.map(neo4jValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, neo4jValue(v)]));
  return value;
}

export async function getAllergens() {
  const session = requireDriver().session();
  try {
    const result = await session.run("MATCH (a:Allergen) RETURN a ORDER BY a.name", {});
    return result.records.map((record) => toNative(record.get("a").properties));
  } finally { await session.close(); }
}

export async function findSafeRecipes(allergens = [], search = "", page = 1, pageSize = 6) {
  const session = requireDriver().session();
  try {
    const params = { allergens, search, skip: (page - 1) * pageSize, limit: pageSize };
    const filter = `
      MATCH (r:Recipe)
      OPTIONAL MATCH (r)-[:CONTAINS]->(i:Ingredient)-[:TRIGGERS]->(a:Allergen)
      WITH r, collect(DISTINCT a.name) AS recipeAllergens
      WHERE all(allergen IN $allergens WHERE NOT allergen IN recipeAllergens)
        AND toLower(r.name) CONTAINS toLower($search)`;
    const countResult = await session.run(`${filter} RETURN count(r) AS total`, params);
    const result = await session.run(`${filter}
      RETURN r { .id, .name, .description, .image, .timeMinutes, .difficulty, allergens: recipeAllergens } AS recipe
      ORDER BY r.name SKIP $skip LIMIT $limit`, params);
    const recipes = result.records.map((record) => toNative(record.get("recipe")));
    const total = toNative(countResult.records[0].get("total"));
    return { recipes, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  } finally { await session.close(); }
}

export async function createRecipe(recipe) {
  const session = requireDriver().session();
  try {
    const result = await session.run(`
      MERGE (r:Recipe {id: $recipe.id})
      SET r.name = $recipe.name, r.description = $recipe.description,
          r.timeMinutes = $recipe.timeMinutes, r.difficulty = $recipe.difficulty
      WITH r
      UNWIND $recipe.ingredients AS item
      MERGE (i:Ingredient {id: item.id}) SET i.name = item.name
      MERGE (r)-[:CONTAINS]->(i)
      FOREACH (allergen IN coalesce(item.allergens, []) |
        MERGE (a:Allergen {name: allergen})
        MERGE (i)-[:TRIGGERS]->(a))
      FOREACH (category IN coalesce(item.categories, []) |
        MERGE (c:Category {name: category})
        MERGE (i)-[:BELONGS_TO]->(c))
      FOREACH (substitute IN coalesce(item.substitutes, []) |
        MERGE (s:Ingredient {id: substitute.id}) SET s.name = substitute.name
        MERGE (i)-[:HAS_SUBSTITUTE]->(s))
      RETURN r { .id, .name, .description, .timeMinutes, .difficulty } AS recipe`, { recipe });
    return toNative(result.records[0].get("recipe"));
  } finally { await session.close(); }
}

export async function getRecipe(id, allergens = []) {
  const session = requireDriver().session();
  try {
    const result = await session.run(`
      MATCH (r:Recipe {id: $id})
      OPTIONAL MATCH (r)-[:CONTAINS]->(i:Ingredient)
      OPTIONAL MATCH (i)-[:TRIGGERS]->(a:Allergen)
      OPTIONAL MATCH (i)-[:HAS_SUBSTITUTE]->(s:Ingredient)
      WITH r, i, collect(DISTINCT a.name) AS ingredientAllergens, collect(DISTINCT s { .id, .name }) AS substitutes
      RETURN r { .id, .name, .description, .instructions, .image, .timeMinutes, .difficulty },
        collect(DISTINCT i { .id, .name, allergens: ingredientAllergens, substitutes: substitutes }) AS ingredients,
        [x IN collect(DISTINCT i) WHERE x IS NOT NULL | x.name] AS ingredientNames`, { id, allergens });
    if (!result.records.length) return null;
    const row = result.records[0];
    const recipe = toNative(row.get(0));
    recipe.ingredients = toNative(row.get("ingredients"));
    recipe.isSafe = recipe.ingredients.every((ingredient) => ingredient.allergens.every((a) => !allergens.includes(a)));
    recipe.conflicts = recipe.ingredients.filter((ingredient) => ingredient.allergens.some((a) => allergens.includes(a)));
    return recipe;
  } finally { await session.close(); }
}

export async function getCrossReactivity(allergen) {
  const session = requireDriver().session();
  try {
    const result = await session.run(`
      MATCH (a:Allergen {name: $allergen})<-[:TRIGGERS]-(i:Ingredient)-[:BELONGS_TO]->(c:Category)<-[:BELONGS_TO]-(related:Ingredient)
      WHERE i <> related
      RETURN c.name AS category, collect(DISTINCT related.name) AS ingredients
      ORDER BY category`, { allergen });
    return result.records.map((record) => ({ category: record.get("category"), ingredients: toNative(record.get("ingredients")) }));
  } finally { await session.close(); }
}
