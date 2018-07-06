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

const swBuild = require('workbox-build');
const patterns = ['assets/templates/*.html',
  'assets/templates/*.json',
  'scripts/client.js',
  'styles/main.css'];
const config = {
  globDirectory: './dist/server/public/',
  globPatterns: patterns,
  modifyUrlPrefix: {'': '/'}
};

swBuild.getManifest(config).then((manifestDetails) => {
  console.log(manifestDetails);
  console.log('Build Manifest generated.');
});
