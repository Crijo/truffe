/**
 * Contexte Web Audio, s'il existe : le jeu reste jouable sans le son (SPEC, Accessibilité).
 * Les anciens Safari ne l'exposent que sous un nom préfixé.
 */
export function audioContextCtor(): (new () => AudioContext) | null {
  const w = window as unknown as { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext };
  return typeof w.AudioContext === 'function' ? w.AudioContext : (w.webkitAudioContext ?? null);
}
