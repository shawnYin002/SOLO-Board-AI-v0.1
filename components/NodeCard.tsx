
import React, { useState } from 'react';
import { NodeData, AspectRatio, NodeColor, Resolution } from '../types';
import { Trash2, Download, Image as ImageIcon, Loader2, Play, Maximize2, Layers, Unlock, Check } from 'lucide-react';

interface NodeCardProps {
  node: NodeData;
  scale: number;
  isSelected: boolean;
  isDarkMode: boolean;
  // Array of input images (from connected nodes)
  inputImages: { id: string, url: string }[]; 
  onUpdate: (id: string, updates: Partial<NodeData>) => void;
  onDelete: (id: string) => void;
  onGenerate: (id: string) => void;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onConnectStart: (e: React.MouseEvent, nodeId: string, type: 'input' | 'output') => void;
  onConnectEnd: (e: React.MouseEvent, nodeId: string, type: 'input' | 'output') => void;
  onReorderInputs: (nodeId: string, fromIndex: number, toIndex: number) => void;
  onUnstack: (nodeId: string, imageIndex: number) => void;
}

// Aspect ratio visual logic
const getAspectRatioStyle = (ratio: AspectRatio) => {
  if (ratio === 'default') return 'auto'; // Let CSS decide based on content or fallback
  return ratio.replace(':', '/');
};

