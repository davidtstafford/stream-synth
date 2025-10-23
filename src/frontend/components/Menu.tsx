import React from 'react';

interface MenuItem {
  id: string;
  label: string;
}

interface MenuProps {
  items: MenuItem[];
  activeScreen: string;
  onNavigate: (screenId: string) => void;
}

export const Menu: React.FC<MenuProps> = ({ items, activeScreen, onNavigate }) => {
  return (
    <div className="menu">
      {items.map((item) => (
        <div
          key={item.id}
          className={`menu-item ${activeScreen === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
};
