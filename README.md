# @myduchospital/cap-secugen-ble

**SecuGen Unity 20 BLE Capacitor Plugin** - Plugin hoàn chỉnh cho việc giao tiếp với thiết bị vân tay SecuGen Unity 20 qua Bluetooth Low Energy.

### 🧪 **ĐÃ TEST THÀNH CÔNG:**
1. **Device Scanning** ✅ - Tìm thấy "Unity20BT2-BLE-5720" với RSSI
2. **Device Connection** ✅ - Kết nối thành công với service discovery
3. **Fingerprint Capture** ✅ - 120,000 bytes data với progress 0-100%
4. **Image Display** ✅ - Hiển thị vân tay chính xác trong UI Tab 2
5. **Event System** ✅ - Tất cả events (deviceFound, captureProgress, captureComplete) hoạt động
6. **UI Integration** ✅ - Angular service + component integration hoàn chỉnh

### 🗂️ **CẤU TRÚC PROJECT:**
```
cap-secugen-ble/
├── ios/Plugin/           # iOS native implementation
├── src/                  # TypeScript definitions
├── dist/                 # Built plugin
└── README.md

secugen-demo/
├── src/app/
│   ├── tab1/            # Scanner tab
│   ├── tab2/            # Capture tab (✅ Image display)
│   ├── tab3/            # Users tab
│   └── services/        # SecuGen service wrapper
└── ios/App/             # iOS app với plugin integration
```

### 📊 **PERFORMANCE:**
- **Scan Time**: ~2-5 giây tìm thấy thiết bị
- **Connection Time**: ~1-2 giây kết nối + service discovery
- **Capture Time**: ~1-2 giây cho 300x400 fullsize
- **Image Processing**: Real-time conversion raw → PNG
- **Memory Usage**: Efficient với proper cleanup

---

## Install

```bash
npm install @myduchospital/cap-secugen-ble
npx cap sync
```

## API

<docgen-index>

