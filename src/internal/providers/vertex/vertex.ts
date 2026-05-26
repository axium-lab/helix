import { HelixConfig } from '../../../core/index.js';
import { Helix } from '../../../createHelix.js';

type VertexConfig = Extract<HelixConfig, { provider: 'vertex' }>;

export function createVertexAdapter(config: VertexConfig): Helix {
  throw new Error('Vertex provider is not yet supported');
}
