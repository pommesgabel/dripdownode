var express = require('express')
	, app = express()
	, httpServer = require('http').Server(app)

	, io = require('socket.io')(httpServer)
	, downloader = require('./downloader')

	, https = require('https')
	, httpProxy = require('http-proxy')

	, Q = require('q');

const ROOT = GLOBAL.proj_root
	, SENDFILE_OPTS = { root: ROOT }
	, PORT = 55221
	, START_TIMEOUT = 5;

// =============================== Drip.fm proxy ===============================

// Proxy all /api requests to drip.fm
var proxy = httpProxy.createServer();
app.use('/api', function(req, res) {
	proxy.web(req, res, {
		target: 'https://drip.fm/api',
		agent: https.globalAgent,
		headers: {
			host: 'drip.fm' // ha, you got tricked son
		}
	});
});
// Listen to proxy errors.
// An ECONNRESET can happen frequently when the connection is closed by the
// user, e.g. reloading the page when it's still loading. We handle them with
// just an error code response, so that the server doesn't crash when they occur
proxy.on('error', function(err, req, res) {
	console.error("Proxy error:", err);
	res.status(400).end();
});

module.exports.cookie = { value: '' };
proxy.on('proxyRes', function (e, req, res) {
	downloader.setCookie(req.headers.cookie);
});

// =========================== Socket Download Server ==========================

io.on('connection', function(socket) {
	console.log('User connected to the socket server');
	downloader.setUpListeners(socket);
});

// ============================= Local HTTP Server =============================

// Static content
app.use('/components', express.static(ROOT + '/components'));
app.use('/templates', express.static(ROOT + '/templates'));
app.use('/dist', express.static(ROOT + '/dist'));
app.use('/fonts', express.static(ROOT + '/fonts'));
app.get('/', function(req, res) {
	res.sendFile('atom-app.html', SENDFILE_OPTS);
});

// Redirect to main HTML for all non-matching requests
app.use(function (req, res, next) {
	res.redirect('/');
});

module.exports = {
	start: function startServer() {
		return Q.promise(function(resolve, reject) {
			httpServer.listen(PORT, 'localhost');
			httpServer.on('listening', function() {
				console.log('Server listening on port %s', PORT);
				resolve(httpServer);
			});
		})
		.timeout(
			START_TIMEOUT * 1000,
			'Server did not start within ' + START_TIMEOUT + ' seconds'
		);
	}
};