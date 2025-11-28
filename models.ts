

import { AspectRatio, Resolution } from './types';

export type ModelParamMode = 'pro' | 'standard';

export interface ModelCapability {
  id: string;
  name: string;
  apiValue: string;
  badge: string;
  description?: string;
  paramMode: ModelParamMode; // Determines how parameters are constructed
  
  // Capabilities
  validResolutions: Resolution[];
  validRatios: AspectRatio[];
  defaultResolution: Resolution;
  defaultRatio: AspectRatio;
}

// ============================================================================
// 模型配置文件 / Model Configuration
// ============================================================================

export const MODELS: Record<string, ModelCapability> = {
  'nano-banana-pro': {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    // Per documentation Request Example
    apiValue: 'nano-banana-pro', 
    badge: 'Pro',
    paramMode: 'pro', // Uses aspect_ratio + resolution
    validResolutions: ['1K', '2K', '4K'],
    validRatios: ['default', '1:1', '9:16', '16:9', '3:4', '4:3', '21:9'],
    defaultResolution: '2K',
    defaultRatio: '9:16'
  },
  'nano-banana': {
    id: 'nano-banana',
    name: 'Nano Banana',
    // Per documentation Root Level Parameters (Default T2I)
    apiValue: 'google/nano-banana', 
    badge: 'Banana',
    paramMode: 'standard', // Uses image_size
    // Standard model only supports 1K resolution (UI will lock this)
    validResolutions: ['1K'], 
    // Standard model supports these ratios via image_size
    // Added 5:4 and 4:5 based on new documentation
    validRatios: ['default', '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '21:9', '5:4', '4:5'], 
    defaultResolution: '1K',
    defaultRatio: 'default'
  }
};

export const MODEL_OPTIONS = Object.values(MODELS);

export const DEFAULT_MODEL_ID = 'nano-banana-pro';

export const getModelConfig = (id: string): ModelCapability => {
  return MODELS[id] || MODELS[DEFAULT_MODEL_ID];
};

export const getModelBadge = (id: string): string => {
  return getModelConfig(id).badge;
};