const express = require('express');
const common = require('./public/scripts/platform/common.js');
const node = require('./public/scripts/platform/node.js');
const routes = require('./public/scripts/routes/index.js')

const app = express();
const getCompiledTemplate = common.getCompiledTemplate;

const assetPath = 'public/assets/';
const dataPath = 'public/data/';

app.all('*', (req, res, next) => {
  // protocol check, if http, redirect to https
  if(req.get('X-Forwarded-Proto').indexOf("https") == 0) {
    return next();
  } else {
    res.redirect('https://' + req.hostname + req.url);
  }
});          

getCompiledTemplate(`${assetPath}templates/head.html`);
getCompiledTemplate(`${assetPath}templates/body.html`);

app.get('/', (req, res, next) => {
  routes['root'](dataPath, assetPath)
    .then(response => {
      node.responseToExpressStream(res, response.body)
    });         
});

app.get('/proxy', (req, res, next) => {
  routes['proxy'](dataPath, assetPath, req)
    .then(response => response.body.pipe(res, {end: true}));
});

/*
  Start the app.                      
*/
app.use(express.static('public'));
app.listen(8080);