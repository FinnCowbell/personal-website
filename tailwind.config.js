module.exports = {
  mode: 'jit',
  purge: [
    './_layouts/**/*.html',
    './_includes/**/*.html',
    './_posts/**/*.html',
  ],
  darkMode: 'media', // or 'media' or 'class'
  theme: {
    extend: {
      screens: {
        '3xl': '1920px',
      }
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
