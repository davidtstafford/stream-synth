import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Menu } from './components/Menu';
import { ConnectionScreen } from './screens/connection/connection';

const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<string>('connection');

  const menuItems = [
    { id: 'connection', label: 'Connection' }
    // Add more screens here as they are developed
  ];

  const renderScreen = () => {
    switch (activeScreen) {
      case 'connection':
        return <ConnectionScreen />;
      default:
        return <ConnectionScreen />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <Menu
        items={menuItems}
        activeScreen={activeScreen}
        onNavigate={setActiveScreen}
      />
      {renderScreen()}
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
