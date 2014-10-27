#!/usr/bin/env node
'use strict';

var fs = require('fs');
var http = require('http');
var express = require('express');
var _ = require('lodash');
var loggers = require('proteus-logger');
var pkginfo = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'package.json'), 'utf8'));
var path = require('path');

var program = require('commander');
program
.version(pkginfo.version)
.option('-p, --port', 'port to listen web')
.option('-c, --config <path>', 'path of the config file')
.parse(process.argv)
;

var config = require('./balmung-config.js');
if (program.config) {
  _.each(require(path.resolve(program.config)), function(value, name) {
    config[name] = value;
  });
}
// configure logger
if (config.logger) {
  loggers.configure(config.logger);
}

var port = program.port || 7700;
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

if (process.env.NODE_ENV === 'test') {
  // disable listening
  port = 0;
  // disable logger
  process.env.DISABLE_PROTEUS_LOGGER = true;
}

loggers.get().info('config:', JSON.stringify(config, null, 4));

app.set('view engine', 'jade');
app.set('views', __dirname + '/views');
app.set('config', config);
app.set('io', io);
io.set('log level', 1);

app.use(express.cookieParser());
app.use(express.json());

if (config.auth && config.auth.basic && config.auth.basic.use) {
  app.use(express.basicAuth(function(id, password) {
    return id === config.auth.basic.id && password === config.auth.basic.password;
  }));
}

app.use(app.router);
app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res) {
  res.render('index');
});
app.get('/template/:file.html', function(req, res) {
  res.contentType('text/html');
  res.render('template/' + req.param('file'));
});

require('./lib/init')(app, function(err) {
  if (err) {
    loggers.get().error(err.stack);
  } else {
    if (port > 0) {
      server.listen(port, function() {
        loggers.get().info('Balmung started at', { port: port });
      });
    }
  }
});

module.exports = app;
