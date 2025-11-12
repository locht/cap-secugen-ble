//
//  SecuGenBLEPluginImpl.m
//  Simple Capacitor plugin implementation
//

#import "SecuGenBLEPlugin.h"

@implementation SecuGenFingerprint

- (void)load {
    [super load];

    // Initialize basic properties
    self.centralManager = [[CBCentralManager alloc] initWithDelegate:self queue:nil];
    self.isConnected = NO;
    self.isScanning = NO;

    NSLog(@"SecuGenBLEPlugin loaded successfully");
}

#pragma mark - Capacitor Plugin Methods

- (void)initialize:(CAPPluginCall *)call {
    NSLog(@"🔧 Initialize called - resolving with success");
    // MUST resolve promise like React Native does
    [call resolve:@{@"success": @YES, @"message": @"Plugin initialized"}];
    NSLog(@"🔧 Initialize resolved!");
}

- (void)isBluetoothEnabled:(CAPPluginCall *)call {
    NSLog(@"📱 isBluetoothEnabled called");

    // Same logic as React Native version
    if (!self.centralManager) {
        self.centralManager = [[CBCentralManager alloc] initWithDelegate:self queue:nil];
    }

    CBManagerState state = self.centralManager.state;
    BOOL isEnabled = (state == CBManagerStatePoweredOn);

    NSLog(@"📱 Bluetooth state: %ld, enabled: %@", (long)state, isEnabled ? @"YES" : @"NO");

    // If state is unknown, wait a bit and check again (like RN version)
    if (state == CBManagerStateUnknown) {
        NSLog(@"📱 State unknown, waiting 0.5s...");
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            CBManagerState newState = self.centralManager.state;
            BOOL newIsEnabled = (newState == CBManagerStatePoweredOn);
            NSLog(@"📱 After wait - state: %ld, enabled: %@", (long)newState, newIsEnabled ? @"YES" : @"NO");
            [call resolve:@{@"enabled": @(newIsEnabled)}];
            NSLog(@"📱 isBluetoothEnabled resolved (delayed)!");
        });
    } else {
        [call resolve:@{@"enabled": @(isEnabled)}];
        NSLog(@"📱 isBluetoothEnabled resolved immediately!");
    }
}

- (void)scan:(CAPPluginCall *)call {
    NSLog(@"🔍 Scan called");

    if (self.centralManager.state != CBManagerStatePoweredOn) {
        // Use resolve with error instead of reject
        [call resolve:@{@"success": @NO, @"message": @"Bluetooth is not powered on"}];
        return;
    }

    if (self.isScanning) {
        // Use resolve with error instead of reject
        [call resolve:@{@"success": @NO, @"message": @"Scan already in progress"}];
        return;
    }

    self.isScanning = YES;

    // Start scanning like React Native version
    [self.centralManager scanForPeripheralsWithServices:nil options:@{CBCentralManagerScanOptionAllowDuplicatesKey: @NO}];

    // Auto-stop after 15 seconds
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(15.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        if (self.isScanning) {
            [self stopScanInternal];
        }
    });

    [call resolve:@{@"success": @YES, @"message": @"Scan started"}];
    NSLog(@"🔍 Scan started successfully");
}

- (void)stopScan:(CAPPluginCall *)call {
    NSLog(@"🛑 Stop scan called");
    [self stopScanInternal];
    [call resolve:@{@"success": @YES, @"message": @"Scan stopped"}];
    NSLog(@"🛑 Stop scan resolved");
}

- (void)stopScanInternal {
    if (self.isScanning) {
        self.isScanning = NO;
        [self.centralManager stopScan];
        [self notifyListeners:@"scanStopped" data:@{@"reason": @"timeout"}];
        NSLog(@"🛑 Scan stopped internally");
    }
}

