/**
 * Single entry point for the packaged CMS. Everything (admin SPA, REST API,
 * auth, media, uploads and backups) is mounted by the package at the paths
 * declared in `serenojs.config.ts`.
 */
import config from "../../serenojs.config";
import { createCmsMiddleware } from "@eutobias/serenojs/server";

export default createCmsMiddleware(config);
