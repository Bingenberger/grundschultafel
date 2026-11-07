// Small JPEG preview of a page (for the template gallery), rendered off-screen in the browser.
import * as fabric from 'fabric';
import '@/lib/mathManipulatives'; // registers Rechenrahmen/Lernuhr so they can be loaded

const WIDTH = 480;
const HEIGHT = 270;

export async function renderThumbnail(canvasData: unknown): Promise<string | null> {
  if (!canvasData) return null;
  try {
    // Scene coordinates match the board size of the device that drew the page
    const board = document.querySelector('canvas.lower-canvas') as HTMLCanvasElement | null;
    const boardWidth = board?.clientWidth || 1600;
    const boardHeight = board?.clientHeight || 900;
    const canvas = new fabric.StaticCanvas(document.createElement('canvas'), { width: WIDTH, height: HEIGHT, renderOnAddRemove: false });
    await canvas.loadFromJSON(canvasData);
    canvas.backgroundColor = '#ffffff';
    // Show the whole board when it has a background (ruled paper etc.), otherwise zoom in
    // on what is actually drawn so small content is still recognisable in the preview.
    let area = { left: 0, top: 0, width: boardWidth, height: boardHeight };
    const objects = canvas.getObjects();
    if (!canvas.backgroundImage && objects.length > 0) {
      const boxes = objects.map((o) => o.getBoundingRect());
      const left = Math.min(...boxes.map((b) => b.left));
      const top = Math.min(...boxes.map((b) => b.top));
      const right = Math.max(...boxes.map((b) => b.left + b.width));
      const bottom = Math.max(...boxes.map((b) => b.top + b.height));
      const pad = Math.max(right - left, bottom - top) * 0.08 + 10;
      area = { left: left - pad, top: top - pad, width: right - left + 2 * pad, height: bottom - top + 2 * pad };
    }
    const zoom = Math.min(WIDTH / area.width, HEIGHT / area.height, 1.5);
    canvas.setViewportTransform([zoom, 0, 0, zoom, (WIDTH - area.width * zoom) / 2 - area.left * zoom, (HEIGHT - area.height * zoom) / 2 - area.top * zoom]);
    canvas.renderAll();
    const url = canvas.toDataURL({ format: 'jpeg', quality: 0.75, multiplier: 1 });
    canvas.dispose();
    return url;
  } catch (error) {
    console.warn('Vorschaubild konnte nicht erzeugt werden:', error);
    return null;
  }
}
