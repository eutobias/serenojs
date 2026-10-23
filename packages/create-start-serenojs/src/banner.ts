import pc from "picocolors";

/**
 * Hand-drawn ANSI Shadow wordmark. Kept as a literal so the CLI has a visual
 * identity without pulling in a font/figlet dependency.
 */
const LOGO = [
  "███████╗███████╗██████╗ ███████╗███╗   ██╗ ██████╗      ██╗███████╗",
  "██╔════╝██╔════╝██╔══██╗██╔════╝████╗  ██║██╔═══██╗     ██║██╔════╝",
  "███████╗█████╗  ██████╔╝█████╗  ██╔██╗ ██║██║   ██║     ██║███████╗",
  "╚════██║██╔══╝  ██╔══██╗██╔══╝  ██║╚██╗██║██║   ██║██   ██║╚════██║",
  "███████║███████╗██║  ██║███████╗██║ ╚████║╚██████╔╝╚█████╔╝███████║",
  "╚══════╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝ ╚═════╝  ╚════╝ ╚══════╝",
];

const TAGLINE = "Schema-driven CMS for Waku · SQLite · Admin included";

export function printBanner(): void {
  const lines = LOGO.map((line) => pc.cyan(line)).join("\n");
  process.stdout.write(`\n${lines}\n${pc.dim(`  ${TAGLINE}`)}\n\n`);
}
