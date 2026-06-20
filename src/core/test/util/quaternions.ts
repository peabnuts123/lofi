import { EulerVector3, Quaternion } from "@lofi/core/math";

/**
 * Quaternions can have somewhat obtuse values. This is a list of
 * quaternions and equivalent euler vectors that are known to be correct.
 */
export const WellKnownQuaternions = {
  /** Identity i.e. no rotation */
  ['identity']: () => ({
    quaternion: Quaternion.identity(),
    euler: new EulerVector3(0, 0, 0),
  }),
  /** A rotation of 90 degrees around the Y axis and 90 degrees around the Z axis. */
  ['90Y90Z']: () => ({
    quaternion: new Quaternion(-0.5, 0.5, 0.5, 0.5),
    euler: new EulerVector3(0, 90, 90),
  }),
  /** A rotation of 180 degrees around the Y axis. */
  ['180Z']: () => ({
    quaternion: new Quaternion(0, 0, 1, 0),
    euler: new EulerVector3(0, 0, 180),
  }),
  /** A rotation of 90 degrees around the X axis. */
  ['90X']: () => ({
    quaternion: new Quaternion(Math.SQRT1_2, 0, 0, Math.SQRT1_2),
    euler: new EulerVector3(90, 0, 0),
  }),
  /** A rotation of 90 degrees around the Y axis. */
  ['90Y']: () => ({
    quaternion: new Quaternion(0, Math.SQRT1_2, 0, Math.SQRT1_2),
    euler: new EulerVector3(0, 90, 0),
  }),
  /** A rotation of 90 degrees around the Z axis. */
  ['90Z']: () => ({
    quaternion: new Quaternion(0, 0, Math.SQRT1_2, Math.SQRT1_2),
    euler: new EulerVector3(0, 0, 90),
  }),
  /** A rotation of -90 degrees around the X axis. */
  ['-90X']: () => ({
    quaternion: new Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2),
    euler: new EulerVector3(90, 0, 0),
  }),
} satisfies Record<string, () => {
  quaternion: Quaternion;
  euler: EulerVector3;
}>;
