import "dotenv/config";
import express from "express";
import cors from "cors";
import { driver, closeDriver, requireDriver } from "./db.js";
import { createRecipe, findSafeRecipes, getAllergens, getCrossReactivity, getRecipe } from "./queries.js";
import { seedDatabase } from "./seed.js";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()) : true }));
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try { await requireDriver().verifyConnectivity(); res.json({ status: "ok", database: "connected" }); }
  catch (error) { res.status(error.status || 503).json({ status: "error", message: error.message }); }
});
app.get("/api/allergens", async (_req, res) => respond(res, getAllergens()));
app.get("/api/recipes", async (req, res) => respond(res, findSafeRecipes(parseAllergens(req.query.allergens), String(req.query.search || ""), positiveInt(req.query.page, 1), positiveInt(req.query.pageSize, 6))));
app.get("/api/recipes/:id", async (req, res) => respond(res, getRecipe(req.params.id, parseAllergens(req.query.allergens)), true));
app.get("/api/cross-reactivity/:allergen", async (req, res) => respond(res, getCrossReactivity(req.params.allergen)));
app.post("/api/recipes", async (req, res) => respond(res, Promise.resolve().then(() => createRecipe(normalizeRecipe(req.body)))));
app.post("/api/seed", async (_req, res) => respond(res, seedDatabase()));

function parseAllergens(value) {
  if (!value) return [];
  return (Array.isArray(value) ? value.join(",") : value).split(",").map((item) => item.trim()).filter(Boolean);
}
function positiveInt(value, fallback) { const parsed = Number.parseInt(value, 10); return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback; }
function normalizeRecipe(body) {
  if (!body?.name || !Array.isArray(body.ingredients) || body.ingredients.length === 0) {
    const error = new Error("Recipe name and at least one ingredient are required."); error.status = 400; throw error;
  }
  const id = body.id || body.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return { id, name: String(body.name).trim(), description: String(body.description || ""), timeMinutes: Number(body.timeMinutes) || 0, difficulty: String(body.difficulty || "Easy"), ingredients: body.ingredients.map((item, index) => ({
    id: item.id || `${id}-ingredient-${index + 1}`,
    name: String(item.name || "").trim(),
    allergens: Array.isArray(item.allergens) ? item.allergens.filter(Boolean) : [],
    categories: Array.isArray(item.categories) ? item.categories.filter(Boolean) : [],
    substitutes: Array.isArray(item.substitutes) ? item.substitutes.filter((substitute) => substitute?.name).map((substitute, subIndex) => ({ id: substitute.id || `${id}-substitute-${index + 1}-${subIndex + 1}`, name: String(substitute.name).trim() })) : [],
  })) };
}
async function respond(res, promise, notFound = false) {
  try { const data = await promise; if (notFound && !data) return res.status(404).json({ message: "Recipe not found" }); res.json(data); }
  catch (error) { res.status(error.status || 500).json({ message: error.message }); }
}

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`GraphDBApp API listening on http://localhost:${port}`));
process.on("SIGTERM", async () => { await closeDriver(); process.exit(0); });
export default app;
