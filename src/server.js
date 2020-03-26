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

// #set _NODE 1
import express from 'express';
import fs from 'fs';
import {URL} from 'url';
import compression from 'compression';
import {
  getCompiledTemplate,
  cacheStorage, paths,
  generateCSPPolicy,
  generateIncrementalNonce
} from './public/scripts/platform/common.js';
import * as node from './public/scripts/platform/node.js';

import {handler as root} from './public/scripts/routes/root.js';
import {handler as proxy} from './public/scripts/routes/proxy.js';
import {handler as all} from './public/scripts/routes/all.js';
import {handler as manifest} from './public/scripts/routes/manifest.js';
import {DepGraph, DepGraphCycleError} from 'dependency-graph';

const preload = '</scripts/client.js>; rel=preload; as=script';
const generator = generateIncrementalNonce('server');
const RSSCombiner = require('rss-combiner-ns');
const path = require('path');

// A global server feedcache so we are not overloading remote servers
class FeedFetcher {
  constructor(fetchInterval, configPath) {
    this.feedConfigs = new Map;
    this.rootConfigPath = configPath;
    this.loadConfigs(configPath);
    this.latestFeeds = {};
    this._fetchInterval = fetchInterval;
  }

  get configs() {
    return this.feedConfigs;
  }

  get fetchInterval() {
    return this._fetchInterval;
  }

  get feeds() {
    return this.latestFeeds;
  }

  loadConfigs(basePath) {
    // Dynamically import the config objects
    console.log('loading config files', basePath);
    const files = fs.readdirSync(basePath, {withFileTypes: true});

    for (const file of files) {
      const filePath = path.join(basePath, file.name);
      if (file.isFile && file.name === 'config.json') {
        this.feedConfigs.set(basePath.replace(this.rootConfigPath, ''), require(filePath));
        continue;
      }
      if (file.isDirectory) {
        this.loadConfigs(filePath);
      }
    }
  }

  async fetchFeeds() {
    const feeds = this.feedConfigs;
    const feedList = Array.from(feeds.values());

    // Build up a simple graph of feeds so we know which order to boot them.
    // If feed A depends on feed B, then we should boot B first.
    const dg = new DepGraph();
    // Our list of servers that we host. We care about these because they need to boot in correct order.
    const hostedOrigins = [];

    for (const config of feedList) {
      hostedOrigins.push(config.feedUrl);
      dg.addNode(config.feedUrl);

      const feeds = config.columns.map(column => column.feedUrl);
      feeds.forEach(feed => {
        dg.addNode(feed);
        dg.addDependency(config.feedUrl, feed);
      });
    }

    // After the graph is loaded, ensure config data is attached.
    // The first time a feed is added to the graph it might not have data.
    for (const config of feedList) {
      dg.setNodeData(config.feedUrl, config);
    }

    // Get the list of feeds in the order we should start them up.
    const orderedConfigs = [];
    try {
      const orderedFeedList = dg.overallOrder().filter(feed => hostedOrigins.indexOf(feed) >= 0);
      orderedFeedList.forEach(feedUrl => orderedConfigs.push(dg.getNodeData(feedUrl)));
    } catch (err) {
      if (err instanceof DepGraphCycleError) {
        console.error(`Unable to start server, cyclic dependencies found in feed configuration: ${err}`);
        process.exit(-1);
      }
    }

    const success = (streamInfo) => {
      console.log(`Fetched feed: ${streamInfo.url}`);
      if ((streamInfo.url in cacheStorage) == false) {
        cacheStorage[streamInfo.url] = streamInfo.stream;
      }
    };

    // Required for closure.
    const combine = (config, feedConfig) => {
      return RSSCombiner(feedConfig).then(combinedFeed => {
        console.log(`${config.origin} Feed Ready`, Date.now());
        const feedXml = combinedFeed.xml();
        cacheStorage[config.feedUrl] = feedXml;
        this.latestFeeds[config.feedUrl] = feedXml;
      }).catch(err => {
        console.log(`Error when fetching feeds for ${config.feedUrl}, ${err}`);
      });
    };

    for (const config of orderedConfigs) {
      console.log(`${config.origin} Checking Feeds`, Date.now());

      const feedConfig = {
        title: config.title,
        size: 100,
        feeds: config.columns.map(column => column.feedUrl),
        generator: config.origin,
        site_url: config.origin,
        softFail: true,
        custom_namespaces: {
          'content': 'http://purl.org/rss/1.0/modules/content/',
          'dc': 'http://purl.org/dc/elements/1.1/',
          'a10': 'http://www.w3.org/2005/Atom',
          'feedburner': 'http://rssnamespace.org/feedburner/ext/1.0'
        },
        pubDate: new Date(),
        successfulFetchCallback: success
      };

      feedConfig.pubDate = new Date();

      try {
        await combine(config, feedConfig);
      }
      catch (err) {
        console.log(err);
      }
    }
  }
}


