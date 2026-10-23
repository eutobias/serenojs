"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "../ui/badge.js";
import { Box } from "../ui/box.js";
import { Text } from "../ui/text.js";
import type { AuthUser, UserSummary } from "../auth/config.js";
import type { CollectionDef, Item, ListResult, RelationOptionsMap } from "../core/types.js";
import type { BackupInfo } from "../core/backup.server.js";
import { AdminShell } from "../ui/admin/admin-shell.js";
import { CollectionIcon } from "../ui/admin/collection-icon.js";
import { CollectionManager } from "../ui/admin/collection-manager.js";
import { StandaloneManager } from "../ui/admin/standalone-manager.js";
import { UsersManager } from "../ui/admin/users-manager.js";
import { BackupManager } from "../ui/admin/backup-manager.js";
import { LoginForm } from "../ui/admin/login-form.js";
import { Link, useRouter } from "../ui/admin/router.js";
import { useCms, useCmsUrls } from "../ui/admin/runtime.js";
import { useI18n } from "../ui/admin/i18n.js";

const LIMIT = 10;

function Loading({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <Box className="items-center justify-center p-10">
      <Text size="caption" className="text-gray-500">
        {label ?? t("common.loading")}
      </Text>
    </Box>
  );
}

function ErrorBox({ message }: { message: string }) {
  const { t } = useI18n();
  return (
    <Box className="flex-col gap-2 p-4 sm:p-6 lg:p-8">
      <Text size="title" className="font-semibold text-gray-900">
        {t("app.errorTitle")}
      </Text>
      <Text className="text-gray-500">{message}</Text>
    </Box>
  );
}

/* -------------------------------------------------------------------------- */
/* Login                                                                      */
/* -------------------------------------------------------------------------- */