- (void)connect:(CAPPluginCall *)call {
    NSString *deviceId = [call.options objectForKey:@"deviceId"];
    NSLog(@"🔗 Connect called with deviceId: %@", deviceId);

    if (!deviceId) {
        [call resolve:@{@"success": @NO, @"message": @"Device ID is required"}];
        return;
    }

    if (self.isConnected) {
        [call resolve:@{@"success": @NO, @"message": @"Already connected to a device"}];
        return;
    }

    // Find peripheral by UUID (like React Native version)
    NSArray *peripherals = [self.centralManager retrievePeripheralsWithIdentifiers:@[[[NSUUID alloc] initWithUUIDString:deviceId]]];

    if (peripherals.count > 0) {
        CBPeripheral *peripheral = peripherals.firstObject;
        self.connectedPeripheral = peripheral;
        peripheral.delegate = self;

        [self.centralManager connectPeripheral:peripheral options:nil];

        [call resolve:@{
            @"connected": @YES,
            @"deviceInfo": @{
                @"id": deviceId,
                @"address": deviceId,
                @"name": peripheral.name ?: @"SecuGen Unity 20"
            }
        }];

        NSLog(@"🔗 Connection initiated to: %@", peripheral.name);
    } else {
        [call resolve:@{@"success": @NO, @"message": @"Device not found"}];
        NSLog(@"🔗 Device not found: %@", deviceId);
    }
}

- (void)disconnect:(CAPPluginCall *)call {
    NSLog(@"disconnect called");
}

- (void)isConnected:(CAPPluginCall *)call {
    NSLog(@"isConnected called");
}

- (void)capture:(CAPPluginCall *)call {
    NSLog(@"📸 Capture called");

    if (!self.connectedPeripheral || !self.writeCharacteristic) {
        [call resolve:@{@"success": @NO, @"message": @"Device not connected"}];
        return;
    }

    // Get parameters with support for different size options
    BOOL fullSize = [[call.options objectForKey:@"fullSize"] boolValue];
    NSString *sizeOption = [call.options objectForKey:@"sizeOption"] ?: @"full";
    
    NSLog(@"📏 Capture parameters - fullSize: %@, sizeOption: %@", fullSize ? @"YES" : @"NO", sizeOption);

    // Initialize capture state (like SDK)
    self.ImageData = [[NSMutableData alloc] init];
    self.total_receive_size = 0;
    self.remaining_data_size = 0;
    self.isWSQ = NO;
    self.currentCommand = 0x43; // CMD_GET_IMAGE

    // Send FP capture command (EXACT SDK logic)
    unsigned char cmd[12] = {0x4E, 0x43, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00};

    // Set size parameter - only use device's native sizes (0x01 and 0x02)
    // For custom sizes, we'll capture appropriate base size and scale it later
    int width, height, originalWidth, originalHeight;
    if ([sizeOption isEqualToString:@"tiny"]) {
        cmd[2] = 0x02; // Use half size from device, scale to 60x80
        self.imgsize = 2;
        originalWidth = 150;
        originalHeight = 200;
        width = 60;  // Target size after scaling
        height = 80;
    } else if ([sizeOption isEqualToString:@"small"]) {
        cmd[2] = 0x02; // Use half size from device, scale to 90x120
        self.imgsize = 2;
        originalWidth = 150;
        originalHeight = 200;
        width = 90;  // Target size after scaling
        height = 120;
    } else if ([sizeOption isEqualToString:@"half"] || (!fullSize && [sizeOption isEqualToString:@"full"])) {
        cmd[2] = 0x02; // Half size
        self.imgsize = 2;
        originalWidth = width = 150;
        originalHeight = height = 200;
    } else {
        cmd[2] = 0x01; // Full size (default)
        self.imgsize = 1;
        originalWidth = width = 300;
        originalHeight = height = 400;
    }
    
    // Store the target size for later use
    self.targetWidth = width;
    self.targetHeight = height;
    self.originalWidth = originalWidth;
    self.originalHeight = originalHeight;
    self.needsScaling = ![sizeOption isEqualToString:@"full"] && ![sizeOption isEqualToString:@"half"];

    NSLog(@"📏 Device capture size: %dx%d (imgsize: %d, cmd[2]: 0x%02X), Target size: %dx%d, Needs scaling: %@", 
          originalWidth, originalHeight, self.imgsize, cmd[2], width, height, self.needsScaling ? @"YES" : @"NO");

    // Calculate checksum like SDK
    unsigned char checksum = 0;
    for (int i = 0; i < 11; i++) {
        checksum += cmd[i];
    }
    cmd[11] = checksum;

    // Send command
    NSData *commandData = [NSData dataWithBytes:cmd length:12];
    [self.connectedPeripheral writeValue:commandData
                       forCharacteristic:self.writeCharacteristic
                                    type:CBCharacteristicWriteWithResponse];

    // Start monitoring like React Native version
    [self startFingerMonitoringOnce];

    [call resolve:@{
        @"success": @YES,
        @"message": @"Capture initiated",
        @"width": @(width),
        @"height": @(height),
        @"fullSize": @(fullSize)
    }];

    NSLog(@"📸 Capture command sent (fullSize: %@)", fullSize ? @"YES" : @"NO");
}

