// @tailwindcss/postcss has @import handling, nesting and prefixing built in, so
// v3's postcss-import / tailwindcss/nesting entries are gone. Minification stays
// with react-scripts' css-minimizer plugin.
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  }
}