function LoginPage({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const config = useCms();
  const { t } = useI18n();
  return (
    <Box className="min-h-screen items-center justify-center bg-gray-50 p-4">
      <Box className="w-full max-w-sm flex-col gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <Box className="flex-col gap-1">
          <Text size="title" className="font-semibold tracking-tight text-gray-900">
            {t("login.title")}
          </Text>
          <Text size="caption" className="text-gray-500">
            {t("login.subtitle", { title: config.title })}
          </Text>
        </Box>
        <LoginForm
          onSuccess={() => {
            void fetch(config.authPath + "/me", { credentials: "same-origin" })
              .then((response) => (response.ok ? response.json() : null))
              .then((json: { user?: AuthUser } | null) => {
                if (json?.user) onLogin(json.user);
              });
          }}
        />
      </Box>
    </Box>
  );
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

function Dashboard() {
  const config = useCms();
  const { api } = useCmsUrls();
  const { t } = useI18n();
  const [totals, setTotals] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    void Promise.all(
      config.collections.map(async (collection) => {
        if (collection.standalone) return [collection.slug, 1] as const;
        try {
          const response = await fetch(`${api(collection.slug)}?limit=1`);
          if (!response.ok) return [collection.slug, 0] as const;
          const json = (await response.json()) as { total?: number };
          return [collection.slug, json.total ?? 0] as const;
        } catch {
          return [collection.slug, 0] as const;
        }
      }),
    ).then((entries) => {
      if (active) setTotals(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [api, config.collections]);

  return (
    <Box className="flex-col gap-8 p-4 sm:p-6 lg:p-8">
      <Box className="flex-col gap-1">
        <Text size="title/xl" className="font-bold tracking-tight text-gray-900">
          {config.title}
        </Text>
        <Text className="text-gray-500">
          {t("dashboard.subtitle")}
        </Text>
      </Box>

      <Box
        style={{ display: "grid" }}
        className="grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {config.collections.map((collection) => (
          <Link
            key={collection.slug}
            to={`/${collection.slug}`}
            className="group flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-gray-900"
          >
            <Box className="items-center justify-between gap-3">
              <Box className="items-center gap-2">
                <CollectionIcon name={collection.icon} className="h-5 w-5 shrink-0 text-gray-500" />
                <Text size="subtitle" className="font-semibold text-gray-900">
                  {collection.label}
                </Text>
              </Box>
              <Badge tone={collection.standalone ? "purple" : "gray"}>
                {collection.standalone ? t("dashboard.single") : (totals[collection.slug] ?? "…")}
              </Badge>
            </Box>
            <Text size="caption" className="text-gray-500">
              {collection.description ??
                t("dashboard.fields", { count: collection.fields.length })}
            </Text>
            <Text size="caption" className="font-medium text-gray-400 group-hover:text-gray-900">
              {t("dashboard.manage")}
            </Text>
          </Link>
        ))}
      </Box>
    </Box>
  );
}

/* -------------------------------------------------------------------------- */
/* Collections                                                                */
/* -------------------------------------------------------------------------- */

function relationsFor(apiPath: string, slug: string): Promise<RelationOptionsMap> {
  return fetch(`${apiPath}/${slug}/relations`, { credentials: "same-origin" })
    .then((response) => (response.ok ? response.json() : { options: {} }))
    .then((json: { options?: RelationOptionsMap }) => json.options ?? {})
    .catch(() => ({}));
}

function CollectionPage({ collection }: { collection: CollectionDef }) {
  const { api } = useCmsUrls();
  const { t } = useI18n();
  const [data, setData] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "single"; item: Item; relations: RelationOptionsMap }
    | { kind: "list"; list: ListResult; relations: RelationOptionsMap }
  >({ kind: "loading" });

  useEffect(() => {
    let active = true;
    setData({ kind: "loading" });

    const load = async () => {
      try {
        const relations = await relationsFor(api(""), collection.slug);
        if (!active) return;
        if (collection.standalone) {
          const response = await fetch(api(collection.slug), { credentials: "same-origin" });
          if (!response.ok) throw new Error(t("collection.loadError"));
          const json = (await response.json()) as { item: Item };
          if (active) setData({ kind: "single", item: json.item, relations });
          return;
        }
        const params = new URLSearchParams({ page: "1", limit: String(LIMIT), q: "" });
        const response = await fetch(`${api(collection.slug)}?${params}`, {
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error(t("collection.loadError"));
        const list = (await response.json()) as ListResult;
        if (active) setData({ kind: "list", list, relations });
      } catch (error) {
        if (active) {
          setData({
            kind: "error",
            message: error instanceof Error ? error.message : t("app.unexpected"),
          });
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [api, collection, t]);

  if (data.kind === "loading") return <Loading />;
  if (data.kind === "error") return <ErrorBox message={data.message} />;
  if (data.kind === "single") {
    return (
      <StandaloneManager
        key={collection.slug}
        collection={collection}
        initial={data.item}
        relationOptions={data.relations}
      />
    );
  }
  return (
    <CollectionManager
      key={collection.slug}
      collection={collection}
      initial={data.list}
      relationOptions={data.relations}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Users / backup                                                             */
/* -------------------------------------------------------------------------- */

function UsersPage({ currentUserId }: { currentUserId: number }) {
  const { auth } = useCmsUrls();
  const { t } = useI18n();
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(auth("users"), { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error(t("users.empty"));
        return (await response.json()) as { users?: UserSummary[] };
      })
      .then((json) => {
        if (active) setUsers(json.users ?? []);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : t("app.unexpected"));
      });
    return () => {
      active = false;
    };
  }, [auth, t]);

  if (error) return <ErrorBox message={error} />;
  if (!users) return <Loading />;
  return <UsersManager initial={users} currentUserId={currentUserId} />;
}

function BackupPage() {
  const { backup } = useCmsUrls();
  const { t } = useI18n();
  const [backups, setBackups] = useState<BackupInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(backup(), { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error(t("backup.empty"));
        return (await response.json()) as { backups?: BackupInfo[] };
      })
      .then((json) => {
        if (active) setBackups(json.backups ?? []);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : t("app.unexpected"));
      });
    return () => {
      active = false;
    };
  }, [backup, t]);

  if (error) return <ErrorBox message={error} />;
  if (!backups) return <Loading />;
  return <BackupManager initial={backups} />;
}

/* -------------------------------------------------------------------------- */
/* App                                                                        */
/* -------------------------------------------------------------------------- */

export function AdminApp() {
  const config = useCms();
  const { path, navigate } = useRouter();
  const { auth } = useCmsUrls();
  const { t } = useI18n();
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void fetch(auth("me"), { credentials: "same-origin" })
      .then(async (response) => (response.ok ? ((await response.json()) as { user: AuthUser }) : null))
      .then((json) => {
        if (active) setUser(json?.user ?? null);
      })
      .catch(() => {
        if (active) setUser(null);
      });
    return () => {
      active = false;
    };
  }, [auth, t]);

  const handleLogin = useCallback(
    (nextUser: AuthUser) => {
      setUser(nextUser);
      navigate("/");
    },
    [navigate],
  );

  if (user === undefined) {
    return (
      <Box className="min-h-screen items-center justify-center bg-gray-50">
        <Loading label={t("app.verifyingSession")} />
      </Box>
    );
  }

  if (!user) return <LoginPage onLogin={handleLogin} />;

  const segments = path.split("/").filter(Boolean);
  let content: React.ReactNode;
  if (segments.length === 0 || segments[0] === "login") {
    content = <Dashboard />;
  } else if (segments[0] === "users") {
    content = <UsersPage currentUserId={user.id} />;
  } else if (segments[0] === "backup") {
    content = <BackupPage />;
  } else {
    const collection = config.collections.find((entry) => entry.slug === segments[0]);
    content = collection ? (
      <CollectionPage collection={collection} />
    ) : (
      <ErrorBox message={t("app.collectionNotFound", { slug: segments[0] ?? "" })} />
    );
  }

  return (
    <AdminShell
      title={config.title}
      collections={config.collections}
      user={user}
      onLoggedOut={() => setUser(null)}
    >
      {content}
    </AdminShell>
  );
}
