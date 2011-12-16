var clients = [];
var clientId = 0;

self.onconnect = function(event){
	var port = event.ports[0];
	clients[clientId++] = port;

	port.onmessage = function(e) {
		for (client in clients){
			// post only to ohter and not to the source window
			if(clients[client] != port)
				clients[client].postMessage(e.data);
		}
	};
};