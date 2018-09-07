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

		this.logger.enabled && this.logger.log('Created new endpoint as ', this);

		return this;
	};

	rpcEndpoint.prototype.pluginTransports = function (tColl) {
		this.transportTypes = Object.assign(transportTypes, tColl);
	};

	rpcEndpoint.prototype.over = function (socket, type) {
		return new rpcTransport(type, socket, this, {logger:this.logger});
	};
	rpcEndpoint.prototype.remove = function (socket) {
		var _self = this;
		Object.keys(_self.transports).forEach((tName)=>{
			if(_self.transports[tName].socket === socket)
				delete _self.transports[tName];
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

	rpcEndpoint.prototype.displayTransports = function () {
		var _self = this;
		console.log('key\t\t\t\tname\t\t\ttype\t\tinitalised');
		Object.keys(_self.transports).forEach((tKey) => {
			console.log('%s\t\t%s\t\t%s\t\t%s', tKey, _self.transports[tKey].tName, _self.transports[tKey].type,_self.transports[tKey].initialised);
		});
	};
	rpcEndpoint.prototype.command = function (name) {
		return new rpcCommand(name, this, {logger:this.logger});
	};


	/* ----------------------------------------------------------- */


	module.exports = rpcEndpoint;

})();
