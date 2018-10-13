(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.octopus = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function () {

	/* ------
	
		Code below is adapted from the debug library, duly licensed as below.

		(The MIT License)

		Copyright (c) 2014 TJ Holowaychuk <tj@vision-media.ca>

		Permission is hereby granted, free of charge, to any person obtaining a copy of this software
		and associated documentation files (the 'Software'), to deal in the Software without restriction,
		including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
		and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
		subject to the following conditions:

		The above copyright notice and this permission notice shall be included in all copies or substantial
		portions of the Software.

		THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
		LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
		IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
		WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
		SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

	------ */

	var Namespace = function (namespaces) {

		this.names = [];
		this.skips = [];

		var i;
		var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
		var len = split.length;

		for (i = 0; i < len; i++) {
			if (!split[i]) continue; // ignore empty strings
			namespaces = split[i].replace(/\*/g, '.*?');
			if (namespaces[0] === '-') {
				this.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
			} else {
				this.names.push(new RegExp('^' + namespaces + '$'));
			}
		}


		return this;
	};


	Namespace.prototype.test = function (value) {
		var i, len;

		for (i = 0, len = this.skips.length; i < len; i++) {
			if (!this.skips[i].test(value))
				return false;
		}

		for (i = 0, len = this.names.length; i < len; i++) {
			if (this.names[i].test(value))
				return true;
		}

		return false;
	};



	module.exports = Namespace;

})();

},{}],2:[function(require,module,exports){
(function () {

	const Namespace = require('./namespace.js');



	/* ----------------------------------------------------------- */


	const MESSAGETYPES = {
		request: 'RQ',
		responseAccept: 'RA',
		responseFail: 'RF',
		responseAcceptError: 'RAE',
		responseFailError: 'RFE'
	};


	var rpcCommand = function (name, endpoint, options) {
		options = options || {};
		// console.log('Creating rpc command [%s] for endpoint [%s][%s]',name, endpoint.label, endpoint.dir);
		this.name = name;
		this.endpoint = endpoint;
		this.requestHandlers = [];
		this.responseHandlers = {};
		this.onProvideFn = null;
		this.endpoint.commands[name] = this;

		this.logger = options.logger.child('CMD:'+this.name);
		this.sendLogger = this.logger.child('send');
		this.recvLogger = this.logger.child('recv');
		this.logger.enabled && this.logger.log('Created new command as ', name);

		this.MESSAGETYPES = MESSAGETYPES;
		return this;
	};


	rpcCommand.prototype.autoID = function () {
		return Math.random().toString().substr(8) + '-' + Date.now();
	};

	rpcCommand.prototype.sendToID = function(tid, msg, mode){
		var _self = this;
		var tName = _self.endpoint.transports[tid].tName;
		msg.source = _self.endpoint.label;
		_self.sendLogger.enabled && _self.sendLogger.log('Sending on transport [%s][%s], mode = %s,  msg =', tid,tName,mode,msg);

		if (!mode || mode != 'respond') {

			return new Promise((res, rej) => {

				var sent = false;

				// handler function
				var handler = function (respData, msgType) {
					_self.sendLogger.enabled && _self.sendLogger.log('\n\nResponse handler called with respData & msgTypes as \n',respData, msgType);

					delete _self.responseHandlers[tid][msg.msgID];

					switch (msgType) {

					case MESSAGETYPES.responseAccept:
						res({
							sent: sent,
							status: true,
							transport: tName,
							command: _self.name,
							response: respData
						});
						break;

					case MESSAGETYPES.responseFail:
						res({
							sent: sent,
							status: false,
							transport: tName,
							command: _self.name,
							response: respData
						});
						break;
					}

				};


				if (!_self.responseHandlers[tid])
					_self.responseHandlers[tid] = {};

				_self.responseHandlers[tid][msg.msgID] = handler;


				var container = {
					rpc_msg: {},
					rpc_dir: _self.endpoint.dir
				};
				container.rpc_msg[_self.name] = msg;

				_self.sendLogger.enabled && _self.sendLogger.log('\n\n\nSending %s to [%s] as \n',mode =='respond'?'response':'request', tName, container);
				Promise.resolve(_self.endpoint.transports[tid].send(container))
					.then((s) => sent = true)
					.catch((e) => {
						sent = false;
						handler(e, MESSAGETYPES.responseFail);
					});

			});
		}
		else{

			var container = {
				rpc_msg: {},
				rpc_dir: _self.endpoint.dir
			};
			container.rpc_msg[_self.name] = msg;

			_self.sendLogger.enabled && _self.sendLogger.log('\n\n\nSending %s to [%s] as \n',mode =='respond'?'response':'request', tName, container);
			return Promise.resolve(_self.endpoint.transports[tid].send(container));
		}
	};

	rpcCommand.prototype.call = function (namespace, data, mode) {
		var _self = this;
		var tName;
		namespace = new Namespace(namespace);
		var tasks = [];

		var msg = {
			msgID: _self.autoID(),
			msgType: MESSAGETYPES.request,
			reqData: data,
		};

		Object.keys(_self.endpoint.transports)
			.forEach(function(tid){
				_self.sendLogger.enabled && _self.sendLogger.log('Scanning for namespace on transport [%s] as \n', tid);

				tName = _self.endpoint.transports[tid].tName;
				if (_self.endpoint.transports[tid].initialised === true && namespace.test(tName)) {
					_self.sendLogger.enabled && _self.sendLogger.log('Transport [%s] is valid. Attempting to send', tid);
					tasks.push(_self.sendToID(tid, msg, mode));
				}
			});

		if (tasks.length > 0)
			return Promise.all(tasks);
		else
			return Promise.resolve([{
				sent: false,
				status: false,
				transport: '',
				command: _self.name,
				response: 'no transports added'
			}]);
	};

	// rpcCommand.prototype.call = function (namespaceString, data) {
	// 	var _self = this;
	//
	// 	var msg = {
	// 		msgID: _self.autoID(),
	// 		msgType: MESSAGETYPES.request,
	// 		reqData: data,
	// 	};
	//
	//
	// 	_self.sendLogger.enabled && _self.sendLogger.log('Requesting RPC with msg = ', msg);
	// 	return _self.send(namespaceString, msg);
	//
	// };


	rpcCommand.prototype.recieve = function (msg, transport) {
		var _self = this;
		var tName = transport.tName, tid = transport.id;

		_self.recvLogger.enabled && _self.recvLogger.log('\n\n\nCommand [%s] Data recvd on [%s][%s] as \n',_self.name, _self.endpoint.label,_self.endpoint.dir,tName, msg);

		switch (msg.msgType) {
		case MESSAGETYPES.responseAccept:
		case MESSAGETYPES.responseFail:
			// console.log('\n\n\nResponse recvd on [%s] from [%s] as\n ',tName, msg.rtName, msg);
			if (_self.responseHandlers[tid] && _self.responseHandlers[tid][msg.respID]) {
				// console.log('handler found. Responding !');
				_self.responseHandlers[tid][msg.respID](msg.respData, msg.msgType);
			} else {
				// console.log('handler not found');
			}
			break;

		case MESSAGETYPES.request:
			// console .log('\n\nCommand[%s] Request recvd on [%s] as\n ',_self.name, tName,msg);

			if (_self.requestHandlers.length > 0) {
				// console.log('\n[%s]Request handlers found\n ',_self.requestHandlers.length);

				var chain = Promise.resolve();
				var reqData = msg.reqData;

				_self.requestHandlers.forEach((h) => {
					/* Each handler is called with (v,p,l,s) as follows
						v	= reqData 	- data sent by caller,
						p	= prev		- response got from the prevhandler's execution for this call,
						l	= tName 		- name of current transport (TODO - buggy, points to local transport name)
						s 	= msg.tName 	- name of the calling transport (this was the actual usecase for tName ?)
					*/
					chain = chain.then((prev) => h(msg.reqData, prev, tName, msg.tName));
				});
				return chain
					.then((respData) => {
						// console.log('\nRequest handlers SUCCESS\n Results are',respData);

						msg.respID = msg.msgID;
						msg.rtName = tName;
						msg.msgID = _self.autoID();
						msg.msgType = MESSAGETYPES.responseAccept;
						msg.respData = respData;
						delete msg.reqData;
						return _self.sendToID(tid, msg, 'respond');
					})
					.catch((e) => {
						// console.log('\nRequest handlers FAILED\n Results are',e);

						msg.respID = msg.msgID;
						msg.rtName = tName;
						msg.msgID = _self.autoID();
						msg.msgType = MESSAGETYPES.responseFail;
						msg.respData = e;
						delete msg.reqData;
						return _self.sendToID(tid, msg, 'respond');
					})
					.then(() => _self.onProvideFn ? _self.onProvideFn(reqData, msg.respData, tName, msg) : null)
					.catch((e) => {
						console.error('Unexpected Error while executing onProvide function - ', e);
					});

			} else {
				// _self.recvLogger.enabled && _self.recvLogger.error('ERROR - No requestHandlers for command[%s] on [%s][%s] -  tName, msg - ', _self.name, _self.endpoint.label, _self.endpoint.dir, tName, msg);
				msg.respID = msg.msgID;
				msg.rtName = tName;
				msg.msgID = _self.autoID();
				msg.msgType = MESSAGETYPES.responseFail;
				msg.respData = 'no providers';
				delete msg.reqData;
				return _self.sendToID(tid, msg, 'respond');

			}
			break;
		}
	};

	rpcCommand.prototype.provide = function (fn) {
		if (typeof fn == "function")
			this.requestHandlers.push(fn);
		else {
			throw new Error('Param passed to "provide" is not a function');
		}
	};

	rpcCommand.prototype.unProvide = function (fn) {
		var index = this.requestHandlers.findIndex((x) => x === fn);
		if (index > -1)
			this.requestHandlers.splice(handlerIndex, 1);
		return this;
	};

	/*
		Executes passed fn when provide response is successfully recieved by remote.
			Assuming transport send() function returns a promise on successfull
			transfer of response message
	*/
	rpcCommand.prototype.onProvide = function (fn) {
		if (typeof fn == "function")
			this.onProvideFn = fn;
		else {
			throw new Error('Param passed to "onProvideFn" is not a function');
		}
	};



	/* ----------------------------------------------------------- */


	module.exports = rpcCommand;

})();

},{"./namespace.js":1}],3:[function(require,module,exports){
(function () {

	const Namespace = require('./namespace.js');
	const rpcStockTransports = require('./stockTransports.js');
	const rpcTransport = require('./rpcTransport.js');
	const rpcCommand = require('./rpcCommand.js');
	/* ----------------------------------------------------------- */


	var rpcEndpoint = function (l, dir, options) {
		options = options || {};
		this.logger = options.logger.child(dir == 'i'?'EP:in':'EP:out');


		this.transports = {};
		this.label = l;
		this.dir = dir;
		this.commands = {};
		this.transportTypes = rpcStockTransports;

		this.logger.enabled && this.logger.log('Created new endpoint as [%s][%s]', l,dir);

		return this;
	};

	rpcEndpoint.prototype.pluginTransports = function (tColl) {
		this.transportTypes = Object.assign(this.transportTypes, tColl);
	};

	rpcEndpoint.prototype.over = function (socket, type) {
		return new rpcTransport(type, socket, this, {logger:this.logger});
	};
	rpcEndpoint.prototype.remove = function (socket) {
		var _self = this;
		Object.keys(_self.transports).forEach((tid)=>{
			if(_self.transports[tid].socket === socket)
				delete _self.transports[tid];
		});
	};

	rpcEndpoint.prototype.rename = function (namespace) {
		var _self = this;
		namespace = new Namespace(namespace);
		return {
			as: (newName) => {
				_self.label = newName;
				Object.keys(_self.transports).forEach((tName) => {
					if (namespace.test(tName)) {
						_self.transports[tName].as(newName);
					}
				});
				return this;
			}
		}
	};

	rpcEndpoint.prototype.displayString = function () {
		var _self = this;
		var logString = 'key\t\t\tname\t\t\ttype:id\t\t\tinitalised\n';
		Object.keys(_self.transports).forEach((tKey) => {
			logString+=`${tKey}\t\t${_self.transports[tKey].tName}\t\t${_self.transports[tKey].type +':'+_self.transports[tKey].id}\t\t${_self.transports[tKey].initialised}\n`;
		});
		return logString;
	};

	rpcEndpoint.prototype.command = function (name) {
		return new rpcCommand(name, this, {logger:this.logger});
	};


	/* ----------------------------------------------------------- */


	module.exports = rpcEndpoint;

})();

},{"./namespace.js":1,"./rpcCommand.js":2,"./rpcTransport.js":4,"./stockTransports.js":5}],4:[function(require,module,exports){
(function () {
	var idCount = 0;
	var autoID = function(){
		return 'T'+ (++idCount);
	};

	var rpcTransport = function (type, socket, endpoint, options) {
		// console.log('Creating rpc transport [%s] for endpoint [%s][%s]',type, endpoint.label, endpoint.dir);
		options = options || {};
		var _self = this;

		_self.id = autoID();
		_self.logger = options.logger.child('T:'+type+':'+_self.id);

		_self.endpoint = endpoint;
		_self.type = type;
		_self.socket = socket;	// Also used for matching & removal, besides internal socket access.
		_self.tName = 'nonname';
		_self.initialised = false;
		_self.nameClock = 0;
		_self.dirFlip = {
			i: 'o',
			o: 'i'
		};

		// Add trasport type specific methods to self
		Object.assign(_self, _self.endpoint.transportTypes[type](type, socket));

		_self.initPromise = new Promise((res,rej)=>{
			_self.onRecv((data) => {
				// console.log('[onRecv] Data recvd on [%s][%s]',_self.tName,_self.endpoint.dir, data);
				if (data.rpc_dir == _self.dirFlip[_self.endpoint.dir]) {
					// console.log('[onRecv] Data accepted on [%s][%s]',_self.tName,_self.endpoint.dir, data);

					if (data.rpc_tName_change) {
						/*
							NOTE - Implementing "Latest & last write wins" consensus policy :
								WHY ? - Required to solve disputes when both(or more) endpoints request a name change at the same time.
								Without this, a simultaneous request causes each one to sends his name change over while implementing the other's name change request.
								 	consequence - a name swap, instead of consensus on a single name value.
						*/
						if (data.rpc_tName_change.force || data.rpc_tName_change.clock >= _self.nameClock) {
							_self.logger.enabled && _self.logger.log('[%s, clock %s] [%s] Changing name of transport [%s][%s] to [%s] at clock =', _self.endpoint.label, _self.nameClock, data.rpc_tName_change.force ? 'forced' : '', _self.tName,_self.id, data.rpc_tName_change.tName, data.rpc_tName_change.clock);
							// delete _self.endpoint.transports[_self.tName];
							_self.tName = data.rpc_tName_change.tName;
							_self.nameClock = data.rpc_tName_change.clock;
							// _self.endpoint.transports[_self.tName] = _self;
							if(!_self.initialised) {
								_self.initialised = true;
								res();
							}
						} else {
							_self.logger.enabled && _self.logger.log('[%s, clock %s] [%s] Rejecting name change of transport [%s][%s] as [%s] at clock =',_self.endpoint.label,_self.nameClock,data.rpc_tName_change.force?'forced':'', _self.tName,_self.id, data.rpc_tName_change.tName,data.rpc_tName_change.clock);
							_self.send({
								rpc_tName_change: {
									tName: _self.tName,
									clock: _self.nameClock,
									force: true
								},
								rpc_dir: _self.endpoint.dir
							});
						}
					}

					if (data.rpc_msg) {
						Object.keys(data.rpc_msg).forEach((cKey) => {
							if (_self.endpoint.commands[cKey])
								_self.endpoint.commands[cKey].recieve(data.rpc_msg[cKey], _self);
						});
					}
				}
			});

			_self.as = function (tName) {
				// delete _self.endpoint.transports[_self.tName];
				var prevName = _self.tName;
				_self.tName = tName;
				_self.nameClock++;
				_self.logger.enabled && _self.logger.log('[%s] Sending namechange of transport [%s][%s] to [%s] at clock =',_self.endpoint.label, prevName,tName,_self.id, _self.nameClock);
				_self.send({
					rpc_tName_change: {
						tName: _self.tName,
						clock: _self.nameClock
					},
					rpc_dir: _self.endpoint.dir
				});
				// _self.endpoint.transports[tName] = _self;
				if(!_self.initialised) {
					_self.initialised = true;
					res();
				}
				return _self;
			};
		});

		_self.endpoint.transports[_self.id] = _self;
		_self.logger.enabled && _self.logger.log('Added transport [%s][%s] for endpoint [%s][%s]',type,_self.id, endpoint.label, endpoint.dir);
		return _self;
	};

	/* ----------------------------------------------------------- */


	module.exports = rpcTransport;

})();

},{}],5:[function(require,module,exports){
(function () {

	var transportTypes = {};

	transportTypes['socketio'] = function (type, socket) {
		return {
			send: (data) => socket.send(JSON.stringify(data)),
			onRecv: (fn) => socket.on('message', (data) => fn(JSON.parse(data)))
		}
	};
	transportTypes['websocket'] = function (type, socket) {
		return {
			send: (data) => {
				return new Promise((res, rej) => {
					socket.send(
						JSON.stringify(data),
						(e) => e ? rej(e) : res()
					);
				});
			},
			onRecv: (fn) => socket.on('message', (data) => fn(JSON.parse(data)))
		}
	};
	transportTypes['processLocal'] = function (type, socket) {
		return {
			send: (data) => socket.emit('message', JSON.stringify(data)),
			onRecv: (fn) => socket.on('message', (data) => fn(JSON.parse(data)))
		}
	};
	transportTypes['nodeEELocal'] = function (type, socket) {
		return {
			send: (data) => socket.emit('message', JSON.stringify(data)),
			onRecv: (fn) => socket.on('message', (data) => fn(JSON.parse(data)))
		}
	};
	transportTypes['processRemote'] = function (type, socket) {
		return {
			send: (data) => socket.send(JSON.stringify(data)),
			send: (data) => {
				return new Promise((res, rej) => {
					var s = socket.send(
						JSON.stringify(data),
						(e) => e instanceof Error ? rej(e) : (s === true? res(s):rej(s))
					);
				});
			},
			onRecv: (fn) => socket.on('message', (data) => fn(JSON.parse(data)))
		}
	};
	transportTypes['nodeEERemote'] = function (type, socket) {
		return {
			send: (data) => socket.send('message', JSON.stringify(data)),
			onRecv: (fn) => socket.on('message', (data) => fn(JSON.parse(data)))
		}
	};

	module.exports = transportTypes;

})();

},{}],6:[function(require,module,exports){
module.exports = function(debug){

	var logger = function (suffix) {
		this.enabled = false;
		this.prefix = suffix || '';

		if(typeof debug == 'function'){
			this.log = debug(`logs:` + this.prefix);
			this.warn = debug(`warnings:` + this.prefix);
			this.error = debug(`errors:` + this.prefix);
			this.enabled = true;
		}
		else{
			this.log = ()=>{};
			this.warn = ()=>{};
			this.error = ()=>{};
			this.enabled = false;
		}
	};

	logger.prototype.child = function (suffix) {
		return new logger(this.prefix + ':' + suffix);
	};

	return logger;
};

},{}],7:[function(require,module,exports){
module.exports = function (debug) {

	const Namespace = require('./components/namespace.js');
	const rpcEndpoint = require('./components/rpcEndpoint.js');
	const debugr = require('debug-pest')(debug);
	var appLogger = new debugr('octopus');

	/* ----------------------------------------------------------- */

	var rpcs = {};

	var rpc = function (name, options) {
		options = options || {};


		if (options.create === true) {
			this.name = name;
			this.commands = {};
			this.logger = appLogger.child(this.name);

			this.incoming = new rpcEndpoint(name, 'i', { logger: this.logger});
			this.outgoing = new rpcEndpoint(name, 'o', { logger: this.logger});

			this.logger.enabled && this.logger.log('Created new Octopus RPC as ', this.name);
			return this;
		}

		if (!rpcs[name]) {
			options.create = true;
			rpcs[name] = new rpc(name, options);
		}


		return rpcs[name];

	};
	rpc.prototype.displayTransports = function () {
		// console.log('\n\n\n------ Transports for [%s] are:\n', this.name);
		// console.log('incoming:\n');
		// this.incoming.displayTransports();
		// console.log('\n\noutgoing:\n');
		// this.outgoing.displayTransports();
		// console.log('\n--------------------------\n\n');

		var logString = `

-------------------- TRANSPORTS for [${this.name}] are : ---------------------------

Incoming (provides):

`;

		logString += this.incoming.displayString();
		logString +=`\n\n-------------\nOutgoing (calls):\n\n`;
		logString += this.outgoing.displayString();
		logString +='\n\n------------------------------------------------------------------------------------\n\n';

		console.log(logString);
	};

	rpc.prototype.over = function (socket, type) {
		var tasks = [];
		tasks.push(this.incoming.over(socket, type)
			.as(this.name)
			.initPromise);
		tasks.push(this.outgoing.over(socket, type)
			.initPromise);
		return Promise.all(tasks);
	};
	rpc.prototype.remove = function (socket) {
		this.incoming.remove(socket);
		this.outgoing.remove(socket);
	};

	rpc.prototype.pluginTransports = function (tObj) {
		this.incoming.pluginTransports(tObj);
		this.outgoing.pluginTransports(tObj);
	};
	rpc.prototype.command = function (name) {
		var _self = this;
		if (!_self.commands[name]) {
			var iC = _self.incoming.command(name);
			var oC = _self.outgoing.command(name);
			_self.MESSAGETYPES = iC.MESSAGETYPES || oC.MESSAGETYPES;

			_self.commands[name] = {
				provide: function (fn) {
					iC.provide(fn);
					return _self.commands[name];
				},
				unProvide: function (fn) {
					iC.unProvide(fn);
					return _self.commands[name];
				},
				onProvide: function (fn) {
					iC.onProvide(fn);
					return _self.commands[name];
				},
				call: function (filter, data) {
					// _self.displayTransports();
					return oC.call(filter, data);
				}
			};
		}
		return this.commands[name];
	};
	rpc.prototype.renameTo = function (newName) {
		this.incoming.rename(this.name)
			.as(newName);
		this.name = newName;
		// this.outgoing.label = newName;
		return this;
	};


	/* ----------------  Result parsing & Resolving to Promise resolve/reject -----------*/

	rpc.prototype.parseByStatus = function (res) {
		var valids = [],
			invalids = [],
			check;
		for (var i = 0; i < res.length; i++) {
			check = res[i];
			if (check.sent === true && check.status === true)
				valids.push(check);
			else
				invalids.push(check);
		}
		return {
			valids: valids,
			invalids: invalids
		};
	};

	rpc.prototype.resolve = function (p) {
		if (p.sent === true && p.status === true)
			return Promise.resolve(p.response);
		else
			return Promise.reject(p.response);
	};
	rpc.prototype.resolveAll = function (p) {

		for (var i = 0; i < p.length; i++) {
			if (p[i].sent === false || p[i].status === false)
				return Promise.reject(p);
		}

		return Promise.resolve(p);
	};
	rpc.prototype.resolveAtLeastOne = function (p) {

		for (var i = 0; i < p.length; i++) {
			if (p[i].sent === true && p[i].status === true)
				return Promise.resolve(p);
		}

		return Promise.reject(p);
	};




	return rpc;

};

},{"./components/namespace.js":1,"./components/rpcEndpoint.js":3,"debug-pest":6}]},{},[7])(7)
});

//# sourceMappingURL=octopus.js.map
