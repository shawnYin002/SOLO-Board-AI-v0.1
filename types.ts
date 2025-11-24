

export type AspectRatio = 'default' | '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '9:16' | '16:9' | '21:9' | '5:4' | '4:5';
export type ModelType = string;
export type NodeColor = 'default' | 'red' | 'yellow' | 'green' | 'chocolate';
export type NodeType = 'generation' | 'upload';
export type Resolution = '1K' | '2K' | '4K';

export interface NodeData {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  prompt: string;
  model: ModelType;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  
  // Image Data
  generatedImages: string[]; // Array of URLs
  selectedImageIndex: number; // Which image is currently "on top"
  uploadedImage: string | null; // Base64 if uploaded directly
  
  // Settings
  colorTag: NodeColor;
  batchSize: 1 | 2 | 4;

  // State
  isGenerating: boolean;
  error?: string;
  progress?: string;
}

export interface Connection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  timestamp: number; // For ordering inputs
}

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}