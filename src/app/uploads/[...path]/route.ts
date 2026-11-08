import { type NextRequest } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await props.params;
    const fileSubPath = resolvedParams.path.join('/');
    
    // Determine the absolute path to the file
    // Handle standalone production mode: prioritize persistent root directory!
    let baseDir = process.cwd();
    if (baseDir.includes(path.join('.next', 'standalone')) || baseDir.endsWith('standalone')) {
      baseDir = path.join(baseDir, '..', '..');
    }

    // 1. Primary path: persistent root public/uploads/...
    let filePath = path.join(baseDir, 'public', 'uploads', fileSubPath);
    
    try {
      await fs.access(filePath);
    } catch {
      // 2. Fallback: check local process directory
      filePath = path.join(process.cwd(), 'public', 'uploads', fileSubPath);
    }

    // Read file contents
    const fileBuffer = await fs.readFile(filePath);
    
    // Determine Mime Type
    const contentType = getMimeType(filePath);

    // Return file response with revalidating cache control to prevent serving stale replaced images
    return new Response(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, must-revalidate',
      },
    });
  } catch (error) {
    return new Response('File not found', { status: 404 });
  }
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.svg': return 'image/svg+xml';
    case '.webp': return 'image/webp';
    case '.pdf': return 'application/pdf';
    case '.json': return 'application/json';
    case '.mp3': return 'audio/mpeg';
    case '.mp4': return 'video/mp4';
    default: return 'application/octet-stream';
  }
}
