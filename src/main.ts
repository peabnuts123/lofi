import './style.css';

import { Testfield } from './projects/testfield';
import { DebugModule } from './util/DebugModule';

DebugModule.register();

const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;

await Testfield.run(canvas);
