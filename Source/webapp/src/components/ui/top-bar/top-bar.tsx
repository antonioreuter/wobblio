'use client';

import React, { useState, useEffect } from 'react';
import { Search, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/providers/theme-provider';
import { cn } from '@/lib/cn';

interface TopBarProps {
  quotaUsed?: number;
  quotaLimit?: number;
  className?: string;
}

export function TopBar({ quotaUsed = 7, quotaLimit = 10, className }: TopBarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className={cn('app-topbar', className)}>
      <div className="search-bar-wrap">
        <Search size={18} />
        <input 
          type="text" 
          placeholder="Search merchant, tag, or item..." 
          className="app-search-input" 
          id="appSearchInput"
        />
      </div>

      <div className="topbar-right-controls flex items-center gap-4">
        <div className="quota-indicator" id="topbarQuota" style={{ fontSize: '13px' }}>
          {quotaUsed} of {quotaLimit} scans used
        </div>

        {/* Theme Toggle Button */}
        <button 
          className="btn-icon-only flex items-center justify-center" 
          onClick={toggleTheme}
          title="Toggle Light/Dark Theme"
          style={{ width: '38px', height: '38px' }}
        >
          {mounted ? (
            resolvedTheme === 'light' ? (
              <Sun size={18} className="text-[#0f172a] dark:text-[#f8fafc]" />
            ) : (
              <Moon size={18} className="text-[#0f172a] dark:text-[#f8fafc]" />
            )
          ) : (
            <div style={{ width: '18px', height: '18px' }} />
          )}
        </button>

        <div className="user-avatar-profile">
          <div className="avatar-circle">AR</div>
        </div>
      </div>
    </header>
  );
}