- (void)getVersion:(CAPPluginCall *)call {
    NSLog(@"getVersion called");
}

- (void)register:(CAPPluginCall *)call {
    NSLog(@"register called");
}

- (void)completeRegistration:(CAPPluginCall *)call {
    NSLog(@"completeRegistration called");
}

- (void)verify:(CAPPluginCall *)call {
    NSLog(@"verify called");
}

- (void)identify:(CAPPluginCall *)call {
    NSLog(@"identify called");
}

- (void)match:(CAPPluginCall *)call {
    NSLog(@"match called");
}

- (void)deleteFingerprint:(CAPPluginCall *)call {
    NSLog(@"deleteFingerprint called");
}

- (void)setPowerOffTime:(CAPPluginCall *)call {
    NSLog(@"⚡ setPowerOffTime called");
    
    NSNumber *timeoutMinutes = [call.options objectForKey:@"timeoutMinutes"] ?: @30;
    
    if (!self.connectedPeripheral || !self.writeCharacteristic) {
        [call resolve:@{@"success": @NO, @"message": @"Device not connected"}];
        return;
    }
    
    // Create FMS packet for CMD_SET_POWER_OFF_TIME (0xF7)
    FMSPacket *packet = [[FMSPacket alloc] init];
    uint8_t *packetBytes = [packet getPacketWithCommand:0xF7 
                                              withParam1:[timeoutMinutes unsignedShortValue] 
                                              withParam2:0x00 
                                            withDataSize:0x00];
    
    NSData *packetData = [NSData dataWithBytes:packetBytes length:12]; // FMS packet header is 12 bytes
    
    // Send command
    [self.connectedPeripheral writeValue:packetData 
                       forCharacteristic:self.writeCharacteristic 
                                    type:CBCharacteristicWriteWithResponse];
    
    // Store call for response
    self.currentCall = call;
    
    [call resolve:@{
        @"success": @YES,
        @"message": [NSString stringWithFormat:@"Power off time set to %@ minutes", timeoutMinutes]
    }];
    
    NSLog(@"📤 Power off time command sent: %@ minutes", timeoutMinutes);
}

#pragma mark - CBCentralManagerDelegate

