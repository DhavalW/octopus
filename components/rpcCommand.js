(function () {

	const Namespace = require('./namespace.js');



	/* ----------------------------------------------------------- */


	const MSGTYPES = {
		request: 'RQ',
		responseAccept: 'RA',
		responseFail: 'RF',
		responseAcceptError: 'RAE',
		responseFailError: 'RFE'
	};


	var rpcCommand = function (name, endpoint) {
		// console.log('Creating rpc command [%s] for endpoint [%s][%s]',name, endpoint.label, endpoint.dir);
		this.name = name;
		this.endpoint = endpoint;
		this.requestHandlers = [];
		this.responseHandlers = {};
		this.onProvideFn = null;
		this.endpoint.commands[name] = this;

		return this;
	};


	rpcCommand.prototype.autoID = function () {
		return Math.random().toString().substr(8) + '-' + Date.now();
	};


	rpcCommand.prototype.send = function (namespace, msg, mode) {
		var _self = this;
		namespace = new Namespace(namespace);
		var tasks = [];

		Object.keys(_self.endpoint.transports).forEach((tName) => {
			if (namespace.test(tName)) {

				if (mode != 'respond') {
					tasks.push((new Promise((res, rej) => {

						if (!_self.responseHandlers[tName])
							_self.responseHandlers[tName] = {};

						_self.responseHandlers[tName][msg.msgID] = function (respData, msgType) {
							delete _self.responseHandlers[tName][msg.msgID];
							if (msgType == MSGTYPES.responseAccept)
								res({
									type: 'incoming',
									transport: tName,
									command:_self.name,
									response: respData
								});
							else if (msgType == MSGTYPES.responseFail) {
								rej({
									type: 'incoming',
									transport: tName,
									command:_self.name,
									response: respData
								});
							} else if (msgType == MSGTYPES.responseAcceptError) {
								res({
									type: 'incoming',
									transport: tName,
									command:_self.name,
									response: new Error(respData)
								});
							} else if (msgType == MSGTYPES.responseFailError) {
								rej({
									type: 'incoming',
									transport: tName,
									command:_self.name,
									response: new Error(respData)
								});
							}
						};

					})));


				}

				var container = {};
				container.rpc_msg = {};
				container.rpc_msg[_self.name] = msg;
				container.rpc_dir = _self.endpoint.dir;


				// console.log('\n\n\nSending %s to [%s] as \n',mode =='respond'?'response':'request', tName, msg);
				tasks.push(Promise.resolve(_self.endpoint.transports[tName].send(container))
					.then((s) => {
						return {
							type: 'outgoing',
							transport: tName,
							command:_self.name,
							response: s
						};
					}));
			}
		});

		if (tasks.length > 0)
			return Promise.all(tasks);
		else
			return Promise.reject([{
				type: 'outgoing',
				transport: '',
				command:_self.name,
				response: 'no transports added'
			}]);
	};

	rpcCommand.prototype.call = function (namespaceString, data) {
		var _self = this;

		var msg = {
			msgID: _self.autoID(),
			msgType: MSGTYPES.request,
			reqData: data,
		};


		// console.log('Requesting RPC with msg = ', msg);
		return _self.send(namespaceString, msg);

	};


	rpcCommand.prototype.recieve = function (msg, tName) {
		var _self = this;

		// console.log('Command [%s] Data recvd on [%s][%s] as \n',_self.name, _self.endpoint.label,_self.endpoint.dir,tName, msg);

		switch (msg.msgType) {
		case MSGTYPES.responseAcceptError:
		case MSGTYPES.responseFailError:
		case MSGTYPES.responseAccept:
		case MSGTYPES.responseFail:
			// console.log('\n\n\nResponse recvd on [%s] from [%s] as\n ',tName, msg.rtName, msg);
			if (_self.responseHandlers[msg.rtName] && _self.responseHandlers[msg.rtName][msg.respID]) {
				// console.log('handler found. Responding !');
				_self.responseHandlers[msg.rtName][msg.respID](msg.respData, msg.msgType);
			} else {
				// console.log('handler not found');
			}
			break;

		case MSGTYPES.request:
			// console.log('\n\n\nRequest recvd on [%s] as\n ',tName,msg);

			if (_self.requestHandlers.length > 0) {
				var chain = Promise.resolve();
				_self.requestHandlers.forEach((h) => {
					chain = chain.then((e) => h(msg.reqData, e, tName));
				});
				return chain
					.then((respData) => {
						msg.respID = msg.msgID;
						msg.rtName = tName;
						msg.msgID = _self.autoID();
						if (respData instanceof Error) {
							msg.msgType = MSGTYPES.responseAcceptError;
							msg.respData = respData.toString();
						} else {
							msg.msgType = MSGTYPES.responseAccept;
							msg.respData = respData;
						}
						delete msg.reqData;
						return _self.send(tName, msg, 'respond');
					})
					.catch((e) => {
						msg.respID = msg.msgID;
						msg.rtName = tName;
						msg.msgID = _self.autoID();

						if (e instanceof Error) {
							msg.msgType = MSGTYPES.responseFailError;
							msg.respData = e.toString();
						} else {
							msg.msgType = MSGTYPES.responseFail;
							msg.respData = e;
						}
						delete msg.reqData;
						return _self.send(tName, msg, 'respond');
					})
					.then(()=> _self.onProvideFn? _self.onProvideFn(msg.respData, tName, msg):null)
					.catch((e)=> {
						console.log('Unexpected Error while executing onProvide function - ', e);
					});

			} else {
				console.error('ERROR - No requestHandlers for command[%s] on [%s][%s] -  tName, msg - ', _self.name, _self.endpoint.label, _self.endpoint.dir, tName, msg);
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
		var index = this.requestHandlers.findIndex((x)=> x === fn);
		if(index > -1)
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
