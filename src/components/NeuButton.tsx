import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

interface NeuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  isLoading?: boolean;
}

export const NeuButton = forwardRef<HTMLButtonElement, NeuButtonProps>(
  ({ variant = 'default', size = 'md', children, isLoading, className = '', disabled, ...props }, ref) => {
    const baseStyles = 'neu-btn font-semibold transition-all duration-200 flex items-center justify-center gap-2 select-none';
    
    const variantStyles = {
      default: 'text-foreground',
      primary: 'bg-primary text-primary-foreground shadow-[4px_4px_8px_var(--neu-shadow-dark),-4px_-4px_8px_var(--neu-shadow-light)]',
      ghost: 'bg-transparent shadow-none text-muted-foreground hover:text-foreground',
      destructive: 'bg-destructive text-destructive-foreground',
    };

    const sizeStyles = {
      sm: 'px-3 py-2 text-[13px] rounded-lg',
      md: 'px-5 py-3 text-[15px] rounded-xl',
      lg: 'px-6 py-4 text-[16px] rounded-2xl w-full',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}
        {...props}
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : children}
      </button>
    );
  }
);

NeuButton.displayName = 'NeuButton';
