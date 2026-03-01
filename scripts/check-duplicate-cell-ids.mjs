import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const ROOT = process.cwd();
const TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'coverage',
  'doc_build',
  'docs-site/doc_build',
]);

function isIgnoredDir(relPath) {
  if (!relPath) return false;
  if (IGNORE_DIRS.has(relPath)) return true;
  return Array.from(IGNORE_DIRS).some((dir) => relPath.startsWith(`${dir}/`));
}

function collectSourceFiles(dir, rel = '') {
  if (isIgnoredDir(rel)) {
    return [];
  }

  const absDir = path.join(dir, rel);
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  const out = [];

  for (const entry of entries) {
    const nextRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(dir, nextRel));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (TARGET_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(path.join(dir, nextRel));
    }
  }

  return out;
}

function isCoreModuleSpecifier(raw) {
  return (
    raw === '@scope-flux/core' ||
    raw.startsWith('@scope-flux/core/') ||
    raw.includes('/core/src/index') ||
    raw.includes('/packages/core/') ||
    raw === '../src/index.js'
  );
}

function getStringLiteralText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return undefined;
}

function collectCellImportNames(sourceFile) {
  const names = new Set();
  const namespaces = new Set();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause || !statement.moduleSpecifier) {
      continue;
    }

    const moduleText = getStringLiteralText(statement.moduleSpecifier);
    if (!moduleText || !isCoreModuleSpecifier(moduleText)) {
      continue;
    }

    const bindings = statement.importClause.namedBindings;
    if (!bindings) {
      continue;
    }

    if (ts.isNamedImports(bindings)) {
      for (const specifier of bindings.elements) {
        const imported = specifier.propertyName?.text ?? specifier.name.text;
        if (imported === 'cell') {
          names.add(specifier.name.text);
        }
      }
      continue;
    }

    if (ts.isNamespaceImport(bindings)) {
      namespaces.add(bindings.name.text);
    }
  }

  return { names, namespaces };
}

function extractCellIdFromCall(callExpression) {
  if (callExpression.arguments.length < 2) {
    return undefined;
  }

  const optionsArg = callExpression.arguments[1];
  if (!ts.isObjectLiteralExpression(optionsArg)) {
    return undefined;
  }

  for (const property of optionsArg.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }
    const key = property.name;
    if (!key) {
      continue;
    }
    const keyText = ts.isIdentifier(key) ? key.text : ts.isStringLiteral(key) ? key.text : undefined;
    if (keyText !== 'id') {
      continue;
    }
    return getStringLiteralText(property.initializer);
  }

  return undefined;
}

function scanFileForCellIds(filePath, duplicatesMap) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = collectCellImportNames(sourceFile);

  if (imports.names.size === 0 && imports.namespaces.size === 0) {
    return;
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      let isCellCall = false;

      if (ts.isIdentifier(node.expression) && imports.names.has(node.expression.text)) {
        isCellCall = true;
      } else if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        imports.namespaces.has(node.expression.expression.text) &&
        node.expression.name.text === 'cell'
      ) {
        isCellCall = true;
      }

      if (isCellCall) {
        const id = extractCellIdFromCall(node);
        if (id) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          const entry = duplicatesMap.get(id) ?? [];
          entry.push({
            filePath,
            line: line + 1,
            column: character + 1,
          });
          duplicatesMap.set(id, entry);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function main() {
  const files = collectSourceFiles(ROOT);
  const duplicatesMap = new Map();

  for (const file of files) {
    scanFileForCellIds(file, duplicatesMap);
  }

  const duplicates = Array.from(duplicatesMap.entries()).filter(([, refs]) => refs.length > 1);

  if (duplicates.length === 0) {
    console.log('No duplicate scope-flux cell IDs found.');
    return;
  }

  console.error('Duplicate scope-flux cell IDs detected:');
  for (const [id, refs] of duplicates) {
    console.error(`- "${id}"`);
    for (const ref of refs) {
      const rel = path.relative(ROOT, ref.filePath);
      console.error(`  - ${rel}:${ref.line}:${ref.column}`);
    }
  }

  process.exitCode = 1;
}

main();
