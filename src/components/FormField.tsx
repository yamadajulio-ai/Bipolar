interface FormFieldProps {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  textarea?: boolean;
  rows?: number;
}

export function FormField({
  label,
  name,
  type = "text",
  required,
  placeholder,
  error,
  min,
  max,
  step,
  maxLength,
  value,
  onChange,
  textarea,
  rows = 3,
}: FormFieldProps) {
  const inputClasses =
    "mt-1 block w-full rounded-md border border-control-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted hover:border-control-border-hover focus-visible:border-control-border-focus focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-control-border-focus aria-[invalid=true]:border-control-border-danger";

  return (
    <div className="mb-4">
      <label htmlFor={name} className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          required={required}
          placeholder={placeholder}
          maxLength={maxLength}
          value={value}
          onChange={onChange}
          rows={rows}
          className={inputClasses}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          maxLength={maxLength}
          value={value}
          onChange={onChange}
          className={inputClasses}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
        />
      )}
      {error && <p id={`${name}-error`} className="mt-1 text-xs text-danger-fg" role="alert">{error}</p>}
    </div>
  );
}
