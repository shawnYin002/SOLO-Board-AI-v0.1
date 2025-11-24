import React from 'react';

interface ConnectionLineProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isSelected?: boolean;
  isHighlighted?: boolean;
  isDarkMode?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export const ConnectionLine: React.FC<ConnectionLineProps> = ({ 
  startX, 
  startY, 
  endX, 
  endY,
  isSelected,
  isHighlighted,
  isDarkMode,
  onClick
}) => {
  const dist = Math.abs(endX - startX);
  const controlPoint1X = startX + dist * 0.5;
  const controlPoint1Y = startY;
  const controlPoint2X = endX - dist * 0.5;
  const controlPoint2Y = endY;

  const path = `M ${startX} ${startY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${endX} ${endY}`;

  // Colors
  const defaultColor = isDarkMode ? '#475569' : '#cbd5e1'; // Slate-600 (Dark) vs Slate-300 (Light)
  const highlightColor = isDarkMode ? '#fbbf24' : '#fbbf24'; // Yellow
  const selectColor = '#ef4444'; // Red

  const strokeColor = isSelected ? selectColor : (isHighlighted ? highlightColor : defaultColor);
  const strokeWidth = isSelected || isHighlighted ? 4 : 3;
  const animationClass = isHighlighted ? 'animate-pulse' : '';

  return (
    <g 
      className={`cursor-pointer group ${animationClass} pointer-events-auto`} 
      onClick={(e) => { 
        if(onClick) {
          e.stopPropagation(); 
          onClick(e); 
        }
      }}
    >
      {/* Invisible wider stroke for easier clicking */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth="20"
        strokeLinecap="round"
      />
      {/* Visible line */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className="transition-colors duration-200"
      />
      <circle cx={startX} cy={startY} r="4" fill={isDarkMode ? '#64748b' : '#94a3b8'} />
      <circle cx={endX} cy={endY} r="4" fill={isDarkMode ? '#64748b' : '#94a3b8'} />
    </g>
  );
};