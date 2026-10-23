import { cp, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute path to the bundled starter template. */
export const TEMPLATE_DIR = fileURLToPath(
  new URL("../templates/starter", import.meta.url),
);

const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "dist-server",
  ".data",
  ".waku",
  "__data",
  "__public",
  ".git",
]);

const SKIPPED_FILES = new Set([".npmignore", ".DS_Store"]);

const SKIPPED_PATHS = new Set(["public/files"]);

type DependencyMap = Record<string, string>;

type TemplatePackageJson = {
  name?: string;
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  peerDependencies?: DependencyMap;
} & Record<string, unknown>;

/**
 * Turn an arbitrary directory name into a valid npm package name.
 * Spaces and invalid characters become dashes; uppercase is folded.
 */
export function normalizePackageName(input: string): string {
  const value = input.trim();
  const scoped = value.startsWith("@") && value.includes("/");
  const parts = (scoped ? value.slice(1) : value)
    .split("/")
    .map(sanitizeNamePart)
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    throw new Error(
      `Cannot derive a package name from "${input}". Pass a directory name with at least one letter or number.`,
    );
  }

  const name = parts.join("/");
  return scoped ? `@${name}` : name;
}

function sanitizeNamePart(part: string): string {
  return part
    .toLowerCase()
    .replace(/[^a-z0-9._~-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[._-]+/, "")
    .replace(/[.-]+$/, "");
}

function shouldCopy(source: string): boolean {
  const relativePath = relative(TEMPLATE_DIR, source);
  if (relativePath === "") return true;

  const segments = relativePath.split(sep);
  if (segments.some((segment) => SKIPPED_DIRECTORIES.has(segment))) return false;
  if (SKIPPED_FILES.has(segments[segments.length - 1] ?? "")) return false;

  for (const skippedPath of SKIPPED_PATHS) {
    if (
      relativePath === skippedPath ||
      relativePath.startsWith(`${skippedPath}${sep}`)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Copy the starter template into `targetDir`, renaming the template-only
 * `gitignore` file and replacing workspace dependency specs with real versions.
 */
export async function copyTemplate(
  targetDir: string,
  packageName: string,
): Promise<void> {
  await mkdir(targetDir, { recursive: true });
  await cp(TEMPLATE_DIR, targetDir, {
    recursive: true,
    filter: shouldCopy,
  });

  await rename(join(targetDir, "gitignore"), join(targetDir, ".gitignore"));

  await rewritePackageJson(join(targetDir, "package.json"), packageName);
}

async function rewritePackageJson(
  packageJsonPath: string,
  packageName: string,
): Promise<void> {
  const raw = await readFile(packageJsonPath, "utf8");
  const pkg = JSON.parse(raw) as TemplatePackageJson;

  pkg.name = packageName;

  for (const key of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
  ] as const) {
    const dependencies = pkg[key];
    if (!dependencies) continue;

    for (const [dependency, spec] of Object.entries(dependencies)) {
      if (spec.startsWith("workspace:")) {
        dependencies[dependency] = spec.slice("workspace:".length);
      }
    }
  }

  await writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}
