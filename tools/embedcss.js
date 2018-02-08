const CleanCSS = require('clean-css');
const process = require('process');
const replace = require('replace-in-file');
const argv = require('minimist')(process.argv.slice(2));

// Replaces the CSS that matches one very specific string with the compressed output of the input file

const inputCSSFile = [argv['i']];

const replaceLink = (css) => {
  const styles = css.styles;
  replace({
    files: 'dist/server/public/assets/templates/*.html',
    from: /<link rel="stylesheet" href="\/styles\/main.css" \/>/g,
    to: `<style nonce='style-{{= it.nonce.inlinedcss }}'>${styles}</style>`
  });
};

new CleanCSS({returnPromise: true})
    .minify(inputCSSFile)
    .then(replaceLink)
    .then(_ => console.log('CSS Replaced'));
