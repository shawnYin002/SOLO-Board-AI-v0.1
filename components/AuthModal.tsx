
import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  onAuthenticated: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthenticated, isOpen: externalIsOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  // Manage open state based on props or local storage check
  const showModal = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  useEffect(() => {
    const storedKieKey = localStorage.getItem('kie_api_key');
    if (storedKieKey) setApiKey(storedKieKey);

    // Initial load check
    if (externalIsOpen === undefined) {
        if (!storedKieKey) {
            setInternalIsOpen(true);
        } else {
            onAuthenticated();
        }
    }
  }, [externalIsOpen, onAuthenticated]);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('kie_api_key', apiKey.trim());
      setInternalIsOpen(false);
      if (onClose) onClose();
      onAuthenticated();
    }
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-500">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col relative group">
        
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-yellow-500"></div>
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-blue-600/20 transition-colors duration-700"></div>
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-purple-600/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-purple-600/20 transition-colors duration-700"></div>

        <div className="p-8 pb-4 flex flex-col items-center text-center relative z-10">
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 shadow-xl border border-slate-800 ring-1 ring-white/5">
             <Sparkles className="text-yellow-400" size={28} />
          </div>
          
          <h2 className="text-2xl font-bold text-white tracking-tight mb-2">SOLO Board AI</h2>
          <p className="text-slate-400 text-sm font-medium">
             欢迎回来，开启您的创意之旅
          </p>
        </div>
        
        <div className="px-8 py-6 space-y-6 relative z-10">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest ml-1">
              <ShieldCheck size={12} /> 登录码验证
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="请输入登录码"
              className="w-full px-4 py-3.5 bg-slate-900/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all text-sm text-white placeholder-slate-600 text-center tracking-widest"
            />
          </div>
          
          <button
              onClick={handleSave}
              disabled={!apiKey.trim()}
              className="w-full bg-gradient-to-r from-slate-200 to-white text-slate-900 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-white/10"
          >
              进入工作台 <ArrowRight size={16} />
          </button>
        </div>
        
        <div className="p-5 text-center border-t border-slate-800 bg-slate-950/50">
             <p className="text-[10px] text-slate-600 font-mono">
                 SECURE SESSION • R2 ENABLED
             </p>
        </div>

      </div>
    </div>
  );
};
