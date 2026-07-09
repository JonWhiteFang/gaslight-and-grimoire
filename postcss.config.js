export default {
  plugins: {
    // Tailwind 4 ships its PostCSS integration as a separate package. Vendor
    // prefixing is now built into Tailwind's engine, so autoprefixer is dropped.
    '@tailwindcss/postcss': {},
  },
};
