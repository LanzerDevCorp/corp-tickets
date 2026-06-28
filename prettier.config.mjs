/** @type {import('prettier').Config} */
const config = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 80,
  tabWidth: 2,
  plugins: ["prettier-plugin-tailwindcss"],
  // Tailwind v4: point the plugin at the CSS entry so custom utilities sort correctly.
  tailwindStylesheet: "./app/globals.css",
};

export default config;
