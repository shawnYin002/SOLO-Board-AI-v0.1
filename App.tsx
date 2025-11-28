
import React, { useState, useEffect } from 'react';
import { Whiteboard } from './components/Whiteboard';
import { AuthModal } from './components/AuthModal';

// 强制在脚本加载时立即清除 API Key (解决刷新后 Key 残留的竞态问题)
// Force clear API key on script load to resolve race conditions on refresh
try {
  localStorage.removeItem('kie_api_key');
} catch (e) {
  console.error("Failed to clear localStorage", e);
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <div className="w-screen h-screen bg-slate-100 text-slate-900 overflow-hidden">
      {!isAuthenticated ? (
        <AuthModal 
          onAuthenticated={() => setIsAuthenticated(true)} 
          isOpen={true}
        />
      ) : (
        <Whiteboard />
      )}
    </div>
  );
}

export default App;