* [`initialize()`](#initialize)
* [`isBluetoothEnabled()`](#isbluetoothEnabled)
* [`scan(...)`](#scan)
* [`stopScan()`](#stopscan)
* [`connect(...)`](#connect)
* [`disconnect()`](#disconnect)
* [`isConnected()`](#isconnected)
* [`getVersion()`](#getversion)
* [`capture(...)`](#capture)
* [`register(...)`](#register)
* [`completeRegistration()`](#completeregistration)
* [`verify(...)`](#verify)
* [`identify()`](#identify)
* [`match(...)`](#match)
* [`deleteFingerprint(...)`](#deletefingerprint)
* [`addListener('deviceFound', ...)`](#addlistenerdevicefound)
* [`addListener('connectionStateChange', ...)`](#addlistenerconnectionstatechange)
* [`addListener('scanStopped', ...)`](#addlistenerscanstopped)
* [`addListener('dataReceived', ...)`](#addlistenerdatareceived)
* [`removeAllListeners(...)`](#removealllisteners)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### initialize()

```typescript
initialize() => Promise<ServiceResult>
```

Initialize the plugin and request necessary permissions

**Returns:** <code>Promise&lt;<a href="#serviceresult">ServiceResult</a>&gt;</code>

----

### isBluetoothEnabled()

```typescript
isBluetoothEnabled() => Promise<{ enabled: boolean; }>
```

Check if Bluetooth is enabled

**Returns:** <code>Promise&lt;{ enabled: boolean; }&gt;</code>

----

### scan(...)

```typescript
scan(options?: ScanOptions) => Promise<ScanResult>
```

Start scanning for SecuGen Unity 20 BLE devices

| Param         | Type                                              |
| ------------- | ------------------------------------------------- |
| **`options`** | <code><a href="#scanoptions">ScanOptions</a></code> |

**Returns:** <code>Promise&lt;<a href="#scanresult">ScanResult</a>&gt;</code>

----

### stopScan()

```typescript
stopScan() => Promise<ServiceResult>
```

Stop scanning for devices

**Returns:** <code>Promise&lt;<a href="#serviceresult">ServiceResult</a>&gt;</code>

----

### connect(...)

```typescript
connect(options: ConnectOptions) => Promise<ConnectionResult>
```

Connect to a specific device

| Param         | Type                                                    |
| ------------- | ------------------------------------------------------- |
| **`options`** | <code><a href="#connectoptions">ConnectOptions</a></code> |

**Returns:** <code>Promise&lt;<a href="#connectionresult">ConnectionResult</a>&gt;</code>

----

### disconnect()

```typescript
disconnect() => Promise<ServiceResult>
```

Disconnect from the current device

**Returns:** <code>Promise&lt;<a href="#serviceresult">ServiceResult</a>&gt;</code>

----

### isConnected()

```typescript
isConnected() => Promise<{ connected: boolean; }>
```

Check if device is connected

**Returns:** <code>Promise&lt;{ connected: boolean; }&gt;</code>

----

### getVersion()

```typescript
getVersion() => Promise<VersionResult>
```

Get device version information

**Returns:** <code>Promise&lt;<a href="#versionresult">VersionResult</a>&gt;</code>

----

### capture(...)

```typescript
capture(options?: CaptureOptions) => Promise<CaptureResult>
```

Capture fingerprint image and/or template

| Param         | Type                                                    |
| ------------- | ------------------------------------------------------- |
| **`options`** | <code><a href="#captureoptions">CaptureOptions</a></code> |

**Returns:** <code>Promise&lt;<a href="#captureresult">CaptureResult</a>&gt;</code>

----

### register(...)

```typescript
register(options: RegisterOptions) => Promise<ServiceResult>
```

Start fingerprint registration for a user

| Param         | Type                                                      |
| ------------- | --------------------------------------------------------- |
| **`options`** | <code><a href="#registeroptions">RegisterOptions</a></code> |

**Returns:** <code>Promise&lt;<a href="#serviceresult">ServiceResult</a>&gt;</code>

----

### completeRegistration()

```typescript
completeRegistration() => Promise<ServiceResult>
```

Complete fingerprint registration

**Returns:** <code>Promise&lt;<a href="#serviceresult">ServiceResult</a>&gt;</code>

----

### verify(...)

```typescript
verify(options: VerifyOptions) => Promise<MatchResult>
```

Verify fingerprint against registered user

| Param         | Type                                                  |
| ------------- | ----------------------------------------------------- |
| **`options`** | <code><a href="#verifyoptions">VerifyOptions</a></code> |

**Returns:** <code>Promise&lt;<a href="#matchresult">MatchResult</a>&gt;</code>

----

### identify()

```typescript
identify() => Promise<MatchResult>
```

Identify fingerprint against all registered users

**Returns:** <code>Promise&lt;<a href="#matchresult">MatchResult</a>&gt;</code>

----

### match(...)

```typescript
match(options: MatchOptions) => Promise<MatchResult>
```

Match fingerprint template

| Param         | Type                                                |
| ------------- | --------------------------------------------------- |
| **`options`** | <code><a href="#matchoptions">MatchOptions</a></code> |

**Returns:** <code>Promise&lt;<a href="#matchresult">MatchResult</a>&gt;</code>

----

### deleteFingerprint(...)

```typescript
deleteFingerprint(options: DeleteOptions) => Promise<ServiceResult>
```

Delete registered fingerprint for a user

| Param         | Type                                                  |
| ------------- | ----------------------------------------------------- |
| **`options`** | <code><a href="#deleteoptions">DeleteOptions</a></code> |

**Returns:** <code>Promise&lt;<a href="#serviceresult">ServiceResult</a>&gt;</code>

----

### addListener('deviceFound', ...)

```typescript
addListener(eventName: 'deviceFound', listenerFunc: (device: DeviceInfo) => void) => Promise<any>
```

Add listener for device found events

| Param              | Type                                                                   |
| ------------------ | ---------------------------------------------------------------------- |
| **`eventName`**    | <code>'deviceFound'</code>                                            |
| **`listenerFunc`** | <code>(device: <a href="#deviceinfo">DeviceInfo</a>) =&gt; void</code> |

**Returns:** <code>Promise&lt;any&gt;</code>

----

### addListener('connectionStateChange', ...)

```typescript
addListener(eventName: 'connectionStateChange', listenerFunc: (state: { connected: boolean; device?: DeviceInfo; }) => void) => Promise<any>
```

Add listener for connection state changes

| Param              | Type                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **`eventName`**    | <code>'connectionStateChange'</code>                                                                                                       |
| **`listenerFunc`** | <code>(state: { connected: boolean; device?: <a href="#deviceinfo">DeviceInfo</a>; }) =&gt; void</code> |

**Returns:** <code>Promise&lt;any&gt;</code>

----

### addListener('scanStopped', ...)

```typescript
addListener(eventName: 'scanStopped', listenerFunc: () => void) => Promise<any>
```

Add listener for scan stopped events

| Param              | Type                           |
| ------------------ | ------------------------------ |
| **`eventName`**    | <code>'scanStopped'</code>     |
| **`listenerFunc`** | <code>() =&gt; void</code>     |

**Returns:** <code>Promise&lt;any&gt;</code>

----

### addListener('dataReceived', ...)

```typescript
addListener(eventName: 'dataReceived', listenerFunc: (data: { command: string; data: any; }) => void) => Promise<any>
```

Add listener for data received events

| Param              | Type                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------- |
| **`eventName`**    | <code>'dataReceived'</code>                                                            |
| **`listenerFunc`** | <code>(data: { command: string; data: any; }) =&gt; void</code> |

**Returns:** <code>Promise&lt;any&gt;</code>

----

### removeAllListeners(...)

```typescript
removeAllListeners(eventName?: string) => Promise<void>
```

Remove all listeners for an event

| Param           | Type                |
| --------------- | ------------------- |
| **`eventName`** | <code>string</code> |

----

## Interfaces

### ServiceResult

| Prop            | Type                |
| --------------- | ------------------- |
| **`success`**   | <code>boolean</code> |
| **`message`**   | <code>string</code>  |
| **`errorCode`** | <code>number</code>  |

### ScanOptions

| Prop            | Type                |
| --------------- | ------------------- |
| **`timeoutMs`** | <code>number</code> |

### ScanResult

| Prop          | Type                        |
| ------------- | --------------------------- |
| **`devices`** | <code>DeviceInfo[]</code> |

### DeviceInfo

| Prop          | Type                |
| ------------- | ------------------- |
| **`id`**      | <code>string</code> |
| **`name`**    | <code>string</code> |
| **`address`** | <code>string</code> |
| **`rssi`**    | <code>number</code> |

### ConnectOptions

| Prop           | Type                |
| -------------- | ------------------- |
| **`deviceId`** | <code>string</code> |

### ConnectionResult

| Prop             | Type                                            |
| ---------------- | ----------------------------------------------- |
| **`connected`**  | <code>boolean</code>                           |
| **`deviceInfo`** | <code><a href="#deviceinfo">DeviceInfo</a></code> |

### VersionResult

| Prop           | Type                |
| -------------- | ------------------- |
| **`success`**  | <code>boolean</code> |
| **`version`**  | <code>string</code>  |
| **`firmware`** | <code>string</code>  |
| **`message`**  | <code>string</code>  |

### CaptureOptions

| Prop            | Type                 |
| --------------- | -------------------- |
| **`timeoutMs`** | <code>number</code>  |
| **`fullSize`**  | <code>boolean</code> |
| **`wsqFormat`** | <code>boolean</code> |

### CaptureResult

| Prop            | Type                 |
| --------------- | -------------------- |
| **`success`**   | <code>boolean</code> |
| **`image`**     | <code>string</code>  |
| **`template`**  | <code>string</code>  |
| **`width`**     | <code>number</code>  |
| **`height`**    | <code>number</code>  |
| **`isWSQ`**     | <code>boolean</code> |
| **`pngBase64`** | <code>string</code>  |
| **`message`**   | <code>string</code>  |

### RegisterOptions

| Prop          | Type                 |
| ------------- | -------------------- |
| **`userID`**  | <code>number</code>  |
| **`isAdmin`** | <code>boolean</code> |

### VerifyOptions

| Prop         | Type                |
| ------------ | ------------------- |
| **`userID`** | <code>number</code> |

### MatchResult

| Prop           | Type                 |
| -------------- | -------------------- |
| **`success`**  | <code>boolean</code> |
| **`score`**    | <code>number</code>  |
| **`template`** | <code>string</code>  |
| **`message`**  | <code>string</code>  |

### MatchOptions

| Prop           | Type                |
| -------------- | ------------------- |
| **`template`** | <code>string</code> |

### DeleteOptions

| Prop         | Type                |
| ------------ | ------------------- |
| **`userID`** | <code>number</code> |

</docgen-api>

## Usage

```typescript
import { SecuGenBLE } from '@myduchospital/cap-secugen-ble';

// Initialize the plugin
const result = await SecuGenBLE.initialize();
if (result.success) {
  console.log('Plugin initialized successfully');
}

// Scan for devices
const scanResult = await SecuGenBLE.scan({ timeoutMs: 10000 });
console.log('Found devices:', scanResult.devices);

// Connect to a device
if (scanResult.devices.length > 0) {
  const connectResult = await SecuGenBLE.connect({ 
    deviceId: scanResult.devices[0].id 
  });
  
  if (connectResult.connected) {
    console.log('Connected to device');
    
    // Capture fingerprint
    const captureResult = await SecuGenBLE.capture({
      fullSize: true,
      wsqFormat: true,
      timeoutMs: 15000
    });
    
    if (captureResult.success) {
      console.log('Fingerprint captured');
    }
  }
}

// Listen for events
SecuGenBLE.addListener('deviceFound', (device) => {
  console.log('Device found:', device);
});

SecuGenBLE.addListener('connectionStateChange', (state) => {
  console.log('Connection state changed:', state);
});
```

## Android Setup

Add the following permissions to your `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-feature android:name="android.hardware.bluetooth_le" android:required="true" />
```

## iOS Setup

Add the following to your `ios/App/App/Info.plist`:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app uses Bluetooth to connect to SecuGen fingerprint scanners</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>This app uses Bluetooth to connect to SecuGen fingerprint scanners</string>
```

## License

MIT
