import { join, normalize, parse, resolve } from 'node:path';

export function changeExtension(filename: string, to: string) {
  const { dir, name } = parse(filename);

  return join(dir, name + to).replace(/\\/g, '/');
}

export function normalizePath(p: string): string {
  const normalized = normalize(resolve(p)).replace(/\\/g, '/');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

export function isSamePath(pathA: string, pathB: string): boolean {
  return normalizePath(pathA) === normalizePath(pathB);
}
