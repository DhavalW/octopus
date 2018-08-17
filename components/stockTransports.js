(function(){

	var transportTypes = {};

	transportTypes['socketio'] = function (type, socket) {
		return {
			send: (data) => socket.send('message', data),
			onRecv: (fn) => socket.on('message', (data) => fn(data))
		}
	};
	transportTypes['processLocal'] = function (type, socket) {
		return {
			send: (data) => socket.emit('message', JSON.stringify(data)),
			onRecv: (fn) => socket.on('message', (data) => fn(JSON.parse(data)))
		}
	};
	transportTypes['nodeEELocal'] = function (type, socket) {
		return {
			send: (data) => socket.emit('message', JSON.stringify(data)),
			onRecv: (fn) => socket.on('message', (data) => fn(JSON.parse(data)))
		}
	};
	transportTypes['processRemote'] = function (type, socket) {
		return {
			send: (data) => socket.send(JSON.stringify(data)),
			onRecv: (fn) => socket.on('message', (data) => fn(JSON.parse(data)))
		}
	};
	transportTypes['nodeEERemote'] = function (type, socket) {
		return {
			send: (data) => socket.send('message', JSON.stringify(data)),
			onRecv: (fn) => socket.on('message', (data) => fn(JSON.parse(data)))
		}
	};

	module.exports = transportTypes;

})();