- (void)centralManagerDidUpdateState:(CBCentralManager *)central {
    NSLog(@"🔵 Bluetooth state updated: %ld", (long)central.state);

    // Notify JS about state change like React Native does
    NSString *stateString = @"unknown";
    BOOL isEnabled = NO;

    switch (central.state) {
        case CBManagerStatePoweredOn:
            stateString = @"poweredOn";
            isEnabled = YES;
            break;
        case CBManagerStatePoweredOff:
            stateString = @"poweredOff";
            break;
        case CBManagerStateResetting:
            stateString = @"resetting";
            break;
        case CBManagerStateUnauthorized:
            stateString = @"unauthorized";
            break;
        case CBManagerStateUnsupported:
            stateString = @"unsupported";
            break;
        case CBManagerStateUnknown:
        default:
            stateString = @"unknown";
            break;
    }

    NSLog(@"🔵 Bluetooth state: %@ (enabled: %@)", stateString, isEnabled ? @"YES" : @"NO");

    // Notify listeners about state change
    [self notifyListeners:@"connectionStateChange" data:@{
        @"bluetoothEnabled": @(isEnabled),
        @"state": stateString
    }];
}

- (void)centralManager:(CBCentralManager *)central
 didDiscoverPeripheral:(CBPeripheral *)peripheral
     advertisementData:(NSDictionary<NSString *,id> *)advertisementData
                  RSSI:(NSNumber *)RSSI {

    NSString *deviceName = peripheral.name ?: @"Unknown Device";
    NSString *localName = advertisementData[CBAdvertisementDataLocalNameKey] ?: @"";

    NSLog(@"🔍 Discovered device: %@ (RSSI: %@)", deviceName, RSSI);

    // Check for SecuGen Unity 20 devices (like React Native version)
    BOOL isSecuGenDevice = NO;

    // Check device name
    if ([deviceName containsString:@"Unity"] || [deviceName containsString:@"SecuGen"] ||
        [localName containsString:@"Unity"] || [localName containsString:@"SecuGen"]) {
        isSecuGenDevice = YES;
    }

    // Check for SecuGen service UUID in advertisement
    NSArray *serviceUUIDs = advertisementData[CBAdvertisementDataServiceUUIDsKey];
    if (serviceUUIDs) {
        for (CBUUID *uuid in serviceUUIDs) {
            if ([uuid.UUIDString.uppercaseString containsString:@"FDA0"]) {
                isSecuGenDevice = YES;
                break;
            }
        }
    }

    // Show SecuGen devices or devices with names for debugging
    if (isSecuGenDevice || (deviceName && ![deviceName isEqualToString:@"Unknown Device"] && deviceName.length > 0)) {
        NSDictionary *deviceInfo = @{
            @"id": peripheral.identifier.UUIDString,
            @"address": peripheral.identifier.UUIDString,
            @"name": deviceName.length > 0 ? deviceName : localName,
            @"rssi": RSSI,
            @"isSecuGen": @(isSecuGenDevice)
        };

        [self notifyListeners:@"deviceFound" data:deviceInfo];
        NSLog(@"🔍 Device found event sent: %@ (SecuGen: %@)", deviceName, isSecuGenDevice ? @"YES" : @"NO");
    }
}

- (void)centralManager:(CBCentralManager *)central didConnectPeripheral:(CBPeripheral *)peripheral {
    NSLog(@"🔗 Connected to peripheral: %@", peripheral.identifier);

    self.isConnected = YES;
    self.connectedPeripheral = peripheral;
    peripheral.delegate = self;

    // Start discovering services (like React Native version)
    CBUUID *serviceUUID = [CBUUID UUIDWithString:@"0000FDA0-0000-1000-8000-00805F9B34FB"];
    [peripheral discoverServices:@[serviceUUID]];

    NSDictionary *connectionState = @{
        @"connected": @YES,
        @"device": @{
            @"id": peripheral.identifier.UUIDString,
            @"address": peripheral.identifier.UUIDString,
            @"name": peripheral.name ?: @"SecuGen Unity 20"
        }
    };
    [self notifyListeners:@"connectionStateChange" data:connectionState];
}

