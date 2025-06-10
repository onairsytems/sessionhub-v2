'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ElementType;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  separator?: React.ReactNode;
  maxItems?: number;
  homeIcon?: boolean;
}

export function Breadcrumb({ 
  items, 
  className = '',
  separator = <ChevronRight className="w-4 h-4" />,
  maxItems,
  homeIcon = true
}: BreadcrumbProps) {
  const allItems = homeIcon 
    ? [{ label: 'Home', href: '/', icon: Home }, ...items]
    : items;

  const displayItems = maxItems && allItems.length > maxItems
    ? [
        ...allItems.slice(0, 1),
        { label: '...', href: undefined },
        ...allItems.slice(-(maxItems - 2))
      ]
    : allItems;

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center ${className}`}>
      <ol className="flex items-center space-x-2">
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;
          const Icon = item.icon;

          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <span className="mx-2 text-muted-foreground">{separator}</span>
              )}
              
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span
                  className={`flex items-center gap-1 text-sm ${
                    isLast ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  <span>{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Hook to generate breadcrumbs from pathname
export function useBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  
  return segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const label = segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return { label, href };
  });
}

// Pre-configured breadcrumb patterns
export function SessionBreadcrumb({ sessionId, sessionName }: { sessionId: string; sessionName?: string }) {
  const items: BreadcrumbItem[] = [
    { label: 'Sessions', href: '/sessions' },
    { label: sessionName || `Session ${sessionId}` }
  ];
  
  return <Breadcrumb items={items} />;
}

export function ProjectBreadcrumb({ projectName, subPath }: { projectName: string; subPath?: string[] }) {
  const items: BreadcrumbItem[] = [
    { label: 'Projects', href: '/projects' },
    { label: projectName, href: `/projects/${projectName}` }
  ];
  
  if (subPath) {
    items.push(...subPath.map((path, index) => ({
      label: path,
      href: `/projects/${projectName}/${subPath.slice(0, index + 1).join('/')}`
    })));
  }
  
  return <Breadcrumb items={items} />;
}

export function SettingsBreadcrumb({ section }: { section?: string }) {
  const items: BreadcrumbItem[] = [
    { label: 'Settings', href: '/settings' }
  ];
  
  if (section) {
    items.push({ label: section });
  }
  
  return <Breadcrumb items={items} />;
}