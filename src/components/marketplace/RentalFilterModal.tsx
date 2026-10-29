"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SlidersHorizontal, RotateCcw } from 'lucide-react';
import {
  RENTAL_PROPERTY_TYPES,
  FURNISHING_OPTIONS,
  TENANT_PREFERENCES,
} from '@/types/marketplace';

export interface RentalFilterState {
  propertyType: string;
  furnishing: string;
  tenantPreference: string;
  radiusKm: number;
  sort: 'distance' | 'newest' | 'rent_asc' | 'rent_desc';
  minRent: string;
  maxRent: string;
}

interface RentalFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: RentalFilterState;
  onApply: (newFilters: RentalFilterState) => void;
}

const DISTANCE_OPTIONS = [
  { value: 5, label: 'Within 5 km' },
  { value: 10, label: 'Within 10 km' },
  { value: 20, label: 'Within 20 km' },
  { value: 50, label: 'Within 50 km' },
  { value: 0, label: 'All Across City' },
];

export default function RentalFilterModal({
  isOpen,
  onClose,
  filters,
  onApply,
}: RentalFilterModalProps) {
  const [localFilters, setLocalFilters] = useState<RentalFilterState>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters, isOpen]);

  const handleReset = () => {
    setLocalFilters({
      propertyType: 'all',
      furnishing: 'all',
      tenantPreference: 'all',
      radiusKm: 20,
      sort: 'distance',
      minRent: '',
      maxRent: '',
    });
  };

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[90vh] p-0 flex flex-col overflow-hidden rounded-3xl bg-white dark:bg-card">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 p-4 border-b flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            <DialogTitle className="text-lg font-bold">Filter Rental Properties</DialogTitle>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:text-primary gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset All
          </Button>
        </DialogHeader>

        {/* Scrollable Filters Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* 1. Distance Radius */}
          <div className="space-y-2">
            <Label className="font-semibold text-xs text-gray-500 uppercase tracking-wider">
              Distance Radius
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DISTANCE_OPTIONS.map((d) => {
                const active = localFilters.radiusKm === d.value;
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setLocalFilters({ ...localFilters, radiusKm: d.value })}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                      active
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Property Type */}
          <div className="space-y-2">
            <Label className="font-semibold text-xs text-gray-500 uppercase tracking-wider">
              Property Type
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setLocalFilters({ ...localFilters, propertyType: 'all' })}
                className={`p-2 rounded-xl border text-xs font-medium text-left truncate transition-all ${
                  localFilters.propertyType === 'all'
                    ? 'border-primary bg-primary/10 text-primary font-bold'
                    : 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                }`}
              >
                All Types
              </button>
              {RENTAL_PROPERTY_TYPES.map((t) => {
                const active = localFilters.propertyType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setLocalFilters({ ...localFilters, propertyType: t.id })}
                    className={`p-2 rounded-xl border text-xs font-medium text-left truncate transition-all ${
                      active
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Furnishing */}
          <div className="space-y-2">
            <Label className="font-semibold text-xs text-gray-500 uppercase tracking-wider">
              Furnishing Status
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setLocalFilters({ ...localFilters, furnishing: 'all' })}
                className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                  localFilters.furnishing === 'all'
                    ? 'border-primary bg-primary text-white shadow-sm'
                    : 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                }`}
              >
                All
              </button>
              {FURNISHING_OPTIONS.map((f) => {
                const active = localFilters.furnishing === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setLocalFilters({ ...localFilters, furnishing: f.id })}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                      active
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Monthly Rent Range */}
          <div className="space-y-2">
            <Label className="font-semibold text-xs text-gray-500 uppercase tracking-wider">
              Monthly Rent Budget (₹)
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">Min Rent</span>
                <Input
                  type="number"
                  placeholder="Min ₹"
                  value={localFilters.minRent}
                  onChange={(e) => setLocalFilters({ ...localFilters, minRent: e.target.value })}
                  className="rounded-xl h-10 text-xs"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">Max Rent</span>
                <Input
                  type="number"
                  placeholder="Max ₹"
                  value={localFilters.maxRent}
                  onChange={(e) => setLocalFilters({ ...localFilters, maxRent: e.target.value })}
                  className="rounded-xl h-10 text-xs"
                />
              </div>
            </div>
          </div>

          {/* 5. Sort By */}
          <div className="space-y-2">
            <Label className="font-semibold text-xs text-gray-500 uppercase tracking-wider">
              Sort By
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'distance', label: 'Nearest to Me' },
                { id: 'newest', label: 'Newest First' },
                { id: 'rent_asc', label: 'Rent: Low to High' },
                { id: 'rent_desc', label: 'Rent: High to Low' },
              ].map((s) => {
                const active = localFilters.sort === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setLocalFilters({ ...localFilters, sort: s.id as any })}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                      active
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="flex-shrink-0 p-3 sm:p-4 border-t bg-gray-50/70 dark:bg-muted/30 flex flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1 rounded-xl text-xs sm:text-sm"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            className="flex-1 rounded-xl bg-primary text-white font-bold text-xs sm:text-sm shadow-md"
          >
            Apply Filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
