import fs from 'node:fs/promises';
import path from 'node:path';

const sourceDir = path.resolve('src/renderer');
const targetDir = path.resolve('dist/renderer');

await fs.mkdir(targetDir, { recursive: true });

for (const filename of ['index.html', 'styles.css']) {
  await fs.copyFile(path.join(sourceDir, filename), path.join(targetDir, filename));
}
