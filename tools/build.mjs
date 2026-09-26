// Bundles src/ into two single-file builds:
//   index.html          — standalone page (open locally, host anywhere)
//   dist/artifact.html  — the same page without <html>/<head>/<body>, for claude.ai Artifact publishing
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const JS = ['src/data/map-data.js', 'src/i18n.js', 'src/core.js', 'src/audio.js', 'src/scenes-a.js', 'src/scenes-b.js', 'src/features.js', 'src/boot.js'];

const tpl = read('src/template.html');
const part = (name) => {
  const m = tpl.match(new RegExp('<!--' + name + '-->([\\s\\S]*?)<!--/' + name + '-->'));
  if (!m) throw new Error('template part missing: ' + name);
  return m[1].trim();
};
const css = read('src/styles.css');
const head = part('HEAD').replace('/*CSS*/', () => css);
const body = part('BODY');
const libs = part('SCRIPTS');
const js = JS.map((f) => '/* ' + f + ' */\n' + read(f)).join('\n').replace(/<\/script/gi, '<\\/script');
const app = '<script>\n' + js + '\n</script>';

const full = [
  '<!doctype html>',
  '<html lang="ru">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  head,
  '</head>',
  '<body>',
  body,
  libs,
  app,
  '</body>',
  '</html>',
  ''
].join('\n');

// Artifact skeleton supplies doctype/head/body; keep <title> first, drop head-only tags it provides.
const fragHead = head
  .replace(/<meta name="theme-color"[^>]*>\n?/, '')
  .replace(/<meta name="description"[^>]*>\n?/, '')
  .replace(/<link rel="icon"[^>]*>\n?/, '');
const frag = [fragHead, body, libs, app, ''].join('\n');

writeFileSync(new URL('index.html', root), full);
mkdirSync(new URL('dist/', root), { recursive: true });
writeFileSync(new URL('dist/artifact.html', root), frag);
console.log('index.html', (full.length / 1024).toFixed(1) + ' KB');
console.log('dist/artifact.html', (frag.length / 1024).toFixed(1) + ' KB');
