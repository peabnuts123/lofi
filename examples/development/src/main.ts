import './style.css';

import { Game } from './scenes/testfield';
// import { Game } from './scenes/character';

import { DebugModule } from '@lofi/engine/util/DebugModule';

try {
  DebugModule.register();

  const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;

  await Game.run(canvas);
} catch (e) {
  if (e instanceof Error) {
    console.error(`Global error: ${e}, ${e.stack}`);
  } else {
    console.error(`Global error: ${e}`);
  }
}