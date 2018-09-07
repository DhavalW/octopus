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

	rpcEndpoint.prototype.displayString = function () {
		var _self = this;
		var logString = 'key\t\t\t\tname\t\t\ttype:id\t\tinitalised\n';
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
