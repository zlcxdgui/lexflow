import type { ReactNode } from 'react';

export type AppNavLink = {
  href: string;
  label: string;
  icon: ReactNode;
  children?: AppNavLink[];
};

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" fill="currentColor" />
    </svg>
  );
}

function CaseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 4h6l1 2h4v14H4V6h4l1-2Zm3 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" fill="currentColor" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6 2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 19c0-2.8 3.1-4.5 6-4.5s6 1.7 6 4.5v1H3v-1Zm12.5 1v-1c0-1.2-.4-2.3-1.2-3.2 2.4.1 5.7 1.4 5.7 4.2v0h-4.5Z" fill="currentColor" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2Zm11 8H6v10h12V10Z" fill="currentColor" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h9l5 5v13H6V3Zm8 1.5V9h4.5L14 4.5ZM9 12h6v1.5H9V12Zm0 3h6v1.5H9V15Z" fill="currentColor" />
    </svg>
  );
}

function BillingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7Zm3-1a1 1 0 0 0-1 1v1h12V7a1 1 0 0 0-1-1H7Zm11 4H6v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7Zm-8 2h5v1.5h-5V12Z" fill="currentColor" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 11a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 12 11Zm-7 9c0-3 3.2-5 7-5s7 2 7 5v1H5v-1Z" fill="currentColor" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 8.7 11.2h-2.1A7 7 0 1 1 12 5v3l4-3.5L12 1v2Zm-1 5v5l4 2 .9-1.8-2.9-1.5V8H11Z" fill="currentColor" />
    </svg>
  );
}

export function CalculatorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 4h10V5H7v2Zm2 4h2V9H9v2Zm0 4h2v-2H9v2Zm4-4h2V9h-2v2Zm0 4h2v-2h-2v2Z" fill="currentColor" />
    </svg>
  );
}

const baseLinks: AppNavLink[] = [
  { href: '/dashboard', label: 'Painel', icon: <GridIcon /> },
  { href: '/matters', label: 'Casos', icon: <CaseIcon /> },
  { href: '/finance', label: 'Financeiro', icon: <BillingIcon /> },
  { href: '/clients', label: 'Pessoas', icon: <PeopleIcon /> },
  { href: '/appointments', label: 'Atendimento', icon: <CalendarIcon /> },
  { href: '/agenda', label: 'Agenda', icon: <CalendarIcon /> },
  { href: '/reports', label: 'Relatórios', icon: <ReportIcon /> },
  { href: '/team', label: 'Equipe', icon: <TeamIcon /> },
];

export const calculatorLinks = [
  { href: '/calculators/deadline', label: 'Calculadora de prazos' },
  { href: '/calculators/child-support', label: 'Calculadora de pensão alimentícia' },
];

export function getAppMenuLinks(role?: string): AppNavLink[] {
  const normalized = String(role || '').toUpperCase();
  const withOwner = normalized === 'OWNER' || normalized === 'ADMIN'
    ? [
        ...baseLinks,
        { href: '/billing', label: 'Planos e cobrança', icon: <BillingIcon /> },
        { href: '/audit', label: 'Auditoria', icon: <HistoryIcon /> },
      ]
    : baseLinks;
  return normalized === 'ADMIN'
    ? [...withOwner, { href: '/offices', label: 'Escritórios', icon: <TeamIcon /> }]
    : withOwner;
}
