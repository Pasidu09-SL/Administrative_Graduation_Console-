import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unified Graduation & Certificate Management System",
  description: "Secure University Exam Division graduation console and student self-service portal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const theme = localStorage.getItem('theme') || 'system';
            const root = document.documentElement;
            root.classList.remove('light', 'dark');
            if (theme === 'system') {
              const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
              root.classList.add(systemTheme);
            } else {
              root.classList.add(theme);
            }
          } catch (e) {}
        `}} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
