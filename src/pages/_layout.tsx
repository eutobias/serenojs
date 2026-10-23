import type { ReactNode } from "react";

import "../styles.css";

type RootLayoutProps = { children: ReactNode };

export default async function RootLayout({ children }: RootLayoutProps) {
  return (
    <>
      <div className="min-h-[100dvh] bg-gray-50 text-gray-900 antialiased">
        {children}
      </div>
    </>
  );
}

export const getConfig = async () => {
  return { render: "static" } as const;
};
