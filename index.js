  
var Noble = require('@abandonware/noble');
var Service, Characteristic;

module.exports = function(homebridge)
{
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-led-strip-ble", "LED_Strip", led_strip);
}

function led_strip(log, config) 
{
  this.log = log;
  this.config = config;
  this.name = config['name'] || 'Led Strip';
  this.address = config['ble_address'];
  this.read_service = config['read_service_uuid'];
  this.write_service = config['write_service_uuid'];
  this.read_char = config['read_char_uuid'];
  this.write_char = config['write_char_uuid'];
  this.write_characteristic = null;
  this.read_characteristic = null ;
  this.peripheral_selected = null;
  this.scanning = false;
  this.read_callbacks = [];

  this.light_service = new Service.Lightbulb(this.name);

  this.light_service
    .getCharacteristic(Characteristic.On)
    .on('set', this.set_power_state.bind(this))
    .on('get', this.get_power_state.bind(this));
  this.light_service
    .addCharacteristic(new Characteristic.Brightness())
    .on('set', this.set_brightness.bind(this))
    .on('get', this.get_brightness.bind(this));
  this.light_service
    .addCharacteristic(new Characteristic.Saturation())
    .on('set', this.set_saturation.bind(this))
    .on('get', this.get_saturation.bind(this));
  this.light_service
    .addCharacteristic(new Characteristic.Hue())
    .on('set', this.set_hue.bind(this))
    .on('get', this.get_hue.bind(this));

  Noble.on('stateChange', this.noble_state_change.bind(this));
  Noble.on('scanStop', this.noble_scan_stop.bind(this));
}

led_strip.prototype.get_information_service = function() 
{
  var informationService = new Service.AccessoryInformation();
  informationService
  .setCharacteristic(Characteristic.Name, this.name)
  .setCharacteristic(Characteristic.SerialNumber, this.address);
  return informationService;
}

led_strip.prototype.getServices = function() 
{
  return [this.light_service, this.get_information_service()];
}

led_strip.prototype.set_power_state = function(power_state, callback) 
{
  this.log.debug("Set Power State: " + power_state);
  this.power_state = power_state;
  this.write_to_bulb("set_power_status", function()
  {
    callback(null);
  });
}

led_strip.prototype.set_brightness = function(value, callback) 
{
  this.brightness = value;
  this.write_to_bulb("set_device", function() 
  {
      callback(null);
  });
}

led_strip.prototype.set_saturation = function(value, callback) 
{
  this.saturation = value;
  this.write_to_bulb("set_device", function() 
  {
      callback(null);
  });
}

led_strip.prototype.set_hue = function(value, callback) 
{
  this.hue = value;
  this.write_to_bulb("set_device", function() 
  {
      callback(null);
  });
}

led_strip.prototype.get_power_state = function(callback) 
{
  this.log.debug("Power State called");

  this.write_to_bulb("get_power_status", function(){});
  this.read_bulb(function(error)
  {
    callback(error, this.power_state);
  }.bind(this));
}

led_strip.prototype.get_brightness = function(callback) 
{
  this.log.debug("Get Brightness called");
  this.read_bulb(function (error) 
  {
    callback(error, this.brightness);
  }.bind(this));
}

led_strip.prototype.get_saturation = function(callback) 
{
  this.log.debug("Get Saturation called");
  this.read_bulb(function (error) 
  {
    callback(error, this.saturation);
  }.bind(this));
}

led_strip.prototype.get_hue = function(callback) 
{
  this.log.debug("Get Hue called");
  this.read_bulb(function (error) 
  {
    callback(error, this.hue);
  }.bind(this));
}

led_strip.prototype.noble_state_change = function(state) 
{
  if (state == "poweredOn") 
  {
    this.log.debug("Starting BLE scan");
    Noble.on("discover", this.noble_discovered.bind(this));
    this.start_scanning_with_timeout();
    this.scanning = true;
  } 
  else 
  {
    this.log.debug("BLE state change to " + state + "; stopping scan.");
    Noble.removeAllListeners('scanStop');
    Noble.stopScanning();
    this.scanning = false;
  }
}

