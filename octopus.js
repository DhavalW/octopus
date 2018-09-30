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
