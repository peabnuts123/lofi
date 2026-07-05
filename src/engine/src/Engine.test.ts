import { describe, test, expect } from 'vitest';
import { Engine, type DrawTask } from './Engine';
import { MaterialInstance, ShaderVariant } from './materials';
import { Matrix4 } from '@lofi/core/math';

describe("Engine", () => {
  test("sortDrawQueue() correctly sorts tasks in a manner efficient for rendering", () => {
    // Setup
    const sortedDrawTasks: DrawTask[] = [];
    // @NOTE Generate list of draw tasks in the order we'd expect them to be rendered
    for (const renderLayer of [0, 1]) {
      for (const isTransparent of [false, true]) {
        let transparencyDepth = 100;
        for (const shaderVariant of [0, 1]) {
          for (const material of [0, 1]) {
            for (const draw of [0, 1]) {
              sortedDrawTasks.push(createMockTask({
                renderLayer,
                transparencyDepth: isTransparent ? transparencyDepth-- : null,
                shaderVariant,
                material,
                uniforms: 0, // @NOTE Uniforms are currently not sorted
                draw,
              }));
            }
          }
        }
      }
    }

    // Reorder draw tasks such that they are not in order any more
    const shuffledDrawTasks = sortedDrawTasks.toReversed();
    // Ensure the shuffled draw queue is actually shuffled as part of our test
    expect(shuffledDrawTasks, "Shuffled draw tasks should be shuffled").not.toEqual(sortedDrawTasks);

    // Test
    Engine.prototype['sortDrawQueue'].call(null, shuffledDrawTasks);

    // Assert
    expect(shuffledDrawTasks).toEqual(sortedDrawTasks);
  });
});


function createMockTask(opts: CreateDrawTaskOptions): DrawTask {
  return {
    renderLayer: opts.renderLayer,
    ...(opts.transparencyDepth !== null ? {
      /* Transparent */
      isTransparent: true,
      depth: opts.transparencyDepth,
    } : {
      /* Opaque */
      isTransparent: false,
    }),
    shaderVariant: { id: opts.shaderVariant } as ShaderVariant,
    material: { id: opts.material } as MaterialInstance,
    uniforms: {
      id: opts.uniforms,
      worldMatrix: Matrix4.identity(),
      localMatrix: Matrix4.identity(),
      skinWeights: new Float32Array(),
    } as DrawTask['uniforms'],
    draw: {
      id: opts.draw,
      init: () => { },
      exec: () => { },
    },
  };
}

interface CreateDrawTaskOptions {
  renderLayer: number;
  transparencyDepth: number | null;
  shaderVariant: number;
  material: number;
  uniforms: number;
  draw: number;
}
