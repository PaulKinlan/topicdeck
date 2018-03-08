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

const preload = '</scripts/client.js>; rel=preload; as=script';
const generator = generateIncrementalNonce('server');

const RSSCombiner = require('rss-combiner-ns');

// A global server feedcache so we are not overloading remote servers
class FeedFetcher {
  constructor(fetchInterval, configPath) {
    this.feedConfigs = this.loadConfigs(configPath);
    this.knownHosts = new Set();
    this.latestFeeds = {};

    this.fetchFeeds();
    setInterval(this.fetchFeeds, fetchInterval);
  }

  get hosts() {
    return this.knownHosts;
  }

  get configs() {
    return this.feedConfigs;
  }

  get feeds() {
    return this.latestFeeds;
  }

  loadConfigs(path) {
    // Dynamically import the config objects
    const configs = fs.readdirSync(path)
        .filter(fileName => fileName.endsWith('.json') && fileName.startsWith('.') == false)
        .map(fileName => [fileName.replace(/\.config\.json$/, ''), require(path + fileName)]);

    return new Map(configs);
  }

  fetchFeeds() {
    const feeds = this.feedConfigs;
    const feedList = Array.from(feeds.values());
    feedList.filter(config => 'redirect' in config === false).forEach(config => {
      const hostname = new URL(config.origin).hostname;
      console.log(`${hostname} Checking Feeds`, Date.now());
      this.knownHosts.add(hostname);

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
        successfulFetchCallback: (streamInfo) => {
          console.log(`Fetched feed: ${streamInfo.url}`);
          if ((streamInfo.url in cacheStorage) == false) {
            cacheStorage[streamInfo.url] = streamInfo.stream;
          }
        }
      };

      feedConfig.pubDate = new Date();

      RSSCombiner(feedConfig)
          .then(combinedFeed => {
            console.log(`${hostname} Feed Ready`, Date.now());
            this.latestFeeds[hostname] = combinedFeed.xml();
          });
    });
  }
}


class Server {
  constructor(configPath, feedFetcher) {
    this.configPath = configPath;
    this.feeds = feedFetcher;
    this.assetPathBase = configPath.assetPathBase;
    this.assetPath = `${configPath.assetPathBase}/${paths.assetPath}`;
    this.dataPath = `${configPath.dataPath}/`;

    getCompiledTemplate(`${this.assetPath}templates/head.html`);
  }

  getHostName(req) {
    let hostname = req.hostname;
    if (this.feeds.hosts.has(hostname) == false) {
      hostname = '127.0.0.1';
    }

    return hostname.replace(/\//g, '');
  }

  start(port) {
    const templates = {
      head: getCompiledTemplate(`${this.assetPath}templates/head.html`),
      allPreload: getCompiledTemplate(`${this.assetPath}templates/all-preload.html`),
      allStyle: getCompiledTemplate(`${this.assetPath}templates/all-styles.html`),
      columnsStyle: getCompiledTemplate(`${this.assetPath}templates/columns-styles.html`),
      columnsPreload: getCompiledTemplate(`${this.assetPath}templates/columns-preload.html`),
      column: getCompiledTemplate(`${this.assetPath}templates/column.html`),
      columns: getCompiledTemplate(`${this.assetPath}templates/columns.html`),
      item: getCompiledTemplate(`${this.assetPath}templates/item.html`),
      manifest: getCompiledTemplate(`${this.assetPath}templates/manifest.json`)
    };

    const app = express();
    app.use(compression({
      filter: (req, res) => true
    }));

    app.set('trust proxy', true);

    app.all('*', (req, res, next) => {
      // protocol check, if http, redirect to https
      const forwarded = req.get('X-Forwarded-Proto');
      const hostname = req.hostname;
      const feed = this.feeds.configs.get(hostname);

      if (feed && 'redirect' in feed) {
        res.redirect(feed.redirect);
        return;
      }

      if (forwarded && forwarded.indexOf('https') == 0 || hostname === '127.0.0.1') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return next();
      } else {
        res.redirect('https://' + hostname + req.url);
        return;
      }
    });

    app.get('/', (req, res, next) => {
      const hostname = this.getHostName(req);

      const nonce = {
        analytics: generator(),
        inlinedcss: generator(),
        style: generator()
      };

      res.setHeader('Content-Security-Policy', generateCSPPolicy(nonce));
      res.setHeader('Link', preload);
      root(nonce, {
        dataPath: `${this.dataPath}${hostname}.`,
        assetPath: paths.assetPath
      }, templates).then(response => {
        if (!!response == false) {
          console.error(req, hostname);
          return res.status(500).send(`Response undefined Error ${hostname}`);
        }
        node.responseToExpressStream(res, response.body);
      });
    });

    app.get('/all', (req, res, next) => {
      const hostname = this.getHostName(req);

      const nonce = {
        analytics: generator(),
        inlinedcss: generator(),
        style: generator()
      };

      res.setHeader('Content-Security-Policy', generateCSPPolicy(nonce));
      res.setHeader('Link', preload);

      all(nonce, {
        dataPath: `${this.dataPath}${hostname}.`,
        assetPath: __dirname + paths.assetPath
      }, templates).then(response => {
        if (!!response == false) {
          console.error(req, hostname);
          return res.status(500).send(`Response undefined Error ${hostname}`);
        }
        node.responseToExpressStream(res, response.body);
      });
    });

    app.get('/manifest.json', (req, res, next) => {
      const hostname = this.getHostName(req);

      manifest({
        dataPath: `${this.dataPath}${hostname}.`,
        assetPath: paths.assetPath
      }, templates).then(response => {
        node.responseToExpressStream(res, response.body);
      });
    });

    app.get('/proxy', (req, res, next) => {
      const hostname = this.getHostName(req);

      proxy(req, {
        dataPath: `${this.dataPath}${hostname}.`,
        assetPath: paths.assetPath
      }, templates).then(response => {
        if (!!response == false) {
          return res.status(500).send(`Response undefined Error ${hostname}`);
        }

        if (typeof(response.body) === 'string') {
          res.status(response.status).send(response.body);
        } else {
          node.sendStream(response.body, true, res);
        }
      });
    });

    /*
      Server specific routes
    */

    app.get('/all.rss', (req, res, next) => {
      const hostname = this.getHostName(req);
      res.setHeader('Content-Type', 'text/xml');
      res.send(this.feeds.feeds[hostname]);
    });

    app.get('/data/config.json', (req, res, next) => {
      const hostname = this.getHostName(req);
      res.sendFile(`${this.dataPath}/${hostname}.config.json`);
    });

    /*
      Start the app.
    */
    app.use(express.static(`${this.assetPathBase}/public`));
    app.listen(port);
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
