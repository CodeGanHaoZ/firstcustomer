import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
}
const sources = files("src").filter((file) => /\.(ts|tsx|css)$/.test(file));
const modules = sources.filter((file) => /\.tsx?$/.test(file)).map((file) => {
  const text = readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const exports = ast.statements.filter(ts.isFunctionDeclaration)
    .filter((node) => node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
    .map((node) => node.name?.text ?? "default");
  return { file, serverActions: /^['"]use server['"];/.test(text) ? exports : [], exports,
    directGuardCalls: [...new Set([...text.matchAll(/\b(requireAdmin|hasAdminSession|getCustomerSession|findCustomerProject|requireCustomerProjectSession)\(/g)].map((match) => match[1]))] };
});
const routes = modules.filter(({ file }) => /\/(page\.tsx|route\.ts)$/.test(file)).map((entry) => ({
  ...entry, path: "/" + entry.file.replace(/^src\/app\//, "").replace(/\/?(page\.tsx|route\.ts)$/, ""),
}));
const report = { scope: "Static source inventory, not a claim of runtime branch coverage. Guards may be delegated to imported helpers.",
  sourceFiles: sources.length, typedModules: modules.length, routes: routes.length,
  serverActionFunctions: modules.reduce((sum, entry) => sum + entry.serverActions.length, 0),
  entryPoints: routes, actionModules: modules.filter(({ serverActions }) => serverActions.length), sourcePaths: sources };
const target = resolve("../reports/source-flow-audit-2026-11-08/source-map.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ sourceFiles: report.sourceFiles, typedModules: report.typedModules, routes: report.routes, serverActionFunctions: report.serverActionFunctions }));