led_strip.prototype.noble_discovered = function(accessory) 
{
  var peripheral = accessory;
  this.log.info("Discovered: ", peripheral.localName, " |UUID: ", peripheral.uuid);

  if (this.peripheral_selected == null) 
  {
    this.log.debug("Peripheral Empty");
    if (peripheral.uuid == this.address)
    {
      this.log.debug("Device Found Starting Connection");
      this.peripheral_selected = peripheral;
      this.stop_scanning();
      this.scanning = false;

      accessory.connect(function(error)
      {
        this.noble_connected(error, accessory);
      }.bind(this));
    }
  }
  else
  {
    if (peripheral.address == this.address) 
    {
      this.log.debug("reconnected to Lost bulb");
      this.peripheral_selected = peripheral;

      if (this.peripheral_selected.state != "connected") 
      {
        Noble.stopScanning();
        this.scanning = false;

        accessory.connect(function(error)
        {
          this.noble_connected(error, accessory);
        }.bind(this));
      }
    }
  } 
}

led_strip.prototype.noble_connected = function(error, accessory) 
{
  if (error){ return this.log.error("Noble connection failed: " + error); }
  this.log.debug("Connection success, discovering services");
  Noble.stopScanning();
  accessory.discoverServices([this.read_service, this.write_service], this.noble_services_discovered.bind(this));

  accessory.on('disconnect', function(error) 
  {
    this.noble_disconnected(error, accessory);
  }.bind(this));
}

led_strip.prototype.noble_services_discovered = function(error, services) 
{
  if (error){ return this.log.error("BLE services discovery failed: " + error); }
  for (var service of services) 
  {
    service.discoverCharacteristics([this.read_char, this.write_char], this.noble_characteristics_discovered.bind(this));
  }
}

led_strip.prototype.noble_characteristics_discovered = function(error, characteristics) 
{
  if (error){ return this.log.error("BLE characteristic discovery failed: " + error); }

  for (var characteristic of characteristics) 
  {
  	this.log.debug("Found Characteristic: " + characteristic.uuid);
  	
    if (characteristic.uuid == this.write_char) 
    {
      this.log.debug("Found Write Characteristic: " + characteristic.uuid);
      this.write_characteristic = characteristic;
    }
    if (characteristic.uuid == this.read_char) 
    {
      this.log.debug("Found Read Characteristic: " + characteristic.uuid);
      this.read_characteristic = characteristic;
    }
    if (this.read_characteristic != null && this.write_characteristic != null)
    {
      this.log.debug("Found all Characteristic. Stopping scan." );
      Noble.stopScanning();

      this.write_to_bulb("get_power_status", function()
      {});
      this.read_bulb(function(error) 
      {});
    }
  }
}

led_strip.prototype.start_scanning_with_timeout = function() 
{
  Noble.startScanning();

  setTimeout(function() 
  {
    if (Noble.listenerCount('discover') == 0) { return; }
    this.log.debug('Discovery timeout');
    Noble.stopScanning();
    this.scanning = false;
  }.bind(this), 12500);
}

led_strip.prototype.noble_disconnected = function(error, accessory) 
{
  this.log.debug("Disconnected from " + accessory.address + ": " + (error ? error : "(No error)"));
  this.read_characteristic = null;
  this.write_characteristic = null;
  accessory.removeAllListeners('disconnect');
  this.log.debug("Restarting BLE scan");
  Noble.startScanning([], false);
}

led_strip.prototype.noble_scan_stop =  function() 
{
  this.log.debug("Scan Stop received");
  this.scanning = false;
}

led_strip.prototype.stop_scanning = function() 
{
  Noble.removeListener('discover', this.noble_discovered.bind(this));

  if (Noble.listenerCount('discover') == 0) 
  {
    Noble.removeAllListeners('scanStop');
    Noble.stopScanning();
  }
}