export const NodeCard: React.FC<NodeCardProps> = ({
  node,
  scale,
  isSelected,
  isDarkMode,
  inputImages,
  onUpdate,
  onDelete,
  onGenerate,
  onMouseDown,
  onConnectStart,
  onConnectEnd,
  onReorderInputs,
  onUnstack
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  const hasGeneratedImages = node.generatedImages && node.generatedImages.length > 0;
  const displayImage = hasGeneratedImages 
    ? node.generatedImages[node.selectedImageIndex] 
    : node.uploadedImage;

  const isUploadCard = node.type === 'upload';

  // --- Dynamic Styles based on Theme ---
  const getThemeClasses = () => {
    if (isDarkMode) {
       const base = "bg-slate-900 border-slate-700 shadow-black/50 text-slate-200";
       const colorMap: Record<NodeColor, string> = {
          default: base,
          red: "bg-red-950/40 border-red-900/50 text-red-100",
          yellow: "bg-yellow-950/40 border-yellow-900/50 text-yellow-100",
          green: "bg-green-950/40 border-green-900/50 text-green-100",
          chocolate: "bg-[#3E2723]/60 border-[#8D6E63]/60 text-[#D7CCC8]", // Chocolate Dark
       };
       const headerMap: Record<NodeColor, string> = {
          default: "bg-slate-800 border-slate-700",
          red: "bg-red-900/40 border-red-900/50",
          yellow: "bg-yellow-900/40 border-yellow-900/50",
          green: "bg-green-900/40 border-green-900/50",
          chocolate: "bg-[#4E342E] border-[#8D6E63]/60",
       };
       return { container: colorMap[node.colorTag], header: headerMap[node.colorTag], input: "bg-slate-950 border-slate-700 text-slate-200 placeholder-slate-500", port: "bg-slate-800 border-slate-500" };
    } else {
       const base = "bg-slate-50 border-slate-200 text-slate-900";
       const colorMap: Record<NodeColor, string> = {
          default: base,
          red: "bg-red-50 border-red-200",
          yellow: "bg-yellow-50 border-yellow-200",
          green: "bg-green-50 border-green-200",
          chocolate: "bg-[#FFF3E0] border-[#8D6E63]", // Chocolate Light
       };
       const headerMap: Record<NodeColor, string> = {
          default: "bg-slate-100 border-slate-200",
          red: "bg-red-100 border-red-200",
          yellow: "bg-yellow-100 border-yellow-200",
          green: "bg-green-100 border-green-200",
          chocolate: "bg-[#D7CCC8] border-[#8D6E63]",
       };
       return { container: colorMap[node.colorTag], header: headerMap[node.colorTag], input: "bg-white border-slate-200 text-slate-900 placeholder-slate-400", port: "bg-white border-slate-400" };
    }
  };
  
  const theme = getThemeClasses();

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (displayImage) {
      const link = document.createElement('a');
      link.href = displayImage;
      link.target = "_blank";
      link.download = `generated-${node.id}.png`;
      link.click();
    }
  };

  const handleDragStartInput = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDropInput = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (!isNaN(dragIndex) && dragIndex !== dropIndex) {
      onReorderInputs(node.id, dragIndex, dropIndex);
    }
  };

  // --- Render Upload Type Card ---
  if (isUploadCard) {
      // Determine border color style for Upload cards based on colorTag
      const borderColor = node.colorTag === 'chocolate' 
          ? (isDarkMode ? 'rgba(141, 110, 99, 0.8)' : 'rgba(141, 110, 99, 1)') // Chocolate
          : (isDarkMode ? 'rgba(192, 132, 252, 0.5)' : 'rgba(192, 132, 252, 0.6)'); // Default Purple

      const portColorClass = node.colorTag === 'chocolate'
          ? (isDarkMode ? 'border-[#8D6E63] bg-slate-800' : 'border-[#8D6E63] bg-white')
          : (isDarkMode ? 'border-purple-500 bg-slate-800' : 'border-purple-400 bg-white');

      const portDotClass = node.colorTag === 'chocolate' ? 'bg-[#8D6E63]' : 'bg-purple-400';

      return (
        <>
            <div
                className={`absolute flex flex-col rounded-xl shadow-md transition-shadow select-none group border-4 ${
                    isSelected ? 'ring-2 ring-blue-300' : ''
                } ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}
                style={{
                    transform: `translate(${node.x}px, ${node.y}px)`,
                    touchAction: 'none',
                    zIndex: isSelected ? 50 : 10,
                    width: 250,
                    borderColor: borderColor, 
                }}
                onMouseDown={(e) => onMouseDown(e, node.id)}
            >
                {/* Image Container */}
                <div className={`relative w-full h-full min-h-[150px] flex items-center justify-center overflow-hidden rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                    {displayImage ? (
                        <img src={displayImage} alt="Upload" className="w-full h-full object-cover" />
                    ) : (
                        <ImageIcon className="text-purple-300" size={48} />
                    )}

                    {/* Hover Overlay */}
                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center gap-2 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button onClick={() => setShowPreview(true)} className="p-2 bg-white rounded-full hover:scale-110 text-slate-800" title="放大预览">
                            <Maximize2 size={16} />
                        </button>
                        <button onClick={handleDownload} className="p-2 bg-white rounded-full hover:scale-110 text-green-600" title="下载">
                            <Download size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} className="p-2 bg-white rounded-full hover:scale-110 text-red-500" title="删除">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>

                {/* Output Port (Right Only for Upload) */}
                <div
                    className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full hover:bg-opacity-80 cursor-crosshair z-20 flex items-center justify-center group/port border-2 ${portColorClass}`}
                    onMouseDown={(e) => { e.stopPropagation(); onConnectStart(e, node.id, 'output'); }}
                    onMouseUp={(e) => { e.stopPropagation(); onConnectEnd(e, node.id, 'output'); }}
                    title="输出图片"
                >
                    <div className={`w-2 h-2 rounded-full group-hover/port:bg-white ${portDotClass}`} />
                </div>
            </div>

            {/* Preview Modal */}
            {showPreview && displayImage && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={(e) => { e.stopPropagation(); setShowPreview(false); }}
                >
                    <div className="relative max-w-[90vw] max-h-[90vh]">
                        <img src={displayImage} className="max-w-full max-h-full rounded shadow-2xl border-4 border-white" />
                    </div>
                </div>
            )}
        </>
      );
  }

  // --- Render Generation Type Card ---
  return (
    <>
      <div
        className={`absolute flex flex-col rounded-xl shadow-lg border-2 transition-shadow w-80 select-none ${theme.container} ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : ''}`}
        style={{
          transform: `translate(${node.x}px, ${node.y}px)`,
          touchAction: 'none',
          zIndex: isSelected ? 50 : 10
        }}
      >
        {/* Input Port (Left) */}
        <div
          className={`absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 border-2 rounded-full hover:bg-yellow-500 hover:border-yellow-300 cursor-crosshair z-20 flex items-center justify-center group ${theme.port}`}
          onMouseDown={(e) => { e.stopPropagation(); onConnectStart(e, node.id, 'input'); }}
          onMouseUp={(e) => { e.stopPropagation(); onConnectEnd(e, node.id, 'input'); }}
          title="输入参考图"
        >
          <div className="w-2 h-2 bg-slate-400 rounded-full group-hover:bg-white" />
        </div>

        {/* Header */}
        <div
          className={`flex items-center justify-between p-2 border-b border-black/5 cursor-move rounded-t-xl ${theme.header}`}
          onMouseDown={(e) => onMouseDown(e, node.id)}
        >
          <div className="flex items-center gap-2">
            {/* Color Tag Menu */}
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowColorMenu(!showColorMenu); }}
                className={`w-4 h-4 rounded-full border border-black/10 hover:scale-110 transition-transform flex items-center justify-center`}
                style={{ backgroundColor: node.colorTag === 'default' ? (isDarkMode ? '#334155' : '#e2e8f0') : node.colorTag === 'chocolate' ? '#8D6E63' : node.colorTag }}
              >
              </button>
              {showColorMenu && (
                <div className={`absolute top-6 left-0 shadow-xl rounded-lg p-2 flex gap-1 z-50 border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                  {(['default', 'red', 'yellow', 'green', 'chocolate'] as NodeColor[]).map(c => {
                    // Hide chocolate for generation cards
                    if (c === 'chocolate' && !isUploadCard) return null;
                    
                    return (
                      <button
                        key={c}
                        className={`w-5 h-5 rounded-full border hover:scale-110 ${isDarkMode ? 'border-slate-600' : 'border-slate-200'} ${
                          c === 'default' ? (isDarkMode ? 'bg-slate-700' : 'bg-slate-200') : 
                          c === 'chocolate' ? 'bg-[#8D6E63]' : `bg-${c}-400`
                        }`}
                        style={{ backgroundColor: c === 'default' || c === 'chocolate' ? undefined : c }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdate(node.id, { colorTag: c });
                          setShowColorMenu(false);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
            <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              {node.model === 'nano-banana-pro' ? 'Pro' : 'Banana'}
            </span>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            className="text-slate-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-3 space-y-3" onMouseDown={(e) => e.stopPropagation()}>
          
          {/* Input Thumbnails */}
          {inputImages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {inputImages.map((img, idx) => (
                <div 
                  key={img.id} 
                  className={`relative flex-shrink-0 w-12 h-12 rounded border overflow-hidden cursor-grab active:cursor-grabbing hover:ring-2 ring-yellow-400 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}
                  draggable
                  onDragStart={(e) => handleDragStartInput(e, idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropInput(e, idx)}
                >
                   <img src={img.url} className="w-full h-full object-cover" />
                   <div className="absolute bottom-0 right-0 bg-black/50 text-white text-[8px] px-1">
                     {idx + 1}
                   </div>
                </div>
              ))}
            </div>
          )}

          {/* Main Image Display (Stack) */}
          <div className="relative group perspective-1000">
            {/* Stack Effects */}
            {hasGeneratedImages && node.generatedImages.length > 1 && !isExpanded && (
              <>
                <div className={`absolute top-[-4px] left-[4px] w-full h-full rounded-lg border z-0 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-slate-300'}`}></div>
                {node.generatedImages.length > 2 && (
                   <div className={`absolute top-[-8px] left-[8px] w-full h-full rounded-lg border z-[-1] ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-slate-300'}`}></div>
                )}
              </>
            )}

            {/* Main Image - Dynamic Aspect Ratio */}
            <div 
                className={`relative z-10 w-full rounded-lg overflow-hidden border flex items-center justify-center transition-all duration-300 ${isDarkMode ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'}`}
                style={{ 
                  aspectRatio: node.aspectRatio === 'default' ? 'auto' : node.aspectRatio.replace(':', '/'),
                  minHeight: node.aspectRatio === 'default' ? '200px' : undefined 
                }}
            >
              {displayImage ? (
                <img src={displayImage} alt="Generated" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center text-slate-400 p-4">
                  <ImageIcon className="mx-auto mb-2 opacity-50" />
                  <p className="text-[10px]">
                    {inputImages.length > 0 ? "准备合成" : "拖入图片"}
                  </p>
                </div>
              )}

              {/* Hover Overlay Controls */}
              {displayImage && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex flex-col justify-end items-end p-2 gap-1 opacity-0 group-hover:opacity-100">
                  <div className="flex gap-1">
                    <button onClick={() => setShowPreview(true)} className="p-1.5 bg-white rounded shadow hover:text-blue-500 text-slate-800" title="放大预览">
                       <Maximize2 size={14} />
                    </button>
                    <button onClick={handleDownload} className="p-1.5 bg-white rounded shadow hover:text-green-500 text-slate-800" title="下载">
                       <Download size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Expand Stack Button */}
              {hasGeneratedImages && node.generatedImages.length > 1 && (
                 <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="absolute top-2 right-2 p-1 bg-black/60 text-white rounded-full hover:bg-black/80 z-20"
                    title="展开堆叠"
                 >
                   <Layers size={14} />
                 </button>
              )}
            </div>

            {/* Expanded Grid */}
            {isExpanded && hasGeneratedImages && (
              <div className={`absolute top-full left-0 right-0 mt-2 rounded-lg shadow-xl border p-2 z-50 grid grid-cols-2 gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                {node.generatedImages.map((img, idx) => (
                  <div key={idx} className="relative group/mini aspect-square rounded overflow-hidden border hover:border-blue-500 cursor-pointer">
                    <img 
                      src={img} 
                      className="w-full h-full object-cover" 
                      onClick={() => {
                         onUpdate(node.id, { selectedImageIndex: idx });
                         setIsExpanded(false);
                      }}
                    />
                    {idx === node.selectedImageIndex && (
                        <div className="absolute top-1 left-1 p-0.5 bg-blue-500 text-white rounded-full">
                            <Check size={8} />
                        </div>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); onUnstack(node.id, idx); }}
                      className="absolute top-1 right-1 p-1 bg-white/80 text-slate-800 rounded hover:text-red-500 opacity-0 group-hover/mini:opacity-100"
                      title="拆分到新卡片"
                    >
                      <Unlock size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="space-y-2">
            <textarea
              className={`w-full text-xs p-2 border rounded-md focus:outline-none focus:border-yellow-500 resize-none ${theme.input}`}
              rows={2}
              placeholder="请输入提示词..."
              value={node.prompt}
              onChange={(e) => onUpdate(node.id, { prompt: e.target.value })}
            />

            <div className="flex items-center justify-between gap-1">
                {/* Ratio Selector */}
                <select
                  className={`text-[10px] p-1 border rounded flex-1 min-w-0 outline-none ${theme.input}`}
                  value={node.aspectRatio}
                  onChange={(e) => onUpdate(node.id, { aspectRatio: e.target.value as AspectRatio })}
                  title="生成比例"
                >
                  <option value="default">默认 (同输入)</option>
                  <option value="9:16">▯ 9:16</option>
                  <option value="16:9">▭ 16:9</option>
                  <option value="1:1">⬜ 1:1</option>
                  <option value="3:4">▯ 3:4</option>
                  <option value="4:3">▭ 4:3</option>
                  <option value="21:9">▭ 21:9</option>
                </select>

                 {/* Resolution Selector */}
                 <select
                  className={`text-[10px] p-1 border rounded flex-1 min-w-0 outline-none ${theme.input}`}
                  value={node.resolution}
                  onChange={(e) => onUpdate(node.id, { resolution: e.target.value as Resolution })}
                  title="分辨率"
                >
                  <option value="2K">2K</option>
                  <option value="1K">1K</option>
                  <option value="4K">4K</option>
                </select>

                {/* Batch Size Selector */}
                <div className={`flex items-center border rounded overflow-hidden flex-none ${isDarkMode ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-white'}`}>
                   <span className={`text-[10px] px-1 border-r ${isDarkMode ? 'border-slate-700 text-slate-500 bg-slate-900' : 'border-slate-200 text-slate-400 bg-slate-50'}`}>张数</span>
                   <select 
                     value={node.batchSize} 
                     onChange={(e) => onUpdate(node.id, { batchSize: parseInt(e.target.value) as 1|2|4 })}
                     className={`text-[10px] p-1 bg-transparent outline-none cursor-pointer ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}
                   >
                     <option value="1">1</option>
                     <option value="2">2</option>
                     <option value="4">4</option>
                   </select>
                </div>
            </div>

            <button
              onClick={() => onGenerate(node.id)}
              disabled={node.isGenerating || (!node.prompt && !node.uploadedImage && inputImages.length === 0)}
              className={`w-full py-2 px-4 rounded-md text-white text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                node.isGenerating
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-slate-800 active:scale-95 shadow-md dark:bg-yellow-500 dark:hover:bg-yellow-600 dark:text-slate-900'
              }`}
            >
              {node.isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> {node.progress || "生成中..."}
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" /> 生成
                </>
              )}
            </button>
            {node.error && (
              <p 
                 className="text-[10px] text-red-500 leading-tight cursor-pointer hover:underline" 
                 title={node.error}
                 onClick={() => alert(node.error)}
              >
                  {node.error} (点击查看)
              </p>
            )}
          </div>
        </div>

        {/* Output Port (Right) */}
        <div
          className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 border-2 rounded-full hover:bg-yellow-500 hover:border-yellow-300 cursor-crosshair z-20 flex items-center justify-center group ${theme.port}`}
          onMouseDown={(e) => { e.stopPropagation(); onConnectStart(e, node.id, 'output'); }}
          onMouseUp={(e) => { e.stopPropagation(); onConnectEnd(e, node.id, 'output'); }}
          title="输出图片"
        >
          <div className="w-2 h-2 bg-slate-400 rounded-full group-hover:bg-white" />
        </div>
      </div>

      {/* Image Preview Modal (Lightbox) */}
      {showPreview && displayImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); setShowPreview(false); }}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
             <img src={displayImage} className="max-w-full max-h-full rounded shadow-2xl border-4 border-white" />
          </div>
        </div>
      )}
    </>
  );
};
