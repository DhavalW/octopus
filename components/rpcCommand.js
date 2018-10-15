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

		this.logger = options.logger.child('CMD:' + this.name);
		this.sendLogger = this.logger.child('send');
		this.recvLogger = this.logger.child('recv');
		this.logger.enabled && this.logger.log('Created new command as ', name);

		this.MESSAGETYPES = MESSAGETYPES;
		return this;
	};


	rpcCommand.prototype.autoID = function () {
		return Math.random().toString().substr(8) + '-' + Date.now();
	};

	rpcCommand.prototype.sendToID = function (tid, msg, mode) {
		var _self = this;
		var tName = _self.endpoint.transports[tid].tName;
		msg.source = _self.endpoint.label;
		_self.sendLogger.enabled && _self.sendLogger.log('Sending on transport [%s][%s], mode = %s,  msg =', tid, tName, mode, msg);

		if (!mode || mode != 'respond') {

			return new Promise((res, rej) => {

				var sent = false;

				// handler function
				var handler = function (respData, msgType) {
					_self.sendLogger.enabled && _self.sendLogger.log('\n\nResponse handler called with respData & msgTypes as \n', respData, msgType);

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

				_self.sendLogger.enabled && _self.sendLogger.log('\n\n\nSending %s to [%s] as \n', mode == 'respond' ? 'response' : 'request', tName, container);
				Promise.resolve(_self.endpoint.transports[tid].send(container))
					.then((s) => sent = true)
					.catch((e) => {
						sent = false;
						handler(e, MESSAGETYPES.responseFail);
					});

			});
		} else {

			var container = {
				rpc_msg: {},
				rpc_dir: _self.endpoint.dir
			};
			container.rpc_msg[_self.name] = msg;

			_self.sendLogger.enabled && _self.sendLogger.log('\n\n\nSending %s to [%s] as \n', mode == 'respond' ? 'response' : 'request', tName, container);
			return Promise.resolve(_self.endpoint.transports[tid].send(container));
		}
	};

	/*
		Data can be a value or a function.
		If its a function, it will be evaluated for every new transport and passed the transport name & index as parameters.
	*/
	rpcCommand.prototype.call = function (namespace, data, mode) {
		var _self = this;
		var tName;
		namespace = new Namespace(namespace);
		var tasks = [];
		var evaluate = false;

		var msg = {
			msgID: _self.autoID(),
			msgType: MESSAGETYPES.request,
			reqData: data,
		};

		if (typeof data === 'function') {
			evaluate = true;
		}


		Object.keys(_self.endpoint.transports)
			.forEach(function (tid, index) {
				_self.sendLogger.enabled && _self.sendLogger.log('Scanning for namespace on transport [%s] as \n', tid);

				tName = _self.endpoint.transports[tid].tName;

				if (_self.endpoint.transports[tid].initialised === true && namespace.test(tName)) {
					if (evaluate === true)
						msg.reqData = data(_self.endpoint.transports[tid].tName, index);
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
		var tName = transport.tName,
			tid = transport.id;

		_self.recvLogger.enabled && _self.recvLogger.log('\n\n\nCommand [%s] Data recvd on [%s][%s] as \n', _self.name, _self.endpoint.label, _self.endpoint.dir, tName, msg);

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
