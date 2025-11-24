
import React, { useState, useRef, useEffect } from 'react';
import { History, X } from 'lucide-react';

interface HistoryItem {
    id: string;
    url: string;
    timestamp: number;
}

interface SessionHistoryDockProps {
    history: HistoryItem[];
    onSelect: (item: HistoryItem) => void;
    isDarkMode: boolean;
}

export const SessionHistoryDock: React.FC<SessionHistoryDockProps> = ({ history, onSelect, isDarkMode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const latestImage = history.length > 0 ? history[0].url : null;

    return (
        <div ref={containerRef} className="relative z-50">
            {/* Popover Grid (Expanded to 6 columns) */}
            {isOpen && (
                <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-3 rounded-2xl shadow-2xl border w-[500px] max-h-[400px] overflow-y-auto grid grid-cols-6 gap-2 animate-in slide-in-from-bottom-5 fade-in duration-200 ${isDarkMode ? 'bg-slate-900/70 border-slate-700 backdrop-blur-xl' : 'bg-white/70 border-slate-200 backdrop-blur-xl'}`}>
                    <div className={`col-span-6 text-xs font-bold mb-1 flex justify-between items-center ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span>本次会话记录 ({history.length})</span>
                        <button onClick={() => setIsOpen(false)} className="hover:text-red-500"><X size={12}/></button>
                    </div>
                    
                    {history.length === 0 && (
                        <div className="col-span-6 py-8 text-center text-[10px] text-slate-500">
                            暂无生成记录
                        </div>
                    )}

                    {history.map((item) => (
                        <div 
                            key={item.id} 
                            onClick={() => {
                                onSelect(item);
                                setIsOpen(false);
                            }}
                            className={`aspect-square rounded-lg overflow-hidden border cursor-pointer transition-transform hover:scale-105 hover:ring-2 hover:ring-blue-400 group relative ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50'}`}
                        >
                            <img src={item.url} className="w-full h-full object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>
                    ))}
                </div>
            )}

            {/* Dock Icon Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-12 h-12 rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all flex items-center justify-center relative group overflow-hidden ${isDarkMode ? 'bg-yellow-500 text-slate-900 shadow-yellow-500/20 hover:bg-yellow-400' : 'bg-slate-900 text-white shadow-slate-900/20 hover:bg-slate-800'}`}
                title="本次生成记录"
            >
                {latestImage ? (
                    <>
                        {/* Stack effect (Fan style) */}
                        {history.length > 1 && <div className="absolute inset-0 rotate-6 bg-slate-300 rounded-xl z-0 opacity-50 scale-90 translate-y-1 border border-white/20"></div>}
                        {history.length > 2 && <div className="absolute inset-0 -rotate-6 bg-slate-400 rounded-xl z-0 opacity-30 scale-85 translate-y-2 border border-white/20"></div>}
                        
                        <img src={latestImage} className="w-full h-full object-cover rounded-xl z-10 border border-white/20" />
                    </>
                ) : (
                    <History size={20} className="currentColor" />
                )}
            </button>
        </div>
    );
};
