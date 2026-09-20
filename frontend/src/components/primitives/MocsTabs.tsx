import React, { useRef, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';

export interface MocsTab {
  id: string;
  label: string;
  /** Optional count shown in parentheses after the label */
  count?: number;
}

export interface MocsTabsProps {
  tabs: MocsTab[];
  activeId: string;
  onChange: (id: string) => void;
  /** Optional content rendered in the right slot (e.g. action buttons) */
  actions?: React.ReactNode;
  className?: string;
  testId?: string;
}

/**
 * MocsTabs — canonical MOCS-Cert tab bar.
 *
 * Implements WAI-ARIA Tabs pattern:
 *   role="tablist" on container
 *   role="tab" on each button
 *   aria-selected="true" on active tab
 *   aria-controls + id for panel association
 *
 * Keyboard:
 *   ArrowLeft / ArrowRight — navigate between tabs
 *   Home / End — jump to first / last tab
 *   Tab — exit the tablist
 *
 * Visual:
 *   Active:   bg-white border border-[#E5E5E5] text-[#1C1C1C] font-semibold
 *   Inactive: transparent text-[#5C5C5C] hover:text-[#1C1C1C]
 *   Container: h-9 px-3.5 bg-[#FAFAFA] border-b border-[#F1F5F9]
 */
export const MocsTabs: React.FC<MocsTabsProps> = ({
  tabs,
  activeId,
  onChange,
  actions,
  className = '',
  testId,
}) => {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Sync refs array length with tabs
  useEffect(() => {
    tabRefs.current = tabRefs.current.slice(0, tabs.length);
  }, [tabs.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let nextIndex = index;

      if (e.key === 'ArrowRight') {
        nextIndex = (index + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = tabs.length - 1;
      } else {
        return;
      }

      e.preventDefault();
      tabRefs.current[nextIndex]?.focus();
      onChange(tabs[nextIndex].id);
    },
    [tabs, onChange],
  );

  return (
    <div
      data-testid={testId}
      className={clsx(
        'min-h-[38px] px-3.5 border-b border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-between gap-2 shrink-0 select-none font-sans',
        className,
      )}
    >
      <div
        role="tablist"
        aria-label="View tabs"
        className="flex items-center space-x-1 min-w-0 overflow-x-auto scrollbar-none py-1"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeId;
          const tabBtnTestId =
            testId === 'cert-tab-bar'
              ? `cert-tab-${tab.id}`
              : testId === 'audit-tabs'
              ? `audit-subtab-${tab.id}`
              : `mocs-tab-${tab.id}`;

          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[index] = el; }}
              role="tab"
              id={`mocs-tab-${tab.id}`}
              data-testid={tabBtnTestId}
              aria-selected={isActive}
              aria-controls={`mocs-tabpanel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={clsx(
                'h-7 px-2.5 sm:px-3 rounded-[4px] text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#005FB8]',
                isActive
                  ? 'bg-[#FFFFFF] text-[#1C1C1C] font-semibold border border-[#005FB8] shadow-xs'
                  : 'text-[#5C5C5C] hover:text-[#1C1C1C] hover:bg-[#F0F0F0] border border-transparent',
              )}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={clsx(
                    'text-[10px] tabular-nums font-semibold px-1.5 py-0.2 rounded',
                    isActive ? 'bg-[#EBF3FC] text-[#005FB8]' : 'bg-[#EAEAEA] text-[#707070]'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 pl-2">{actions}</div>
      )}
    </div>
  );
};
