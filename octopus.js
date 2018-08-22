(function () {

	const Namespace = require('./components/namespace.js');
	const rpcEndpoint = require('./components/rpcEndpoint.js');

	/* ----------------------------------------------------------- */

	var rpcs = {};

	var rpc = function(name, options){
		options = options || {};

		if(options.create === true){
			this.name = name;
			this.commands = {};
			this.incoming = new rpcEndpoint(name,'i');
			this.outgoing = new rpcEndpoint(name,'o');

			return this;
		}

		if(!rpcs[name]){
			rpcs[name] = new rpc(name,{create:true});
		}

		return rpcs[name];

	};
	rpc.prototype.displayTransports = function(){
		console.log('\n\n\n------ Transports for [%s] are:\n',this.name);
		console.log('incoming:\n');
		this.incoming.displayTransports();
		console.log('\n\noutgoing:\n');
		this.outgoing.displayTransports();
		console.log('\n--------------------------\n\n');
	}
	rpc.prototype.over = function(socket, type){
		var tasks = [];
		tasks.push(this.incoming.over(socket,type).as(this.name).initPromise);
		tasks.push(this.outgoing.over(socket,type).initPromise);
		return Promise.all(tasks);
	};
	rpc.prototype.pluginTransports = function(tObj){
		this.incoming.pluginTransports(tObj);
		this.outgoing.pluginTransports(tObj);
	};
	rpc.prototype.command = function(name){
		if(!this.commands[name]){
			var iC = this.incoming.command(name);
			var oC = this.outgoing.command(name);
			this.commands[name] = {
				provide:function(fn){
					return iC.provide(fn);
				},
				call:function(filter, data){
					return oC.call(filter,data);
				}
			};
		}
		return this.commands[name];
	};
	rpc.prototype.renameTo = function(newName){
		this.incoming.rename(this.name).as(newName);
		this.name = newName;
		this.outgoing.label = newName;
		return this;
	};
	rpc.prototype.parseResponseData = function(inc){
		return inc.filter(x=>x.type=="incoming").map(x=> x.response);
	};
	rpc.prototype.parseResponses = function(inc){
		return inc.filter(x=>x.type=="incoming").map(x=>{return {transport : x.transport, command:x.command, response:x.response}; });
	};
	rpc.prototype.parseStatuses = function(inc){
		return inc.filter(x=>x.type=="outgoing").map(x=>{return {transport : x.transport, command:x.command, status:x.status}; });
	};



	module.exports = rpc;

})();
