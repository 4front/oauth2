var express = require('express');
var supertest = require('supertest');
var http = require('http');
var shortid = require('shortid');
var oauth2 = require('../lib/oauth2');

describe('oauth2()', function() {
	var self;

	beforeEach(function() {
		self = this;

		// Create a simulated remote oauth provider
		var oauthProvider = express();
		oauthProvider.settings.authorizationCodes = {};

		// http://tutorials.jenkov.com/oauth2/authorization-code-request-response.html
		oauthProvider.get('/authorize', function(req, res, next) {
			var code = shortid.generate();
			oauthProvider.settings.authCodes[code] = req.query;

			res.json({
				code: code,
				state: req.query.state
			});
		});

		oauthProvider.get('/token', function(req, res) {
			var code = req.query.code;

			return res.json({
				access_token: shortid.generate()
			});
		});

	  this.oauthServer = http.createServer(this.remoteApi).listen(9999);

		this.server = express();
		this.server.use('/oauth', oauth2({
			providers: {
				dummy: {
					authorizationURL: "http://localhost:9999/authorize",
    			tokenURL: "http://localhost:9999/token"
				}
			}
		}));

		this.server.use(function(err, req, res, next) {
	    if (!err.status)
	      err.status = 500;

	    if (err.status >= 500)
	      console.error(err.stack);

	    res.status(err.status).send(err.message);
	  });
	});

	afterEach(function() {
	  this.oauthServer.close();
	});

	it('perform oauth2 flow', function(done) {
		supertest(this.server)
			.get('/oauth/dummy?state=random')
			.expect(200)
			.end(done);
	});
});