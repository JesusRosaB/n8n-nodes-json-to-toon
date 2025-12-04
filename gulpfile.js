const { src, dest } = require('gulp');

function buildIcons() {
  return src('icons/*.svg')
    .pipe(dest('dist/nodes'));
}

exports['build:icons'] = buildIcons;
exports.default = buildIcons;
