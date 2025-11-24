
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { NodeData, Connection, Viewport, NodeType } from '../types';
import { NodeCard } from './NodeCard';
import { ConnectionLine } from './ConnectionLine';
import { generateImageContent } from '../services/geminiService';
import { DebugPanel } from './DebugPanel';
import { AuthModal } from './AuthModal';
import { SessionHistoryDock } from './SessionHistoryDock';
import { Plus, ImagePlus, X, Palette, Sun, Moon, Wand2, ArrowLeftRight, Bug, Settings } from 'lucide-react';

const NODE_WIDTH = 320;

export const Whiteboard: React.FC = () => {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  // Settings / Auth Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Session History State
  const [history, setHistory] = useState<{ id: string, url: string, timestamp: number }[]>([]);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  // Debug State
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  // Interaction State
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDraggingNode, setIsDraggingNode] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; type: 'input' | 'output' } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Context Menu State (for dropping line on empty space)
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, sourceNodeId: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // --- Keyboard & Global Events ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Input Protection: Don't delete nodes if typing
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.code === 'Space' && !isInput) setIsSpacePressed(true);
      
      if ((e.code === 'Delete' || e.code === 'Backspace') && !isInput) {
          if (selectedNodeId) deleteNode(selectedNodeId);
          if (selectedConnectionId) deleteConnection(selectedConnectionId);
      }
      
      if (e.code === 'Escape') {
          setSelectedNodeId(null);
          setSelectedConnectionId(null);
          setConnectingFrom(null);
          setContextMenu(null);
          setIsSettingsOpen(false);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedNodeId, selectedConnectionId]);

  // --- Helper: Screen to World ---
  const screenToWorld = useCallback((sx: number, sy: number) => {
    return {
      x: (sx - viewport.x) / viewport.scale,
      y: (sy - viewport.y) / viewport.scale,
    };
  }, [viewport]);

  // --- Node Operations ---
  const addNode = (x: number, y: number, initialData?: Partial<NodeData>) => {
     const type: NodeType = initialData?.type || 'generation';
     const newNode: NodeData = {
        id: crypto.randomUUID(),
        type: type,
        x: x - (NODE_WIDTH / 2),
        y: y - 100, 
        prompt: '',
        model: 'nano-banana-pro',
        aspectRatio: '9:16', // Default 9:16
        resolution: '2K',   // Default 2K
        generatedImages: [],
        selectedImageIndex: 0,
        uploadedImage: null,
        colorTag: 'default',
        batchSize: 1,
        isGenerating: false,
        ...initialData
      };
      setNodes(prev => [...prev, newNode]);
      return newNode.id;
  };

  const updateNode = (id: string, updates: Partial<NodeData>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const deleteNode = (id: string) => {
    // Check if this node was an input for another generation node
    // If so, and it was the ONLY input, revert that node to 9:16
    const outputConnections = connections.filter(c => c.fromNodeId === id);
    outputConnections.forEach(conn => {
        const targetNode = nodes.find(n => n.id === conn.toNodeId);
        if (targetNode && targetNode.type === 'generation') {
            const inputs = connections.filter(c => c.toNodeId === targetNode.id && c.fromNodeId !== id);
            if (inputs.length === 0 && targetNode.aspectRatio === 'default') {
                updateNode(targetNode.id, { aspectRatio: '9:16' });
            }
        }
    });

    setNodes(prev => prev.filter(n => n.id !== id));
    setConnections(prev => prev.filter(c => c.fromNodeId !== id && c.toNodeId !== id));
    setSelectedNodeId(null);
  };

  const deleteConnection = (id: string) => {
    const conn = connections.find(c => c.id === id);
    if (conn) {
        const targetNode = nodes.find(n => n.id === conn.toNodeId);
        if (targetNode && targetNode.type === 'generation') {
             const remainingInputs = connections.filter(c => c.toNodeId === targetNode.id && c.id !== id);
             if (remainingInputs.length === 0 && targetNode.aspectRatio === 'default') {
                 updateNode(targetNode.id, { aspectRatio: '9:16' });
             }
        }
    }
    setConnections(prev => prev.filter(c => c.id !== id));
    setSelectedConnectionId(null);
  };

  const unstackImage = (nodeId: string, imageIndex: number) => {
    const sourceNode = nodes.find(n => n.id === nodeId);
    if (!sourceNode || !sourceNode.generatedImages[imageIndex]) return;

    const imgUrl = sourceNode.generatedImages[imageIndex];
    const newNodeId = addNode(sourceNode.x + NODE_WIDTH + 150, sourceNode.y + 100, {
        type: 'generation',
        uploadedImage: null,
        generatedImages: [imgUrl]
    });
  };

  const generateNodeImage = async (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;

    // Resolve Inputs based on Connection Order
    const inputConns = connections
        .filter(c => c.toNodeId === id)
        .sort((a, b) => a.timestamp - b.timestamp);
    
    const inputImages: string[] = [];
    
    for (const conn of inputConns) {
        const src = nodes.find(n => n.id === conn.fromNodeId);
        if (src) {
            const img = (src.generatedImages && src.generatedImages.length > 0) 
                ? src.generatedImages[src.selectedImageIndex] 
                : src.uploadedImage;
            if (img) inputImages.push(img);
        }
    }

    updateNode(id, { isGenerating: true, error: undefined, progress: `开始生成 x${node.batchSize}...` });

    try {
      const results = await generateImageContent({
        prompt: node.prompt,
        model: node.model,
        aspectRatio: node.aspectRatio,
        resolution: node.resolution,
        inputImages: inputImages,
        batchSize: node.batchSize
      });
      
      // Update Node
      updateNode(id, { 
          generatedImages: results, 
          selectedImageIndex: 0, 
          isGenerating: false, 
          progress: undefined 
      });

      // Update Session History (Newest first)
      const newHistoryItems = results.map(url => ({
          id: crypto.randomUUID(),
          url,
          timestamp: Date.now()
      }));
      setHistory(prev => [...newHistoryItems, ...prev]);

    } catch (err: any) {
      updateNode(id, { isGenerating: false, error: err.message, progress: undefined });
    }
  };

  // --- Interaction Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isSpacePressed && e.button === 0) {
        setIsPanning(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        e.preventDefault(); 
    } else {
        setSelectedNodeId(null);
        setSelectedConnectionId(null);
        setContextMenu(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const worldPos = screenToWorld(clientX, clientY);
    setMousePos(worldPos);

    if (isPanning) {
      const dx = clientX - dragStart.x;
      const dy = clientY - dragStart.y;
      setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: clientX, y: clientY });
    } else if (isDraggingNode) {
      setNodes(prev => prev.map(n => {
        if (n.id === isDraggingNode) {
          return {
            ...n,
            x: worldPos.x - (NODE_WIDTH / 2),
            y: worldPos.y - 20 
          };
        }
        return n;
      }));
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (connectingFrom) {
       if (!isDraggingNode) { 
          setContextMenu({
             x: e.clientX,
             y: e.clientY,
             sourceNodeId: connectingFrom.nodeId
          });
       }
    }

    setIsPanning(false);
    setIsDraggingNode(null);
    setConnectingFrom(null); 
  };

  // --- Connection Logic ---

  const handleConnectStart = (e: React.MouseEvent, nodeId: string, type: 'input' | 'output') => {
    setConnectingFrom({ nodeId, type });
  };

  const handleConnectEnd = (e: React.MouseEvent, targetNodeId: string, type: 'input' | 'output') => {
    e.stopPropagation();
    if (!connectingFrom) return;
    if (connectingFrom.nodeId === targetNodeId) return; 

    let fromId, toId;

    if (connectingFrom.type === 'output' && type === 'input') {
        fromId = connectingFrom.nodeId;
        toId = targetNodeId;
    } else {
        return; 
    }

    if (connections.some(c => c.fromNodeId === fromId && c.toNodeId === toId)) return;

    // Check if target has existing inputs
    const existingInputs = connections.filter(c => c.toNodeId === toId);
    if (existingInputs.length === 0) {
        // First input: change ratio to default
        const targetNode = nodes.find(n => n.id === toId);
        if (targetNode && targetNode.type === 'generation') {
            updateNode(targetNode.id, { aspectRatio: 'default' });
        }
    }

    setConnections(prev => [...prev, { 
        id: crypto.randomUUID(), 
        fromNodeId: fromId, 
        toNodeId: toId, 
        timestamp: Date.now() 
    }]);
    
    setConnectingFrom(null);
  };
  
  const handleDropOnNode = (e: React.MouseEvent, targetNodeId: string) => {
      e.stopPropagation();
      if (!connectingFrom) return;
      if (connectingFrom.nodeId === targetNodeId) return;

      const fromId = connectingFrom.nodeId;
      const toId = targetNodeId;

      if (connectingFrom.type === 'input') return;

      if (connections.some(c => c.fromNodeId === fromId && c.toNodeId === toId)) return;

      // Check if target has existing inputs
      const existingInputs = connections.filter(c => c.toNodeId === toId);
      if (existingInputs.length === 0) {
        // First input: change ratio to default
        const targetNode = nodes.find(n => n.id === toId);
        if (targetNode && targetNode.type === 'generation') {
            updateNode(targetNode.id, { aspectRatio: 'default' });
        }
      }

      setConnections(prev => [...prev, { 
        id: crypto.randomUUID(), 
        fromNodeId: fromId, 
        toNodeId: toId, 
        timestamp: Date.now() 
    }]);
    setConnectingFrom(null);
  };

  const handleReorderInputs = (nodeId: string, fromIndex: number, toIndex: number) => {
      const nodeConns = connections
        .filter(c => c.toNodeId === nodeId)
        .sort((a, b) => a.timestamp - b.timestamp);
      
      if (!nodeConns[fromIndex] || !nodeConns[toIndex]) return;

      const connA = nodeConns[fromIndex];
      const connB = nodeConns[toIndex];

      const tempTime = connA.timestamp;
      
      const newConnections = connections.map(c => {
          if (c.id === connA.id) return { ...c, timestamp: connB.timestamp };
          if (c.id === connB.id) return { ...c, timestamp: tempTime };
          return c;
      });
      
      setConnections(newConnections);
  };

  const handleContextMenuCreate = () => {
     if (!contextMenu) return;
     const { x, y } = screenToWorld(contextMenu.x, contextMenu.y);
     // FIX: When creating a node from an existing connection line, 
     // default to 'default' aspect ratio (inherit from source)
     const newNodeId = addNode(x + NODE_WIDTH/2, y + 100, { 
         type: 'generation',
         aspectRatio: 'default'
     }); 
     
     setConnections(prev => [...prev, {
         id: crypto.randomUUID(),
         fromNodeId: contextMenu.sourceNodeId,
         toNodeId: newNodeId,
         timestamp: Date.now()
     }]);
     setContextMenu(null);
  };

  const handleFileDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files) as File[];
      if (files.length === 0) return;

      const { x, y } = screenToWorld(e.clientX, e.clientY);
      
      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (!file.type.startsWith('image/')) continue;

          const reader = new FileReader();
          reader.onload = (ev) => {
              addNode(x + (i * 20), y + (i * 20), {
                  type: 'upload',
                  uploadedImage: ev.target?.result as string,
                  model: 'nano-banana-pro'
              });
          };
          reader.readAsDataURL(file);
      }
  };

  const handleManualUpload = () => {
     const input = document.createElement('input');
     input.type = 'file';
     input.accept = 'image/*';
     input.onchange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const cx = (window.innerWidth / 2 - viewport.x) / viewport.scale;
                const cy = (window.innerHeight / 2 - viewport.y) / viewport.scale;
                addNode(cx, cy, { 
                    type: 'upload',
                    uploadedImage: ev.target?.result as string 
                });
            };
            reader.readAsDataURL(file);
        }
     };
     input.click();
  };

  // Restore image from history
  const handleRestoreFromHistory = (item: { url: string }) => {
      const cx = (window.innerWidth / 2 - viewport.x) / viewport.scale;
      const cy = (window.innerHeight / 2 - viewport.y) / viewport.scale;
      
      addNode(cx, cy, {
          type: 'upload', // Acts like an upload node
          uploadedImage: item.url,
          colorTag: 'chocolate' // Special visual style
      });
  };

  const getNodePortPos = (nodeId: string, type: 'input' | 'output') => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    const yOffset = node.type === 'upload' ? 80 : 225; 
    if (type === 'input') return { x: node.x, y: node.y + yOffset };
    return { x: node.x + (node.type === 'upload' ? 250 : NODE_WIDTH), y: node.y + yOffset };
  };

  const getNodeInputImages = (nodeId: string) => {
     return connections
        .filter(c => c.toNodeId === nodeId)
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(c => {
             const src = nodes.find(n => n.id === c.fromNodeId);
             if (!src) return null;
             return {
                 id: src.id,
                 url: (src.generatedImages.length > 0) ? src.generatedImages[src.selectedImageIndex] : src.uploadedImage
             };
        })
        .filter(Boolean) as { id: string, url: string }[];
  };

  return (
    <div 
      className={`w-full h-full relative overflow-hidden font-sans select-none transition-colors duration-300 ${isSpacePressed ? 'cursor-grab active:cursor-grabbing' : ''} ${isDarkMode ? 'bg-[#0B0F19] text-slate-200' : 'bg-slate-50 text-slate-900'}`}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={(e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const s = Math.max(0.1, Math.min(5, viewport.scale - e.deltaY * 0.001));
            setViewport(prev => ({ ...prev, scale: s }));
        } else {
            e.preventDefault();
            setViewport(prev => ({ 
              ...prev, 
              x: prev.x - e.deltaX, 
              y: prev.y - e.deltaY 
            }));
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleFileDrop}
    >
      <div 
        className="absolute inset-0 dot-grid pointer-events-none opacity-40 transition-opacity"
        style={{
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          transform: `scale(${viewport.scale})`,
          transformOrigin: '0 0',
          backgroundImage: `radial-gradient(${isDarkMode ? '#334155' : '#cbd5e1'} 1px, transparent 1px)`
        }}
      />

      <div className="absolute top-4 left-4 z-50 pointer-events-none">
         <div className="flex items-center gap-2">
            <Palette className="text-yellow-500" size={24} />
            <h1 className={`font-bold text-lg ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>SOLO Board AI</h1>
         </div>
      </div>

      <div className="absolute top-4 right-4 z-50 flex gap-2">
        <button 
           onClick={() => setIsSettingsOpen(true)}
           className={`p-2 rounded-full shadow-md transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700' : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
           title="设置"
        >
            <Settings size={20} />
        </button>
        <button 
           onClick={toggleTheme}
           className={`p-2 rounded-full shadow-md transition-all ${isDarkMode ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
           title="切换主题"
        >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
             <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
                <div className={`flex items-center gap-4 px-6 py-3 rounded-full backdrop-blur-md border shadow-sm ${isDarkMode ? 'bg-slate-900/50 border-slate-800 text-slate-300' : 'bg-white/60 border-slate-200 text-slate-600'}`}>
                    <div className="flex items-center gap-2 text-xs font-medium">
                        <Wand2 size={14} className="text-blue-500"/>
                        <span>双击画布自由生成</span>
                    </div>
                    <div className={`w-px h-4 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
                    <div className="flex items-center gap-2 text-xs font-medium">
                        <ImagePlus size={14} className="text-green-500"/>
                        <span>拖入图片上传</span>
                    </div>
                     <div className={`w-px h-4 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
                    <div className="flex items-center gap-2 text-xs font-medium">
                        <ArrowLeftRight size={14} className="text-orange-500"/>
                        <span>Space + 拖动平移</span>
                    </div>
                </div>
                <div className={`text-xs opacity-50 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    开始你的创作之旅
                </div>
             </div>
          </div>
      )}

      <div 
        style={{ 
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: '0 0',
          width: '100%',
          height: '100%'
        }}
        className="relative"
      >
         <div 
            className="absolute inset-0 z-0" 
            style={{ width: '100000px', height: '100000px', transform: 'translate(-50000px, -50000px)'}}
            onDoubleClick={(e) => {
                const { x, y } = screenToWorld(e.clientX, e.clientY);
                addNode(x, y, { type: 'generation' });
            }}
         />

        <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none z-[1]">
            {connections.map(conn => {
                const start = getNodePortPos(conn.fromNodeId, 'output');
                const end = getNodePortPos(conn.toNodeId, 'input');
                const isNodeSelected = selectedNodeId === conn.fromNodeId || selectedNodeId === conn.toNodeId;
                return (
                    <ConnectionLine 
                        key={conn.id} 
                        startX={start.x} startY={start.y} 
                        endX={end.x} endY={end.y}
                        isSelected={selectedConnectionId === conn.id}
                        isHighlighted={isNodeSelected}
                        isDarkMode={isDarkMode}
                        onClick={(e) => {
                           e.stopPropagation();
                           setSelectedConnectionId(conn.id);
                           setSelectedNodeId(null);
                        }}
                    />
                );
            })}
            {connectingFrom && (
                <ConnectionLine 
                    startX={getNodePortPos(connectingFrom.nodeId, connectingFrom.type).x}
                    startY={getNodePortPos(connectingFrom.nodeId, connectingFrom.type).y}
                    endX={mousePos.x}
                    endY={mousePos.y}
                    isDarkMode={isDarkMode}
                />
            )}
        </svg>

        <div className="z-10 relative">
            {nodes.map(node => (
                <NodeCard
                    key={node.id}
                    node={node}
                    scale={viewport.scale}
                    isSelected={selectedNodeId === node.id}
                    isDarkMode={isDarkMode}
                    inputImages={getNodeInputImages(node.id)}
                    onUpdate={updateNode}
                    onDelete={deleteNode}
                    onGenerate={generateNodeImage}
                    onMouseDown={(e, id) => {
                        e.stopPropagation();
                        setIsDraggingNode(id);
                        setSelectedNodeId(id);
                        setSelectedConnectionId(null);
                    }}
                    onConnectStart={handleConnectStart}
                    onConnectEnd={handleConnectEnd}
                    onReorderInputs={handleReorderInputs}
                    onUnstack={unstackImage}
                />
            ))}
            
            {connectingFrom && connectingFrom.type === 'output' && nodes.map(node => {
               if (node.id === connectingFrom.nodeId) return null;
               if (node.type === 'upload') return null;
               return (
                 <div
                    key={`hit-${node.id}`}
                    className="absolute rounded-xl bg-red-400/20 border-2 border-red-400 border-dashed animate-pulse z-0"
                    style={{
                        transform: `translate(${node.x - 20}px, ${node.y}px)`, 
                        width: NODE_WIDTH / 2 + 20, 
                        height: 400, 
                        clipPath: 'inset(0)' 
                    }}
                    onMouseUp={(e) => handleDropOnNode(e, node.id)}
                 />
               );
            })}
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-end gap-4">
        <button
          onClick={handleManualUpload}
          className={`pl-4 pr-5 py-3 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2 font-medium ${isDarkMode ? 'bg-yellow-500 text-slate-900 shadow-yellow-500/20' : 'bg-slate-900 text-white shadow-slate-900/20'}`}
        >
          <ImagePlus size={20} />
          <span>上传图片</span>
        </button>

        <SessionHistoryDock 
            history={history} 
            onSelect={handleRestoreFromHistory} 
            isDarkMode={isDarkMode} 
        />
      </div>
      
      <div className="absolute bottom-8 right-8 z-50">
          <button 
             onClick={() => setShowDebugPanel(!showDebugPanel)}
             className={`p-3 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-white text-slate-400 hover:text-slate-900'}`}
             title="调试日志"
          >
             <Bug size={20} />
          </button>
      </div>
      
      {showDebugPanel && <DebugPanel onClose={() => setShowDebugPanel(false)} />}
      <AuthModal isOpen={isSettingsOpen} onAuthenticated={() => {}} onClose={() => setIsSettingsOpen(false)} />

      {contextMenu && (
        <div 
            className={`absolute z-[60] rounded-lg shadow-xl border p-1 animate-in fade-in zoom-in duration-100 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onMouseDown={(e) => e.stopPropagation()} 
        >
            <button 
                onClick={handleContextMenuCreate}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm w-48 ${isDarkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
            >
                <Plus size={16} /> 新建生成卡片
            </button>
            <button 
                onClick={() => setContextMenu(null)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm w-48 ${isDarkMode ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
            >
                <X size={16} /> 取消
            </button>
        </div>
      )}

    </div>
  );
};
