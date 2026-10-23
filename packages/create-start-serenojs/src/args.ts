import { parseArgs } from "node:util";

import { isPackageManager, type PackageManager } from "./pm.js";

export class UsageError extends Error {}

export type CliOptions = {
  help: boolean;
  version: boolean;
  directory: string | undefined;
  yes: boolean;
  install: boolean;
  git: boolean;
  pm: PackageManager | undefined;
};

export const HELP = `create-start-serenojs

Scaffold a SerenoJS project (Waku + @eutobias/serenojs + SQLite).

Usage:
  create-start-serenojs [directory] [options]

Options:
  -h, --help        Show this help
  -v, --version     Show the version
  -y, --yes         Accept all defaults (no prompts)
      --no-install  Skip dependency installation
      --no-git      Skip git initialization
      --pm <name>   Force a package manager: pnpm, npm, yarn or bun
`;

export function parseCliArgs(argv: string[]): CliOptions {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
      yes: { type: "boolean", short: "y", default: false },
      "no-install": { type: "boolean", default: false },
      "no-git": { type: "boolean", default: false },
      pm: { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });

  if (positionals.length > 1) {
    throw new UsageError("Please provide a single project directory.");
  }

  let pm: PackageManager | undefined;
  const pmValue = values.pm;
  if (pmValue !== undefined) {
    if (!isPackageManager(pmValue)) {
      throw new UsageError(
        `Unknown package manager "${pmValue}". Use pnpm, npm, yarn or bun.`,
      );
    }
    pm = pmValue;
  }

  return {
    help: values.help,
    version: values.version,
    directory: positionals[0],
    yes: values.yes,
    install: !values["no-install"],
    git: !values["no-git"],
    pm,
  };
}
