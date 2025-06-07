
'use client';

export default function TestPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <h1 className="text-3xl font-bold text-center">SessionHub Test</h1>
      <p className="text-center mt-4">If you can see this, the build is working correctly.</p>
      <div className="mt-8 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md mx-auto">
        <h2 className="text-xl font-semibold mb-2">Build Status</h2>
        <ul className="space-y-2">
          <li className="text-green-600 dark:text-green-400">✓ Next.js build: Working</li>
          <li className="text-green-600 dark:text-green-400">✓ Tailwind CSS: Working</li>
          <li className="text-green-600 dark:text-green-400">✓ Dark mode: Working</li>
          <li className="text-yellow-600 dark:text-yellow-400">⚠ Electron API: Not available in this context</li>
        </ul>
      </div>
    </div>
  );
}