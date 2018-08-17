(function () {

	const Namespace = require('./components/namespace.js');
	const rpcEndpoint = require('./components/rpcEndpoint.js');

	/* ----------------------------------------------------------- */

	var rpc = function(name){
		this.name = name;
		this.incoming = new rpcEndpoint(name,'i');
		this.outgoing = new rpcEndpoint(name,'o');
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
		this.outgoing.over(socket,type);
		return this.incoming.over(socket,type).as(this.name);
	};
	rpc.prototype.pluginTransports = function(tObj){
		this.incoming.pluginTransports(tObj);
		this.outgoing.pluginTransports(tObj);
	};
	rpc.prototype.command = function(name){
		var iC = this.incoming.command(name);
		var oC = this.outgoing.command(name);
		return{
			provide:function(fn){
				return iC.provide(fn);
			},
			call:function(filter, data){
				return oC.call(filter,data);
			}
		};
	};
	rpc.prototype.renameTo = function(newName){
		this.incoming.rename(this.name).as(newName);
		this.name = newName;
		this.outgoing.label = newName;
		return this;
	};
	rpc.prototype.parseResponses = function(inc){
		return inc.filter(x=>x.type=="incoming").map(x=>{return {name : x.name, response:x.response}; });
	};
	rpc.prototype.parseStatuses = function(inc){
		return inc.filter(x=>x.type=="outgoing").map(x=>{return {name : x.name, status:x.status}; });
	};


	module.exports = rpc;

})();
