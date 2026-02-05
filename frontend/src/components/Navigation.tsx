'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, Moon, Database, Gauge, FlaskConical, Info, Settings } from 'lucide-react';
import { useTheme } from './ThemeProvider';

const tabs = [
  { name: 'Datasets', href: '/datasets', icon: Database },
  { name: 'Graders', href: '/graders', icon: Gauge },
  { name: 'Experiments', href: '/experiments', icon: FlaskConical },
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'About', href: '/about', icon: Info },
];

export function Navigation() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="bg-card border-b border-border" style={{ boxShadow: 'var(--shadow-sm)' }}>
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex h-14 items-center justify-between">
          <Link
            href="/"
            className="font-mono text-sm font-semibold tracking-tight text-muted-foreground hover:text-foreground transition-colors"
          >
            eval-harness
          </Link>

          <nav className="flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive = pathname.startsWith(tab.href);
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-all
                    ${isActive
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }
                  `}
                  style={{ borderRadius: 'var(--radius)' }}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.name}</span>
                </Link>
              );
            })}
          </nav>

          <button
            onClick={toggleTheme}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            style={{ borderRadius: 'var(--radius)' }}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
