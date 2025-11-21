package com.myduchospital.plugins.secugenble;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import com.secugen.fmssdk.FMSAPI;
import com.secugen.fmssdk.FMSImage;
import com.secugen.fmssdk.FMSImageSave;
import com.secugen.fmssdk.FMSHeader;
import com.secugen.fmssdk.FMSData;
import com.secugen.u20_bt_android_ble_demo.DeviceControlActivity;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@CapacitorPlugin(
    name = "SecuGenBLE",
    permissions = {
        @Permission(strings = { Manifest.permission.BLUETOOTH }, alias = "bluetooth"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_ADMIN }, alias = "bluetoothAdmin"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bluetoothConnect"),
        @Permission(strings = { Manifest.permission.BLUETOOTH_SCAN }, alias = "bluetoothScan"),
        @Permission(strings = { Manifest.permission.ACCESS_FINE_LOCATION }, alias = "location"),
        @Permission(strings = { Manifest.permission.ACCESS_COARSE_LOCATION }, alias = "coarseLocation")
    }
)
public class SecuGenBLEPlugin extends Plugin {

    private static final String TAG = "SecuGenBLEPlugin";
    
    // SecuGen Unity 20 BLE UUIDs (Revision 2)
    private static final String SERVICE_UUID = "0000FDA0-0000-1000-8000-00805F9B34FB";
    private static final String WRITE_CHARACTERISTIC_UUID = "00002BB2-0000-1000-8000-00805F9B34FB";
    private static final String NOTIFY_CHARACTERISTIC_UUID = "00002BB1-0000-1000-8000-00805F9B34FB";
    private static final String CLIENT_CHARACTERISTIC_CONFIG = "00002902-0000-1000-8000-00805f9b34fb";
    private static final byte CMD_GET_TEMPLATE = 0x40;
    private static final byte CMD_SET_POWER_OFF_TIME = (byte) 0xF7;
    private static final int REQUEST_MTU_SIZE = 301;
    
    // Bluetooth components
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeScanner bluetoothLeScanner;
    private BluetoothGatt bluetoothGatt;
    private BluetoothGattCharacteristic writeCharacteristic;
    private BluetoothGattCharacteristic notifyCharacteristic;
    
    // Connection state
    private boolean isConnected = false;
    private boolean isScanning = false;
    private String connectedDeviceAddress;
    private Handler mainHandler;
    
    // SecuGen SDK data management for capture
    private byte[] imageBuffer;
    private int remainingDataSize = 0;
    private int totalReceiveSize = 0;
    private boolean isCapturingImage = false;
    private long captureStartTime = 0;
    private boolean isCurrentCaptureWSQ = false;

    // Track current capture call and expected image size
    private PluginCall currentCaptureCall;
    private boolean captureFullSize = true;
    private int captureWidth = 300;
    private int captureHeight = 400;

    // Generic command tracking (register/verify/identify)
    private PluginCall currentCommandCall;
    private byte currentCommandCode = 0x00;

    // Template transfer state (CMD_GET_TEMPLATE)
    private byte[] templateBuffer;
    private int remainingTemplateSize = 0;
    private int totalTemplateSize = 0;
    private boolean isReceivingTemplate = false;
    private PluginCall currentTemplateCall;
    
    // Scan results
    private List<BluetoothDevice> scannedDevices = new ArrayList<>();

    @Override
    public void load() {
        super.load();
        this.mainHandler = new Handler(Looper.getMainLooper());
        initializeBluetooth();
    }

