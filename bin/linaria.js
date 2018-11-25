#!/usr/bin/env node
/* @flow */

const path = require('path');
const fs = require('fs');
const mkdir = require('mkdirp');
const glob = require('glob');
const commander = require('commander');
const { transform } = require('../lib/node');

commander
  // $FlowFixMe
  .version(require(path.join(__dirname, '../package.json')).version)
  .usage('[options] <file1> [<fileN>...]')
  .option('-s, --source-maps', 'generate source maps')
  .option('-r, --require-css', 'require CSS in original JS file')
  .option('-o, --out-dir <dir>', 'output directory')
  .action((file, ...rest) => {
    if (typeof file !== 'string') {
      commander.help();
    }

    const command = rest[rest.length - 1];
    const files = [file, ...rest.slice(0, -1)];
    // console.log({
    //   files,
    //   sourceMaps: Boolean(command.sourceMaps),
    //   requireCss: Boolean(command.requireCss),
    //   outDir: command.outDir,
    //   config: command.config,
    // });
    processFiles(files, {
      sourceMaps: Boolean(command.sourceMaps),
      requireCss: Boolean(command.requireCss),
      outDir: command.outDir || '.',
    });
  })
  .parse(process.argv);

/* ::
type Options = {
  sourceMaps: boolean,
  requireCss: boolean,
  outDir: string,
};
*/

function processFiles(files /* :string[] */, options /* :Options */) {
  const resolvedFiles = files.reduce(
    (acc, pattern) => [...acc, ...glob.sync(pattern, { absolute: true })],
    []
  );

  resolvedFiles.forEach(filename => {
    const outputFilename = resolveOutputFilename(filename, options.outDir);
    // const { cssText, sourceMap, cssSourceMapText } = transform(
    transform(fs.readFileSync(filename).toString(), {
      inputFilename: filename,
      outputFilename,
      inputSourceMap: null,
      pluginOptions: {},
    });

    // if (cssText) {
    //   mkdir.sync(path.dirname(outputFilename));
    //   const cssContent =
    //     options.sourceMaps && sourceMap
    //       ? `${cssText}\n/*# sourceMappingURL=${outputFilename}.map */`
    //       : cssText;
    //   fs.writeFileSync(outputFilename, cssContent);
    //   if (options.sourceMaps && sourceMap) {
    //     // $FlowFixMe
    //     fs.writeFileSync(`${outputFilename}.map`, cssSourceMapText);
    //   }
    //   if (options.requireCss) {
    //     fs.writeFileSync(
    //       filename,
    //       `${fs.readFileSync(filename).toString()}\nrequire('${path.relative(
    //         path.dirname(filename),
    //         outputFilename
    //       )}');`
    //     );
    //   }

    console.log(`Writing ${outputFilename}`);
  });
}

function resolveOutputFilename(filename /* :string */, outDir /* :string */) {
  const folderStructure = path.relative(process.cwd(), path.dirname(filename));
  const outputBasename = path
    .basename(filename)
    .replace(path.extname(filename), '.css');
  return path.resolve(outDir, folderStructure, outputBasename);
}
