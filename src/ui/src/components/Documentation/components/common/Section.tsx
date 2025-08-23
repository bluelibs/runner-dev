import React from "react";
import "./Section.scss";

export interface SectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const Section: React.FC<SectionProps> = ({
  title,
  children,
  className = "",
}) => {
  return (
    <div className={`section ${className}`}>
      <h4 className="section__title">{title}</h4>
      <div className="section__content">{children}</div>
    </div>
  );
};
