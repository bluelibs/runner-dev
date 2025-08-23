import React from "react";
import "./Alert.scss";

export interface AlertProps {
  type: "warning" | "danger" | "info";
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  type,
  title,
  children,
  className = "",
}) => {
  return (
    <div className={`alert alert--${type} ${className}`}>
      <div className="alert__title">{title}</div>
      <div className="alert__content">{children}</div>
    </div>
  );
};
