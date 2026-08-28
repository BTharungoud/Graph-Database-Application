# GraphDBApp — Smart Food Allergen & Safe Recipe Navigator

GraphDBApp is a React + Express application that uses Neo4j to answer food-safety questions through connected data rather than flat ingredient lists.

## Product scope

The core traversal is:

`Recipe -[CONTAINS]-> Ingredient -[TRIGGERS]-> Allergen`

Ingredients can also connect to `Category` nodes and safe alternatives through `HAS_SUBSTITUTE`. This supports filtering recipes for one or more allergens, explaining conflicts, finding substitutes, intersecting safe recipes for several diners, and exploring related ingredients by category.

This is decision support, not medical advice. Users must verify packaging, cross-contact warnings, and clinical guidance.

## Why a graph database?

The important question is a relationship question: “Does this recipe contain an ingredient that triggers one of my allergens?” In a relational schema, that answer crosses several join tables—recipes, recipe ingredients, ingredients, categories, allergen mappings, and user profiles. Neo4j represents those connections directly, so the safety check is an understandable multi-hop traversal. The same model also makes substitute discovery, shared safety across several diners, and related-ingredient exploration natural extensions instead of increasingly complex join logic. The graph earns its place because relationships are the product, not just storage details.

## Stack

- `client/`: React and Vite single-page UI
- `server/`: Node.js, Express, and the official Neo4j driver
- database: Neo4j Aura / Cognodb over Bolt+

## Run locally

Install Node.js 18+ (recommended). Node.js 16 is also supported by the pinned Vite 4 client dependency.

Install and configure each project independently:

```powershell
cd server
npm install
prepare .env
npm run dev
```

In a second terminal:

```powershell
cd client
npm install
prepare .env
npm run dev
```

Leave `client/.env` as `VITE_API_URL=` for local development. Open `http://localhost:5173`, then seed the demonstration graph with `POST http://localhost:4000/api/seed`.

The frontend includes a small demo fallback, so its layout remains inspectable when Neo4j is unavailable. Live results replace it automatically after the API connects.

## Create and configure a CognoDB instance

The server project expects a Neo4j-compatible CognoDB instance that exposes a secure Bolt endpoint.

1. Sign in to the CognoDB console and create a new database/instance.
2. Choose a database name, region, and development sizing appropriate for the project.
3. Create or note the database username and generate a strong password.
4. Copy the instance’s secure Bolt URI (`bolt+s://...`) into `NEO4J_URI`.
5. Copy the username and password into `NEO4J_USERNAME` and `NEO4J_PASSWORD` in a local `.env` file.
6. Allow the client IP/network in the instance access settings if CognoDB requires an allowlist.
7. Start the API and confirm `GET /api/health` returns `{ "status": "ok" }`.
8. Run `POST /api/seed` once to create constraints and load the demonstration graph.

The exact console labels may vary by CognoDB account/version; the required values are the secure Bolt URI, username, and password. Put these only in `server/.env`; never put them in the client project or source control.

## API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check Neo4j connectivity |
| GET | `/api/allergens` | List available allergens |
| GET | `/api/recipes?allergens=Peanut,Gluten&search=chicken&page=1&pageSize=6` | Search and return six paginated recipes safe for all selected allergens |
| GET | `/api/recipes/:id?allergens=Peanut` | Return ingredients, conflicts, and substitutes |
| GET | `/api/cross-reactivity/:allergen` | Explore related category ingredients |
| POST | `/api/recipes` | Add a recipe and its graph relationships from the client/admin form |
| POST | `/api/seed` | Insert sample graph data |

## Graph model

```text
(Recipe)-[:CONTAINS]->(Ingredient)-[:TRIGGERS]->(Allergen)
                         |
                         +--[:BELONGS_TO]->(Category)
                         +--[:HAS_SUBSTITUTE]->(Ingredient)
```

The safe-recipe query uses `all(...)` over the selected allergen list, so a recipe is returned only if none of its traversed allergen paths match the profile.

## Main graph queries explained

### Safe recipe filtering

`findSafeRecipes` starts at every `Recipe`, follows `CONTAINS` to ingredients, and follows `TRIGGERS` to allergen nodes. It collects the allergens reached for each recipe and applies `all(allergen IN $allergens WHERE NOT allergen IN recipeAllergens)`. Every selected allergen must be absent before the recipe is returned.

### Recipe safety explanation and substitutes

`getRecipe` returns each ingredient, the allergens reached from it, and any `HAS_SUBSTITUTE` ingredients. Express marks an ingredient as a conflict when its reached allergen is in the user profile. This gives the UI an explainable path instead of only a yes/no result.

### Cross-reactivity exploration

`getCrossReactivity` traverses `Allergen <-[:TRIGGERS]- Ingredient -[:BELONGS_TO]-> Category <-[:BELONGS_TO]- related Ingredient`. It groups related ingredients by category, allowing the application to surface connected ingredients that deserve further label checking.

### Graph initialization

`seedDatabase` creates uniqueness constraints for the main node identifiers, then uses `MERGE` for nodes and relationships. Re-running the seed is therefore idempotent for the included demonstration data.

## UI screenshots

Added the final UI screenshots here before submission:

1. `screenshots/init-view.png` — landing state before allergens are selected.
2. `screenshots/filtered-recipes.png` — selected allergen profile and filtered results.
3. `screenshots/recipe-safety-details.png` — a recipe showing conflicts and substitutes.
