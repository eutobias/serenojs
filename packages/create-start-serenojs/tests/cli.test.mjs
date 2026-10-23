import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const bin = join(packageDir, "dist", "index.js");

function run(args, cwd) {
  return spawnSync(process.execPath, [bin, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, npm_config_user_agent: "pnpm/12.0.0 node/v24.0.0" },
  });
}

async function workspace() {
  const root = await mkdtemp(join(tmpdir(), "create-serenojs-"));
  const cwd = join(root, "workspace");
  await mkdir(cwd, { recursive: true });
  return cwd;
}

test("prints help and version", async () => {
  const cwd = await workspace();

  const help = run(["--help"], cwd);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /create-start-serenojs/);
  assert.match(help.stdout, /--no-install/);

  const version = run(["--version"], cwd);
  assert.equal(version.status, 0);
  assert.match(version.stdout.trim(), /^\d+\.\d+\.\d+/);
});

test("scaffolds a project without installing or initializing git", async () => {
  const cwd = await workspace();
  const result = run(
    ["My App", "--yes", "--no-install", "--no-git"],
    cwd,
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.includes("\u001b["), false);

  const target = join(cwd, "My App");
  const pkg = JSON.parse(
    await readFile(join(target, "package.json"), "utf8"),
  );

  assert.equal(pkg.name, "my-app");
  assert.equal(pkg.dependencies["@eutobias/serenojs"], "^0.1.0");
  assert.equal(pkg.devDependencies?.tailwindcss, undefined);
  assert.equal(pkg.dependencies?.["react-icons"], undefined);
  assert.equal(
    Object.values({ ...pkg.dependencies, ...pkg.devDependencies }).some(
      (spec) => String(spec).startsWith("workspace:"),
    ),
    false,
  );

  await stat(join(target, ".gitignore"));
  await stat(join(target, "README.md"));
  await stat(join(target, "serenojs.config.ts"));
  await stat(join(target, "src", "schemas", "todos.ts"));
  await stat(join(target, "src", "pages", "index.tsx"));
  await stat(
    join(target, ".agents", "skills", "serenojs-schema", "SKILL.md"),
  );
  await stat(
    join(
      target,
      ".agents",
      "skills",
      "serenojs-schema",
      "references",
      "fields.md",
    ),
  );

  const page = await readFile(
    join(target, "src", "pages", "index.tsx"),
    "utf8",
  );
  assert.equal(page.includes("@eutobias/serenojs/ui"), false);

  await stat(join(target, "src", "styles.css"));
  await assert.rejects(stat(join(target, "gitignore")));
  await assert.rejects(stat(join(target, ".npmignore")));
  await assert.rejects(stat(join(target, ".data")));
  await assert.rejects(stat(join(target, "node_modules")));
  await assert.rejects(stat(join(target, "dist")));
});

test("refuses to write into a non-empty directory", async () => {
  const cwd = await workspace();
  const target = join(cwd, "taken");
  await mkdir(target);
  await writeFile(join(target, "keep.txt"), "do not delete");

  const result = run(
    [target, "--yes", "--no-install", "--no-git"],
    cwd,
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /not empty/);
  assert.equal(
    await readFile(join(target, "keep.txt"), "utf8"),
    "do not delete",
  );
});

test("requires a directory when running non-interactively", async () => {
  const cwd = await workspace();
  const result = run(["--yes", "--no-install", "--no-git"], cwd);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing project directory/);
});

test("rejects unknown package managers", async () => {
  const cwd = await workspace();
  const result = run(["app", "--yes", "--pm", "cargo"], cwd);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown package manager/);
});
