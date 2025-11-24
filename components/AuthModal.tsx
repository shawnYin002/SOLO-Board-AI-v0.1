import React, { useState, useEffect } from 'react';
import { Key, ArrowRight, Github, X, Image as ImageIcon } from 'lucide-react';

interface AuthModalProps {
  onAuthenticated: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthenticated, isOpen: externalIsOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  
  // ImgBB
  const [imgbbKey, setImgbbKey] = useState('');
  
  // GitHub
  const [ghToken, setGhToken] = useState('');
  const [ghUser, setGhUser] = useState('');
  const [ghRepo, setGhRepo] = useState('');

  const [activeTab, setActiveTab] = useState<'github' | 'imgbb'>('github');
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  // Manage open state based on props or local storage check
  const showModal = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  useEffect(() => {
    const storedKieKey = localStorage.getItem('kie_api_key');
    const storedImgbbKey = localStorage.getItem('imgbb_api_key');
    
    const storedGhToken = localStorage.getItem('gh_token');
    const storedGhUser = localStorage.getItem('gh_user');
    const storedGhRepo = localStorage.getItem('gh_repo');
    
    if (storedKieKey) setApiKey(storedKieKey);
    if (storedImgbbKey) setImgbbKey(storedImgbbKey);
    
    if (storedGhToken) setGhToken(storedGhToken);
    if (storedGhUser) setGhUser(storedGhUser);
    if (storedGhRepo) setGhRepo(storedGhRepo);

    // Prefer GitHub tab if configured
    if (storedGhToken) {
        setActiveTab('github');
    } else if (storedImgbbKey) {
        setActiveTab('imgbb');
    }

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
      
      // Save GitHub
      if (ghToken.trim()) localStorage.setItem('gh_token', ghToken.trim());
      else localStorage.removeItem('gh_token');
      
      if (ghUser.trim()) localStorage.setItem('gh_user', ghUser.trim());
      else localStorage.removeItem('gh_user');

      if (ghRepo.trim()) localStorage.setItem('gh_repo', ghRepo.trim());
      else localStorage.removeItem('gh_repo');

      // Save ImgBB
      if (imgbbKey.trim()) localStorage.setItem('imgbb_api_key', imgbbKey.trim());
      else localStorage.removeItem('imgbb_api_key');
      
      setInternalIsOpen(false);
      if (onClose) onClose();
      onAuthenticated();
    }
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 p-6 text-white relative shrink-0">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Key className="w-5 h-5 text-yellow-500" />
            API 服务配置
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            为了正常使用生成功能，请配置以下服务
          </p>
          {onClose && (
              <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
                  <X size={20} />
              </button>
          )}
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Kie Key Section */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Kie.ai API Key (必填)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="请输入 Bearer Token (sk-...)"
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none transition-all text-sm font-mono"
            />
          </div>

          <div className="border-t border-slate-100 my-2"></div>

          {/* Image Hosting Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                图床服务 (必填其一)
                </label>
                <div className="flex bg-slate-100 p-0.5 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('github')}
                        className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${activeTab === 'github' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        GitHub (推荐)
                    </button>
                    <button 
                        onClick={() => setActiveTab('imgbb')}
                        className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${activeTab === 'imgbb' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        ImgBB
                    </button>
                </div>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-700 leading-relaxed">
               <strong>为什么需要配置？</strong> Kie API 不支持直接上传本地图片数据。本地图片将上传至您的图床并转换为公开链接后发送给 AI。
            </div>

            {activeTab === 'github' ? (
                <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex gap-2">
                         <input
                            type="text"
                            value={ghUser}
                            onChange={(e) => setGhUser(e.target.value)}
                            placeholder="GitHub 用户名"
                            className="flex-1 p-2 border border-slate-300 rounded focus:border-slate-900 outline-none text-xs"
                        />
                        <input
                            type="text"
                            value={ghRepo}
                            onChange={(e) => setGhRepo(e.target.value)}
                            placeholder="公开仓库名 (Public Repo)"
                            className="flex-1 p-2 border border-slate-300 rounded focus:border-slate-900 outline-none text-xs"
                        />
                    </div>
                    <input
                        type="password"
                        value={ghToken}
                        onChange={(e) => setGhToken(e.target.value)}
                        placeholder="Personal Access Token (需勾选 repo 权限)"
                        className="w-full p-2 border border-slate-300 rounded focus:border-slate-900 outline-none text-xs font-mono"
                    />
                    <div className="flex justify-end">
                        <a 
                            href="https://github.com/settings/tokens/new?scopes=repo&description=SoloBoardAI" 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-xs text-slate-500 flex items-center gap-1 hover:text-slate-900 hover:underline"
                        >
                            <Github size={12} /> 快速申请 Token
                        </a>
                    </div>
                </div>
            ) : (
                <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-300">
                    <input
                        type="password"
                        value={imgbbKey}
                        onChange={(e) => setImgbbKey(e.target.value)}
                        placeholder="ImgBB API Key"
                        className="w-full p-2 border border-slate-300 rounded focus:border-slate-900 outline-none text-xs font-mono"
                    />
                    <div className="flex justify-end">
                         <a 
                            href="https://api.imgbb.com/" 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-xs text-slate-500 flex items-center gap-1 hover:text-slate-900 hover:underline"
                         >
                            <ImageIcon size={12} /> 申请 ImgBB Key
                        </a>
                    </div>
                </div>
            )}
          </div>
        </div>
        
        <div className="p-6 pt-0 shrink-0">
            <button
                onClick={handleSave}
                disabled={!apiKey.trim()}
                className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-900/10"
            >
                保存设置 <ArrowRight size={18} />
            </button>
        </div>
      </div>
    </div>
  );
};