led_strip.prototype.read_bulb = function(callback) 
{
  this.log.debug("Starting read from bulb");

  if (this.read_characteristic == null) 
  {
    this.log.info("Read Characteristic not yet found. Skipping..");
    callback(false);
    return;
  }

  this.read_characteristic.on('read', function(data, isNotification)
  {
    if (data != "") 
    {
      var red = data.readUInt8(6);
      var green = data.readUInt8(7);
      var blue = data.readUInt8(8);
      var hsv = this.rgb_2_hsv(red, green, blue);
      this.hue = hsv.hue;
      this.saturation = hsv.saturation;
      this.brightness = hsv.value;
      this.log.debug("Get: " + "rgb("+red+","+green+","+blue+") " + "= hsv("+hsv.hue+","+hsv.saturation+","+hsv.value+") " + ")");

      var power = data.readUIntBE(2, 1).toString(16);
      this.power_state = (power == '23') ? true : false;
    }
  }.bind(this));

  callback();
}

led_strip.prototype.write_to_bulb = function(type, callback) 
{
  this.log.debug("Starting write to bulb" );

  if (this.write_characteristic == null) 
  {
    this.log.warn("Characteristic not yet found. Skipping..");
    callback(false);
    return;
  }

  var rgb = this.hsv_2_rgb(this.hue, this.saturation, this.brightness);
  var hex = this.rgb_to_hex(rgb.red, rgb.green, rgb.blue);

  if (type == "set_device")
  { 
    var array = Uint8Array.from([0x56, hex.red, hex.green, hex.blue, 0x00, 0xF0, 0xAA]);
    const buff = Buffer.from(array);
    this.write_characteristic.write(buff, false);
  }
  
  if (type == "get_power_status")
  { 
    var array = Uint8Array.from([0xEF, 0x01, 0x77]);
    const buff = Buffer.from(array);
    this.write_characteristic.write(buff, false);
  }

  if (type == "set_power_status")
  { 
    var pwer_code = (this.power_state == true) ? 0x23 : 0x24;
    var array = Uint8Array.from([0xCC, pwer_code, 0x33]);
    const buff = Buffer.from(array);
    this.write_characteristic.write(buff, false);
  }

  callback();
}


led_strip.prototype.rgb_2_hsv = function(red, green, blue) 
{
  red /= 255;
  green /= 255;
  blue /= 255;

  let cmin = Math.min(red,green,blue),
  cmax = Math.max(red,green,blue),
  delta = cmax - cmin,
  h = 0,
  s = 0,
  v = 0;

  if (delta == 0)
  {
    h = 0;
  }
  else if (cmax == red)
  {
    h = ((green - blue) / delta) % 6;
  }
  else if (cmax == green)
  {
    h = (blue - red) / delta + 2;
  }
  else
  {
    h = (red - green) / delta + 4;
  }

  h = Math.round(h * 60);
    
  if (h < 0)
  {
    h += 360;
  }

  v = (cmax + cmin) / 2;

  s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * v - 1));

  s = +(s * 100).toFixed(1);
  v = +(v * 100).toFixed(1);

  return { 
    hue: h,
    saturation: s,
    value: v 
  };

}

led_strip.prototype.hsv_2_rgb = function(h, s, v) 
{
  var r, g, b;
  var i;
  var f, p, q, t;

  h = Math.max(0, Math.min(360, h));
  s = Math.max(0, Math.min(100, s));
  v = Math.max(0, Math.min(100, v));
  s /= 100;
  v /= 100;
   
  if(s == 0) 
  {
    r = g = b = v;
    return {
        red: Math.round(r * 255), 
        green: Math.round(g * 255), 
        blue: Math.round(b * 255)
    };
  }
   
  h /= 60;
  i = Math.floor(h);
  f = h - i;
  p = v * (1 - s);
  q = v * (1 - s * f);
  t = v * (1 - s * (1 - f));
   
  switch(i) 
  {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q;
  }
   
  return {
      red: Math.round(r * 255), 
      green: Math.round(g * 255), 
      blue: Math.round(b * 255)
  };
}

led_strip.prototype.rgb_to_hex = function(red,green,blue) 
{
  r = red.toString(16);
  g = green.toString(16);
  b = blue.toString(16);

  if (r.length == 1)
    r = "0" + r;
  if (g.length == 1)
    g = "0" + g;
  if (b.length == 1)
    b = "0" + b;

  return {
    red: r = "0x" + r,
    green: g = "0x" + g,
    blue: b = "0x" + b
  };
}