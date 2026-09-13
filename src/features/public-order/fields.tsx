import type { ComponentPropsWithRef, FocusEventHandler, ReactNode, Ref } from 'react';

type FieldDescription = {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
};

function describedBy(id: string, hint: ReactNode, error?: string, existing?: string) {
  return (
    [existing, hint ? `${id}-hint` : undefined, error ? `${id}-error` : undefined]
      .filter(Boolean)
      .join(' ') || undefined
  );
}

function FieldLabel({ id, label, optional }: FieldDescription) {
  return (
    <label htmlFor={id} className="public-order-field-label">
      {label}
      {optional && <span className="public-order-optional"> (اختياري)</span>}
    </label>
  );
}

function FieldDescriptionText({
  id,
  hint,
  error,
}: Pick<FieldDescription, 'id' | 'hint' | 'error'>) {
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} className="public-order-field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="public-order-field-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

export function OrderSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="public-order-section"
      aria-labelledby={`${id}-heading`}
      id={`public-order-section-${id}`}
    >
      <div className="public-order-section-heading">
        <h2 id={`${id}-heading`}>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function OrderInput({
  id,
  label,
  hint,
  error,
  optional,
  className,
  'aria-describedby': existingDescription,
  ...inputProps
}: FieldDescription & Omit<ComponentPropsWithRef<'input'>, 'id' | 'children'>) {
  return (
    <div className="public-order-field">
      <FieldLabel id={id} label={label} optional={optional} />
      <input
        {...inputProps}
        id={id}
        className={`public-order-input${className ? ` ${className}` : ''}`}
        aria-invalid={error ? true : inputProps['aria-invalid']}
        aria-describedby={describedBy(id, hint, error, existingDescription)}
      />
      <FieldDescriptionText id={id} hint={hint} error={error} />
    </div>
  );
}

export type OrderOption = { value: string; label: string };

export function OrderSelect({
  id,
  label,
  hint,
  error,
  optional,
  options,
  placeholder = 'اختر من القائمة',
  className,
  'aria-describedby': existingDescription,
  ...selectProps
}: FieldDescription &
  Omit<ComponentPropsWithRef<'select'>, 'id' | 'children'> & {
    options: readonly OrderOption[];
    placeholder?: string;
  }) {
  return (
    <div className="public-order-field">
      <FieldLabel id={id} label={label} optional={optional} />
      <select
        {...selectProps}
        id={id}
        className={`public-order-input${className ? ` ${className}` : ''}`}
        aria-invalid={error ? true : selectProps['aria-invalid']}
        aria-describedby={describedBy(id, hint, error, existingDescription)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldDescriptionText id={id} hint={hint} error={error} />
    </div>
  );
}

export function OrderTextarea({
  id,
  label,
  hint,
  error,
  optional,
  className,
  'aria-describedby': existingDescription,
  ...textareaProps
}: FieldDescription & Omit<ComponentPropsWithRef<'textarea'>, 'id' | 'children'>) {
  return (
    <div className="public-order-field">
      <FieldLabel id={id} label={label} optional={optional} />
      <textarea
        rows={3}
        {...textareaProps}
        id={id}
        className={`public-order-input${className ? ` ${className}` : ''}`}
        aria-invalid={error ? true : textareaProps['aria-invalid']}
        aria-describedby={describedBy(id, hint, error, existingDescription)}
      />
      <FieldDescriptionText id={id} hint={hint} error={error} />
    </div>
  );
}

export function OrderChoiceGroup({
  id,
  label,
  hint,
  error,
  name,
  value,
  options,
  onValueChange,
  onBlur,
  inputRef,
  disabled,
}: Omit<FieldDescription, 'optional'> & {
  name: string;
  value: string;
  options: readonly (OrderOption & { description?: string })[];
  onValueChange: (value: string) => void;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  inputRef?: Ref<HTMLInputElement>;
  disabled?: boolean;
}) {
  return (
    <fieldset
      id={id}
      className="public-order-choice-group"
      disabled={disabled}
      aria-describedby={describedBy(id, hint, error)}
      aria-invalid={error ? true : undefined}
    >
      <legend className="public-order-field-label">{label}</legend>
      <div className="public-order-choices">
        {options.map((option, index) => (
          <label
            className="public-order-choice"
            key={option.value}
            data-selected={value === option.value}
          >
            <input
              ref={index === 0 ? inputRef : undefined}
              id={`${id}-${option.value}`}
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onValueChange(option.value)}
              onBlur={onBlur}
              aria-labelledby={`${id}-${option.value}-label`}
              aria-describedby={describedBy(
                id,
                hint,
                error,
                option.description ? `${id}-${option.value}-description` : undefined,
              )}
            />
            <span>
              <span className="public-order-choice-label" id={`${id}-${option.value}-label`}>
                {option.label}
              </span>
              {option.description && (
                <span
                  className="public-order-choice-description"
                  id={`${id}-${option.value}-description`}
                >
                  {option.description}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      <FieldDescriptionText id={id} hint={hint} error={error} />
    </fieldset>
  );
}
