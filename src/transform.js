/* @flow */

const path = require('path');
const babel = require('@babel/core');
const stylis = require('stylis');
const { SourceMapGenerator } = require('source-map');

/* ::
type Location = {
  line: number,
  column: number
}
*/

/* ::
type Result = {
  code: string,
  sourceMap: ?Object,
  cssText?: string,
  cssSourceMapText?: string,
  dependencies?: string[],
  rules?: {
    [className: string]: {
      cssText: string,
      displayName: string,
      start: ?Location,
    },
  },
  replacements?: Array<{
    original: { start: Location, end: Location },
    length: number
  }>,
}
*/

/* ::
type PluginOptions = {
  evaluate?: boolean,
  displayName?: boolean,
}
*/

/* ::
type Options = {
  inputFilename: string,
  outputFilename: ?string,
  inputSourceMap: ?Object,
  pluginOptions: ?{
    evaluate?: boolean,
    displayName?: boolean,
  },
}
*/

const STYLIS_DECLARATION = 1;

module.exports = function transform(
  code /* :string */,
  options /* :Options */
) /* : Result */ {
  // Check if the file contains `css` or `styled` tag first
  // Otherwise we should skip transforming
  if (
    !/\b(styled[\s\n]*(\([\s\S]+\)|\.[\s\n]*[a-z0-9]+)|css)[\s\n]*`/.test(code)
  ) {
    return {
      code,
      sourceMap: options.inputSourceMap,
    };
  }

  // Parse the code first so babel uses user's babel config for parsing
  // We don't want to use user's config when transforming the code
  const ast = babel.parseSync(code, {
    filename: options.inputFilename,
    caller: { name: 'linaria' },
  });

  const { metadata, code: transformedCode, map } = babel.transformFromAstSync(
    ast,
    code,
    {
      filename: options.inputFilename,
      presets: [[require.resolve('./babel'), options.pluginOptions]],
      babelrc: false,
      configFile: false,
      sourceMaps: true,
      sourceFileName: options.inputFilename,
      // Must be a boolean/object/undefined, so null have to be replaced with false.
      inputSourceMap: options.inputSourceMap || false,
    }
  );

  if (!metadata.linaria) {
    return {
      code,
      sourceMap: options.inputSourceMap,
    };
  }

  const { rules, replacements, dependencies } = metadata.linaria;
  const mappings = [];

  let cssText = '';

  stylis.use(null)((context, decl) => {
    if (context === STYLIS_DECLARATION && options.outputFilename) {
      // When writing to a file, we need to adjust the relative paths inside url(..) expressions
      // It'll allow css-loader to resolve an imported asset properly
      return decl.replace(
        /\b(url\()(\.[^)]+)(\))/,
        (match, p1, p2, p3) =>
          p1 +
          // Replace asset path with new path relative to the output CSS
          path.relative(
            /* $FlowFixMe */
            path.dirname(options.outputFilename),
            // Get the absolute path to the asset from the path relative to the JS file
            path.resolve(path.dirname(options.inputFilename), p2)
          ) +
          p3
      );
    }

    return decl;
  });

  Object.keys(rules).forEach((selector, index) => {
    mappings.push({
      generated: {
        line: index + 1,
        column: 0,
      },
      original: rules[selector].start,
      name: selector,
    });

    // Run each rule through stylis to support nesting
    cssText += `${stylis(selector, rules[selector].cssText)}\n`;
  });

  return {
    code: transformedCode,
    cssText,
    rules,
    replacements,
    dependencies,
    sourceMap: map,

    get cssSourceMapText() {
      if (mappings && mappings.length) {
        const generator = new SourceMapGenerator({
          file: options.inputFilename.replace(/\.js$/, '.css'),
        });

        mappings.forEach(mapping =>
          generator.addMapping(
            Object.assign({}, mapping, { source: options.inputFilename })
          )
        );

        generator.setSourceContent(options.inputFilename, code);

        return generator.toString();
      }

      return '';
    },
  };
};
