import neo4j from "neo4j-driver";

const required = ["NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD"];
const missing = required.filter((key) => !process.env[key]);

export const driver = missing.length
  ? null
  : neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD),
    );

export function requireDriver() {
  if (!driver) {
    const error = new Error("Neo4j is not configured. Copy .env.example to .env and add credentials.");
    error.status = 503;
    throw error;
  }
  return driver;
}

export async function closeDriver() {
  if (driver) await driver.close();
}