- (void)centralManager:(CBCentralManager *)central didDisconnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error {
    NSLog(@"🔗 Disconnected from peripheral: %@ (error: %@)", peripheral.identifier, error);

    self.isConnected = NO;
    self.connectedPeripheral = nil;
    self.writeCharacteristic = nil;
    self.notifyCharacteristic = nil;

    [self notifyListeners:@"connectionStateChange" data:@{@"connected": @NO}];
}

- (void)centralManager:(CBCentralManager *)central didFailToConnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error {
    NSLog(@"🔗 Failed to connect to peripheral: %@ (error: %@)", peripheral.identifier, error);

    self.isConnected = NO;
    self.connectedPeripheral = nil;

    [self notifyListeners:@"connectionStateChange" data:@{
        @"connected": @NO,
        @"error": error.localizedDescription
    }];
}

#pragma mark - CBPeripheralDelegate

- (void)peripheral:(CBPeripheral *)peripheral didDiscoverServices:(NSError *)error {
    if (error) {
        NSLog(@"🔗 Error discovering services: %@", error);
        return;
    }

    NSLog(@"🔗 Discovered %lu services", (unsigned long)peripheral.services.count);

    for (CBService *service in peripheral.services) {
        NSLog(@"🔗 Service UUID: %@", service.UUID);
        if ([service.UUID.UUIDString.uppercaseString containsString:@"FDA0"]) {
            // Discover characteristics for SecuGen service
            CBUUID *writeUUID = [CBUUID UUIDWithString:@"00002BB2-0000-1000-8000-00805F9B34FB"];
            CBUUID *notifyUUID = [CBUUID UUIDWithString:@"00002BB1-0000-1000-8000-00805F9B34FB"];
            [peripheral discoverCharacteristics:@[writeUUID, notifyUUID] forService:service];
        }
    }
}

- (void)peripheral:(CBPeripheral *)peripheral didDiscoverCharacteristicsForService:(CBService *)service error:(NSError *)error {
    if (error) {
        NSLog(@"🔗 Error discovering characteristics: %@", error);
        return;
    }

    NSLog(@"🔗 Discovered %lu characteristics for service %@", (unsigned long)service.characteristics.count, service.UUID);

    for (CBCharacteristic *characteristic in service.characteristics) {
        NSLog(@"🔗 Characteristic UUID: %@", characteristic.UUID);

        if ([characteristic.UUID.UUIDString.uppercaseString containsString:@"2BB2"]) {
            // Write characteristic
            self.writeCharacteristic = characteristic;
            NSLog(@"🔗 Found write characteristic");
        } else if ([characteristic.UUID.UUIDString.uppercaseString containsString:@"2BB1"]) {
            // Notify characteristic
            self.notifyCharacteristic = characteristic;
            [peripheral setNotifyValue:YES forCharacteristic:characteristic];
            NSLog(@"🔗 Found notify characteristic and enabled notifications");
        }
    }

    if (self.writeCharacteristic && self.notifyCharacteristic) {
        [self notifyListeners:@"serviceDiscovered" data:@{}];
        NSLog(@"🔗 SecuGen service setup complete!");
    }
}

- (void)peripheral:(CBPeripheral *)peripheral didUpdateValueForCharacteristic:(CBCharacteristic *)characteristic error:(NSError *)error {
    if (error) {
        NSLog(@"🔗 Error updating characteristic value: %@", error);
        return;
    }

    if ([characteristic.UUID.UUIDString.uppercaseString containsString:@"2BB1"]) {
        NSData *data = characteristic.value;
        if (data) {
//             NSLog(@"📡 Received data: %lu bytes", (unsigned long)data.length);
            // Process data like React Native version
            [self handleReceivedData:data];
        }
    }
}

#pragma mark - Data Processing (from React Native version)

