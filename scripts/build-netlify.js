// Build script for Netlify deployment
// Copies seed data and runs Vite build
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const seedSource = path.join("server", "data", "films.json");
const seedDest = path.join("netlify", "lib", "seed-films.js");

// Generate seed-films.js from films.json
if (fs.existsSync(seedSource)) {
  const data = fs.readFileSync(seedSource, "utf-8");
  const output = `// Auto-generated seed data — do not edit manually\nexport default ${data.trim()};\n`;
  fs.writeFileSync(seedDest, output, "utf-8");
  console.log(`✅ Seed data copied: ${seedSource} → ${seedDest}`);
} else {
  // Write empty array if no seed data
  fs.writeFileSync(seedDest, "export default [];\n", "utf-8");
  console.log("⚠️ No seed data found, writing empty array");
}

// Run Vite build
console.log("🔨 Running Vite build...");
execSync("npx vite build", { stdio: "inherit" });
console.log("✅ Build complete!");
