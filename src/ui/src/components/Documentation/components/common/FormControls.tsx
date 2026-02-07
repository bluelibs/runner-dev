import React from "react";
import "./Form.scss";

export interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
}

export const Form: React.FC<FormProps> = ({
  children,
  className = "",
  ...rest
}) => {
  return (
    <form className={`form ${className}`} {...rest}>
      {children}
    </form>
  );
};

export const FormRow: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => {
  return <div className={`form__row ${className}`}>{children}</div>;
};

export interface FormGroupProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormGroup: React.FC<FormGroupProps> = ({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = "",
}) => {
  return (
    <div className={`form__group ${className}`}>
      <label className="form__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <div className="form__hint">{hint}</div>}
      {error && <div className="form__error">{error}</div>}
    </div>
  );
};

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const TextInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", invalid, ...rest }, ref) => (
    <input
      ref={ref}
      className={`form__input ${invalid ? "is-invalid" : ""} ${className}`}
      {...rest}
    />
  )
);
TextInput.displayName = "TextInput";

export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", invalid, ...rest }, ref) => (
    <input
      ref={ref}
      type="password"
      className={`form__input ${invalid ? "is-invalid" : ""} ${className}`}
      {...rest}
    />
  )
);
PasswordInput.displayName = "PasswordInput";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", invalid, children, ...rest }, ref) => (
    <select
      ref={ref}
      className={`form__select ${invalid ? "is-invalid" : ""} ${className}`}
      {...rest}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";

export type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Checkbox: React.FC<CheckboxProps> = ({
  className = "",
  ...rest
}) => (
  <label className={`form__checkbox ${className}`}>
    <input type="checkbox" {...rest} />
    <span className="form__checkbox-label">
      {rest.title || rest["aria-label"] || ""}
    </span>
  </label>
);

export const FormActions: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => (
  <div className={`form__actions ${className}`}>{children}</div>
);
