import './style.css';

import { Game } from './projects/testfield';
import { DebugModule } from './util/DebugModule';

DebugModule.register();

const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;

await Game.run(canvas);
