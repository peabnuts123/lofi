export type NoneBlendingMode = {
  type: 'None';
};
export type AverageBlendingMode = {
  type: 'Average';
};
export type AdditiveBlendingMode = {
  type: 'Additive';
};
export type SubtractiveBlendingMode = {
  type: 'Subtractive';
};
export type AlphaBlendBlendingMode = {
  type: 'AlphaBlend';
};
export type AlphaClipBlendingMode = {
  type: 'AlphaClip';
  cutoff: number;
};

export type ShaderBlendingMode =
  NoneBlendingMode |
  AverageBlendingMode |
  AdditiveBlendingMode |
  SubtractiveBlendingMode |
  AlphaBlendBlendingMode |
  AlphaClipBlendingMode;

export type BlendingModeType = ShaderBlendingMode['type'];

// Hand-rolled artisanal enum
export const ShaderBlendingMode = {
  None: () => ({ type: 'None' }),
  Average: () => ({ type: 'Average' }),
  Additive: () => ({ type: 'Additive' }),
  Subtractive: () => ({ type: 'Subtractive' }),
  AlphaBlend: () => ({ type: 'AlphaBlend' }),
  AlphaClip: (cutoff: number) => ({ type: 'AlphaClip', cutoff }),
} satisfies { [type in BlendingModeType]: (...args: any[]) => Extract<ShaderBlendingMode, { type: type }> };
