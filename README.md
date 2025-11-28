# SOLO Board AI

A whiteboard-style generative AI interface powered by Google Gemini models. This application allows users to generate, edit, and organize images in a spatial canvas environment.

## Features

- **Infinite Canvas**: Drag, zoom, and pan across an infinite whiteboard.
- **Node-Based Workflow**: Connect generation nodes to create workflows.
- **Multi-Model Support**: Switch between Nano Banana and Pro models.
- **Image Upload & Hosting**: 
  - Drag & drop local images.
  - Integration with **GitHub** and **ImgBB** for image hosting.
- **Visual Stacking**: Generated iterations are stacked on nodes for easy management.
- **Session History**: Quickly access and restore previously generated images.

## Tech Stack

- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **AI Integration**: Google Gemini API (via custom proxy or direct)

## Setup

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## Configuration

Click the **Settings (Gear Icon)** in the top right to configure:
- **Kie/Gemini API Key**: Required for generation.
- **GitHub Token / ImgBB Key**: Required for uploading local reference images.