class Server {
  constructor(configPath, feedFetcher) {
    this.configPath = configPath;
    this.feeds = feedFetcher;
    this.assetPathBase = configPath.assetPathBase;
    this.overridePathBase = configPath.overridePathBase || this.assetPathBase;
    this.assetPath = `${configPath.assetPathBase}/${paths.assetPath}`;
    this.dataPath = `${configPath.dataPath}/`;
  }

  _resolveAssets(filePath, {defaultBase, overridePathBase}) {
    const overridePath = path.join(overridePathBase, paths.assetPath, filePath);
    const defaultPath = path.join(defaultBase, paths.assetPath, filePath);
    return fs.existsSync(overridePath) ? overridePath : defaultPath;
  }

  getPathName(pathName = '') {
    pathName = pathName.replace(/\/$/, '');
    if (this.feeds.feedConfigs.has(pathName) === true) {
      return pathName;
    }

    if (pathName === '') {
      return pathName;
    }

    return undefined;
  }

  start(port) {
    const assetPaths = {overridePathBase: this.overridePathBase, defaultBase: this.assetPathBase};
    const templates = {
      head: getCompiledTemplate(this._resolveAssets('templates/head.html', assetPaths)),
      allStyle: getCompiledTemplate(this._resolveAssets('templates/all-styles.html', assetPaths)),
      columnsStyle: getCompiledTemplate(this._resolveAssets('templates/columns-styles.html', assetPaths)),
      column: getCompiledTemplate(this._resolveAssets('templates/column.html', assetPaths)),
      columns: getCompiledTemplate(this._resolveAssets('templates/columns.html', assetPaths)),
      item: getCompiledTemplate(this._resolveAssets('templates/item.html', assetPaths)),
      manifest: getCompiledTemplate(`${this.assetPath}templates/manifest.json`)
    };

    const app = express();
    app.use(compression({
      filter: (req, res) => true
    }));

    const overridePathBase = path.join(this.overridePathBase, 'public');
    const assetPathBase = path.join(this.assetPathBase, 'public');
    const staticParams = {
      maxAge: 86400
    };

    if (fs.existsSync(overridePathBase)) {
      console.log('Exposing overridePathBase Static', `${overridePathBase}`);
      app.use(express.static(overridePathBase, staticParams));
    }
    app.use(express.static(assetPathBase, staticParams));
    console.log('Exposing assetPathBases Static', assetPathBase);

    app.set('trust proxy', true);

    app.all('*', (req, res, next) => {
      // protocol check, if http, redirect to https
      const forwarded = req.get('X-Forwarded-Proto');
      const hostname = req.hostname;

      req.setHeader('X-Accel-Buffering', 'no');

      if (forwarded && forwarded.indexOf('https') == 0 || hostname === '127.0.0.1') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return next();
      } else {
        res.redirect('https://' + hostname + req.url);
        return;
      }      
    });

