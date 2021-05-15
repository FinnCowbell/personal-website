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
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
