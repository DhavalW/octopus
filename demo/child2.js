const rpcBi = require('../rpc.js');
var rpc = new rpcBi('local:child:child2');

rpc.over(process, 'processRemote');

var test = rpc.command('test');
var hello = rpc.command('hello');

test.provide(function (data, prev, tName) {
	return 'child2-tested';
});

hello.provide(function (data, prev, tName) {
	return 'child2 :- Hey there ! ' + data.from;
});

setTimeout(()=>rpc.displayTransports(),4500);
