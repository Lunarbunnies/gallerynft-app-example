import type { ReactNode } from "react";
import { ThemeToggle } from "../components/ThemeToggle";
import "./globals.css";

export const metadata = {
  title: "On-Chain Gallery",
  description: "Mock-first on-chain gallery system",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
            (function() {
              try {
                var stored = localStorage.getItem('gallery-theme');
                if (stored === 'dark' || stored === 'light') {
                  document.documentElement.setAttribute('data-theme', stored);
                }
              } catch (e) {}
            })();
          `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: "Helvetica, Arial, sans-serif",
          fontSize: "14px",
          lineHeight: 1.4,
        }}
      >
        <ThemeToggle />
        <div style={{ padding: "24px" }}>{children}</div>
      </body>
    </html>
  );
}
