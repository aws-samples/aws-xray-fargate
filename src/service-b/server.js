// Copyright 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License").
// You may not use this file except in compliance with the License.
// A copy of the License is located at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// or in the "license" file accompanying this file. This file is distributed
// on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
// express or implied. See the License for the specific language governing
// permissions and limitations under the License.

var XRay = require('aws-xray-sdk');
var AWS = XRay.captureAWS(require('aws-sdk'));

const express = require('express');

// Constants
const PORT = 8080;

// App
const app = express();

XRay.config([XRay.plugins.ECSPlugin]);
XRay.middleware.enableDynamicNaming();

app.use(XRay.express.openSegment('service-b'));

function randomIntInc(low, high) {
  return Math.floor(Math.random() * (high - low + 1) + low);
}

function sleep(callback) {
  var now = new Date().getTime();
  while (new Date().getTime() < now + randomIntInc(0, 1000)) { /* */ }
  callback();
}

app.get('/health', function(req, res) {
  res.status(200).send("Healthy");
});

app.post('/create', function(req, res) {
  res.setHeader('Content-Type', 'application/json');

  var r = randomIntInc(1, 10)
  var st = 0;
  if (r % 2 == 0) {
    st = 200;
  } else {
    st = 403;
  }

  var data = {
    request: randomIntInc(1, 10000),
    status: st,
    time: new Date().getTime()
  };

  for (var i = 0; i < 5; i++) {
    sleep(function() {});
  }

  if (st == 200) {
      res.json(data);
  } else {
    res.status(st).send(data);
  }

});

app.use(XRay.express.closeSegment());

app.listen(PORT);
console.log('Running on http://0.0.0.0:' + PORT);
