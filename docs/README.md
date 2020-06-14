## Palace

This project implements the card game Palace as a multiplayer online game.

### Cloning the repository and running the server software

1. Ensure you have installed node.js on your device. It is available from https://nodejs.org/en/download/
2. Fork or clone this repository onto your device. 
3. In the console, run `npm install` to install the required components.
4. Run `npm start` or `node server.js` to launch the server

### Connecting to the game as a client

#### On the same device as the server is running

To play the game on one device, first run the server, then connect to `localhost:5000` in as many separate browser tabs as there are players.

#### On the same local network

To play the game from different devices connected to the same local network, first run the server on one device, and find the device's private IP address (`ipconfig` in a Window terminal or `ip a` in a Linux terminal). Connect to `<ipaddress>:5000` from as many devices as there are players. You may have to configure/adjust/disable firewalls to allow incoming connections on the device running the server.

#### Anywhere in the world

To connect to the game server from outside of a local network, port forwarding must be set up on your router. This process is slightly different for every router, but it will involve navigating to the router's settings page in a browser (often `192.168.1.254`, some routers have their address on a sticker). Create a new port forwarding rule to forward all incoming traffic on port 5000 to port 5000 of the private IP address of the device on which the server is running. You may have to configure/adjust/disable firewalls to allow incoming connections on the device running the server.