# create-start-serenojs

Scaffold a [SerenoJS](https://github.com/eutobias/serenojs) project —
Waku + `@eutobias/serenojs` + SQLite, with the admin panel, REST API, auth,
media uploads and backups already wired up.

## Usage

```sh
npm create start-serenojs@latest my-app
# or
pnpm create start-serenojs my-app
# or
yarn create start-serenojs my-app
# or
bun create start-serenojs my-app
```

You can also run the binary directly:

```sh
npx create-start-serenojs my-app
```

Omit the directory to be prompted for one:

```sh
npm create start-serenojs@latest
```

After scaffolding:

```sh
cd my-app
pnpm dev
```

Open <http://localhost:3000/admin> and sign in with
`admin@example.com` / `admin123`.

## Options

| Option | Effect |
| --- | --- |
| `-h`, `--help` | Show help |
| `-v`, `--version` | Show the version |
| `-y`, `--yes` | Accept all defaults, never prompt |
| `--no-install` | Copy the template without installing dependencies |
| `--no-git` | Do not initialize a git repository |
| `--pm <name>` | Force the package manager: `pnpm`, `npm`, `yarn` or `bun` |

The package manager is detected from the command that invoked the CLI
(`npm_config_user_agent`), falling back to `pnpm`. `--pm` overrides it.

When `--yes` is used, a directory argument is required — the CLI never writes
into the current directory implicitly.

## What gets created

```
my-app/
  serenojs.config.ts
  waku.config.ts
  tsconfig.json
  .agents/
    skills/           # coding-agent skills (e.g. serenojs-schema)
  src/
    schemas/          # todos example collection + locales
    middleware/       # mounts the SerenoJS Hono app
    pages/            # todos example app
    styles.css        # example app styles
  public/
  README.md
```

The generated `package.json` uses the published `@eutobias/serenojs` range;
`workspace:` specs from the monorepo template are rewritten automatically.

If a git repository is requested, the CLI runs `git init`, stages the files and
attempts an initial commit. The commit is skipped silently when git user
configuration is missing — the repository is still initialized.

## Template

The template lives in [`templates/starter`](./templates/starter) and is the
single source of truth for the starter app — it is not copied from another
directory. The same folder is a pnpm workspace package (`serenojs-starter`) so
it can be developed and built in this repository.

The starter includes a small example app (todos CRUD) that consumes the public
REST API. You are free to use any component library or styling solution; the
admin panel brings its own bundled styles and is not affected by the host app.

Template-only files:

- `gitignore` is renamed to `.gitignore` on scaffold (npm strips dotfiles
  named `.gitignore` from published packages).
- `.npmignore` and build/runtime artifacts (`.data`, `dist`, `node_modules`,
  `public/files`, `.waku`) are never copied.
- `.agents/skills/` is copied as-is, so generated projects ship the same agent
  skills (currently `serenojs-schema`).

## Development

```sh
pnpm install
pnpm build:create                 # compile src -> dist
node packages/create-start-serenojs/dist/index.js --help
pnpm --filter create-start-serenojs test
```

To exercise the template in this repository:

```sh
pnpm dev                          # builds the package + admin, runs the starter
```

## Publishing

```sh
pnpm build:create
pnpm --filter create-start-serenojs pack
pnpm --filter create-start-serenojs publish
```

`prepack` builds `dist/` automatically. The published tarball contains `dist/`,
the template and this README.
