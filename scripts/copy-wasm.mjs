import {copyFile, mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
await mkdir('public', {recursive:true});
await copyFile(require.resolve('sql.js/dist/sql-wasm.wasm'), 'public/sql-wasm.wasm');
