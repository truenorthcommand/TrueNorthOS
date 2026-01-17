import React, { forwardRef, KeyboardEvent } from 'react';
import './GlassCard.css';

type GlassCardBaseProps = {
  variant?: 'default' | 'subtle' | 'strong';
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = GlassCardBaseProps & 
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof GlassCardBaseProps> & {
    as?: 'button';
  };

type AnchorProps = GlassCardBaseProps & 
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof GlassCardBaseProps> & {
    as: 'a';
  };

type DivProps = GlassCardBaseProps & 
  Omit<React.HTMLAttributes<HTMLDivElement>, keyof GlassCardBaseProps> & {
    as: 'div';
  };

type GlassCardProps = ButtonProps | AnchorProps | DivProps;

export const GlassCard = forwardRef<
  HTMLButtonElement | HTMLAnchorElement | HTMLDivElement,
  GlassCardProps
>((props, ref) => {
  const {
    as = 'button',
    variant = 'default',
    disabled = false,
    className = '',
    children,
    ...rest
  } = props;

  const baseClass = `glasscard glasscard--${variant}`;
  const disabledClass = disabled ? 'glasscard--disabled' : '';
  const combinedClass = `${baseClass} ${disabledClass} ${className}`.trim();

  if (as === 'a') {
    const anchorProps = rest as React.AnchorHTMLAttributes<HTMLAnchorElement>;
    const { target, rel, ...otherAnchorProps } = anchorProps;
    
    const safeRel = target === '_blank' && !rel 
      ? 'noreferrer noopener' 
      : rel;

    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={combinedClass}
        target={target}
        rel={safeRel}
        {...otherAnchorProps}
      >
        <span className="glasscard__content">{children}</span>
      </a>
    );
  }

  if (as === 'div') {
    const divProps = rest as React.HTMLAttributes<HTMLDivElement>;
    const { onClick, ...otherDivProps } = divProps;
    
    const isClickable = !!onClick;
    
    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (!isClickable || disabled) return;
      
      if (e.key === 'Enter') {
        onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
      }
      if (e.key === ' ') {
        e.preventDefault();
        onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
      }
    };

    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        className={`${combinedClass} ${isClickable ? 'glasscard--clickable' : ''}`}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable && !disabled ? 0 : undefined}
        onClick={disabled ? undefined : onClick}
        onKeyDown={isClickable ? handleKeyDown : undefined}
        aria-disabled={isClickable && disabled ? true : undefined}
        {...otherDivProps}
      >
        <span className="glasscard__content">{children}</span>
      </div>
    );
  }

  const buttonProps = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
  const { type = 'button', ...otherButtonProps } = buttonProps;

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type}
      className={combinedClass}
      disabled={disabled}
      {...otherButtonProps}
    >
      <span className="glasscard__content">{children}</span>
    </button>
  );
});

GlassCard.displayName = 'GlassCard';

export default GlassCard;
