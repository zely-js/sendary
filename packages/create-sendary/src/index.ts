#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

import animaux from 'animaux';

import { version } from '../package.json';

const defaultDirectory = 'sendary-app';
const templateDirectory = join(__dirname, '..', 'template');

interface CLIOptions {
  __?: string[];
  force?: boolean | string;
}

// The CJS build exposes the CLI factory as a nested `default` export.
const createProgram =
  typeof animaux === 'function'
    ? animaux
    : (animaux as unknown as { default: typeof animaux }).default;

const app = createProgram({ name: 'create-sendary' })
  .version(version)
  .option('--force', 'Create the app even if the target directory is not empty');

app.action(({ options }) => {
  const { __: positional = [], force } = options as CLIOptions;

  let directory = positional[0];
  let overwrite = force === true;

  // `animaux` treats the token after `--force` as its value.
  if (typeof force === 'string' && force !== 'true' && force !== 'false') {
    directory ??= force;
    overwrite = true;
  }

  try {
    createApp(directory ?? defaultDirectory, overwrite);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(`\n${message}\n`);
    process.exitCode = 1;
  }
});

app.parse(process.argv.slice(2));

/**
 * Copies the starter template to a new directory and sets the package name.
 */
function createApp(directory: string, force: boolean) {
  const target = resolve(process.cwd(), directory);
  const name = toPackageName(basename(target));
  const displayDirectory = relative(process.cwd(), target) || '.';

  if (!existsSync(templateDirectory)) {
    throw new Error(`Template directory not found: ${templateDirectory}`);
  }

  if (existsSync(target)) {
    if (!statSync(target).isDirectory()) {
      throw new Error(`Target path is not a directory: ${target}`);
    }

    if (!force && readdirSync(target).length > 0) {
      throw new Error(
        `Target directory is not empty: ${target}\nUse --force to overwrite existing files.`,
      );
    }
  } else {
    mkdirSync(target, { recursive: true });
  }

  copyDirectory(templateDirectory, target);

  // npm strips `.gitignore` from package tarballs, so the template ships it as `gitignore`.
  const gitignorePath = join(target, '.gitignore');
  const templateGitignorePath = join(target, 'gitignore');

  if (existsSync(templateGitignorePath)) {
    rmSync(gitignorePath, { force: true });
    renameSync(templateGitignorePath, gitignorePath);
  }

  const packagePath = join(target, 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

  packageJson.name = name;
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

  const manager = packageManager();
  const install = `${manager} install`;
  const dev = manager === 'yarn' ? 'yarn dev' : `${manager} run dev`;

  console.log(`\nCreated ${name} in ${displayDirectory}\n`);
  console.log('Next steps:');
  console.log(`  cd "${displayDirectory}"`);
  console.log(`  ${install}`);
  console.log(`  ${dev}\n`);
}

function copyDirectory(source: string, target: string) {
  mkdirSync(target, { recursive: true });

  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name);
    const targetPath = join(target, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      writeFileSync(targetPath, readFileSync(sourcePath));
    }
  }
}

function toPackageName(input: string): string {
  const name = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+/, '')
    .replace(/[._-]+$/, '')
    .slice(0, 214);

  return name || defaultDirectory;
}

function packageManager(): 'npm' | 'pnpm' | 'yarn' {
  const agent = process.env.npm_config_user_agent ?? '';

  if (agent.startsWith('pnpm')) return 'pnpm';
  if (agent.startsWith('yarn')) return 'yarn';

  return 'npm';
}
