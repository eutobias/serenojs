"use client";

import { useState } from "react";

import { Box } from "../box.js";
import { Button } from "../button.js";
import { FieldWrapper, inputClass } from "../field-wrapper.js";
import { Text } from "../text.js";
import { useCmsUrls } from "./runtime.js";
import { useI18n } from "./i18n.js";

function nextTarget(): string {
  if (typeof window === "undefined") return "/admin";
  const next = new URLSearchParams(window.location.search).get("next");
  // Only allow internal paths.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
}

export const LoginForm = ({ onSuccess }: { onSuccess?: () => void }) => {
  const { auth } = useCmsUrls();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(auth("login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        setError(json?.message ?? t("login.error"));
        return;
      }
      if (onSuccess) onSuccess();
      else window.location.assign(nextTarget());
    } catch {
      setError(t("login.network"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      as="form"
      className="flex-col gap-4"
      onSubmit={(event) => void submit(event)}
    >
      {error ? (
        <Box className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <Text size="caption" className="text-red-700">
            {error}
          </Text>
        </Box>
      ) : null}

      <FieldWrapper label={t("common.email")} htmlFor="login-email" required>
        <input
          id="login-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          disabled={submitting}
          onChange={(event) => setEmail(event.target.value)}
          className={`${inputClass} border-gray-300`}
        />
      </FieldWrapper>

      <FieldWrapper label={t("common.password")} htmlFor="login-password" required>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          disabled={submitting}
          onChange={(event) => setPassword(event.target.value)}
          className={`${inputClass} border-gray-300`}
        />
      </FieldWrapper>

      <Button type="submit" variant="primary" disabled={submitting}>
        {submitting ? t("login.submitting") : t("login.submit")}
      </Button>
    </Box>
  );
};
