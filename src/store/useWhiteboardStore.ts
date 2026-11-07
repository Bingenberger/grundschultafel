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

export type ClassroomTool = 'names' | 'groups' | 'dice' | 'noise';

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
  fillColor: string;
  setFillColor: (color: string) => void;
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
  // Maths material to insert (id from MATH_MENU)
  newMathItem: string | null;
  triggerAddMath: (id: string) => void;
  consumeNewMath: () => void;

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
  // Registered by the Whiteboard: writes the live canvas into the current page before saving
  canvasFlush: (() => void) | null;
  setCanvasFlush: (fn: (() => void) | null) => void;

  // Save tracking: every content change increments `revision`; a notebook is clean when
  // `savedRevision` caught up. `notebookGeneration` changes whenever another notebook is
  // loaded or a new one started, so a late save response cannot mark the wrong one clean.
  revision: number;
  savedRevision: number;
  notebookGeneration: number;
  markSaved: (revision: number, generation: number) => void;
  saveState: 'idle' | 'saving' | 'error';
  setSaveState: (state: 'idle' | 'saving' | 'error') => void;
  lastSavedAt: number | null;
  saveMessage: { kind: 'ok' | 'error'; text: string } | null;
  setSaveMessage: (message: { kind: 'ok' | 'error'; text: string } | null) => void;
  
  // Persistence
  notebookId: string | null;
  notebookName: string | null;
  notebookLoadSignal: number;
  setNotebook: (id: string, name: string) => void;
  loadNotebookState: (id: string, name: string, pages: Page[], journalImages?: JournalImage[]) => void;
  resetNotebook: () => void;
  renameNotebook: (newName: string) => void;

  // Journal Sidebar
  // Floating classroom tools panel (not part of the notebook)
  classroomTool: ClassroomTool | null;
  // German reading tools panel (Blitzlesen, Silbenrutsche)
  deutschTool: 'blitz' | 'rutsche' | null;
  setDeutschTool: (tool: 'blitz' | 'rutsche' | null) => void;
  setClassroomTool: (tool: ClassroomTool | null) => void;

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
  fillColor: '#000000',
  setFillColor: (color) => set({ fillColor: color }),
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

  newMathItem: null,
  triggerAddMath: (id) => set({ newMathItem: id }),
  consumeNewMath: () => set({ newMathItem: null }),

  newRuler: false,
  triggerAddRuler: () => set({ newRuler: true }),
  consumeNewRuler: () => set({ newRuler: false }),

  pages: [{ id: initialPageId, canvasData: null }],
  currentPageId: initialPageId,

  addPage: () => {
    const newPageId = uuidv4();
    set((state) => ({
      pages: [...state.pages, { id: newPageId, canvasData: null }],
      currentPageId: newPageId,
      revision: state.revision + 1
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
        currentPageId: state.currentPageId === id ? newPages[0].id : state.currentPageId,
        revision: state.revision + 1
      };
    });
  },

  updatePageData: (id, data) => {
    set((state) => ({
      pages: state.pages.map(p => p.id === id ? { ...p, canvasData: data } : p),
      revision: state.revision + 1
    }));
  },

  canvasFlush: null,
  setCanvasFlush: (fn) => set({ canvasFlush: fn }),

  revision: 0,
  savedRevision: 0,
  notebookGeneration: 0,
  markSaved: (revision, generation) => set((state) =>
    state.notebookGeneration === generation && revision > state.savedRevision
      ? { savedRevision: revision, lastSavedAt: Date.now() }
      : state.notebookGeneration === generation ? { lastSavedAt: Date.now() } : {}
  ),
  saveState: 'idle',
  setSaveState: (saveState) => set({ saveState }),
  lastSavedAt: null,
  saveMessage: null,
  setSaveMessage: (saveMessage) => set({ saveMessage }),

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
    journalImages,
    savedRevision: state.revision,
    notebookGeneration: state.notebookGeneration + 1,
    lastSavedAt: null
  })),
  resetNotebook: () => {
    const newId = uuidv4();
    set((state) => ({
      notebookId: null,
      notebookName: null,
      pages: [{ id: newId, canvasData: null }],
      currentPageId: newId,
      clearCanvasSignal: state.clearCanvasSignal + 1,
      journalImages: [],
      savedRevision: state.revision,
      notebookGeneration: state.notebookGeneration + 1,
      lastSavedAt: null
    }));
  },
  renameNotebook: (newName: string) => set((state) => ({ notebookName: newName, revision: state.revision + 1 })),

  classroomTool: null,
  deutschTool: null,
  setDeutschTool: (deutschTool) => set({ deutschTool }),
  setClassroomTool: (classroomTool) => set({ classroomTool }),

  isJournalOpen: false,
  toggleJournal: () => set((state) => ({ isJournalOpen: !state.isJournalOpen })),
  setJournalOpen: (open) => set({ isJournalOpen: open }),
  journalImages: [],
  setJournalImages: (images) => set((state) => ({ journalImages: images, revision: state.revision + 1 })),

  undoSignal: 0,
  triggerUndo: () => set((state) => ({ undoSignal: state.undoSignal + 1 })),
  redoSignal: 0,
  triggerRedo: () => set((state) => ({ redoSignal: state.redoSignal + 1 })),
  canUndo: false,
  setCanUndo: (v) => set({ canUndo: v }),
  canRedo: false,
  setCanRedo: (v) => set({ canRedo: v }),
}));
