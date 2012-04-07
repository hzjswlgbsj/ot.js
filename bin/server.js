#!/usr/bin/env node

var Operation = require('../lib/operation');
var Server = require('../lib/server');
var express = require('express');
var socketIO = require('socket.io');
var path = require('path');

var app = express.createServer();

app.configure(function () {
  app.use(express.logger());
  app.use(express.static(path.join(__dirname, '../integration')));
  app.use(express.static(path.join(__dirname, '../lib')));
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

var io = socketIO.listen(app);

// source: http://devcenter.heroku.com/articles/using-socket-io-with-node-js-on-heroku
io.configure('production', function () {
  io.set('transports', ['xhr-polling']); 
  io.set('polling duration', 10); 
});

var str = "lorem ipsum\ndolor sit amet";

var users = {};
var server = new Server(str);

server.broadcast = function (operation) {
  io.sockets.emit('operation', operation);
};

io.sockets.on('connection', function (socket) {
  socket.once('auth', function (auth) {
    socket.emit('doc', {
      str: server.str,
      revision: server.operations.length,
      users: users
    });

    var name = auth.name; // TODO: validate uniqueness
    users[name] = { cursor: 0 };

    socket.broadcast.emit('user_joined', { name: name, cursor: 0 });
    socket.on('operation', function (operation) {
      operation = Operation.fromJSON(operation);
      server.receiveOperation(operation);
      console.log("new operation: " + operation);
    });
    socket.on('cursor', function (obj) {
      users[name].cursor = obj.index;
      obj.name = name;
      socket.broadcast.emit('cursor', obj);
    });
    socket.on('disconnect', function () {
      // TODO
      console.log("Disconnect " + name);
      delete users[name];
      io.sockets.emit('user_left', { name: name });
    });
  });
});

var port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log("Listening on port " + port);
});