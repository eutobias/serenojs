"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Admin UI language (independent from content localization).
 *
 * English is the default; the user's choice is persisted in localStorage.
 * Collection/field labels come from the schema and are intentionally NOT
 * translated here.
 */
export type AdminLocale = "en" | "pt";

export const ADMIN_LOCALES: { code: AdminLocale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português (BR)" },
];

export const DEFAULT_ADMIN_LOCALE: AdminLocale = "en";
export const ADMIN_LOCALE_STORAGE_KEY = "serenojs:admin-locale";

type Vars = Record<string, string | number>;
type Dictionary = Record<string, string>;

const en: Dictionary = {
  "common.loading": "Loading…",
  "common.saveChanges": "Save changes",
  "common.saving": "Saving…",
  "common.cancel": "Cancel",
  "common.remove": "Remove",
  "common.removing": "Removing…",
  "common.edit": "Edit",
  "common.createdAt": "Created at",
  "common.updatedAt": "Updated at",
  "common.email": "Email",
  "common.password": "Password",
  "common.deleteWarning": "This action cannot be undone.",
  "common.search": "Search",
  "common.clear": "Clear",
  "common.closeNotification": "Close notification",
  "common.yes": "Yes",
  "common.no": "No",
  "common.language": "Language",
  "sidebar.openMenu": "Open menu",

  "app.unexpected": "Unexpected error.",
  "app.errorTitle": "Something went wrong",
  "app.verifyingSession": "Checking session…",
  "app.collectionNotFound": 'There is no collection "{slug}".',
  "app.missingRuntime": "SerenoJS configuration is missing. The middleware did not inject the runtime.",

  "login.title": "Sign in",
  "login.subtitle": "{title} · admin panel",
  "login.submitting": "Signing in…",
  "login.submit": "Sign in",
  "login.error": "Could not sign in.",
  "login.network": "Network error while signing in.",

  "sidebar.collections": "Collections",
  "sidebar.overview": "Overview",
  "sidebar.singleRecord": "Single record",
  "sidebar.administration": "Administration",
  "sidebar.users": "Users",
  "sidebar.backup": "Backup",
  "sidebar.sessionActive": "Active session",
  "sidebar.signOut": "Sign out",

  "dashboard.subtitle": "Panel generated from the collection descriptors.",
  "dashboard.single": "Single",
  "dashboard.fields": "{count} field(s) defined in the schema.",
  "dashboard.manage": "Manage →",

  "collection.newItem": "+ New item",
  "collection.searchPlaceholder": "Search…",
  "collection.empty": "No items registered yet.",
  "collection.editTitle": "Edit item #{id}",
  "collection.newTitle": "New item in {label}",
  "collection.removeTitle": "Remove item",
  "collection.removeConfirm": "Are you sure you want to remove {label}?",
  "collection.loadError": "Failed to load items.",
  "collection.saveError": "Could not save.",
  "collection.created": "Item created successfully.",
  "collection.updated": "Item updated successfully.",
  "collection.removeError": "Could not remove the item.",
  "collection.removed": "Item removed successfully.",
  "collection.networkSave": "Network error while saving the item.",

  "form.general": "General",
  "form.create": "Create item",

  "standalone.badge": "Single record",
  "standalone.saved": "Record updated successfully.",
  "standalone.saveError": "Could not save.",
  "standalone.networkSave": "Network error while saving the record.",

  "field.select": "— select —",
  "field.none": "— none —",

  "media.upload": "Upload file",
  "media.replace": "Replace file",
  "media.uploading": "Uploading…",
  "media.uploadFailed": "Upload failed.",
  "media.networkUpload": "Network error during upload.",
  "media.addImages": "Add images",
  "media.moveBack": "Move backward",
  "media.setPrimary": "Set as primary",
  "media.moveForward": "Move forward",
  "media.count": "{count} media",
  "media.primary": "Primary",
  "media.noFile": "No file selected.",
  "media.noMedia": "No media uploaded.",
  "relation.empty": "No items available to relate.",

  "list.empty": "No items.",
  "list.item": "Item {index}",
  "list.moveUp": "Move up",
  "list.moveDown": "Move down",
  "list.remove": "Remove",
  "list.add": "Add item",

  "pagination.range": "{from}–{to} of {total} items",
  "pagination.previous": "Previous",
  "pagination.next": "Next",

  "table.loading": "Loading…",
  "table.empty": "No items found.",

  "users.title": "Users",
  "users.subtitle": "Who can access the admin panel.",
  "users.you": "you",
  "users.new": "+ New user",
  "users.createTitle": "New user",
  "users.empty": "No users registered yet.",
  "users.editTitle": "Edit user #{id}",
  "users.removeTitle": "Remove user",
  "users.removeConfirm":
    "Remove the user {email}? Their active sessions will be revoked.",
  "users.newPassword": "New password",
  "users.passwordHintKeep": "Leave blank to keep the current password.",
  "users.passwordHintMin": "At least 8 characters.",
  "users.create": "Create user",
  "users.created": "User created.",
  "users.updated": "User updated.",
  "users.removed": "User removed.",
  "users.saveError": "Could not save the user.",
  "users.networkSave": "Network error while saving the user.",
  "users.removeError": "Could not remove the user.",
  "users.networkRemove": "Network error while removing the user.",

  "backup.title": "Backup",
  "backup.subtitle": "Download or restore the database and system images.",
  "backup.refresh": "Refresh",
  "backup.downloadCurrent": "Download current",
  "backup.restoreAction": "Restore",
  "backup.create": "Create backup",
  "backup.description":
    "The backup bundles a consistent SQLite snapshot and every file under public/images and public/files. Restoring replaces the current database and rewrites the images.",
  "backup.file": "File",
  "backup.size": "Size",
  "backup.download": "Download",
  "backup.empty": "No stored backups yet.",
  "backup.restoreTitle": "Restore backup",
  "backup.deleteTitle": "Remove backup",
  "backup.restoreWarning": "The current database will be replaced.",
  "backup.restoreConfirm":
    "Restore the file {name}? The current database will be replaced and images from the backup rewritten. The session may be terminated.",
  "backup.deleteConfirm": "Remove the backup {name}?",
  "backup.restoring": "Restoring…",
  "backup.restored": "Backup restored. Reloading…",
  "backup.created": "Backup created.",
  "backup.createError": "Could not create the backup.",
  "backup.networkCreate": "Network error while creating the backup.",
  "backup.restoreError": "Could not restore the backup.",
  "backup.networkRestore": "Network error while restoring the backup.",
  "backup.removed": "Backup removed.",
  "backup.removeError": "Could not remove the backup.",
  "backup.networkRemove": "Network error while removing the backup.",
};

