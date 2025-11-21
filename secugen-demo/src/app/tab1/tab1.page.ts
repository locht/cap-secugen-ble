import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { SecuGenService } from '../services/secugen.service';
import { DeviceInfo } from '@myduchospital/cap-secugen-ble';

interface Message {
  text: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timestamp: Date;
}

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page implements OnInit, OnDestroy {

  isInitialized = false;
  bluetoothEnabled = false;
  connectedDevice: DeviceInfo | null = null;
  scannedDevices: DeviceInfo[] = [];
  isScanning = false;
  messages: Message[] = [];

  private secuGenService = inject(SecuGenService);

  ngOnInit() {
    this.updateStatus();
  }

  ngOnDestroy() {
    this.secuGenService.cleanup();
  }

  private addMessage(text: string, type: Message['type'] = 'info') {
    this.messages.push({
      text,
      type,
      timestamp: new Date()
    });
  }

  private async updateStatus() {
    this.isInitialized = this.secuGenService.getInitializationStatus();
    this.connectedDevice = this.secuGenService.getConnectedDevice();
    this.bluetoothEnabled = await this.secuGenService.isBluetoothEnabled();
  }

  async initialize() {
    try {
      this.addMessage('Initializing SecuGen BLE plugin...', 'info');
      const result = await this.secuGenService.initialize();
      
      if (result.success) {
        this.addMessage('Plugin initialized successfully!', 'success');
        this.isInitialized = true;
      } else {
        this.addMessage(`Initialization failed: ${result.message}`, 'error');
      }
    } catch (error) {
      this.addMessage(`Initialization error: ${error}`, 'error');
    }
  }

  async checkBluetooth() {
    try {
      this.addMessage('Checking Bluetooth status...', 'info');
      this.bluetoothEnabled = await this.secuGenService.isBluetoothEnabled();
      
      if (this.bluetoothEnabled) {
        this.addMessage('Bluetooth is enabled', 'success');
      } else {
        this.addMessage('Bluetooth is disabled. Please enable it.', 'warning');
      }
    } catch (error) {
      this.addMessage(`Bluetooth check error: ${error}`, 'error');
    }
  }

  async startScan() {
    try {
      this.addMessage('Starting device scan...', 'info');
      this.isScanning = true;
      this.scannedDevices = [];
      
      const result = await this.secuGenService.scan(10000);
      
      if (result.devices && result.devices.length > 0) {
        this.scannedDevices = result.devices;
        this.addMessage(`Found ${result.devices.length} device(s)`, 'success');
      } else {
        this.addMessage('No SecuGen devices found', 'warning');
      }
      
      this.isScanning = false;
    } catch (error) {
      this.addMessage(`Scan error: ${error}`, 'error');
      this.isScanning = false;
    }
  }

  async stopScan() {
    try {
      const result = await this.secuGenService.stopScan();
      this.isScanning = false;
      
      if (result.success) {
        this.addMessage('Scan stopped', 'info');
      } else {
        this.addMessage(`Stop scan failed: ${result.message}`, 'error');
      }
    } catch (error) {
      this.addMessage(`Stop scan error: ${error}`, 'error');
      this.isScanning = false;
    }
  }

  async connectToDevice(device: DeviceInfo) {
    try {
      this.addMessage(`Connecting to ${device.name || device.address}...`, 'info');
      
      const result = await this.secuGenService.connect(device.id);
      
      if (result.connected) {
        this.connectedDevice = result.deviceInfo || device;
        this.addMessage(`Connected to ${device.name || device.address}`, 'success');
      } else {
        this.addMessage(`Connection failed to ${device.name || device.address}`, 'error');
      }
    } catch (error) {
      this.addMessage(`Connection error: ${error}`, 'error');
    }
  }

  async disconnect() {
    try {
      this.addMessage('Disconnecting...', 'info');
      
      const result = await this.secuGenService.disconnect();
      
      if (result.success) {
        this.connectedDevice = null;
        this.addMessage('Disconnected successfully', 'success');
      } else {
        this.addMessage(`Disconnect failed: ${result.message}`, 'error');
      }
    } catch (error) {
      this.addMessage(`Disconnect error: ${error}`, 'error');
    }
  }

  clearMessages() {
    this.messages = [];
  }
}
