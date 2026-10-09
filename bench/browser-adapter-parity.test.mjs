import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import test from "node:test";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const adapter = resolve(root, "tests/browser/modules.ts");
const parse = (file) => ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);

function exportedValues(file) {
  const names = new Set();
  for (const node of parse(file).statements) {
    if (!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (ts.isVariableStatement(node)) {
      for (const d of node.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) names.add(d.name.text);
      }
    } else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node)) {
      if (node.name) names.add(node.name.text);
    }
  }
  return names;
}

function resolveRelative(source, importer) {
  if (!source.startsWith(".") || /\.(css|json|svg|png|webp|jpg)$/.test(source)) return null;
  const base = resolve(dirname(importer), source);
  return [base, ...[".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"].map((e) => base + e)]
    .find((p) => existsSync(p)) ?? null;
}

// Match test-only-data in vite.browser.config.ts. Walk only the components
// actually reachable from the two browser entries, rather than demanding
// mocks for production screens that the harness does not load.
function browserTarget(source, importer) {
  if (importer.replaceAll("\\", "/").includes("/src/ui/")) {
    for (const [suffix, target] of [
      ["/modules", "modules.ts"], ["/useIngestion", "ingestion.ts"],
      ["/ScanProvider", "scan.ts"], ["/crops.js", "source-crops.ts"],
    ]) {
      if (source.endsWith(suffix)) return resolve(root, "tests/browser", target);
    }
  }
  return resolveRelative(source, importer);
}

test("browser data adapter exports every value imported by its reachable UI", () => {
  const available = exportedValues(adapter);
  const seen = new Set();
  const missing = [];
  let checked = 0;
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const inspect = (node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const clause = node.importClause;
        // Type-only imports disappear before Vite evaluates a module.
        if (clause?.isTypeOnly) return;
        const target = browserTarget(node.moduleSpecifier.text, file);
        if (target === adapter && clause) {
          if (clause.name && !available.has("default")) missing.push(relative(root, file) + ": default");
          if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
            for (const spec of clause.namedBindings.elements) {
              if (spec.isTypeOnly) continue;
              const name = (spec.propertyName ?? spec.name).text;
              checked++;
              if (!available.has(name)) missing.push(relative(root, file) + ": " + name);
            }
          }
        }
        if (target) visit(target);
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
                 && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
        const target = browserTarget(node.arguments[0].text, file);
        if (target) visit(target);
      }
      ts.forEachChild(node, inspect);
    };
    inspect(parse(file));
  };
  visit(resolve(root, "tests/browser/main.tsx"));
  visit(resolve(root, "tests/browser/paper-reading.tsx"));
  assert.ok(checked > 0, "the test must inspect real UI value imports");
  assert.deepEqual(missing.sort(), [], "Missing browser fixture exports would blank the test app");
});
