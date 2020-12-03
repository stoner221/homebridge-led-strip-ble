# homebridge-led-strip-ble
This is a plugin for [Homebridge](https://github.com/nfarina/homebridge) to enable the control of a led strip over BLE.

You will need NodeJS version 8.6 (or superior) and have Noble installed : https://www.npmjs.com/package/@abandonware/noble. Check if Noble is working correctly before you start to install this plugin. Noble has a strong system dependencie to bluetooth layer and requires the installation of bluetooth system libraries first.


# Installation

Install homebridge-led-strip-ble using npm :
<pre><code>
	npm install homebridge-led-strip-ble
</code></pre>

# Configuration
Add the Bluetooth address of each lightbulb required as a separate accessory in the Homebridge config.json file:
<pre><code>
	"accessories": [
	    {
	     "accessory": "LED_Strip",
	      "name": "a_name",
	      "address": "000000000000",
	      "read_service_uuid": "ffd0",
	      "write_service_uuid": "ffd5",
	      "read_char_uuid": "ffd4",
	      "write_char_uuid": "ffd9"
	    }
	  ]
</code></pre>

You can find the address by checking the log output of homebridge:
<pre><code>
	Homebridge is running on port 51111.
	[LED Strip] Starting BLE scan
	[LED Strip] Discovered: 5992f6c8406b
	[LED Strip] Discovered: c4be84e094d4
	[LED Strip] Discovered: 5b2d0489329c
</code></pre>
This code is based on homebridge-beewi: See [homebridge-beewi](https://www.npmjs.com/package/homebridge-beewi)

# Working
KIKO-5050-65.6FT [Amazon](https://www.amazon.com/Ultra-Long-KIKO-Bluetooth-Controller-Decoration/dp/B086YQS6VK/ref=sr_1_9?dchild=1&keywords=led+strip&qid=1606960009&sr=8-9)
