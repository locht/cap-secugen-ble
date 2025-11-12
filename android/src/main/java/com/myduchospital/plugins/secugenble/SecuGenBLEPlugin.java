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
    
    // SecuGen SDK data management
    private byte[] mImgBuf;
    private int mImgBufSize = 0;
    private int mExpectedImageSize = 0;
    private boolean mIsCollectingImage = false;
    private long mCaptureStartTime = 0;
    
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

    private boolean hasRequiredPermissions() {
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
                    Log.d(TAG, "Connected to GATT server");
                    isConnected = true;
                    connectedDeviceAddress = device.getAddress();
                    bluetoothGatt = gatt;
                    
                    // Discover services
                    gatt.discoverServices();
                    
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
            public void onCharacteristicChanged(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic) {
                handleDataReceived(characteristic.getValue());
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

        boolean fullSize = call.getBoolean("fullSize", true);
        boolean wsqFormat = call.getBoolean("wsqFormat", true);
        
        // Send capture command to device
        byte[] captureCommand = createCaptureCommand(fullSize);
        sendCommand(captureCommand);
        
        // For now, return a mock result
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("message", "Capture initiated");
        result.put("width", fullSize ? 300 : 150);
        result.put("height", fullSize ? 400 : 200);
        result.put("isWSQ", wsqFormat);
        call.resolve(result);
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
        // Process received data from SecuGen device
        JSObject dataEvent = new JSObject();
        dataEvent.put("command", "data_received");
        dataEvent.put("data", Base64.encodeToString(data, Base64.DEFAULT));
        notifyListeners("dataReceived", dataEvent);
    }

    // Additional methods for fingerprint operations would go here
    // (register, verify, identify, delete, etc.)
}
