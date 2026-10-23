export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

const PACKAGE_MANAGERS: PackageManager[] = ["pnpm", "npm", "yarn", "bun"];

export function isPackageManager(value: string): value is PackageManager {
  return PACKAGE_MANAGERS.includes(value as PackageManager);
}

/**
 * Detect the package manager that invoked the CLI from the user agent set by
 * `npm create` / `pnpm create` / `yarn create` / `bun create`.
 */
export function detectPackageManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent ?? "";
  const name = userAgent.split(" ")[0]?.split("/")[0] ?? "";
  return isPackageManager(name) ? name : "pnpm";
}

/** Command used to print the "next steps" instructions. */
export function devCommand(pm: PackageManager): string {
  return pm === "npm" ? "npm run dev" : `${pm} dev`;
}
