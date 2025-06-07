import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './simple.css';
// import { Navigation } from '@/components/Navigation';

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
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100`}>
        <div className="min-h-screen flex flex-col">
          <main className="flex-1">
            {children}
          </main>
          <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-8 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                <p>© 2025 SessionHub. Built with the Two-Actor Model.</p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}