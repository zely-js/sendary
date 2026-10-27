/**
 * Options accepted by the `staga()` Vite plugin.
 */
export interface BaseConfig {
  compileOptions?: CompileOptions;
}

/**
 * Options passed to the page compiler.
 * https://staga.vercel.app/docs/build-app
 */
export interface CompileOptions {
  /**
   * Also treat modules in `preserveSideEffects` as side-effect free.
   */
  ignoreSideEffects?: boolean;
  /**
   * Modules that keep their side effects when `ignoreSideEffects` is enabled.
   */
  preserveSideEffects?: string[];
  /**
   * Output directory for compiled modules.
   * @default '.staga'
   */
  outdir?: string;
  /**
   * Extra file extensions handled as assets.
   */
  assetsExtensions?: string[];
}
