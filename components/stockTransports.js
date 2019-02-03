(function () {

	var transportTypes = {};

	transportTypes['socketio'] = function (type, socket) {
		return {
			send: (data) => socket.send(JSON.stringify(data)),
			onRecv: (fn) => socket.on('message', (data) => fn(JSON.parse(data))),
			stopRecv: (fn) => socket.removeListener('message', fn)
		}
	};
	transportTypes['websocket'] = function (type, socket) {
		return {
			send: (data) => {
				return new Promise((res, rej) => {
					socket.send(
						JSON.stringify(data),
						(e) => e ? rej(e) : res()
					);
				});
			},
			onRecv: (fn) => socket.on('message', (data) => fn(JSON.parse(data))),
			stopRecv: (fn) => socket.removeListener('message', fn)
		}
	};
	transportTypes['processLocal'] = function (type, socket) {
		return {
			send: (data) => socket.emit('message', JSON.stringify(data)),
			onRecv: (fn) => socket.on('message', (data) => fn(JSON.parse(data))),
			stopRecv: (fn) => socket.removeListener('message', fn)
		}
	};
	transportTypes['nodeEELocal'] = function (type, socket) {
		return {
			send: (data) => socket.emit('message', JSON.stringify(data)),
			onRecv: (fn) => socket.on('message', (data) => fn(JSON.parse(data))),
			stopRecv: (fn) => socket.removeListener('message', fn)
		}
	};
	transportTypes['processRemote'] = function (type, socket) {
		return {
			send: (data) => {
				return new Promise((res, rej) => {
					var s = socket.send(
						JSON.stringify(data),
						(e) => e instanceof Error ? rej(e) : (s === true ? res(s) : rej(s))
					);
				});
			},
			onRecv: (fn) => socket.on('message', (data) => fn(JSON.parse(data))),
			stopRecv: (fn) => socket.removeListener('message', fn)
		}
	};
	transportTypes['nodeEERemote'] = function (type, socket) {
		return {
			send: (data) => socket.send('message', JSON.stringify(data)),
			onRecv: (fn) => socket.on('message', (data) => fn(JSON.parse(data))),
			stopRecv: (fn) => socket.removeListener('message', fn)
		}
	};

	module.exports = transportTypes;

})();
