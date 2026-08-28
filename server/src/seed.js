import { requireDriver } from "./db.js";

export async function seedDatabase() {
  const session = requireDriver().session();
  try {
    await Promise.all([
      session.run("CREATE CONSTRAINT recipe_id IF NOT EXISTS FOR (r:Recipe) REQUIRE r.id IS UNIQUE"),
      session.run("CREATE CONSTRAINT ingredient_id IF NOT EXISTS FOR (i:Ingredient) REQUIRE i.id IS UNIQUE"),
      session.run("CREATE CONSTRAINT allergen_name IF NOT EXISTS FOR (a:Allergen) REQUIRE a.name IS UNIQUE"),
      session.run("CREATE CONSTRAINT category_name IF NOT EXISTS FOR (c:Category) REQUIRE c.name IS UNIQUE"),
    ]);
    await session.run(`
      UNWIND $recipes AS recipe
      MERGE (r:Recipe {id: recipe.id}) SET r += recipe
      WITH r, recipe
      UNWIND recipe.ingredients AS item
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
        MERGE (i)-[:HAS_SUBSTITUTE]->(s))`, { recipes: sampleRecipes });
  } finally { await session.close(); }
}

const sampleRecipes = [
  { id: "lemon-herb-chicken", name: "Lemon Herb Chicken", description: "Bright, juicy chicken with roasted vegetables.", timeMinutes: 35, difficulty: "Easy", ingredients: [
    { id: "chicken-breast", name: "Chicken breast", allergens: [], categories: ["Poultry"] },
    { id: "olive-oil", name: "Olive oil", allergens: [], categories: ["Oils"] },
    { id: "lemon", name: "Lemon", allergens: [], categories: ["Fruit"] },
  ] },
  { id: "coconut-curry", name: "Coconut Vegetable Curry", description: "Creamy coconut curry packed with colorful vegetables.", timeMinutes: 30, difficulty: "Easy", ingredients: [
    { id: "coconut-milk", name: "Coconut milk", allergens: [], categories: ["Coconut"] },
    { id: "chickpeas", name: "Chickpeas", allergens: [], categories: ["Legumes"] },
    { id: "soy-sauce", name: "Soy sauce", allergens: ["Soy", "Gluten"], categories: ["Fermented sauces"] },
  ] },
  { id: "chocolate-chip-cookies", name: "Chocolate Chip Cookies", description: "A classic bake with a crisp edge and soft center.", timeMinutes: 25, difficulty: "Medium", ingredients: [
    { id: "wheat-flour", name: "Wheat flour", allergens: ["Gluten"], categories: ["Grains"], substitutes: [{ id: "rice-flour", name: "Rice flour" }] },
    { id: "butter", name: "Butter", allergens: ["Dairy"], categories: ["Dairy"] },
    { id: "peanut-butter", name: "Peanut butter", allergens: ["Peanut"], categories: ["Legumes"] },
  ] },
  { id: "garden-quinoa-bowl", name: "Garden Quinoa Bowl", description: "A colorful quinoa bowl with herbs, greens, and citrus dressing.", timeMinutes: 20, difficulty: "Easy", ingredients: [
    { id: "quinoa", name: "Quinoa", allergens: [], categories: ["Grains"] },
    { id: "avocado", name: "Avocado", allergens: [], categories: ["Fruit"] },
    { id: "lemon-dressing", name: "Lemon dressing", allergens: [], categories: ["Dressings"] },
  ] },
  { id: "shrimp-rice-noodles", name: "Shrimp Rice Noodles", description: "Rice noodles tossed with shrimp, vegetables, and a savory sauce.", timeMinutes: 28, difficulty: "Medium", ingredients: [
    { id: "shrimp", name: "Shrimp", allergens: ["Shellfish"], categories: ["Seafood"] },
    { id: "rice-noodles", name: "Rice noodles", allergens: [], categories: ["Grains"] },
    { id: "tamari", name: "Tamari", allergens: ["Soy"], categories: ["Fermented sauces"], substitutes: [{ id: "coconut-aminos", name: "Coconut aminos" }] },
  ] },
  { id: "sunflower-hummus", name: "Sunflower Seed Hummus", description: "A creamy, nut-free dip with chickpeas and lemon.", timeMinutes: 15, difficulty: "Easy", ingredients: [
    { id: "sunflower-seeds", name: "Sunflower seeds", allergens: [], categories: ["Seeds"], substitutes: [{ id: "pumpkin-seeds", name: "Pumpkin seeds" }] },
    { id: "chickpeas-hummus", name: "Chickpeas", allergens: [], categories: ["Legumes"] },
    { id: "tahini", name: "Tahini", allergens: ["Sesame"], categories: ["Seeds"] },
  ] },
];
