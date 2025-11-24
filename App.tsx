import React, { useState } from 'react';
import { Whiteboard } from './components/Whiteboard';
import { AuthModal } from './components/AuthModal';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <div className="w-screen h-screen bg-slate-100 text-slate-900 overflow-hidden">
      <AuthModal onAuthenticated={() => setIsAuthenticated(true)} />
      {isAuthenticated && <Whiteboard />}
    </div>
  );
}

export default App;
