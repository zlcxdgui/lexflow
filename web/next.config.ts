import path from 'path';
import { fileURLToPath } from 'url';
import type { NextConfig } from 'next';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(configDir, '..');

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.qrserver.com',
      },
    ],
  },
  turbopack: {
    root: workspaceRoot,
  },
};

export default nextConfig;
