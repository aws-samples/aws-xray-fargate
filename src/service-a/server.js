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
var http = XRay.captureHTTPs(require('http'));

const express = require('express');
var bodyParser = require('body-parser');
var queryString = require('querystring');


// Constants
const PORT = 8080;
const apiCNAME = process.env.API_CNAME || 'localhost';

// App
const app = express();

XRay.config([XRay.plugins.ECSPlugin]);
XRay.middleware.enableDynamicNaming();

app.use(bodyParser.urlencoded({extended: false}));
app.use(XRay.express.openSegment('service-a'));

app.get('/health', function(req, res) {
  res.status(200).send("Healthy");
});

app.get('/', function(req, res) {
  var seg = XRay.getSegment();
  seg.addAnnotation('service', 'service-b-request');

  var reqData = queryString.stringify(req.body);

  var options = {
    host: apiCNAME,
    port: '80',
    path: '/create',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(reqData)
    }
  };

  // Set up the request
  var remoteReq = http.request(options, function(remoteRes) {
    var body = '';
    remoteRes.setEncoding('utf8');

    remoteRes.on('data', function(chunk) {
      body += chunk;
    });

    remoteRes.on('end', function() {
      res.status(200).send(body);
    });
  });

  remoteReq.on('error', function() {
    console.log('service-b request failed');
  });

  // post the data
  remoteReq.write(reqData);
  remoteReq.end();
});

app.use(XRay.express.closeSegment());

app.listen(PORT);
console.log('Running on http://0.0.0.0:' + PORT);
