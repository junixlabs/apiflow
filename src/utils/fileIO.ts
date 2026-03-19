import type { ApiViewFile } from '../types';

export async function saveFlow(data: ApiViewFile): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${data.metadata.name}.apiview`,
        types: [
          {
            description: 'API View File',
            accept: { 'application/json': ['.apiview'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }

  // Fallback: download via anchor
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.metadata.name}.apiview`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function loadFlow(): Promise<ApiViewFile | null> {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'API View File',
            accept: { 'application/json': ['.apiview'] },
          },
        ],
      });
      const file = await handle.getFile();
      const text = await file.text();
      return JSON.parse(text) as ApiViewFile;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null;
    }
  }

  // Fallback: input[type=file]
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.apiview';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const text = await file.text();
      resolve(JSON.parse(text) as ApiViewFile);
    };
    input.click();
  });
}
