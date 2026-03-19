import { toPng, toSvg } from 'html-to-image';

function download(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export async function exportToPng(element: HTMLElement, filename = 'api-view-canvas.png') {
  const dataUrl = await toPng(element, {
    backgroundColor: '#0f172a',
    filter: (node) => {
      // Exclude ReactFlow controls/minimap from export
      const className = (node as HTMLElement).className;
      if (typeof className === 'string' && className.includes('react-flow__controls')) return false;
      return true;
    },
  });
  download(dataUrl, filename);
}

export async function exportToSvg(element: HTMLElement, filename = 'api-view-canvas.svg') {
  const dataUrl = await toSvg(element, {
    backgroundColor: '#0f172a',
    filter: (node) => {
      const className = (node as HTMLElement).className;
      if (typeof className === 'string' && className.includes('react-flow__controls')) return false;
      return true;
    },
  });
  download(dataUrl, filename);
}
