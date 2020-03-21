const {Server, FeedFetcher} = require('../../dist/server/server.js');

const fetchInterval = 60 * 60 * 1000;
const feedFetcher = new FeedFetcher(fetchInterval, __dirname + '/config/');

const server = new Server({
  assetPathBase: `${__dirname}/../../dist/server/`,
  dataPath: `${__dirname}/config/`,
  overridePathBase: `${__dirname}/`
}, feedFetcher);

server.start(8080);
