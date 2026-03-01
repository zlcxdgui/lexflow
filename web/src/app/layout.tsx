import type { Metadata } from 'next';
import AppHeader from '@/components/AppHeader';
import './globals.css';

export const metadata: Metadata = {
  title: 'LexFlow',
  description: 'SaaS de advocacia',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppHeader />
        <div className="appContentRoot">{children}</div>
      </body>
    </html>
  );
}
