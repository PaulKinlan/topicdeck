/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const argv = require('minimist')(process.argv.slice(2));
const swBuild = require('workbox-build');
const fs = require('fs');

const inputPath = argv['inputpath'] || './dist/server/public/';
const overridePath = argv['overridepath'] || inputPath;
const swInputPath = argv['input'];
const swOutputPath = argv['output'];

const patterns = ['assets/templates/*.html',
  'assets/templates/*.json',
  'scripts/client.js',
  'styles/main.css'];

const config = {
  globDirectory: inputPath,
  globPatterns: patterns,
  modifyUrlPrefix: {'': '/'}
};

const overrideConfig = {
  globDirectory: overridePath,
  globPatterns: ['**/*'],
  modifyUrlPrefix: {'': '/'}
};

const mergeGeneratedManifests = async (base, overrides) => {
  const baseFiles = await swBuild.getManifest(base);
  let overrideFiles = [];

  overrideFiles = await swBuild.getManifest(overrides);

  const baseFileMap = new Map(baseFiles.manifestEntries.map(entry => [entry.url, entry.revision]));
  console.log(baseFileMap)
  const overrideFileMap = new Map(overrideFiles.manifestEntries.map(entry => [entry.url, entry.revision]));
  console.log(overrideFileMap)
  const finalManifest = [];

  new Map([...baseFileMap, ...overrideFileMap]).forEach((value, key) => finalManifest.push({url: key, revision: value}));
  return finalManifest;
};

(async () => {
  const files = await mergeGeneratedManifests(config, overrideConfig);
  const sw = fs.readFileSync(swInputPath, {encoding: 'utf8'});
  let newSw;

  if (files === undefined) {
    newSw = sw.replace(/\["insertfileshere"\]/, '');
  }
  else {
    newSw = sw.replace(/\["insertfileshere"\]/, JSON.stringify(files));
  } 

  fs.writeFileSync(swOutputPath, newSw);
})();