    app.get('/proxy', (req, res) => {
      const pathName = this.getPathName(req.params.path);

      console.log('/proxy', pathName);

      // Get the base config file.
      const hostname = this.feeds.feedConfigs.get(this.configPath);

      const url = new URL(`${req.protocol}://${hostname}${req.originalUrl}`);

      proxy(url, {
        dataPath: path.join(this.dataPath, pathName),
        assetPath: paths.assetPath
      }, templates).then(response => {
        if (!!response == false) {
          return res.status(500).send(`Response undefined Error ${url}`);
        }

        if (typeof(response.body) === 'string') {
          res.status(response.status).send(response.body);
        } else {
          node.sendStream(response.body, true, res);
        }
      });
    });

    app.get('/:path(*)?/all', (req, res) => {
      const pathName = this.getPathName(req.params.path);
      console.log('/:path(*)?/all', pathName);

      const nonce = {
        analytics: generator(),
        inlinedcss: generator(),
        style: generator()
      };

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Security-Policy', generateCSPPolicy(nonce));
      res.setHeader('Link', preload);

      all(nonce, {
        dataPath: path.join(this.dataPath, pathName, '/'),
        assetPath: __dirname + paths.assetPath
      }, templates).then(response => {
        if (!!response == false) {
          console.error(req, path);
          return res.status(500).send(`Response undefined Error ${path}`);
        }
        node.responseToExpressStream(res, response.body);
      });
    });

    app.get('/:path(*)?/manifest.json', (req, res, next) => {
      const pathName = this.getPathName(req.params.path);
      if (pathName === undefined) return res.status(404);

      console.log('/:path(*)?/manifest.json', pathName);

      res.setHeader('Content-Type', 'application/manifest+json');

      manifest({
        dataPath: path.join(this.dataPath, pathName, '/'),
        assetPath: paths.assetPath
      }, templates).then(response => {
        node.responseToExpressStream(res, response.body);
      });
    });

    /*
      Server specific routes
    */

    app.get('/:path(*)?/all.rss', (req, res) => {
      const pathName = this.getPathName(req.params.path);
      if (pathName === undefined) return res.status(404);

      console.log('/:path(*)?/all.rss', pathName);
      res.setHeader('Content-Type', 'text/xml');
      res.send(this.feeds.feeds[req.protocol + '://' + req.get('host') + req.originalUrl]);
    });

    app.get('/:path(*)?/data/config.json', (req, res) => {
      const pathName = this.getPathName(req.params.path);
      if (pathName === undefined) return res.status(404);

      console.log('/:path(*)?/data/config.json', pathName);
      res.setHeader('Content-Type', 'application/json');
      res.sendFile(path.join(this.dataPath, pathName, 'config.json'));
    });

    app.get('/:path(*)?/', (req, res) => {
      const pathName = this.getPathName(req.params.path);
      console.log('/:path(*)?/', pathName);
      if (pathName === undefined) return res.status(404);

      const nonce = {
        analytics: generator(),
        inlinedcss: generator(),
        style: generator()
      };

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Security-Policy', generateCSPPolicy(nonce));
      res.setHeader('Link', preload);
      root(nonce, {
        dataPath: path.join(this.dataPath, pathName, '/'),
        assetPath: paths.assetPath
      }, templates).then(response => {
        if (!!response == false) {
          console.error(req, path);
          return res.status(500).send(`Response undefined Error ${path}`);
        }
        node.responseToExpressStream(res, response.body);
      });
    });

    /*
      Start the app.
    */
    app.listen(port);
    this.feeds.fetchFeeds();
    setInterval(this.feeds.fetchFeeds.bind(this.feeds), this.feeds.fetchInterval);
  }
}

if (typeof process === 'object') {
  process.on('unhandledRejection', (error, promise) => {
    console.error('== Node detected an unhandled rejection! ==');
    console.error(error.stack);
  });
}

module.exports = {
  Server: Server,
  FeedFetcher: FeedFetcher
};
