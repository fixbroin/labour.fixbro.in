"use client";

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { usePaymentOptions } from '@/hooks/usePaymentOptions';

interface PaymentMethodsProps {
  selectedMethod: string;
  onSelect: (method: string) => void;
}

export default function PaymentMethods({ selectedMethod, onSelect }: PaymentMethodsProps) {
  const { paymentOptions, isLoading } = usePaymentOptions();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3 py-2">
        <div className="h-16 bg-muted rounded-xl" />
        <div className="h-16 bg-muted rounded-xl" />
      </div>
    );
  }

  if (paymentOptions.length === 0) {
    return <p className="text-sm text-destructive py-2">No payment methods available.</p>;
  }

  return (
    <RadioGroup value={selectedMethod} onValueChange={onSelect} className="space-y-3">
      {paymentOptions.map((method) => {
        const Icon = method.icon;
        const isSelected = selectedMethod === method.value;
        return (
          <Label
            key={method.value}
            htmlFor={`payment-${method.value}`}
            className={`flex items-start space-x-3 border rounded-xl p-4 cursor-pointer transition-all hover:bg-accent/50 ${
              isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-input'
            }`}
          >
            <RadioGroupItem value={method.value} id={`payment-${method.value}`} className="mt-1" />
            <div className="flex items-start gap-3 flex-1">
              <div className="bg-primary/10 p-2 rounded-lg mt-0.5">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-0.5">
                <span className="font-semibold text-foreground text-sm block">{method.label}</span>
                <span className="text-xs text-muted-foreground block">{method.description}</span>
              </div>
            </div>
          </Label>
        );
      })}
    </RadioGroup>
  );
}
