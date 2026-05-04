import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type ToolType = 'pen' | 'text' | 'eraser' | 'move' | 'rs' | 'fill' | 'highlighter';

interface PendingImage {
  url: string;
  left?: number;
  top?: number;
}

export interface Page {
  id: string;
  canvasData: any | null; // Null means empty/new page
}

export interface JournalImage {
  id: string;
  url: string;
}

interface WhiteboardState {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  penColor: string;
  setPenColor: (color: string) => void;
  penWidth: number;
  setPenWidth: (width: number) => void;
  isStraightLineMode: boolean;
  setStraightLineMode: (mode: boolean) => void;
  highlighterColor: string;
  setHighlighterColor: (color: string) => void;
  highlighterWidth: number;
  setHighlighterWidth: (width: number) => void;
  eraserWidth: number;
  setEraserWidth: (width: number) => void;
  clearCanvasSignal: number;
  triggerClearCanvas: () => void;
  newImage: PendingImage | null;
  triggerAddImage: (url: string, left?: number, top?: number) => void;
  consumeNewImage: () => void;
  newBackgroundUrl: string | null;
  triggerSetBackground: (url: string) => void;
  consumeNewBackground: () => void;
  newYoutubeId: string | null;
  triggerAddYoutubeVideo: (youtubeId: string) => void;
  consumeNewYoutubeVideo: () => void;

  // Timer Trigger
  newTimerType: string | null;
  triggerAddTimer: (type: string) => void;
  consumeNewTimer: () => void;

  // Shape Trigger
  newShape: string | null;
  shapeStrokeColor: string;
  setShapeStrokeColor: (color: string) => void;
  shapeFillColor: string;
  setShapeFillColor: (color: string) => void;
  shapeFilled: boolean;
  setShapeFilled: (filled: boolean) => void;
  triggerAddShape: (type: string) => void;
  consumeNewShape: () => void;

  // Ruler Trigger
  newRuler: boolean;
  triggerAddRuler: () => void;
  consumeNewRuler: () => void;
  // Page Management
  pages: Page[];
  currentPageId: string;
  addPage: () => void;
  switchPage: (id: string) => void;
  deletePage: (id: string) => void;
  updatePageData: (id: string, canvasData: any) => void;
  
  // Persistence
  notebookId: string | null;
  notebookName: string | null;
  notebookLoadSignal: number;
  setNotebook: (id: string, name: string) => void;
  loadNotebookState: (id: string, name: string, pages: Page[], journalImages?: JournalImage[]) => void;
  resetNotebook: () => void;
  renameNotebook: (newName: string) => void;

  // Journal Sidebar
  isJournalOpen: boolean;
  toggleJournal: () => void;
  setJournalOpen: (open: boolean) => void;
  journalImages: JournalImage[];
  setJournalImages: (images: JournalImage[]) => void;

  // Undo / Redo
  undoSignal: number;
  triggerUndo: () => void;
  redoSignal: number;
  triggerRedo: () => void;
  canUndo: boolean;
  setCanUndo: (v: boolean) => void;
  canRedo: boolean;
  setCanRedo: (v: boolean) => void;
}

const initialPageId = uuidv4();

