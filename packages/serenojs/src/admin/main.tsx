"use client";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";
import type { AdminRuntimeConfig } from "../ui/admin/runtime.js";
import { AdminRuntimeProvider } from "../ui/admin/runtime.js";
import { setLocaleLabels } from "../ui/admin/locales.js";
import { setDefaultLocale } from "../locale.js";
import { DEFAULT_ADMIN_LOCALE, I18nProvider, translate } from "../ui/admin/i18n.js";
import { RouterProvider } from "../ui/admin/router.js";
import { AdminApp } from "./app.js";

declare global {
  interface Window {
    __SERENOJS__?: AdminRuntimeConfig;
  }
}

const config = window.__SERENOJS__;
const container = document.getElementById("root");

if (!config) {
  if (container) {
    container.textContent = translate(DEFAULT_ADMIN_LOCALE, "app.missingRuntime");
  }
} else if (container) {
  setLocaleLabels(config.locales);
  setDefaultLocale(config.defaultLocale);
  createRoot(container).render(
    <StrictMode>
      <AdminRuntimeProvider value={config}>
        <I18nProvider>
          <RouterProvider basePath={config.adminPath}>
            <AdminApp />
          </RouterProvider>
        </I18nProvider>
      </AdminRuntimeProvider>
    </StrictMode>,
  );
}
