import React from 'react';

interface MenuItem {
  id: string;
  label: string;
  isBottom?: boolean;
}

interface MenuProps {
  items: MenuItem[];
  activeScreen: string;
  onNavigate: (screenId: string) => void;
}

export const Menu: React.FC<MenuProps> = ({ items, activeScreen, onNavigate }) => {
  const regularItems = items.filter(item => !item.isBottom);
  const bottomItems = items.filter(item => item.isBottom);

  return (
    <div className="menu" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {regularItems.map((item) => (
          <div
            key={item.id}
            className={`menu-item ${activeScreen === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid #444', paddingTop: '8px' }}>
        {bottomItems.map((item) => (
          <div
            key={item.id}
            className={`menu-item ${activeScreen === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
};
