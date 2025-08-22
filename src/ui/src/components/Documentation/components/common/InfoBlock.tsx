import React from "react";
import "./InfoBlock.scss";

export interface InfoBlockProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export const InfoBlock: React.FC<InfoBlockProps> = ({
  label,
  children,
  className = "",
}) => {
  return (
    <div className={`info-block ${className}`}>
      <div className="info-block__label">{label}</div>
      <div className="info-block__value">{children}</div>
    </div>
  );
};