    private void initializeBluetooth() {
        final BluetoothManager bluetoothManager = 
            (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        
        if (bluetoothManager != null) {
            bluetoothAdapter = bluetoothManager.getAdapter();
            if (bluetoothAdapter != null) {
                bluetoothLeScanner = bluetoothAdapter.getBluetoothLeScanner();
            }
        }
        
        Log.d(TAG, "SecuGen BLE Plugin initialized");
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        if (bluetoothAdapter == null) {
            call.reject("Bluetooth not supported on this device");
            return;
        }

        // Check and request permissions
        if (!hasRequiredPermissions()) {
            requestAllPermissions(call, "permissionCallback");
            return;
        }

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("message", "SecuGen BLE Plugin initialized successfully");
        call.resolve(result);
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (hasRequiredPermissions()) {
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Permissions granted");
            call.resolve(result);
        } else {
            call.reject("Required permissions not granted");
        }
    }

    @Override
    public boolean hasRequiredPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return hasPermission(Manifest.permission.BLUETOOTH_SCAN) &&
                   hasPermission(Manifest.permission.BLUETOOTH_CONNECT) &&
                   hasPermission(Manifest.permission.ACCESS_FINE_LOCATION);
        } else {
            return hasPermission(Manifest.permission.BLUETOOTH) &&
                   hasPermission(Manifest.permission.BLUETOOTH_ADMIN) &&
                   hasPermission(Manifest.permission.ACCESS_FINE_LOCATION);
        }
    }

    @PluginMethod
    public void isBluetoothEnabled(PluginCall call) {
        JSObject result = new JSObject();
        boolean enabled = bluetoothAdapter != null && bluetoothAdapter.isEnabled();
        result.put("enabled", enabled);
        call.resolve(result);
    }

    @PluginMethod
    public void scan(PluginCall call) {
        if (!hasRequiredPermissions()) {
            call.reject("Missing required permissions");
            return;
        }

        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            call.reject("Bluetooth not available");
            return;
        }

        if (isScanning) {
            call.reject("Scan already in progress");
            return;
        }

        scannedDevices.clear();
        isScanning = true;

        ScanCallback scanCallback = new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult result) {
                BluetoothDevice device = result.getDevice();
                if (device != null && !scannedDevices.contains(device)) {
                    // Filter for SecuGen devices
                    String deviceName = getDeviceName(device);
                    if (deviceName != null && (deviceName.contains("Unity") || deviceName.contains("SecuGen"))) {
                        scannedDevices.add(device);
                        
                        // Notify about found device
                        JSObject deviceInfo = createDeviceInfo(device, result.getRssi());
                        notifyListeners("deviceFound", deviceInfo);
                    }
                }
            }

            @Override
            public void onScanFailed(int errorCode) {
                isScanning = false;
                Log.e(TAG, "Scan failed with error: " + errorCode);
            }
        };

        bluetoothLeScanner.startScan(scanCallback);

        // Auto-stop scan after timeout
        int timeoutMs = call.getInt("timeoutMs", 10000);
        mainHandler.postDelayed(() -> {
            if (isScanning) {
                bluetoothLeScanner.stopScan(scanCallback);
                isScanning = false;
                notifyListeners("scanStopped", new JSObject());
            }
        }, timeoutMs);

        // Return current results
        JSObject result = new JSObject();
        JSArray devices = new JSArray();
        for (BluetoothDevice device : scannedDevices) {
            devices.put(createDeviceInfo(device, 0));
        }
        result.put("devices", devices);
        call.resolve(result);
    }

    @PluginMethod
    public void stopScan(PluginCall call) {
        if (isScanning && bluetoothLeScanner != null) {
            // Note: We need to keep reference to the callback to stop it properly
            // For now, we'll rely on the timeout mechanism
            isScanning = false;
        }
        
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("message", "Scan stopped");
        call.resolve(result);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String deviceId = call.getString("deviceId");
        if (deviceId == null) {
            call.reject("Device ID is required");
            return;
        }

        if (isConnected) {
            call.reject("Already connected to a device");
            return;
        }

        BluetoothDevice device = bluetoothAdapter.getRemoteDevice(deviceId);
        if (device == null) {
            call.reject("Device not found");
            return;
        }

        BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
            @Override
            public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    Log.d(TAG, "Connected to GATT server, requesting MTU");
                    isConnected = true;
                    connectedDeviceAddress = device.getAddress();
                    bluetoothGatt = gatt;

                    gatt.requestMtu(REQUEST_MTU_SIZE);
                    
                    JSObject connectionState = new JSObject();
                    connectionState.put("connected", true);
                    connectionState.put("device", createDeviceInfo(device, 0));
                    notifyListeners("connectionStateChange", connectionState);
                    
                } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                    Log.d(TAG, "Disconnected from GATT server");
                    isConnected = false;
                    connectedDeviceAddress = null;
                    bluetoothGatt = null;
                    
                    JSObject connectionState = new JSObject();
                    connectionState.put("connected", false);
                    notifyListeners("connectionStateChange", connectionState);
                }
            }

            @Override
            public void onServicesDiscovered(BluetoothGatt gatt, int status) {
                if (status == BluetoothGatt.GATT_SUCCESS) {
                    Log.d(TAG, "Services discovered");
                    setupCharacteristics(gatt);
                }
            }

            @Override
            public void onMtuChanged(BluetoothGatt gatt, int mtu, int status) {
                if (status == BluetoothGatt.GATT_SUCCESS) {
                    Log.d(TAG, "MTU changed to " + mtu + ", discovering services");
                    gatt.discoverServices();
                } else {
                    Log.d(TAG, "MTU change failed with status: " + status);
                    gatt.discoverServices();
                }
            }

            @Override
            public void onCharacteristicRead(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, int status) {
                if (status == BluetoothGatt.GATT_SUCCESS) {
                    handleDataReceived(characteristic.getValue());
                } else {
                    Log.d(TAG, "onCharacteristicRead failed with status: " + status);
                }
            }

            @Override
            public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic) {
                byte[] value = characteristic.getValue();

                // Mirror SDK behavior: a 12-byte packet starting with 'N' (0x4E)
                // is a notify trigger, and we must explicitly read the data
                if (value != null
                        && value.length == FMSAPI.PACKET_HEADER_SIZE
                        && value[0] == 0x4E
                        && notifyCharacteristic != null
                        && bluetoothGatt != null) {
                    requestNextChunk();
                    return;
                }

                handleDataReceived(value);
            }
        };

        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Missing BLUETOOTH_CONNECT permission");
            return;
        }
        
        device.connectGatt(getContext(), false, gattCallback);

        JSObject result = new JSObject();
        result.put("connected", true);
        result.put("deviceInfo", createDeviceInfo(device, 0));
        call.resolve(result);
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        if (bluetoothGatt != null) {
            if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                call.reject("Missing BLUETOOTH_CONNECT permission");
                return;
            }
            bluetoothGatt.disconnect();
            bluetoothGatt.close();
            bluetoothGatt = null;
        }
        
        isConnected = false;
        connectedDeviceAddress = null;
        
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("message", "Disconnected");
        call.resolve(result);
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        JSObject result = new JSObject();
        result.put("connected", isConnected);
        call.resolve(result);
    }

    @PluginMethod
    public void capture(PluginCall call) {
        if (!isConnected) {
            call.reject("Device not connected");
            return;
        }

        // For performance and BLE throughput, always request half-size image (150x200)
        // and enable WSQ compression like iOS implementation
        boolean fullSize = false;

        this.captureFullSize = fullSize;
        captureWidth = 150;
        captureHeight = 200;

        // Reset capture state
        remainingDataSize = 0;
        totalReceiveSize = 0;
        isCapturingImage = false;
        isCurrentCaptureWSQ = true; // we will request WSQ image
        captureStartTime = System.currentTimeMillis();
        currentCaptureCall = null; // iOS: capture call is resolved immediately, image delivered via events

        // Allocate buffer large enough for max image size (header + data)
        int maxSize = FMSAPI.PACKET_HEADER_SIZE + FMSImage.IMG_SIZE_MAX + 1;
        if (imageBuffer == null || imageBuffer.length < maxSize) {
            imageBuffer = new byte[maxSize];
        }

        // Build capture command using FMSAPI with WSQ enabled - always half-size
        byte sizeFlag = FMSAPI.IMAGE_SIZE_HALF;
        byte[] captureCommand = FMSAPI.cmdFPCaptureUseWSQ(sizeFlag);
        sendCommand(captureCommand);

        // Mirror iOS behavior: resolve immediately with capture parameters;
        // the actual image will be delivered via captureProgress/captureComplete events.
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("message", "Capture initiated");
        result.put("width", captureWidth);
        result.put("height", captureHeight);
        result.put("fullSize", captureFullSize);
        call.resolve(result);
    }

    @PluginMethod
    public void register(PluginCall call) {
        if (!isConnected) {
            call.reject("Device not connected");
            return;
        }

        Integer userId = call.getInt("userID");
        boolean isAdmin = call.getBoolean("isAdmin", false);
        if (userId == null) {
            call.reject("userID is required");
            return;
        }

        byte[] cmd = FMSAPI.cmdFPRegisterStart(userId, isAdmin);
        currentCommandCall = call;
        currentCommandCode = FMSAPI.CMD_FP_REGISTER_START;
        sendCommand(cmd);
    }

    @PluginMethod
    public void completeRegistration(PluginCall call) {
        if (!isConnected) {
            call.reject("Device not connected");
            return;
        }

        byte[] cmd = FMSAPI.cmdFPRegisterEnd();
        currentCommandCall = call;
        currentCommandCode = FMSAPI.CMD_FP_REGISTER_END;
        sendCommand(cmd);
    }

    @PluginMethod
    public void verify(PluginCall call) {
        if (!isConnected) {
            call.reject("Device not connected");
            return;
        }

        Integer userId = call.getInt("userID");
        if (userId == null) {
            call.reject("userID is required");
            return;
        }

        byte[] cmd = FMSAPI.cmdFPVerify(userId);
        currentCommandCall = call;
        currentCommandCode = FMSAPI.CMD_FP_VERIFY;
        sendCommand(cmd);
    }

    @PluginMethod
    public void identify(PluginCall call) {
        if (!isConnected) {
            call.reject("Device not connected");
            return;
        }

        byte[] cmd = FMSAPI.cmdFPIdentify();
        currentCommandCall = call;
        currentCommandCode = FMSAPI.CMD_FP_IDENTIFY;
        sendCommand(cmd);
    }

    @PluginMethod
    public void match(PluginCall call) {
        // Implement match using VERIFY command, exposing userID and score
        if (!isConnected) {
            call.reject("Device not connected");
            return;
        }

        Integer userId = call.getInt("userID");
        if (userId == null) {
            call.reject("userID is required");
            return;
        }

        byte[] cmd = FMSAPI.cmdFPVerify(userId);
        currentCommandCall = call;
        currentCommandCode = FMSAPI.CMD_FP_VERIFY;
        sendCommand(cmd);
    }

    @PluginMethod
    public void deleteFingerprint(PluginCall call) {
        if (!isConnected) {
            call.reject("Device not connected");
            return;
        }

        Integer userId = call.getInt("userID");
        if (userId == null) {
            call.reject("userID is required");
            return;
        }

        byte[] cmd = FMSAPI.cmdFPDelete(userId);
        currentCommandCall = call;
        currentCommandCode = FMSAPI.CMD_FP_DELETE;
        sendCommand(cmd);
    }

    @PluginMethod
    public void setPowerOffTime(PluginCall call) {
        if (!isConnected) {
            call.reject("Device not connected");
            return;
        }

        int timeoutMinutes = call.getInt("timeoutMinutes", 30);

        // Build packet manually using FMSHeader
        FMSHeader header = new FMSHeader();
        header.setPkt_class((byte) 0x00);
        header.setPkt_command(CMD_SET_POWER_OFF_TIME);
        header.setPkt_param1((short) timeoutMinutes);
        header.setPkt_param2((short) 0);
        header.setPkt_datasize1((short) 0);
        header.setPkt_datasize2((short) 0);
        header.setCheckSum();

        byte[] cmd = header.get();
        currentCommandCall = call;
        currentCommandCode = CMD_SET_POWER_OFF_TIME;
        sendCommand(cmd);
    }

    @PluginMethod
    public void getTemplate(PluginCall call) {
        if (!isConnected) {
            call.reject("Device not connected");
            return;
        }

        Integer userId = call.getInt("userID");
        if (userId == null) {
            call.reject("userID is required");
            return;
        }

        // Reset template transfer state
        remainingTemplateSize = 0;
        totalTemplateSize = 0;
        isReceivingTemplate = false;
        currentTemplateCall = call;

        int maxTemplateSize = FMSImage.IMG_SIZE_MAX; // safe upper bound
        if (templateBuffer == null || templateBuffer.length < maxTemplateSize) {
            templateBuffer = new byte[maxTemplateSize];
        }

        // Build CMD_GET_TEMPLATE header manually using FMSHeader
        FMSHeader header = new FMSHeader();
        header.setPkt_class((byte) 0x00);
        header.setPkt_command(CMD_GET_TEMPLATE);
        header.setPkt_param1((short) userId.intValue());
        header.setPkt_param2((short) 0);
        header.setPkt_datasize1((short) 0);
        header.setPkt_datasize2((short) 0);
        header.setCheckSum();

        byte[] cmd = header.get();
        sendCommand(cmd);
    }

    // Helper methods
    private String getDeviceName(BluetoothDevice device) {
        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            return null;
        }
        return device.getName();
    }

    private JSObject createDeviceInfo(BluetoothDevice device, int rssi) {
        JSObject deviceInfo = new JSObject();
        deviceInfo.put("id", device.getAddress());
        deviceInfo.put("address", device.getAddress());
        deviceInfo.put("name", getDeviceName(device));
        if (rssi != 0) {
            deviceInfo.put("rssi", rssi);
        }
        return deviceInfo;
    }

    private void setupCharacteristics(BluetoothGatt gatt) {
        BluetoothGattService service = gatt.getService(UUID.fromString(SERVICE_UUID));
        if (service != null) {
            writeCharacteristic = service.getCharacteristic(UUID.fromString(WRITE_CHARACTERISTIC_UUID));
            notifyCharacteristic = service.getCharacteristic(UUID.fromString(NOTIFY_CHARACTERISTIC_UUID));
            
            if (notifyCharacteristic != null) {
                gatt.setCharacteristicNotification(notifyCharacteristic, true);
                
                BluetoothGattDescriptor descriptor = notifyCharacteristic.getDescriptor(
                    UUID.fromString(CLIENT_CHARACTERISTIC_CONFIG));
                if (descriptor != null) {
                    descriptor.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                    gatt.writeDescriptor(descriptor);
                }
            }
        }
    }

    private void requestNextChunk() {
        if (bluetoothGatt == null || notifyCharacteristic == null) {
            return;
        }
        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        bluetoothGatt.readCharacteristic(notifyCharacteristic);
    }

    private void sendCommand(byte[] command) {
        if (writeCharacteristic != null && bluetoothGatt != null) {
            writeCharacteristic.setValue(command);
            if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                return;
            }
            bluetoothGatt.writeCharacteristic(writeCharacteristic);
        }
    }

    private byte[] createCaptureCommand(boolean fullSize) {
        // This should be implemented based on SecuGen protocol
        // For now, return a mock command
        return new byte[]{0x01, 0x02, 0x03}; // Placeholder
    }

    private void handleDataReceived(byte[] data) {
        if (data == null || data.length == 0) {
            return;
        }

        // If this is a 12-byte FMS header, parse using FMSHeader
        if (data.length == FMSAPI.PACKET_HEADER_SIZE) {
            FMSHeader header = new FMSHeader(data);
            byte command = header.pkt_command;
            byte error = header.pkt_error;

            // Handle fingerprint capture (CMD_FP_CAPTURE = 0x43)
            if (command == FMSAPI.CMD_FP_CAPTURE) {
                if (error != FMSAPI.ERR_NONE) {
                    // Capture failed - report via captureProgress event (like iOS)
                    JSObject progress = new JSObject();
                    progress.put("status", "error");
                    progress.put("message", String.format("Capture failed (Error: 0x%02X)", error));
                    notifyListeners("captureProgress", progress);
                    remainingDataSize = 0;
                    totalReceiveSize = 0;
                    isCapturingImage = false;
                    return;
                }

                int dataSize = (((int) header.pkt_datasize1) & 0x0000FFFF)
                        | ((((int) header.pkt_datasize2) << 16) & 0xFFFF0000);

                Log.d(TAG, "CMD_FP_CAPTURE header: size=" + dataSize
                        + ", param1=0x" + Integer.toHexString(header.pkt_param1 & 0xFFFF)
                        + ", error=0x" + Integer.toHexString(error & 0xFF));

                // High byte of param1 indicates WSQ flag in SDK/iOS
                // ((param1 >> 8) & 0xFF) != 0 => WSQ image
                isCurrentCaptureWSQ = (((header.pkt_param1 >> 8) & 0xFF) != 0);

                if (dataSize <= 0 || dataSize > FMSImage.IMG_SIZE_MAX) {
                    // Invalid size - notify error via event
                    JSObject progress = new JSObject();
                    progress.put("status", "error");
                    progress.put("message", "Invalid image data size");
                    notifyListeners("captureProgress", progress);
                    remainingDataSize = 0;
                    totalReceiveSize = 0;
                    isCapturingImage = false;
                    return;
                }

                remainingDataSize = dataSize;
                totalReceiveSize = 0;
                isCapturingImage = true;

                // Notify JS that download has started
                JSObject progress = new JSObject();
                progress.put("status", "downloading");
                progress.put("message", String.format("Downloading %d bytes...", dataSize));
                progress.put("progress", 0);
                notifyListeners("captureProgress", progress);

                // Start reading the first chunk of image data
                requestNextChunk();

                return;
            }

            // Handle template header (CMD_GET_TEMPLATE = 0x40)
            if (command == CMD_GET_TEMPLATE && currentTemplateCall != null) {
                if (error != FMSAPI.ERR_NONE) {
                    JSObject result = new JSObject();
                    result.put("success", false);
                    result.put("message", String.format("Get template failed (Error: 0x%02X)", error));
                    currentTemplateCall.resolve(result);
                    currentTemplateCall = null;
                    remainingTemplateSize = 0;
                    totalTemplateSize = 0;
                    isReceivingTemplate = false;
                    return;
                }

                int dataSize = (data[6] & 0xFF)
                        | ((data[7] & 0xFF) << 8)
                        | ((data[8] & 0xFF) << 16)
                        | ((data[9] & 0xFF) << 24);

                if (dataSize <= 0 || dataSize > FMSImage.IMG_SIZE_MAX) {
                    JSObject result = new JSObject();
                    result.put("success", false);
                    result.put("message", "Invalid template data size");
                    currentTemplateCall.resolve(result);
                    currentTemplateCall = null;
                    remainingTemplateSize = 0;
                    totalTemplateSize = 0;
                    isReceivingTemplate = false;
                    return;
                }

                remainingTemplateSize = dataSize;
                totalTemplateSize = 0;
                isReceivingTemplate = true;

                return;
            }

            // Handle register / completeRegistration / verify / identify
            if (currentCommandCall != null && command == currentCommandCode) {
                // Parse param1 (userID) and param2 (score) from header
                int param1 = (data[2] & 0xFF) | ((data[3] & 0xFF) << 8);
                int param2 = (data[4] & 0xFF) | ((data[5] & 0xFF) << 8);

                JSObject result = new JSObject();

                switch (command) {
                    case FMSAPI.CMD_FP_REGISTER_START:
                        if (error == FMSAPI.ERR_NONE) {
                            result.put("success", true);
                            result.put("message", "Fingerprint registration started");
                        } else if (error == FMSAPI.ERR_ALREADY_REGISTERED_USER) {
                            result.put("success", false);
                            result.put("message", String.format("Register start failed (Error: 0x%02X)", error));
                        } else {
                            result.put("success", false);
                            result.put("message", String.format("Register start failed (Error: 0x%02X)", error));
                        }
                        break;

                    case FMSAPI.CMD_FP_REGISTER_END:
                        if (error == FMSAPI.ERR_NONE) {
                            result.put("success", true);
                            result.put("message", "Fingerprint registration completed");
                        } else {
                            result.put("success", false);
                            result.put("message", String.format("Register end failed (Error: 0x%02X)", error));
                        }
                        break;

                    case FMSAPI.CMD_FP_VERIFY:
                        result.put("userID", param1);
                        result.put("score", param2);
                        if (error == FMSAPI.ERR_NONE) {
                            result.put("success", true);
                            result.put("message", "Fingerprint verification success");
                        } else if (error == FMSAPI.ERR_VERIFY_FAILED) {
                            result.put("success", false);
                            result.put("message", "Fingerprint verification failed");
                        } else if (error == FMSAPI.ERR_USER_NOT_FOUND) {
                            result.put("success", false);
                            result.put("message", "User not found");
                        } else {
                            result.put("success", false);
                            result.put("message", String.format("Verify failed (Error: 0x%02X)", error));
                        }
                        break;

                    case FMSAPI.CMD_FP_IDENTIFY:
                        if (error == FMSAPI.ERR_NONE) {
                            result.put("success", true);
                            result.put("message", "Fingerprint identify success");
                            result.put("userID", param1);
                            result.put("score", param2);
                        } else if (error == FMSAPI.ERR_IDENTIFY_FAILED) {
                            result.put("success", false);
                            result.put("message", "Fingerprint identify failed");
                        } else {
                            result.put("success", false);
                            result.put("message", String.format("Identify failed (Error: 0x%02X)", error));
                        }
                        break;

                    case FMSAPI.CMD_FP_DELETE:
                        result.put("userID", param1);
                        if (error == FMSAPI.ERR_NONE) {
                            result.put("success", true);
                            result.put("message", String.format("User %d deleted", param1));
                        } else if (error == FMSAPI.ERR_USER_NOT_FOUND) {
                            result.put("success", false);
                            result.put("message", String.format("User %d not found", param1));
                        } else {
                            result.put("success", false);
                            result.put("message", String.format("Delete failed (Error: 0x%02X)", error));
                        }
                        break;

                    case CMD_SET_POWER_OFF_TIME:
                        if (error == FMSAPI.ERR_NONE) {
                            result.put("success", true);
                            result.put("message", "Power off time set successfully");
                        } else {
                            result.put("success", false);
                            result.put("message", String.format("Set power off time failed (Error: 0x%02X)", error));
                        }
                        break;
                }

                currentCommandCall.resolve(result);
                currentCommandCall = null;
                currentCommandCode = 0x00;
                return;
            }

            // For now, for other commands just emit raw dataReceived for debugging
            JSObject dataEvent = new JSObject();
            dataEvent.put("command", "header_received");
            dataEvent.put("data", Base64.encodeToString(data, Base64.DEFAULT));
            notifyListeners("dataReceived", dataEvent);
            return;
        }

        // Handle template data stream
        if (isReceivingTemplate && remainingTemplateSize > 0 && currentTemplateCall != null) {
            int chunkLen = Math.min(data.length, remainingTemplateSize);
            if (templateBuffer != null && totalTemplateSize + chunkLen <= templateBuffer.length) {
                System.arraycopy(data, 0, templateBuffer, totalTemplateSize, chunkLen);
            }
            remainingTemplateSize -= chunkLen;
            totalTemplateSize += chunkLen;

            if (remainingTemplateSize > 0) {
                return;
            }

            // All template data received
            isReceivingTemplate = false;

            String templateBase64 = "";
            if (templateBuffer != null && totalTemplateSize > 0) {
                byte[] rawTmpl = new byte[totalTemplateSize];
                System.arraycopy(templateBuffer, 0, rawTmpl, 0, totalTemplateSize);
                templateBase64 = Base64.encodeToString(rawTmpl, Base64.NO_WRAP);
            }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("template", templateBase64);

            currentTemplateCall.resolve(result);
            currentTemplateCall = null;

            return;
        }

        // If we are in the middle of receiving image data, append chunks
        if (isCapturingImage && remainingDataSize > 0) {
            int chunkLen = Math.min(data.length, remainingDataSize);
            if (imageBuffer != null && totalReceiveSize + chunkLen <= imageBuffer.length) {
                System.arraycopy(data, 0, imageBuffer, totalReceiveSize, chunkLen);
            }
            remainingDataSize -= chunkLen;
            totalReceiveSize += chunkLen;

            int percent = (totalReceiveSize + remainingDataSize) > 0
                    ? (int) ((totalReceiveSize * 100L) / (totalReceiveSize + remainingDataSize))
                    : 100;

            JSObject progress = new JSObject();
            progress.put("status", "downloading");
            progress.put("message", "Downloading image data...");
            progress.put("progress", percent);
            notifyListeners("captureProgress", progress);

            // If still remaining, wait for further chunks
            if (remainingDataSize > 0) {
                // Request next data chunk from the device, mirroring SDK behavior
                requestNextChunk();
                return;
            }

            // All data received - finalize capture
            isCapturingImage = false;
            // Base64 encode final image bytes (WSQ-decoded or raw)
            String imageBase64 = "";
            int finalWidth = captureWidth;
            int finalHeight = captureHeight;

            if (imageBuffer != null && totalReceiveSize > 0) {
                byte[] raw = new byte[totalReceiveSize];
                System.arraycopy(imageBuffer, 0, raw, 0, totalReceiveSize);

                if (isCurrentCaptureWSQ) {
                    try {
                        DeviceControlActivity.WSQInfoClass info = new DeviceControlActivity.WSQInfoClass();
                        DeviceControlActivity wsqDecoder = new DeviceControlActivity();
                        byte[] decoded = wsqDecoder.jniSgWSQDecode(info, raw, raw.length);

                        if (decoded != null && info.width > 0 && info.height > 0
                                && decoded.length == info.width * info.height) {
                            finalWidth = info.width;
                            finalHeight = info.height;
                            imageBase64 = Base64.encodeToString(decoded, Base64.NO_WRAP);
                        } else {
                            // Fallback: use original buffer as raw
                            imageBase64 = Base64.encodeToString(raw, Base64.NO_WRAP);
                        }
                    } catch (Throwable t) {
                        Log.e(TAG, "WSQ decode failed, sending raw buffer", t);
                        imageBase64 = Base64.encodeToString(raw, Base64.NO_WRAP);
                    }
                } else {
                    // Non-WSQ: raw grayscale directly
                    imageBase64 = Base64.encodeToString(raw, Base64.NO_WRAP);
                }
            }

            // Emit captureComplete event with payload matching iOS
            JSObject complete = new JSObject();
            complete.put("success", true);
            complete.put("imageData", imageBase64);
            complete.put("width", finalWidth);
            complete.put("height", finalHeight);
            complete.put("isWSQ", isCurrentCaptureWSQ);
            complete.put("size", totalReceiveSize);
            complete.put("message", "Fingerprint captured successfully");
            notifyListeners("captureComplete", complete);

            // Final captureProgress event (status=complete) like iOS
            JSObject done = new JSObject();
            done.put("status", "complete");
            done.put("progress", 100);
            done.put("message", "Capture complete");
            notifyListeners("captureProgress", done);

            return;
        }

        // Default: just forward raw data for debugging
        JSObject dataEvent = new JSObject();
        dataEvent.put("command", "data_received");
        dataEvent.put("data", Base64.encodeToString(data, Base64.DEFAULT));
        notifyListeners("dataReceived", dataEvent);
    }

    // Additional methods for fingerprint operations would go here
    // (register, verify, identify, delete, etc.)
}
