"use client";

import { useCallback, useRef, useState } from "react";

import type { BackupInfo, BackupManifest } from "../../core/backup.server.js";
import { Badge } from "../badge.js";
import { Box } from "../box.js";
import { Button, IconButton } from "../button.js";
import { Drawer } from "../drawer.js";
import { Text } from "../text.js";
import {
  FiDatabase,
  FiDownload,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiUpload,
} from "react-icons/fi";

import { DataTable, type Column } from "./table.js";
import { useToast } from "./toast.js";
import { useI18n } from "./i18n.js";
import { useCmsUrls } from "./runtime.js";

export type BackupManagerProps = {
  initial: BackupInfo[];
};

type DrawerState =
  | { kind: "closed" }
  | { kind: "restore"; file: File }
  | { kind: "delete"; backup: BackupInfo };

/** Deterministic (UTC) date format to avoid hydration mismatches. */
function formatDateTime(value: string, locale: "en" | "pt"): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value);
  if (!match) return value || "—";
  const date = locale === "en" ? `${match[2]}/${match[3]}/${match[1]}` : `${match[3]}/${match[2]}/${match[1]}`;
  return `${date} ${match[4]}:${match[5]}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export const BackupManager = ({ initial }: BackupManagerProps) => {
  const toast = useToast();
  const { backup: backupUrl } = useCmsUrls();
  const { t, locale } = useI18n();
  const [backups, setBackups] = useState<BackupInfo[]>(initial);
  const [drawer, setDrawer] = useState<DrawerState>({ kind: "closed" });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(backupUrl());
      if (!response.ok) return;
      const json = (await response.json()) as { backups?: BackupInfo[] };
      if (json.backups) setBackups(json.backups);
    } finally {
      setLoading(false);
    }
  }, []);

  const closeDrawer = () => setDrawer({ kind: "closed" });

  const createBackup = async () => {
    setBusy(true);
    try {
      const response = await fetch(backupUrl(), { method: "POST" });
      if (!response.ok) {
        toast.error(t("backup.createError"));
        return;
      }
      toast.success(t("backup.created"));
      await reload();
    } catch {
      toast.error(t("backup.networkCreate"));
    } finally {
      setBusy(false);
    }
  };

  const downloadCurrent = () => {
    window.location.assign(backupUrl("latest=1"));
  };

  const pickFile = () => fileRef.current?.click();

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setDrawer({ kind: "restore", file });
  };

  const confirmRestore = async () => {
    if (drawer.kind !== "restore") return;
    setBusy(true);
    try {
      const response = await fetch(backupUrl(), {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: drawer.file,
      });
      const json = (await response.json().catch(() => null)) as
        | { message?: string; manifest?: BackupManifest }
        | null;
      if (!response.ok) {
        toast.error(json?.message ?? t("backup.restoreError"));
        return;
      }
      closeDrawer();
      toast.success(t("backup.restored"));
      // The database (and possibly the session) changed underneath us.
      setTimeout(() => window.location.reload(), 1_200);
    } catch {
      toast.error(t("backup.networkRestore"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (drawer.kind !== "delete") return;
    setBusy(true);
    try {
      const response = await fetch(
        backupUrl(`name=${encodeURIComponent(drawer.backup.name)}`),
        { method: "DELETE" },
      );
      if (!response.ok) {
        toast.error(t("backup.removeError"));
        return;
      }
      closeDrawer();
      toast.success(t("backup.removed"));
      await reload();
    } catch {
      toast.error(t("backup.networkRemove"));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<BackupInfo>[] = [
    {
      key: "name",
      header: t("backup.file"),
      render: (backup) => (
        <Box className="items-center gap-2">
          <FiDatabase aria-hidden className="h-4 w-4 shrink-0 text-gray-400" />
          <Text as="span" size="caption" className="truncate font-medium text-gray-900">
            {backup.name}
          </Text>
        </Box>
      ),
    },
    {
      key: "createdAt",
      header: t("common.createdAt"),
      width: "160px",
      render: (backup) => (
        <Text as="span" size="caption" className="whitespace-nowrap text-gray-500">
          {formatDateTime(backup.createdAt, locale)}
        </Text>
      ),
    },
    {
      key: "size",
      header: t("backup.size"),
      width: "110px",
      render: (backup) => (
        <Text as="span" size="caption" className="whitespace-nowrap text-gray-500">
          {formatSize(backup.size)}
        </Text>
      ),
    },
    {
      key: "__actions",
      header: "",
      width: "110px",
      align: "right",
      render: (backup) => (
        <Box className="items-center justify-end gap-1">
          <a
            href={backupUrl(`name=${encodeURIComponent(backup.name)}`)}
            download={backup.name}
            title={t("backup.download")}
            aria-label={t("backup.download")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <FiDownload aria-hidden />
          </a>
          <IconButton
            type="button"
            label={t("common.remove")}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => setDrawer({ kind: "delete", backup })}
          >
            <FiTrash2 aria-hidden />
          </IconButton>
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
              {t("backup.title")}
            </Text>
            <Badge tone="gray">{backups.length}</Badge>
          </Box>
          <Text size="caption" className="text-gray-500">
            {t("backup.subtitle")}
          </Text>
        </Box>
        <Box className="flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => void reload()} disabled={loading}>
            <FiRefreshCw aria-hidden /> {t("backup.refresh")}
          </Button>
          <Button type="button" variant="secondary" onClick={downloadCurrent} disabled={busy}>
            <FiDownload aria-hidden /> {t("backup.downloadCurrent")}
          </Button>
          <Button type="button" variant="secondary" onClick={pickFile} disabled={busy}>
            <FiUpload aria-hidden /> {t("backup.restoreAction")}
          </Button>
          <Button type="button" variant="primary" onClick={() => void createBackup()} disabled={busy}>
            <FiPlus aria-hidden /> {t("backup.create")}
          </Button>
        </Box>
      </Box>

      <Box className="rounded-lg border border-gray-200 bg-white p-4">
        <Text size="caption" className="text-gray-500">
          {t("backup.description")}
        </Text>
      </Box>

      <input
        ref={fileRef}
        type="file"
        accept=".serenojs,application/gzip"
        className="hidden"
        onChange={onFileChange}
      />

      <DataTable
        columns={columns}
        rows={backups}
        rowKey={(backup) => backup.name}
        loading={loading}
        empty={t("backup.empty")}
      />

      <Drawer
        open={drawer.kind !== "closed"}
        onClose={closeDrawer}
        title={
          drawer.kind === "restore"
            ? t("backup.restoreTitle")
            : drawer.kind === "delete"
              ? t("backup.deleteTitle")
              : ""
        }
        description={
          drawer.kind === "restore"
            ? t("backup.restoreWarning")
            : drawer.kind === "delete"
              ? t("common.deleteWarning")
              : undefined
        }
      >
        {drawer.kind === "restore" ? (
          <Box className="flex-col gap-6">
            <Text className="text-gray-700">
              {t("backup.restoreConfirm", { name: drawer.file.name })}
            </Text>
            <Box className="items-center justify-end gap-2 border-t border-gray-200 pt-4">
              <Button type="button" variant="secondary" onClick={closeDrawer} disabled={busy}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => void confirmRestore()}
                disabled={busy}
              >
                {busy ? t("backup.restoring") : t("backup.restoreAction")}
              </Button>
            </Box>
          </Box>
        ) : null}

        {drawer.kind === "delete" ? (
          <Box className="flex-col gap-6">
            <Text className="text-gray-700">
              {t("backup.deleteConfirm", { name: drawer.backup.name })}
            </Text>
            <Box className="items-center justify-end gap-2 border-t border-gray-200 pt-4">
              <Button type="button" variant="secondary" onClick={closeDrawer} disabled={busy}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => void confirmDelete()}
                disabled={busy}
              >
                {busy ? t("common.removing") : t("common.remove")}
              </Button>
            </Box>
          </Box>
        ) : null}
      </Drawer>
    </Box>
  );
};
