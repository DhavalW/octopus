(function () {

	const Namespace = require('./namespace.js');
	const rpcStockTransports = require('./stockTransports.js');
	const rpcTransport = require('./rpcTransport.js');
	const rpcCommand = require('./rpcCommand.js');
	/* ----------------------------------------------------------- */


	var rpcEndpoint = function (l, dir, options) {
		options = options || {};
		this.logger = options.logger.child(dir == 'i' ? 'EP:in' : 'EP:out');


		this.transports = {};
		this.nameChangeHooks = {};
		this.label = l;
		this.dir = dir;
		this.commands = {};
		this.transportTypes = rpcStockTransports;

		this.logger.enabled && this.logger.log('Created new endpoint as [%s][%s]', l, dir);

		return this;
	};

	rpcEndpoint.prototype.pluginTransports = function (tColl) {
		this.transportTypes = Object.assign(this.transportTypes, tColl);
	};

	rpcEndpoint.prototype.over = function (socket, type) {
		return new rpcTransport(type, socket, this, { logger: this.logger });
	};
	rpcEndpoint.prototype.remove = function (socket) {
		var _self = this;
		// Object.keys(_self.transports).forEach((tid) => {
		// 	if (_self.transports[tid].socket == socket){
		// 		_self.logger.enabled && _self.logger.log('Destroying & removing transport [%s] tName [%s]. ',tid,_self.transports[tid].tName);
		// 		_self.transports[tid].destroy();
		// 		delete _self.transports[tid];
		// 	}
		// });

		// _self.logger.enabled && _self.logger.log('Attempting to remove socket. ',socket._octopus);
		// _self.logger.enabled && _self.logger.log('Current endpoint[%s][%s] transports are . ',_self.label, _self.dir, _self.transports);

		if (socket && socket._octopus && socket._octopus.transports) {

			// Go through transports added to socket
			socket._octopus.transports.forEach((t) => {

				// See if its a transport of this endpoint
				var foundT = Object.keys(_self.transports).find(x => _self.transports[x] === t);

				// if found, disassociate from socket, destroy and delete from endpoint
				if (foundT) {
					foundT = _self.transports[foundT];
					_self.logger.enabled && _self.logger.warn('Destroying & removing transport [%s] tName [%s] from endpoint[%s][%s]. ', foundT.id, foundT.tName, _self.label, _self.dir);

					var index = socket._octopus.transports.findIndex(x => x == t);
					socket._octopus.transports.splice(index, 1);


					foundT.destroy();
					delete _self.transports[foundT.id];
				}
			});
		}
	};

	rpcEndpoint.prototype.rename = function (namespace) {

		/*
			NOTE - Must investigate if there are side effects ?

			Should we be allowed to change remote side name ?
				Any usecase where we need it ?

			If our name change is accepted by remote side,
			 	should it trigger name changes with other connected transports too ? since there can only be one name for the remote.

			If we change the remote's name,
				should it trigger name changes with other connected transports too ? since there can only be one name for the remote.

			If so,
				Could this cause infinite loops / ripples ?

			For eg - Say connection path is setup as
				A - B - C - D - A
				    |_______|

		*/
		var _self = this;
		namespace = new Namespace(namespace);
		return {
			as: (newName) => {
				_self.label = newName;
				Object.keys(_self.transports).forEach((tid) => {
					if (namespace.test(_self.transports[tid].tName)) {
						_self.transports[tid].as(newName);
					}
				});
				return this;
			}
		}
	};

	// Internal hook called by transport, to signal a name change
	rpcEndpoint.prototype.transportNameChanged = function (transport) {

		// Run past all registered hooks & see if any are registered for this tName
		if (this.nameChangeHooks[transport.tName]) {
			this.nameChangeHooks[transport.tName].forEach(x => x(transport));
		}
	};

	/*
		Returns a one-time hook promise that
			1> resolves when appropriate name change occurs
			2> rejects if timeout happens

		& Automatically cleans up after it executes once (resolve or reject).
	*/
	rpcEndpoint.prototype.addTransportNameChangeHook = function (tName, timeout) {
		if (!this.nameChangeHooks[tName])
			this.nameChangeHooks[tName] = [];

		var p = new Promise((res, rej) => {
			var fn = (transport) => {
				if (res && !p.done) {
					p.done = true;
					var i = this.nameChangeHooks[tName].findIndex(x => x == fn);
					this.nameChangeHooks[tName].splice(i, 1);
					res(transport);
				}
			};

			this.nameChangeHooks[tName].push(fn);

			setTimeout(() => {
				if (rej && !p.done) {
					p.done == true;
					var i = this.nameChangeHooks[tName].findIndex(x => x == fn);
					this.nameChangeHooks[tName].splice(i, 1);
					rej();
				}
			}, timeout || 5000);

		});

		return p;
	};

	rpcEndpoint.prototype.displayString = function () {
		var _self = this;
		var logString = 'key\t\t\tname\t\t\ttype:id\t\t\tinitalised\n';
		Object.keys(_self.transports).forEach((tKey) => {
			logString += `${tKey}\t\t${_self.transports[tKey].tName}\t\t${_self.transports[tKey].type +':'+_self.transports[tKey].id}\t\t${_self.transports[tKey].initialised}\n`;
		});
		return logString;
	};

	rpcEndpoint.prototype.command = function (name) {
		return new rpcCommand(name, this, { logger: this.logger });
	};

	rpcEndpoint.prototype.findTransportByName = function (tName) {
		var tKey = Object.keys(this.transports).find(x => this.transports[x].tName == tName);

		if (tKey)
			return this.transports[tKey];
		else
			return null;
	};

	/* ----------------------------------------------------------- */


	module.exports = rpcEndpoint;

})();
