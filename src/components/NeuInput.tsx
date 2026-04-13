import { forwardRef, type InputHTMLAttributes } from 'react';

interface NeuInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const NeuInput = forwardRef<HTMLInputElement, NeuInputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && <label className="text-[13px] font-medium text-foreground pl-1">{label}</label>}
        <input
          ref={ref}
          className={`w-full px-4 py-3.5 neu-input text-foreground text-[15px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow ${className}`}
          {...props}
        />
        {error && <p className="text-[12px] text-destructive pl-1">{error}</p>}
      </div>
    );
  }
);

NeuInput.displayName = 'NeuInput';
