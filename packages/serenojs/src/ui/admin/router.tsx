"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

import { joinPath, useCms } from "./runtime.js";

type RouterValue = {
  /** Current path relative to the admin mount path (`/`, `/todos`, ...). */
  path: string;
  navigate: (to: string) => void;
};

const RouterContext = createContext<RouterValue | null>(null);

function relativePath(pathname: string, base: string): string {
  const basePath = base.replace(/\/+$/, "");
  if (pathname === basePath) return "/";
  if (pathname.startsWith(`${basePath}/`)) {
    const rest = pathname.slice(basePath.length);
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return "/";
}

export function RouterProvider({
  basePath,
  children,
}: {
  basePath: string;
  children: ReactNode;
}) {
  const [path, setPath] = useState(() =>
    typeof window === "undefined" ? "/" : relativePath(window.location.pathname, basePath),
  );

  useEffect(() => {
    const onPop = () => setPath(relativePath(window.location.pathname, basePath));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [basePath]);

  const navigate = useCallback(
    (to: string) => {
      const absolute = joinPath(basePath, to);
      if (absolute !== window.location.pathname) {
        window.history.pushState(null, "", absolute);
      }
      setPath(relativePath(absolute, basePath));
    },
    [basePath],
  );

  const value = useMemo(() => ({ path, navigate }), [path, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (!value) {
    throw new Error("[serenojs] RouterProvider is missing.");
  }
  return value;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
};

/** Internal link that preserves the SPA history. */
export function Link({ to, onClick, children, ...rest }: LinkProps) {
  const { navigate } = useRouter();
  const { adminPath } = useCms();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={joinPath(adminPath, to)} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
