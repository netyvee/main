import type { Config } from 'tailwindcss';
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    // Framework components ship TS source consumed via transpilePackages - their
    // utility classes must be scanned or the CSS gets purged (parity-critical).
    // main omitted this originally (globals had no utility layer), so every framework
    // section rendered its layout classes inert on this site. Restored to match
    // care/staffing so the governed sections + Shell actually lay out as designed.
    './node_modules/@vigil/web-framework/src/**/*.{ts,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
};
export default config;
