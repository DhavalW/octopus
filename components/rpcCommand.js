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

	rpcCommand.prototype.sendToID = function (tid, msg, mode, pTransName) {
		var _self = this;

		msg.msgID = _self.autoID();
		_self.sendLogger.enabled && _self.sendLogger.log('\n\n[sendToID] called with tid[%s], msgID[%s], mode[%s], pTransName[%s] \n', tid, msg.msgID, mode, pTransName);

		/*
			NOTE - Adding a check as a hotfix to avoind crashing on tName errors.

			Source of errors - sendToID is called from call() as well as recursively, when responding to messages.

			The source of tName errors may be the async nature. Since this is async, there's a gap in between call & execution
			between which a "remove()" function call might delete the transport, raising such issues.

			Case #1 - Deleted transport after a call from .call(), but before the execution of sendToID, causing tName errors.
			Case #2 - Alternately, Deleted the transport after a message was recieved, but before a response could be sent.

			NOTE - EDGE CASE TO SOLVE :
			What happens if in either case, the response is critical for proper function / avoiding duplication of calls (see below),
			and could be sent because the reciever still exists (ie same tName), but over a different transport (ie different tID).

			How duplication of calls -
				Sender sends RPC
				Reciever gets RPC & executes provider
				Sender disconnects & reconnects with a new connection
				Reciever removes previous socket & re-adds new socket (ie same tName, once initial handshake is done, but different tID).
				Reciever RPC call response fails / ignored because old tID doesn't exist anymore.
				Sender times out (or considers failure due to disconnection / remains hanging as a memory leak), even though RPC provider has executed on reciever
				Application tries again assuming bad RPC call.

			Possible solution -
				if tID mismatch is found,
					a search of other transports with the same tName is done,
					 	if found, send as usual and resolve
						if not found,
							call is hooked and waits till another transport with the same name connects before timeout
							if connects,
								send as usual & resolve
							if not,
								fail with a timeout
		*/

		if (tid === '' || !_self.endpoint.transports[tid]) {
			_self.sendLogger.enabled && _self.sendLogger.log('\n\n[sendToID] transport to tid[%s] does not exist. Taking corrective action... \n', tid);


			var trans = _self.endpoint.findTransportByName(pTransName);

			// If found, continue with discovered transport
			if (trans) {
				tid = trans.id;
			}

			// Else wait for a new transport to connect, or reject on timeout
			else {
				return Promise.resolve()

					// Wait for new transport with given name to setup
					.then(() => _self.endpoint.addTransportNameChangeHook(pTransName))

					// Once hook fires, call this recursively and try to resend
					.then((t) => this.sendToID(t.id, msg, mode, pTransName))

					// Reject if it fails (worst case situation)
					.catch(() => {
						_self.sendLogger.enabled && _self.sendLogger.warn('[ERROR] transport tName[%s] was not found as tid[%s]. Might lead to duplicated provider executions, if re-connections caused it.', tName, tid);

						if (!mode || mode != 'respond') {
							_self.sendLogger.enabled && _self.sendLogger.warn('Cannot call - missing transport');
							return Promise.resolve({
								sent: false,
								status: false,
								transport: pTransName,
								command: _self.name,
								response: 'transport removed or changed'
							});
						} else {
							_self.sendLogger.enabled && _self.sendLogger.warn('Cannot respond - missing transport');
							return Promise.reject('transport missing');
						}
					});
			}
		}

		// NOTE - In case the tName has changed since the call
		var tName = _self.endpoint.transports[tid].tName;

		msg.source = _self.endpoint.label;
		_self.sendLogger.enabled && _self.sendLogger.log('Sending on transport [%s][%s], mode = %s,  msg =', tid, tName, mode, msg);


		if (!mode || mode != 'respond') {

			return new Promise((res, rej) => {

				var sent = false;

				// handler function
				var handler = function (respData, msgType) {
					_self.sendLogger.enabled && _self.sendLogger.log('\n\nResponse handler called with respData & msgTypes as \n', respData, msgType);

					delete _self.responseHandlers[tName][msg.msgID];


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


				if (!_self.responseHandlers[tName])
					_self.responseHandlers[tName] = {};

				_self.sendLogger.enabled && _self.sendLogger.log('\n\nAdding response handler at [%s][%s] \n', tName, msg.msgID);
				_self.responseHandlers[tName][msg.msgID] = handler;


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
		If its a function, it will be evaluated for every new transport

		and passed params as:
			1. the transport tName, index - if found.
			2. null, null - if no transports are found, and it goes to waiting

		//TODO - improve consistency in params passed to data function.

	*/
	rpcCommand.prototype.call = function (namespace, data, mode) {
		var _self = this;
		var tName;
		var tasks = [];
		var evaluate = false;


		if (typeof data === 'function') {
			evaluate = true;
		}

		// Send to all transports that match the namespace
		var tasks = _self.endpoint.findTransportsByNamespace(namespace, { initialised: true })
			.map((t, i) => {
				var msg = {
					msgID: _self.autoID(),
					msgType: MESSAGETYPES.request,
					reqData: evaluate === true ? data(t.tName, i) : data,
				};

				_self.sendLogger.enabled && _self.sendLogger.log('Transport [%s] is valid. Attempting to send', t.id);

				return _self.sendToID(t.id, msg, mode, t.tName);
			});


		// If transports were not found,
		// hook & wait for the first valid transport that connects
		if (tasks.length == 0){

			var msg = {
				msgID: _self.autoID(),
				msgType: MESSAGETYPES.request,
				reqData: evaluate === true ? data(null, null) : data,
			};

			_self.sendLogger.enabled && _self.sendLogger.log('No transports found for [%s]. Waiting', namespace);

			return Promise.all([_self.sendToID('', msg, mode, namespace)]);

		}

		// Otherwise, wait till all messages have been sent & resolve.
		else
			return Promise.all(tasks);


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
			if (_self.responseHandlers[tName] && _self.responseHandlers[tName][msg.respID]) {
				_self.sendLogger.enabled && _self.sendLogger.log('handler found. Responding !');
				return Promise.resolve(_self.responseHandlers[tName][msg.respID](msg.respData, msg.msgType));

			} else {
				_self.sendLogger.enabled && _self.sendLogger.log('handler not found');
				return Promise.reject(new Error('handler not found'));
			}
			break;

		case MESSAGETYPES.request:
			// console .log('\n\nCommand[%s] Request recvd on [%s] as\n ',_self.name, tName,msg);

			if (_self.requestHandlers.length > 0) {
				// console.log('\n[%s]Request handlers found\n ',_self.requestHandlers.length);

				var chain = Promise.resolve();
				var reqData = msg.reqData;

				_self.requestHandlers.forEach((h) => {
					/* Each handler is called with (v,p,s,t,msg) as follows
						v	= reqData 	- data sent by caller,
						p	= prev		- response got from the prevhandler's execution for this call,
						s 	= msg.source 	- name of the calling transport (this was the actual usecase for tName ?)
						t	= tName 		- name of current transport (TODO - buggy, points to local transport name)
						msg 	= msg 		- full raw msg obj
					*/
					chain = chain.then((prev) => h(msg.reqData, prev, msg.source, tName, msg));
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
						return _self.sendToID(tid, msg, 'respond', tName);
					})
					.catch((e) => {
						// console.log('\nRequest handlers FAILED\n Results are',e);

						msg.respID = msg.msgID;
						msg.rtName = tName;
						msg.msgID = _self.autoID();
						msg.msgType = MESSAGETYPES.responseFail;
						msg.respData = e;
						delete msg.reqData;
						return _self.sendToID(tid, msg, 'respond', tName);
					})
					.then(() => _self.onProvideFn ? _self.onProvideFn(reqData, msg.respData, tName, msg) : null)
					.catch((e) => {
						console.error('[Octopus] Error while executing [%s] provider chain on [%s] - ', _self.name, tName, e);
						return Promise.reject(e);
					});

			} else {
				_self.recvLogger.enabled && _self.recvLogger.error('ERROR - No requestHandlers for command[%s] on [%s][%s] -  tName, msg - ', _self.name, _self.endpoint.label, _self.endpoint.dir, tName, msg);
				msg.respID = msg.msgID;
				msg.rtName = tName;
				msg.msgID = _self.autoID();
				msg.msgType = MESSAGETYPES.responseFail;
				msg.respData = 'no providers';
				delete msg.reqData;
				return _self.sendToID(tid, msg, 'respond', tName);

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
			this.requestHandlers.splice(index, 1);
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
