export interface CaptureOptions {
  timeoutMs?: number;
  fullSize?: boolean;
  wsqFormat?: boolean;
  sizeOption?: 'full' | 'half' | 'small' | 'tiny'; // New size options: full=300x400, half=150x200, small=90x120, tiny=60x80
}

export interface ScanOptions {
  timeoutMs?: number;
}

export interface ConnectOptions {
  deviceId: string;
}

export interface RegisterOptions {
  userID: number;
  isAdmin?: boolean;
}

export interface VerifyOptions {
  userID: number;
}

export interface MatchOptions {
  template: string;
}

export interface DeleteOptions {
  userID: number;
}

export interface DeviceInfo {
  id: string;
  name?: string;
  address: string;
  rssi?: number;
}

export interface ScanResult {
  devices: DeviceInfo[];
}

export interface ConnectionResult {
  connected: boolean;
  deviceInfo?: DeviceInfo;
}

export interface CaptureResult {
  success: boolean;
  image?: string;
  template?: string;
  width?: number;
  height?: number;
  isWSQ?: boolean;
  pngBase64?: string;
  message?: string;
}

export interface MatchResult {
  success: boolean;
  score?: number;
  template?: string;
  message?: string;
}

export interface ServiceResult {
  success: boolean;
  message: string;
  errorCode?: number;
}

export interface VersionResult {
  success: boolean;
  version?: string;
  firmware?: string;
  message?: string;
}

/**
 * SecuGen Unity 20 BLE Plugin Interface
 * Provides comprehensive fingerprint scanner functionality
 */
export interface SecuGenBLEPlugin {
  /**
   * Initialize the plugin and request necessary permissions
   */
  initialize(): Promise<ServiceResult>;

  /**
   * Check if Bluetooth is enabled
   */
  isBluetoothEnabled(): Promise<{ enabled: boolean }>;

  /**
   * Start scanning for SecuGen Unity 20 BLE devices
   */
  scan(options?: ScanOptions): Promise<ScanResult>;

  /**
   * Stop scanning for devices
   */
  stopScan(): Promise<ServiceResult>;

  /**
   * Connect to a specific device
   */
  connect(options: ConnectOptions): Promise<ConnectionResult>;

  /**
   * Disconnect from the current device
   */
  disconnect(): Promise<ServiceResult>;

  /**
   * Check if device is connected
   */
  isConnected(): Promise<{ connected: boolean }>;

  /**
   * Get device version information
   */
  getVersion(): Promise<VersionResult>;

  /**
   * Capture fingerprint image and/or template
   */
  capture(options?: CaptureOptions): Promise<CaptureResult>;

  /**
   * Start fingerprint registration for a user
   */
  register(options: RegisterOptions): Promise<ServiceResult>;

  /**
   * Complete fingerprint registration
   */
  completeRegistration(): Promise<ServiceResult>;

  /**
   * Verify fingerprint against registered user
   */
  verify(options: VerifyOptions): Promise<MatchResult>;

  /**
   * Identify fingerprint against all registered users
   */
  identify(): Promise<MatchResult>;

  /**
   * Match fingerprint template
   */
  match(options: MatchOptions): Promise<MatchResult>;

  /**
   * Delete registered fingerprint for a user
   */
  deleteFingerprint(options: DeleteOptions): Promise<ServiceResult>;

  /**
   * Set power off time for device (wake-up feature)
   */
  setPowerOffTime(options: { timeoutMinutes: number }): Promise<ServiceResult>;

  /**
   * Add listener for device found events
   */
  addListener(
    eventName: 'deviceFound',
    listenerFunc: (device: DeviceInfo) => void,
  ): Promise<any>;

  /**
   * Add listener for connection state changes
   */
  addListener(
    eventName: 'connectionStateChange',
    listenerFunc: (state: { connected: boolean; device?: DeviceInfo }) => void,
  ): Promise<any>;

  /**
   * Add listener for scan stopped events
   */
  addListener(
    eventName: 'scanStopped',
    listenerFunc: () => void,
  ): Promise<any>;

  /**
   * Add listener for data received events
   */
  addListener(
    eventName: 'dataReceived',
    listenerFunc: (data: { command: string; data: any }) => void,
  ): Promise<any>;

  /**
   * Add listener for capture progress events
   */
  addListener(
    eventName: 'captureProgress',
    listenerFunc: (progress: { status: string; progress?: number; message: string }) => void,
  ): Promise<any>;

  /**
   * Add listener for capture complete events
   */
  addListener(
    eventName: 'captureComplete',
    listenerFunc: (result: { success: boolean; imageData: string; width: number; height: number; isWSQ: boolean; size: number; message: string }) => void,
  ): Promise<any>;

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(eventName?: string): Promise<void>;

  /**
   * Handle data received from device (internal use)
   */
  onDataReceived?(data: { command: string; data: any }): void;
}
