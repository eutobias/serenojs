#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";

import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  note,
  outro,
  spinner,
  text,
} from "@clack/prompts";
import pc from "picocolors";

import { HELP, parseCliArgs, UsageError } from "./args.js";
import { printBanner } from "./banner.js";
import { detectPackageManager, devCommand, type PackageManager } from "./pm.js";
import { copyTemplate, normalizePackageName } from "./template.js";

type PackageJson = { version?: string };

const prettyOutput = Boolean(process.stdout.isTTY);

class CancelledError extends Error {
  constructor() {
    super("Cancelled");
    this.name = "CancelledError";
  }
}

function unwrap<T>(value: T): Exclude<T, symbol> {
  if (isCancel(value)) throw new CancelledError();
  return value as Exclude<T, symbol>;
}

function readVersion(): string {
  const raw = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  return (JSON.parse(raw) as PackageJson).version ?? "0.0.0";
}

async function assertUsableDirectory(targetDir: string): Promise<void> {
  try {
    const info = await stat(targetDir);
    if (!info.isDirectory()) {
      throw new UsageError(`"${targetDir}" already exists and is not a directory.`);
    }
    const entries = (await readdir(targetDir)).filter(
      (entry) => entry !== ".DS_Store",
    );
    if (entries.length > 0) {
      throw new UsageError(
        `Directory "${targetDir}" is not empty. Choose another directory or remove its contents.`,
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    if (error instanceof UsageError) throw error;
    throw new UsageError(
      `Cannot use "${targetDir}": ${(error as Error).message}`,
    );
  }
}

function spawnCommand(
  command: string,
  args: string[],
  cwd: string,
  captureOutput: boolean,
): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === "win32",
      stdio: captureOutput ? ["ignore", "pipe", "pipe"] : "inherit",
    });

    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      if (output.trim().length > 0) {
        process.stderr.write(`${output.trimEnd()}\n`);
      }
      rejectPromise(
        new Error(
          `"${command} ${args.join(" ")}" exited with code ${code ?? "unknown"}.`,
        ),
      );
    });
  });
}

async function installDependencies(
  pm: PackageManager,
  targetDir: string,
): Promise<void> {
  if (!prettyOutput) {
    process.stdout.write(`\nInstalling dependencies with ${pm}...\n`);
    await spawnCommand(pm, ["install"], targetDir, false);
    return;
  }

  const progress = spinner();
  progress.start(`Installing dependencies with ${pm}`);
  try {
    await spawnCommand(pm, ["install"], targetDir, true);
    progress.stop("Dependencies installed");
  } catch (error) {
    progress.error("Installation failed");
    throw error;
  }
}

function runGitInit(targetDir: string): boolean {
  const init = spawnSync("git", ["init"], {
    cwd: targetDir,
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  if (init.error || init.status !== 0) return false;

  spawnSync("git", ["add", "-A"], {
    cwd: targetDir,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  spawnSync("git", ["commit", "-m", "Initial commit"], {
    cwd: targetDir,
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  return true;
}

function nextStepLines(
  targetDir: string,
  pm: PackageManager,
  install: boolean,
): string[] {
  const location = relative(process.cwd(), targetDir) || ".";
  const lines: string[] = [];

  if (location !== ".") lines.push(`cd ${location}`);
  if (!install) lines.push(`${pm} install`);
  if (lines.length > 0) lines.push("");

  lines.push(devCommand(pm));
  lines.push("");
  lines.push("Admin: http://localhost:3000/admin");
  lines.push("Login: admin@example.com / admin123");

  return lines;
}

function printNextSteps(
  targetDir: string,
  pm: PackageManager,
  install: boolean,
): void {
  const lines = nextStepLines(targetDir, pm, install);

  if (prettyOutput) {
    note(lines.join("\n"), "Next steps");
    outro(pc.green("Project ready."));
    return;
  }

  const body = lines
    .map((line) => (line.length > 0 ? `  ${line}` : ""))
    .join("\n");
  process.stdout.write(`\nDone. Next steps:\n\n${body}\n`);
}

async function main(argv: string[]): Promise<number> {
  const options = parseCliArgs(argv);

  if (options.version) {
    process.stdout.write(`${readVersion()}\n`);
    return 0;
  }
  if (options.help) {
    process.stdout.write(HELP);
    return 0;
  }

  const interactive =
    !options.yes &&
    Boolean(process.stdin.isTTY) &&
    Boolean(process.stdout.isTTY);

  if (prettyOutput) {
    printBanner();
    intro(pc.cyan(pc.bold("create-start-serenojs")));
  }

  let directory = options.directory;
  if (!directory) {
    if (!interactive) {
      throw new UsageError(
        "Missing project directory. Usage: create-start-serenojs <directory>",
      );
    }
    directory = unwrap(
      await text({
        message: "Where should we create your project?",
        placeholder: "my-app",
        defaultValue: "my-app",
        validate: (value) =>
          (value ?? "").trim().length === 0
            ? "Please enter a directory name."
            : undefined,
      }),
    );
  }

  const targetDir = resolve(process.cwd(), directory);
  const packageName = normalizePackageName(
    basename(targetDir) || "my-serenojs-app",
  );
  const pm = options.pm ?? detectPackageManager();

  let install = options.install;
  let git = options.git;
  if (interactive) {
    if (install) {
      install = unwrap(
        await confirm({
          message: `Install dependencies with ${pm}?`,
          initialValue: true,
        }),
      );
    }
    if (git) {
      git = unwrap(
        await confirm({
          message: "Initialize a git repository?",
          initialValue: true,
        }),
      );
    }
  }

  await assertUsableDirectory(targetDir);
  await mkdir(targetDir, { recursive: true });
  await copyTemplate(targetDir, packageName);

  if (prettyOutput) {
    log.success(
      `Created ${pc.bold(packageName)} in ${pc.dim(targetDir)}`,
    );
  } else {
    process.stdout.write(`Created ${packageName} in ${targetDir}\n`);
  }

  if (install) await installDependencies(pm, targetDir);

  if (git) {
    const initialized = runGitInit(targetDir);
    if (prettyOutput) {
      if (initialized) log.success("Initialized a git repository.");
      else log.warn("Skipped git initialization (git is not available).");
    } else if (initialized) {
      process.stdout.write("Initialized a git repository.\n");
    } else {
      process.stdout.write(
        "Skipped git initialization (git is not available).\n",
      );
    }
  }

  printNextSteps(targetDir, pm, install);
  return 0;
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    if (error instanceof CancelledError) {
      if (prettyOutput) cancel("Setup cancelled.");
      else process.stderr.write("\nCancelled.\n");
      process.exitCode = 130;
      return;
    }

    const message = error instanceof Error ? error.message : "Unexpected error.";
    if (prettyOutput) {
      log.error(message);
      if (error instanceof UsageError) {
        log.info("Run create-start-serenojs --help to see the available options.");
      }
    } else {
      process.stderr.write(`\nError: ${message}\n`);
      if (error instanceof UsageError) {
        process.stderr.write(
          "Run create-start-serenojs --help to see the available options.\n",
        );
      }
    }
    process.exitCode = 1;
  });
