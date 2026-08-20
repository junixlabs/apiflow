import type { ApiViewFile } from '../types';

// cm:why The File System Access API is not in the TS lib this project builds against, so the two
// entry points it uses are declared here instead of being cast to `any` — narrow enough that a typo
// in an option name still fails to compile.
interface FilePickerOptions {
  suggestedName?: string;
  types?: Array<{ description: string; accept: Record<string, string[]> }>;
}

interface WritableFile {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface PickedFile {
  createWritable(): Promise<WritableFile>;
  getFile(): Promise<File>;
}

interface FilePickerWindow {
  showSaveFilePicker?: (options: FilePickerOptions) => Promise<PickedFile>;
  showOpenFilePicker?: (options: FilePickerOptions) => Promise<PickedFile[]>;
}

const picker = window as unknown as FilePickerWindow;

export async function saveFlow(data: ApiViewFile): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  if (picker.showSaveFilePicker) {
    try {
      const handle = await picker.showSaveFilePicker({
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
  if (picker.showOpenFilePicker) {
    try {
      const [handle] = await picker.showOpenFilePicker({
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
