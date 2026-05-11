import './style.css';

import { Game } from './scenes/testfield';
// import { Game } from './scenes/character';

import { DebugModule } from '@lofi/engine/util/DebugModule';

DebugModule.register();

const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;

await Game.run(canvas);

