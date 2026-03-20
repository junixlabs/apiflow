import type { ApiNodeConfig } from '../core/types';

export interface EndpointLibraryEntry {
  id: string;
  label: string;
  config: ApiNodeConfig;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
