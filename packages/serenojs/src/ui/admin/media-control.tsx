"use client";

import { useRef, useState } from "react";

import { acceptAttribute, isImageUrl } from "../../core/media.js";
import type { FieldDef } from "../../core/types.js";
import { Box } from "../box.js";
import { Button } from "../button.js";
import { FieldWrapper } from "../field-wrapper.js";
import { useCmsUrls } from "./runtime.js";
import { Text } from "../text.js";
import { useI18n } from "./i18n.js";

export type MediaControlProps = {
  field: FieldDef;
  collectionSlug: string;
  value: string;
  error?: string | undefined;
  disabled?: boolean | undefined;
  onChange: (value: string) => void;
};

function fileName(url: string): string {
  return url.split("/").pop() ?? url;
}

/**
 * Upload control for `media` fields. Uploads to `/media?collection=&field=`,
 * stores the returned URL, and can delete the underlying file on removal.
 */
export const MediaControl = ({
  field,
  collectionSlug,
  value,
  error,
  disabled,
  onChange,
}: MediaControlProps) => {
  const { media } = useCmsUrls();
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setLocalError(null);
    try {
      const params = new URLSearchParams({
        collection: collectionSlug,
        field: field.name,
      });
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(media(params.toString()), {
        method: "POST",
        body: form,
      });
      const json = (await response.json().catch(() => null)) as
        | { media?: { url?: string }; message?: string }
        | null;
      if (!response.ok || !json?.media?.url) {
        setLocalError(json?.message ?? t("media.uploadFailed"));
        return;
      }
      onChange(json.media.url);
    } catch {
      setLocalError(t("media.networkUpload"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    setLocalError(null);
    if (value.startsWith("/files/")) {
      try {
        await fetch(media(`url=${encodeURIComponent(value)}`), {
          method: "DELETE",
        });
      } catch {
        // Ignore: the folder can be cleaned manually.
      }
    }
    onChange("");
  };

  const busy = disabled || uploading;

  return (
    <FieldWrapper
      label={field.label}
      required={field.required}
      help={field.help}
      error={error ?? localError ?? undefined}
    >
      <Box className="flex-col gap-2">
        {value ? (
          <Box className="flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
            {isImageUrl(value) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={value}
                alt=""
                className="h-32 w-full rounded-md border border-gray-200 bg-white object-contain"
              />
            ) : null}
            <Box className="items-center justify-between gap-2">
              <a
                href={value}
                target="_blank"
                rel="noreferrer"
                className="truncate text-sm text-gray-600 underline hover:text-gray-900"
              >
                {fileName(value)}
              </a>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={busy}
                onClick={() => void remove()}
              >
                Remover
              </Button>
            </Box>
          </Box>
        ) : (
          <Text size="caption" className="text-gray-400">
            {t("media.noFile")}
          </Text>
        )}

        <Box className="items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? t("media.uploading") : value ? t("media.replace") : t("media.upload")}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={acceptAttribute(field)}
            disabled={busy}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </Box>
      </Box>
    </FieldWrapper>
  );
};
