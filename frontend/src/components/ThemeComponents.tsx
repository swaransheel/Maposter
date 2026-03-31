import React, { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}

/**
 * Reusable Card component with theme support
 * 
 * Features:
 * - Automatic theme adaptation
 * - Smooth transitions
 * - Optional hover effects
 * - Accessible focus states
 * 
 * @example
 * <Card hover onClick={() => console.log('clicked')}>
 *   <h3>My Card Title</h3>
 *   <p>Card content</p>
 * </Card>
 */
export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hover = false,
  onClick,
}) => {
  const isClickable = !!onClick

  return (
    <div
      onClick={onClick}
      className={`
        bg-bg-elevated
        border border-line
        rounded-xl shadow-lg
        p-6
        transition-all duration-300 ease-in-out
        ${hover || isClickable ? 'hover:shadow-xl hover:scale-[1.02]' : ''}
        ${isClickable ? 'cursor-pointer' : ''}
        ${
          isClickable
            ? 'focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 dark:focus:ring-offset-bg-primary'
            : ''
        }
        ${className}
      `}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}

interface ButtonProps {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  className?: string
}

/**
 * Reusable Button component with theme support
 * 
 * @example
 * <Button variant="primary" onClick={handleClick}>
 *   Click me
 * </Button>
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = '',
}) => {
  const baseStyles = `
    inline-flex items-center justify-center gap-2
    font-semibold rounded-lg
    transition-all duration-300 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-bg-primary
    disabled:opacity-50 disabled:cursor-not-allowed
    active:scale-95
  `

  const variants = {
    primary: `
      bg-brand-primary text-tx-inverse
      hover:bg-brand-primary/90
      focus:ring-brand-primary
      shadow-md hover:shadow-lg
    `,
    secondary: `
      bg-bg-elevated text-tx-primary
      border-2 border-brand-primary
      hover:bg-brand-primary/10
      focus:ring-brand-primary
    `,
    danger: `
      bg-status-error text-tx-inverse
      hover:bg-status-error/90
      focus:ring-status-error
      shadow-md hover:shadow-lg
    `,
    ghost: `
      bg-transparent text-tx-primary
      hover:bg-bg-secondary
      focus:ring-brand-primary
    `,
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  )
}

interface InputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'email' | 'password' | 'number'
  label?: string
  error?: string
  disabled?: boolean
  className?: string
}

/**
 * Reusable Input component with theme support
 * 
 * @example
 * <Input
 *   label="City name"
 *   value={city}
 *   onChange={setCity}
 *   placeholder="Enter city name"
 *   error={cityError}
 * />
 */
export const Input: React.FC<InputProps> = ({
  value,
  onChange,
  placeholder,
  type = 'text',
  label,
  error,
  disabled = false,
  className = '',
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-tx-primary mb-2">
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          w-full px-3 py-2
          bg-bg-input text-tx-primary
          border-2 ${error ? 'border-status-error' : 'border-line'}
          rounded-lg
          placeholder:text-tx-tertiary
          transition-all duration-300 ease-in-out
          focus:outline-none focus:ring-2
          ${
            error
              ? 'focus:border-status-error focus:ring-status-error/20'
              : 'focus:border-brand-primary focus:ring-brand-primary/20'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
      />
      {error && (
        <p className="mt-1 text-sm text-status-error transition-all duration-200">
          {error}
        </p>
      )}
    </div>
  )
}

interface AlertProps {
  children: ReactNode
  type?: 'info' | 'success' | 'warning' | 'error'
  onClose?: () => void
  className?: string
}

/**
 * Reusable Alert component with theme support
 * 
 * @example
 * <Alert type="success" onClose={() => setAlert(null)}>
 *   Map generated successfully!
 * </Alert>
 */
export const Alert: React.FC<AlertProps> = ({
  children,
  type = 'info',
  onClose,
  className = '',
}) => {
  const styles = {
    info: 'bg-status-info/10 border-status-info/30 text-status-info',
    success: 'bg-status-success/10 border-status-success/30 text-status-success',
    warning: 'bg-status-warning/10 border-status-warning/30 text-status-warning',
    error: 'bg-status-error/10 border-status-error/30 text-status-error',
  }

  return (
    <div
      className={`
        p-4 rounded-lg border
        transition-all duration-300 ease-in-out
        ${styles[type]}
        ${className}
      `}
      role="alert"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">{children}</div>
        {onClose && (
          <button
            onClick={onClose}
            className="
              flex-shrink-0 p-1 rounded
              hover:bg-current/10
              transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-current/30
            "
            aria-label="Close alert"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
