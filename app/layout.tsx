import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navigation } from '@/components/Navigation';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ToastProvider } from '@/components/ui/Toast';
import { OnboardingWizard } from '@/renderer/components/OnboardingWizard';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SessionHub - Development Velocity Platform',
  description: 'Build faster through perfect execution with the Two-Actor Model',
  keywords: ['development', 'velocity', 'claude', 'two-actor model'],
  authors: [{ name: 'Jonathan Hoggard' }],
  openGraph: {
    title: 'SessionHub',
    description: 'Development Velocity Platform',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className={`${inter.className} bg-background text-foreground`}>
        <ErrorBoundary>
          <ToastProvider>
            <React.Fragment>
              <div className="min-h-screen flex flex-col">
                <Navigation />
                <main className="flex-1">
                  <ErrorBoundary>
                    {children}
                  </ErrorBoundary>
                </main>
                <OnboardingWizard />
                <footer className="bg-card border-t py-8 mt-auto">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center text-sm text-muted-foreground">
                      <p>© 2025 SessionHub. Built with the Two-Actor Model.</p>
                    </div>
                  </div>
                </footer>
              </div>
            </React.Fragment>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}