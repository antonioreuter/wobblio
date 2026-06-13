'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ReceiptText,
  CheckSquare,
  LineChart,
  ShoppingCart,
  Wallet,
  Users,
  Settings,
  Terminal,
} from 'lucide-react';
import { WobblioLogo } from '@/components/ui/logo';

interface LeftNavProps {
  userRole?: string;
}

export function LeftNav({ userRole }: LeftNavProps) {
  const pathname = usePathname() ?? '';

  const menuItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/invoices', icon: ReceiptText, label: 'Invoices Ledger' },
    { href: '/review', icon: CheckSquare, label: 'Awaiting Check' },
    { href: '/reports', icon: LineChart, label: 'Price Trends' },
    { href: '/lists', icon: ShoppingCart, label: 'Shopping Lists' },
    { href: '/budgets', icon: Wallet, label: 'Category Budgets' },
    { href: '/household', icon: Users, label: 'Household Synced Space' },
  ];

  return (
    <aside className="app-nav-rail">
      <Link href="/dashboard" className="rail-logo" title="Wobblio">
        <WobblioLogo className="w-8 h-[21px]" />
      </Link>
      
      <nav className="rail-menu" aria-label="App Navigation Modules">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rail-btn ${isActive ? 'active' : ''}`}
              title={item.label}
              aria-label={item.label}
            >
              <Icon className="w-5 h-5" />
            </Link>
          );
        })}

        <Link
          href="/settings"
          className={`rail-btn ${pathname.startsWith('/settings') ? 'active' : ''}`}
          title="Settings & Privacy"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </Link>

        {userRole === 'ADMIN' && (
          <Link
            href="/admin"
            className={`rail-btn ${pathname.startsWith('/admin') ? 'active' : ''}`}
            title="Developer Console"
            aria-label="Admin"
          >
            <Terminal className="w-5 h-5" />
          </Link>
        )}
      </nav>
    </aside>
  );
}