- (void)handleReceivedData:(NSData *)data {
    const unsigned char *bytes = [data bytes];
    NSUInteger length = [data length];

    // Check if this is a command response (12 bytes) or image data
    if (length == 12 && bytes[0] == 0x4E && bytes[1] == 0x43) {
        // This is command response - handle like React Native
        [self handleCommandResponse:data];
    } else if (length > 12) {
        // This is image data - use SDK logic
        [self handleImageData:data];
    } else {
        // Send raw data event
        NSDictionary *dataEvent = @{
            @"command": @"data_received",
            @"data": [data base64EncodedStringWithOptions:0]
        };
        [self notifyListeners:@"dataReceived" data:dataEvent];
    }
}

- (void)handleCommandResponse:(NSData *)responseData {
    const unsigned char *bytes = [responseData bytes];

    // Parse command and error (like React Native version)
    uint16_t command = bytes[1]; // Command is at byte 1
    uint8_t error = bytes[4];

    self.currentCommand = command;

    NSLog(@"📋 Command response: 0x%02X, Error: 0x%02X", command, error);

    switch (command) {
        case 0x43: // CMD_GET_IMAGE
            {
                if (error == 0x00) { // ERR_NONE
                    // Parse data size from response (bytes 6-9)
                    uint32_t dataSize = bytes[6] | (bytes[7] << 8) | (bytes[8] << 16) | (bytes[9] << 24);

                    if (dataSize > 0) {
                        self.remaining_data_size = dataSize;
                        self.total_receive_size = 0;
                        [self.ImageData setLength:0];

                        // Check WSQ flag (simplified)
                        self.isWSQ = (bytes[5] & 0x01) ? YES : NO;

                        NSLog(@"📸 Starting image capture: %d bytes, WSQ: %@", dataSize, self.isWSQ ? @"YES" : @"NO");

                        // Start reading image data
                        [self.connectedPeripheral readValueForCharacteristic:self.notifyCharacteristic];

                        // Notify progress
                        [self notifyListeners:@"captureProgress" data:@{
                            @"status": @"capturing",
                            @"message": @"Place finger on sensor",
                            @"progress": @0
                        }];
                    } else {
                        NSLog(@"👆 Device ready for fingerprint - Place finger on sensor!");
                        [self notifyListeners:@"captureProgress" data:@{
                            @"status": @"ready",
                            @"message": @"Place finger on sensor"
                        }];
                    }
                } else {
                    NSLog(@"❌ Capture failed with Error: 0x%02X", error);
                    [self notifyListeners:@"captureProgress" data:@{
                        @"status": @"error",
                        @"message": [NSString stringWithFormat:@"Capture failed (Error: 0x%02X)", error]
                    }];
                }
            }
            break;
        default:
            NSLog(@"🔥 Other command: 0x%02X", command);
            break;
    }
}

- (void)handleImageData:(NSData *)imageData {
    // EXACT SDK logic from React Native
    self.remaining_data_size -= imageData.length;
    self.total_receive_size += imageData.length;

    // Calculate progress percentage
    int totalExpected = self.total_receive_size + self.remaining_data_size;
    int progressPercent = totalExpected > 0 ? (int)((float)self.total_receive_size / totalExpected * 100) : 0;

//     NSLog(@"📊 Progress: %d%% (%d/%d bytes)", progressPercent, self.total_receive_size, totalExpected);

    // Notify progress every 10%
    static int lastPercent = -1;
    if (progressPercent != lastPercent && progressPercent % 10 == 0) {
        lastPercent = progressPercent;
        [self notifyListeners:@"captureProgress" data:@{
            @"status": @"downloading",
            @"progress": @(progressPercent),
            @"message": [NSString stringWithFormat:@"Downloading image... %d%%", progressPercent]
        }];
    }

    if (imageData.length != 0) {
        if (self.currentCommand == 0x43) { // CMD_GET_IMAGE
            // Append image data
            [self.ImageData appendBytes:[imageData bytes] length:[imageData length]];
        }
    }

    // Continue reading if more data expected
    if (self.remaining_data_size > 0) {
        [self.connectedPeripheral readValueForCharacteristic:self.notifyCharacteristic];
    } else {
        // Image complete - process it
        [self processCompleteImage];
    }
}