const pt: Dictionary = {
  "common.loading": "Carregando…",
  "common.saveChanges": "Salvar alterações",
  "common.saving": "Salvando…",
  "common.cancel": "Cancelar",
  "common.remove": "Remover",
  "common.removing": "Removendo…",
  "common.edit": "Editar",
  "common.createdAt": "Criado em",
  "common.updatedAt": "Atualizado em",
  "common.email": "E-mail",
  "common.password": "Senha",
  "common.deleteWarning": "Esta ação não pode ser desfeita.",
  "common.search": "Buscar",
  "common.clear": "Limpar",
  "common.closeNotification": "Fechar notificação",
  "common.yes": "Sim",
  "common.no": "Não",
  "common.language": "Idioma",
  "sidebar.openMenu": "Abrir menu",

  "app.unexpected": "Erro inesperado.",
  "app.errorTitle": "Algo deu errado",
  "app.verifyingSession": "Verificando sessão…",
  "app.collectionNotFound": 'Não há coleção "{slug}".',
  "app.missingRuntime": "Configuração do SerenoJS ausente. O middleware não injetou o runtime.",

  "login.title": "Entrar",
  "login.subtitle": "{title} · painel administrativo",
  "login.submitting": "Entrando…",
  "login.submit": "Entrar",
  "login.error": "Não foi possível entrar.",
  "login.network": "Erro de rede ao entrar.",

  "sidebar.collections": "Coleções",
  "sidebar.overview": "Visão geral",
  "sidebar.singleRecord": "Registro único",
  "sidebar.administration": "Administração",
  "sidebar.users": "Usuários",
  "sidebar.backup": "Backup",
  "sidebar.sessionActive": "Sessão ativa",
  "sidebar.signOut": "Sair",

  "dashboard.subtitle": "Painel gerado automaticamente a partir dos descritores de coleção.",
  "dashboard.single": "Único",
  "dashboard.fields": "{count} campo(s) definidos no schema.",
  "dashboard.manage": "Gerenciar →",

  "collection.newItem": "+ Novo item",
  "collection.searchPlaceholder": "Buscar…",
  "collection.empty": "Nenhum item cadastrado ainda.",
  "collection.editTitle": "Editar item #{id}",
  "collection.newTitle": "Novo item em {label}",
  "collection.removeTitle": "Remover item",
  "collection.removeConfirm": "Tem certeza que deseja remover {label}?",
  "collection.loadError": "Falha ao carregar os itens.",
  "collection.saveError": "Não foi possível salvar.",
  "collection.created": "Item criado com sucesso.",
  "collection.updated": "Item atualizado com sucesso.",
  "collection.removeError": "Não foi possível remover o item.",
  "collection.removed": "Item removido com sucesso.",
  "collection.networkSave": "Erro de rede ao salvar o item.",

  "form.general": "Geral",
  "form.create": "Criar item",

  "standalone.badge": "Registro único",
  "standalone.saved": "Registro atualizado com sucesso.",
  "standalone.saveError": "Não foi possível salvar.",
  "standalone.networkSave": "Erro de rede ao salvar o registro.",

  "field.select": "— selecione —",
  "field.none": "— nenhum —",

  "media.upload": "Enviar arquivo",
  "media.replace": "Substituir arquivo",
  "media.uploading": "Enviando…",
  "media.uploadFailed": "Falha no upload.",
  "media.networkUpload": "Erro de rede no upload.",
  "media.addImages": "Adicionar imagens",
  "media.moveBack": "Mover para trás",
  "media.setPrimary": "Definir como principal",
  "media.moveForward": "Mover para frente",
  "media.count": "{count} mídia(s)",
  "media.primary": "Principal",
  "media.noFile": "Nenhum arquivo enviado.",
  "media.noMedia": "Nenhuma mídia enviada.",
  "relation.empty": "Nenhum item disponível para relacionar.",

  "list.empty": "Nenhum item.",
  "list.item": "Item {index}",
  "list.moveUp": "Mover para cima",
  "list.moveDown": "Mover para baixo",
  "list.remove": "Remover",
  "list.add": "Adicionar item",

  "pagination.range": "{from}–{to} de {total} itens",
  "pagination.previous": "Anterior",
  "pagination.next": "Próxima",

  "table.loading": "Carregando…",
  "table.empty": "Nenhum item encontrado.",

  "users.title": "Usuários",
  "users.subtitle": "Quem pode acessar o painel administrativo.",
  "users.you": "você",
  "users.new": "+ Novo usuário",
  "users.createTitle": "Novo usuário",
  "users.empty": "Nenhum usuário cadastrado.",
  "users.editTitle": "Editar usuário #{id}",
  "users.removeTitle": "Remover usuário",
  "users.removeConfirm":
    "Remover o usuário {email}? As sessões ativas dele serão encerradas.",
  "users.newPassword": "Nova senha",
  "users.passwordHintKeep": "Deixe em branco para manter a senha atual.",
  "users.passwordHintMin": "Mínimo de 8 caracteres.",
  "users.create": "Criar usuário",
  "users.created": "Usuário criado.",
  "users.updated": "Usuário atualizado.",
  "users.removed": "Usuário removido.",
  "users.saveError": "Não foi possível salvar o usuário.",
  "users.networkSave": "Erro de rede ao salvar o usuário.",
  "users.removeError": "Não foi possível remover o usuário.",
  "users.networkRemove": "Erro de rede ao remover o usuário.",

  "backup.title": "Backup",
  "backup.subtitle": "Baixe ou restaure o banco de dados e as imagens do sistema.",
  "backup.refresh": "Atualizar",
  "backup.downloadCurrent": "Baixar atual",
  "backup.restoreAction": "Restaurar",
  "backup.create": "Criar backup",
  "backup.description":
    "O backup reúne um snapshot consistente do banco SQLite e todos os arquivos de public/images e public/files. Restaurar substitui o banco atual e regrava as imagens.",
  "backup.file": "Arquivo",
  "backup.size": "Tamanho",
  "backup.download": "Baixar",
  "backup.empty": "Nenhum backup armazenado ainda.",
  "backup.restoreTitle": "Restaurar backup",
  "backup.deleteTitle": "Remover backup",
  "backup.restoreWarning": "O banco atual será substituído.",
  "backup.restoreConfirm":
    "Restaurar o arquivo {name}? O banco de dados atual será substituído e as imagens do backup regravadas. A sessão pode ser encerrada.",
  "backup.deleteConfirm": "Remover o backup {name}?",
  "backup.restoring": "Restaurando…",
  "backup.restored": "Backup restaurado. Recarregando…",
  "backup.created": "Backup criado.",
  "backup.createError": "Não foi possível criar o backup.",
  "backup.networkCreate": "Erro de rede ao criar o backup.",
  "backup.restoreError": "Não foi possível restaurar o backup.",
  "backup.networkRestore": "Erro de rede ao restaurar o backup.",
  "backup.removed": "Backup removido.",
  "backup.removeError": "Não foi possível remover o backup.",
  "backup.networkRemove": "Erro de rede ao remover o backup.",
};

const messages: Record<AdminLocale, Dictionary> = { en, pt };

export function translate(
  locale: AdminLocale,
  key: string,
  vars?: Vars,
): string {
  const template = messages[locale][key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

function readStoredLocale(): AdminLocale {
  try {
    const stored = window.localStorage.getItem(ADMIN_LOCALE_STORAGE_KEY);
    if (stored === "en" || stored === "pt") return stored;
  } catch {
    // localStorage can be unavailable (private mode/SSR).
  }
  return DEFAULT_ADMIN_LOCALE;
}

type I18nValue = {
  locale: AdminLocale;
  setLocale: (locale: AdminLocale) => void;
  t: (key: string, vars?: Vars) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>(readStoredLocale);

  const setLocale = useCallback((next: AdminLocale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(ADMIN_LOCALE_STORAGE_KEY, next);
    } catch {
      // Ignore persistence failures.
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Vars) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("[serenojs] I18nProvider is missing.");
  }
  return value;
}
