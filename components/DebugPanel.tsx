
import React, { useEffect, useState } from 'react';
import { logger, LogEntry } from '../services/logger';
import { X, Trash2, Copy, Bug } from 'lucide-react';

interface DebugPanelProps {
  onClose: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    return logger.subscribe(setLogs);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("日志已复制");
  };

  const renderDetails = (details: any) => {
    if (typeof details === 'object' && details !== null) {
        // If it looks like an error object with message/stack but failed instanceof check or was constructed manually
        if ('message' in details && ('stack' in details || 'name' in details)) {
            return `${details.name || 'Error'}: ${details.message}\n${details.stack || ''}`;
        }
        return JSON.stringify(details, null, 2);
    }
    return String(details);
  };

  return (
    <div className="fixed bottom-24 right-4 w-[500px] h-[400px] bg-slate-900 text-slate-200 rounded-xl shadow-2xl border border-slate-700 flex flex-col z-[100] font-mono text-xs animate-in slide-in-from-bottom-10 fade-in">
      <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-800 rounded-t-xl select-none">
        <div className="flex items-center gap-2">
            <Bug size={14} className="text-yellow-500"/>
            <span className="font-bold">系统调试终端 / System Logs</span>
        </div>
        <div className="flex gap-3">
           <button onClick={() => logger.clear()} className="hover:text-red-400" title="清空日志"><Trash2 size={14}/></button>
           <button onClick={onClose} className="hover:text-white" title="关闭"><X size={14}/></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {logs.length === 0 && (
            <div className="text-center text-slate-600 mt-20 flex flex-col gap-2 items-center">
                <Bug size={32} className="opacity-20"/>
                <p>暂无日志记录...</p>
                <p className="text-[10px]">操作应用程序以生成日志</p>
            </div>
        )}
        {logs.map(log => (
          <div key={log.id} className="border-b border-slate-800 pb-2 last:border-0 group">
             <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                        log.level === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                        log.level === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                        {log.level}
                    </span>
                    <span className="text-slate-500 text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
                <button 
                    onClick={() => copyToClipboard(JSON.stringify(log, null, 2))}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-white"
                >
                    <Copy size={12}/>
                </button>
             </div>
             <div className="break-all whitespace-pre-wrap text-slate-300 leading-relaxed pl-1">{log.message}</div>
             {log.details && (
                 <div className="mt-2 bg-black/50 p-2 rounded border border-slate-800 overflow-x-auto">
                     <pre className="text-[10px] text-slate-400">
                         {renderDetails(log.details)}
                     </pre>
                 </div>
             )}
          </div>
        ))}
      </div>
    </div>
  );
};