- (void)processCompleteImage {
    NSLog(@"🖼️ Processing complete image: %d bytes", self.total_receive_size);

    NSData *finalImageData = self.ImageData;
    int finalWidth = self.originalWidth;
    int finalHeight = self.originalHeight;
    
    // If scaling is needed (for tiny size), scale down the image
    if (self.needsScaling) {
        NSLog(@"📏 Scaling image from %dx%d to %dx%d", self.originalWidth, self.originalHeight, self.targetWidth, self.targetHeight);
        finalImageData = [self scaleImageData:self.ImageData 
                                   fromWidth:self.originalWidth 
                                  fromHeight:self.originalHeight 
                                     toWidth:self.targetWidth 
                                    toHeight:self.targetHeight];
        finalWidth = self.targetWidth;
        finalHeight = self.targetHeight;
    }

    // Convert final image data to base64
    NSString *imageBase64 = [finalImageData base64EncodedStringWithOptions:0];

    [self notifyListeners:@"captureComplete" data:@{
        @"success": @YES,
        @"imageData": imageBase64,
        @"width": @(finalWidth),
        @"height": @(finalHeight),
        @"isWSQ": @(self.isWSQ),
        @"size": @(finalImageData.length),
        @"message": @"Fingerprint captured successfully"
    }];

    [self notifyListeners:@"captureProgress" data:@{
        @"status": @"complete",
        @"progress": @100,
        @"message": @"Capture complete"
    }];

    NSLog(@"✅ Capture complete: %dx%d, %d bytes, WSQ: %@", finalWidth, finalHeight, (int)finalImageData.length, self.isWSQ ? @"YES" : @"NO");
}

- (void)startFingerMonitoringOnce {
    // Simple monitoring without infinite retry loop (like React Native)
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        if (self.connectedPeripheral && self.notifyCharacteristic) {
            NSLog(@"🔄 Starting finger monitoring - reading characteristic");
            [self.connectedPeripheral readValueForCharacteristic:self.notifyCharacteristic];
        } else {
            NSLog(@"❌ Cannot start monitoring - peripheral or characteristic not ready");
        }
    });
}

#pragma mark - Image Scaling

- (NSData *)scaleImageData:(NSData *)imageData fromWidth:(int)fromWidth fromHeight:(int)fromHeight toWidth:(int)toWidth toHeight:(int)toHeight {
    // Simple nearest neighbor scaling for grayscale image data
    const unsigned char *sourceBytes = [imageData bytes];
    NSMutableData *scaledData = [NSMutableData dataWithCapacity:toWidth * toHeight];
    
    float xRatio = (float)fromWidth / toWidth;
    float yRatio = (float)fromHeight / toHeight;
    
    for (int y = 0; y < toHeight; y++) {
        for (int x = 0; x < toWidth; x++) {
            int sourceX = (int)(x * xRatio);
            int sourceY = (int)(y * yRatio);
            
            // Ensure we don't go out of bounds
            if (sourceX >= fromWidth) sourceX = fromWidth - 1;
            if (sourceY >= fromHeight) sourceY = fromHeight - 1;
            
            int sourceIndex = sourceY * fromWidth + sourceX;
            if (sourceIndex < imageData.length) {
                unsigned char pixel = sourceBytes[sourceIndex];
                [scaledData appendBytes:&pixel length:1];
            } else {
                // If out of bounds, use black pixel
                unsigned char blackPixel = 0;
                [scaledData appendBytes:&blackPixel length:1];
            }
        }
    }
    
    NSLog(@"📏 Scaled image from %dx%d (%lu bytes) to %dx%d (%lu bytes)", 
          fromWidth, fromHeight, (unsigned long)imageData.length,
          toWidth, toHeight, (unsigned long)scaledData.length);
    
    return scaledData;
}

@end
