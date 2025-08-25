import React from "react";
import "./SidebarHeader.scss";

export interface SidebarHeaderProps {
  icon: string;
  title: string;
  description?: string;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  icon,
  title,
  description,
  status,
  actions,
  className = "",
}) => {
  return (
    <div className={`sidebar-header ${className}`}>
      <div className="sidebar-header__content">
        <div className="sidebar-header__title-section">
          <h2 className="sidebar-header__title">{title}</h2>
          {status && <div className="sidebar-header__status">{status}</div>}
        </div>
        {actions && <div className="sidebar-header__actions">{actions}</div>}
      </div>
      {description && (
        <p className="sidebar-header__description">{description}</p>
      )}
    </div>
  );
};