export const useWhiteboardStore = create<WhiteboardState>((set, get) => ({
  activeTool: 'pen',
  setActiveTool: (tool) => set({ activeTool: tool }),
  penColor: '#000000',
  setPenColor: (color) => set({ penColor: color }),
  penWidth: 5,
  setPenWidth: (width) => set({ penWidth: width }),
  isStraightLineMode: false,
  setStraightLineMode: (mode) => set({ isStraightLineMode: mode }),
  highlighterColor: '#FFFF00',
  setHighlighterColor: (color) => set({ highlighterColor: color }),
  highlighterWidth: 20,
  setHighlighterWidth: (width) => set({ highlighterWidth: width }),
  eraserWidth: 20,
  setEraserWidth: (width) => set({ eraserWidth: width }),
  clearCanvasSignal: 0,
  triggerClearCanvas: () => set((state) => ({ clearCanvasSignal: state.clearCanvasSignal + 1 })),
  newImage: null,
  triggerAddImage: (url, left, top) => set({ newImage: { url, left, top } }),
  consumeNewImage: () => set({ newImage: null }),
  newBackgroundUrl: null,
  triggerSetBackground: (url) => set({ newBackgroundUrl: url }),
  consumeNewBackground: () => set({ newBackgroundUrl: null }),
  newYoutubeId: null,
  triggerAddYoutubeVideo: (id) => set({ newYoutubeId: id }),
  consumeNewYoutubeVideo: () => set({ newYoutubeId: null }),
  
  newTimerType: null,
  triggerAddTimer: (type) => set({ newTimerType: type }),
  consumeNewTimer: () => set({ newTimerType: null }),

  newShape: null,
  shapeStrokeColor: '#000000',
  setShapeStrokeColor: (color) => set({ shapeStrokeColor: color }),
  shapeFillColor: '#FFC107',
  setShapeFillColor: (color) => set({ shapeFillColor: color }),
  shapeFilled: false,
  setShapeFilled: (filled) => set({ shapeFilled: filled }),
  triggerAddShape: (type) => set({ newShape: type }),
  consumeNewShape: () => set({ newShape: null }),

  newRuler: false,
  triggerAddRuler: () => set({ newRuler: true }),
  consumeNewRuler: () => set({ newRuler: false }),

  pages: [{ id: initialPageId, canvasData: null }],
  currentPageId: initialPageId,

  addPage: () => {
    const newPageId = uuidv4();
    set((state) => ({
      pages: [...state.pages, { id: newPageId, canvasData: null }],
      currentPageId: newPageId
    }));
  },

  switchPage: (id) => {
    const { currentPageId } = get();
    if (id === currentPageId) return;
    set({ currentPageId: id });
  },

  deletePage: (id) => {
    set((state) => {
      const newPages = state.pages.filter(p => p.id !== id);
      // Don't allow deleting the last page
      if (newPages.length === 0) return state;

      return {
        pages: newPages,
        currentPageId: state.currentPageId === id ? newPages[0].id : state.currentPageId
      };
    });
  },

  updatePageData: (id, data) => {
    set((state) => ({
      pages: state.pages.map(p => p.id === id ? { ...p, canvasData: data } : p)
    }));
  },

  notebookId: null,
  notebookName: null,
  notebookLoadSignal: 0,
  setNotebook: (id, name) => set({ notebookId: id, notebookName: name }),
  loadNotebookState: (id, name, pages, journalImages = []) => set((state) => ({
    notebookId: id,
    notebookName: name,
    notebookLoadSignal: state.notebookLoadSignal + 1,
    pages: pages,
    currentPageId: pages[0]?.id || uuidv4(),
    journalImages
  })),
  resetNotebook: () => {
    const newId = uuidv4();
    set((state) => ({
      notebookId: null,
      notebookName: null,
      pages: [{ id: newId, canvasData: null }],
      currentPageId: newId,
      clearCanvasSignal: state.clearCanvasSignal + 1,
      journalImages: []
    }));
  },
  renameNotebook: (newName: string) => set({ notebookName: newName }),

  isJournalOpen: false,
  toggleJournal: () => set((state) => ({ isJournalOpen: !state.isJournalOpen })),
  setJournalOpen: (open) => set({ isJournalOpen: open }),
  journalImages: [],
  setJournalImages: (images) => set({ journalImages: images }),

  undoSignal: 0,
  triggerUndo: () => set((state) => ({ undoSignal: state.undoSignal + 1 })),
  redoSignal: 0,
  triggerRedo: () => set((state) => ({ redoSignal: state.redoSignal + 1 })),
  canUndo: false,
  setCanUndo: (v) => set({ canUndo: v }),
  canRedo: false,
  setCanRedo: (v) => set({ canRedo: v }),
}));
