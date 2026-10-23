"use client";

import { useCallback, useState } from "react";

import type { UserSummary } from "../../auth/config.js";
import { Badge } from "../badge.js";
import { Box } from "../box.js";
import { Button, IconButton } from "../button.js";
import { Drawer } from "../drawer.js";
import { FieldWrapper, inputClass } from "../field-wrapper.js";
import { Text } from "../text.js";
import { FiEdit2, FiTrash2 } from "react-icons/fi";

import { DataTable, type Column } from "./table.js";
import { useToast } from "./toast.js";
import { useI18n } from "./i18n.js";
import { useCmsUrls } from "./runtime.js";

export type UsersManagerProps = {
  initial: UserSummary[];
  currentUserId: number;
};

type DrawerState =
  | { kind: "closed" }
  | { kind: "form"; user: UserSummary | null }
  | { kind: "delete"; user: UserSummary };

/** Deterministic (UTC) date format to avoid hydration mismatches. */
function formatDateTime(value: string, locale: "en" | "pt"): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value);
  if (!match) return value || "—";
  const date = locale === "en" ? `${match[2]}/${match[3]}/${match[1]}` : `${match[3]}/${match[2]}/${match[1]}`;
  return `${date} ${match[4]}:${match[5]}`;
}

export const UsersManager = ({ initial, currentUserId }: UsersManagerProps) => {
  const toast = useToast();
  const { auth } = useCmsUrls();
  const { t, locale } = useI18n();
  const [users, setUsers] = useState<UserSummary[]>(initial);
  const [drawer, setDrawer] = useState<DrawerState>({ kind: "closed" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const response = await fetch(auth("users"));
    if (!response.ok) return;
    const json = (await response.json()) as { users?: UserSummary[] };
    if (json.users) setUsers(json.users);
  }, []);

  const closeDrawer = () => {
    setDrawer({ kind: "closed" });
    setErrors({});
    setFormError(null);
  };

  const openCreate = () => {
    setEmail("");
    setPassword("");
    setErrors({});
    setFormError(null);
    setDrawer({ kind: "form", user: null });
  };

  const openEdit = (user: UserSummary) => {
    setEmail(user.email);
    setPassword("");
    setErrors({});
    setFormError(null);
    setDrawer({ kind: "form", user });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (drawer.kind !== "form") return;
    const editing = drawer.user;
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    try {
      const response = await fetch(
        editing ? auth(`users/${editing.id}`) : auth("users"),
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );
      const json = (await response.json()) as {
        message?: string;
        errors?: Record<string, string>;
      };
      if (!response.ok) {
        setErrors(json.errors ?? {});
        setFormError(json.message ?? t("users.saveError"));
        return;
      }
      closeDrawer();
      toast.success(editing ? t("users.updated") : t("users.created"));
      await reload();
    } catch {
      setFormError(t("users.networkSave"));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (drawer.kind !== "delete") return;
    setSubmitting(true);
    try {
      const response = await fetch(auth(`users/${drawer.user.id}`), {
        method: "DELETE",
      });
      const json = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!response.ok) {
        toast.error(json?.message ?? t("users.removeError"));
        return;
      }
      closeDrawer();
      toast.success(t("users.removed"));
      await reload();
    } catch {
      toast.error(t("users.networkRemove"));
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<UserSummary>[] = [
    {
      key: "id",
      header: "ID",
      width: "70px",
      render: (user) => (
        <Text as="span" size="caption" className="text-gray-400">
          #{user.id}
        </Text>
      ),
    },
    {
      key: "email",
      header: t("common.email"),
      render: (user) => (
        <Box className="items-center gap-2">
          <Text as="span" size="caption" className="font-medium text-gray-900">
            {user.email}
          </Text>
          {user.id === currentUserId ? <Badge tone="purple">{t("users.you")}</Badge> : null}
        </Box>
      ),
    },
    {
      key: "createdAt",
      header: t("common.createdAt"),
      width: "150px",
      render: (user) => (
        <Text as="span" size="caption" className="whitespace-nowrap text-gray-500">
          {formatDateTime(user.createdAt, locale)}
        </Text>
      ),
    },
    {
      key: "updatedAt",
      header: t("common.updatedAt"),
      width: "150px",
      render: (user) => (
        <Text as="span" size="caption" className="whitespace-nowrap text-gray-500">
          {formatDateTime(user.updatedAt, locale)}
        </Text>
      ),
    },
    {
      key: "__actions",
      header: "",
      width: "110px",
      align: "right",
      render: (user) => (
        <Box className="items-center justify-end gap-1">
          <IconButton
            type="button"
            label={t("common.edit")}
            onClick={() => openEdit(user)}
          >
            <FiEdit2 aria-hidden />
          </IconButton>
          {user.id === currentUserId ? null : (
            <IconButton
              type="button"
              label={t("common.remove")}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setDrawer({ kind: "delete", user })}
            >
              <FiTrash2 aria-hidden />
            </IconButton>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box className="flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Box className="flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
        <Box className="flex-col gap-1">
          <Box className="items-center gap-3">
            <Text size="title" className="font-semibold text-gray-900">
              {t("users.title")}
            </Text>
            <Badge tone="gray">{users.length}</Badge>
          </Box>
          <Text size="caption" className="text-gray-500">
            {t("users.subtitle")}
          </Text>
        </Box>
        <Button type="button" variant="primary" onClick={openCreate}>
          {t("users.new")}
        </Button>
      </Box>

      <DataTable
        columns={columns}
        rows={users}
        rowKey={(user) => user.id}
        empty={t("users.empty")}
      />

      <Drawer
        open={drawer.kind !== "closed"}
        onClose={closeDrawer}
        title={
          drawer.kind === "form"
            ? drawer.user
              ? t("users.editTitle", { id: drawer.user.id })
              : t("users.createTitle")
            : t("users.removeTitle")
        }
        description={
          drawer.kind === "delete"
            ? t("common.deleteWarning")
            : undefined
        }
      >
        {drawer.kind === "form" ? (
          <Box
            as="form"
            className="flex-col gap-5"
            onSubmit={(event) => void submit(event)}
          >
            {formError ? (
              <Box className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
                <Text size="caption" className="text-red-700">
                  {formError}
                </Text>
              </Box>
            ) : null}

            <FieldWrapper label={t("common.email")} htmlFor="user-email" required error={errors.email}>
              <input
                id="user-email"
                type="email"
                autoComplete="off"
                required
                value={email}
                disabled={submitting}
                onChange={(event) => setEmail(event.target.value)}
                className={`${inputClass} border-gray-300`}
              />
            </FieldWrapper>

            <FieldWrapper
              label={drawer.user ? t("users.newPassword") : t("common.password")}
              htmlFor="user-password"
              required={!drawer.user}
              help={
                drawer.user
                  ? t("users.passwordHintKeep")
                  : t("users.passwordHintMin")
              }
              error={errors.password}
            >
              <input
                id="user-password"
                type="password"
                autoComplete="new-password"
                value={password}
                disabled={submitting}
                onChange={(event) => setPassword(event.target.value)}
                className={`${inputClass} border-gray-300`}
              />
            </FieldWrapper>

            <Box className="items-center justify-end gap-2 border-t border-gray-200 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={closeDrawer}
                disabled={submitting}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? t("common.saving") : drawer.user ? t("common.saveChanges") : t("users.create")}
              </Button>
            </Box>
          </Box>
        ) : null}

        {drawer.kind === "delete" ? (
          <Box className="flex-col gap-6">
            <Text className="text-gray-700">
              {t("users.removeConfirm", { email: drawer.user.email })}
            </Text>
            <Box className="items-center justify-end gap-2 border-t border-gray-200 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={closeDrawer}
                disabled={submitting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => void confirmDelete()}
                disabled={submitting}
              >
                {submitting ? t("common.removing") : t("common.remove")}
              </Button>
            </Box>
          </Box>
        ) : null}
      </Drawer>
    </Box>
  );
};
