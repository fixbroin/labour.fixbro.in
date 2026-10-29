"use client";

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ChevronDown, CheckCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalSelectOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  description?: string;
  badge?: string;
}

interface MarketplaceModalSelectProps {
  label: string;
  modalTitle?: string;
  modalDescription?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  value?: string;
  onChange: (value: string) => void;
  options: ModalSelectOption[];
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export default function MarketplaceModalSelect({
  label,
  modalTitle,
  modalDescription,
  placeholder = "Select an option...",
  searchPlaceholder = "Type to search...",
  value,
  onChange,
  options,
  disabled = false,
  required = false,
  className,
}: MarketplaceModalSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedOption = useMemo(
    () => options.find((opt) => opt.id === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.hint && opt.hint.toLowerCase().includes(q))
    );
  }, [options, search]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center justify-between">
          <span>
            {label} {required && <span className="text-red-500">*</span>}
          </span>
        </label>
      )}

      {/* Trigger Button that looks like a dropdown, but opens the modal */}
      <Button
        type="button"
        variant="outline"
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className={cn(
          "w-full h-11 px-3.5 rounded-2xl justify-between text-left font-normal border-gray-200 dark:border-gray-800 bg-white dark:bg-card shadow-sm hover:bg-gray-50/70 dark:hover:bg-muted/30 transition-all",
          !selectedOption && "text-muted-foreground"
        )}
      >
        <div className="flex items-center gap-2.5 truncate">
          {selectedOption?.icon && (
            <span className="shrink-0 text-primary">{selectedOption.icon}</span>
          )}
          <span className="font-semibold text-xs sm:text-sm text-gray-900 dark:text-white truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              {selectedOption.badge}
            </span>
          )}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
      </Button>

      {/* Centered Pop-up Modal matching Image 3 */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-[440px] rounded-3xl p-5 gap-4">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center justify-between">
              <span>{modalTitle || label || "Select Option"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {modalDescription || "Search and select from the list below."}
            </DialogDescription>
          </DialogHeader>

          {/* Search Box with Magnifying Glass */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9 pr-8 h-10 rounded-xl text-xs bg-gray-50/80 dark:bg-muted/40 border-gray-200 dark:border-gray-800 focus-visible:ring-primary"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Options List in ScrollArea */}
          <ScrollArea className="max-h-[320px] sm:max-h-[360px] pr-1">
            <div className="space-y-1 py-1">
              {filteredOptions.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground space-y-1">
                  <p>No options found for &quot;{search}&quot;</p>
                  <p className="text-[11px]">Try typing another keyword</p>
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.id === value;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelect(opt.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all",
                        isSelected
                          ? "bg-primary/10 dark:bg-primary/20 text-primary font-bold shadow-sm"
                          : "hover:bg-gray-100 dark:hover:bg-muted/40 text-gray-800 dark:text-gray-200 font-medium"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-3">
                        {opt.icon && (
                          <div
                            className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                              isSelected
                                ? "bg-primary text-white"
                                : "bg-gray-100 dark:bg-muted text-gray-600 dark:text-gray-300"
                            )}
                          >
                            {opt.icon}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm truncate">{opt.label}</p>
                          {(opt.hint || opt.description) && (
                            <p className="text-[11px] text-muted-foreground truncate font-normal">
                              {opt.hint || opt.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
