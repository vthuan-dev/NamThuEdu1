import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Search } from "lucide-react";

export interface HoverDropdownOption {
  value: string;
  label: string;
  count?: number | string;
  icon?: React.ReactNode;
}

interface HoverDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: HoverDropdownOption[];
  ariaLabel?: string;
  searchable?: boolean;
  className?: string;
  menuMinWidth?: string;
}

export function HoverDropdown({
  value,
  onChange,
  options,
  ariaLabel,
  searchable = false,
  className = "",
  menuMinWidth = "min-w-[190px]",
}: HoverDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const selectedOption = options.find((o) => o.value === value);

  const handleMouseEnter = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  const handleClickToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery("");
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, searchQuery]);

  // Label to show on button
  const buttonText = selectedOption
    ? selectedOption.count !== undefined
      ? `${selectedOption.label} (${selectedOption.count})`
      : selectedOption.label
    : options[0]?.label || "Chọn";

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative inline-block text-left ${className}`}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleClickToggle}
        aria-label={ariaLabel || buttonText}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`group flex items-center justify-between gap-2.5 rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-all cursor-pointer whitespace-nowrap select-none ${
          isOpen
            ? "border-slate-800 ring-2 ring-slate-100 shadow-xs"
            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
        }`}
      >
        <span className="truncate font-normal text-slate-700">{buttonText}</span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? "rotate-180 text-slate-700" : "group-hover:text-slate-600"
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute left-0 top-full z-40 mt-1.5 ${menuMinWidth} max-w-xs max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl transition-all duration-150 animate-in fade-in-0 zoom-in-95`}
          style={{ boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)" }}
        >
          {/* Optional Search */}
          {searchable && options.length > 5 && (
            <div className="sticky top-0 z-10 bg-white px-2 pb-1.5 pt-0.5 border-b border-slate-100 mb-1">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm..."
                  className="w-full rounded-md border border-slate-200 py-1 pl-8 pr-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          {/* Options list */}
          <div className="py-0.5">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-center text-xs text-slate-400">Không tìm thấy kết quả</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={`group/item flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/70 font-semibold text-blue-700"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-normal"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                      <span className="truncate">{opt.label}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {opt.count !== undefined && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                            isSelected ? "bg-blue-100 text-blue-700 font-semibold" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {opt.count}
                        </span>
                      )}
                      {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
