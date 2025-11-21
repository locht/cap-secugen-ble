import { Injectable } from '@angular/core';
import {
  SecuGenBLE,
  DeviceInfo,
  CaptureResult,
  ServiceResult,
  ScanResult,
  ConnectionResult,
  MatchResult,
} from '@myduchospital/cap-secugen-ble';
import { Subject, Observable, from } from 'rxjs';
import {
  base64ToArrayBuffer,
  getImageStats,
  createImageDataFromRaw,
  drawImageOnCanvas,
  scaleImageFast,
} from './image-utils';

/**
 * Mã lỗi SDK SecuGen (từ React Native SDK gốc)
 * Định nghĩa các mã lỗi có thể xảy ra trong quá trình giao tiếp với thiết bị
 */
export const SDKErrorCodes = {
  ERR_NONE: 0x00, // Không có lỗi
  ERR_FLASH_OPEN: 0x01, // Lỗi mở flash
  ERR_SENSOR_OPEN: 0x02, // Lỗi mở sensor
  ERR_REGISTER_FAILED: 0x03, // Đăng ký thất bại
  ERR_VERIFY_FAILED: 0x04, // Xác thực thất bại
  ERR_ALREADY_REGISTERED_USER: 0x05, // Người dùng đã đăng ký
  ERR_USER_NOT_FOUND: 0x06, // Không tìm thấy người dùng
  ERR_TIME_OUT: 0x08, // Hết thời gian chờ
  ERR_DB_FULL: 0x09, // Cơ sở dữ liệu đầy
  ERR_WRONG_USERID: 0x0a, // ID người dùng sai
  ERR_DB_NO_DATA: 0x0b, // Không có dữ liệu trong DB
  ERR_FUNCTION_FAIL: 0x10, // Chức năng thất bại
  ERR_INSUFFICIENT_DATA: 0x11, // Dữ liệu không đủ
  ERR_FLASH_WRITE_ERROR: 0x12, // Lỗi ghi flash
  ERR_INVALID_PARAM: 0x14, // Tham số không hợp lệ
  ERR_AUTHENTICATION_FAIL: 0x17, // Xác thực thất bại
  ERR_IDENTIFY_FAILED: 0x1b, // Nhận dạng thất bại
  ERR_CHECKSUM_ERR: 0x28, // Lỗi checksum
  ERR_INVALID_FPRECORD: 0x30, // Bản ghi vân tay không hợp lệ
  ERR_UNKNOWN_COMMAND: 0xff, // Lệnh không xác định
};

/**
 * Service quản lý giao tiếp với SecuGen Unity 20 BLE plugin
 * Cung cấp các method để scan, connect, capture fingerprint
 */
@Injectable({
  providedIn: 'root',
})
export class SecuGenService {
  // Trạng thái khởi tạo plugin
  private isInitialized = false;

  // Thiết bị hiện tại đang kết nối
  private connectedDevice: DeviceInfo | null = null;

  // Danh sách thiết bị được tìm thấy trong quá trình scan
  private discoveredDevices: DeviceInfo[] = [];

  // Kết quả capture cuối cùng (để UI có thể lấy)
  private lastCaptureResult: any = null;

  // === RXJS SUBJECTS FOR REAL-TIME EVENTS ===
  // Subject cho capture progress events
  private captureProgressSubject = new Subject<any>();

  // Subject cho capture complete events
  private captureCompleteSubject = new Subject<any>();

  // Observable cho UI subscribe
  public captureProgress$ = this.captureProgressSubject.asObservable();
  public captureComplete$ = this.captureCompleteSubject.asObservable();

  /**
   * Constructor - Khởi tạo service và thiết lập event listeners
   */
  constructor() {
    this.setupEventListeners();
  }

  /**
   * Thiết lập các event listener để nhận sự kiện từ native plugin
   * Xử lý các event: deviceFound, connectionStateChange, captureProgress, etc.
   */
  private setupEventListeners() {
    // Lắng nghe sự kiện tìm thấy thiết bị trong quá trình scan
    SecuGenBLE.addListener('deviceFound', (device: DeviceInfo) => {
      // console.log('🔍 Device found:', device);
      // Thêm vào danh sách discovered devices nếu chưa có
      const existingIndex = this.discoveredDevices.findIndex((d) => d.id === device.id);
      if (existingIndex >= 0) {
        // Cập nhật thiết bị hiện có (RSSI có thể thay đổi)
        this.discoveredDevices[existingIndex] = device;
      } else {
        // Thêm thiết bị mới
        this.discoveredDevices.push(device);
      }
    });

    // Lắng nghe thay đổi trạng thái kết nối
    SecuGenBLE.addListener('connectionStateChange', (state: { connected: boolean; device?: DeviceInfo }) => {
      console.log('🔗 Connection state changed:', state);
      if (state.connected && state.device) {
        this.connectedDevice = state.device;
      } else {
        this.connectedDevice = null;
      }
    });

    // Lắng nghe sự kiện dừng scan
    SecuGenBLE.addListener('scanStopped', () => {
      console.log('🛑 Scan stopped');
    });

    // Lắng nghe tiến trình capture vân tay (0-100%)
    SecuGenBLE.addListener('captureProgress', (progress: any) => {
      console.log('📊 Capture progress:', progress);
      // Emit progress event để UI có thể subscribe
      this.captureProgressSubject.next(progress);
    });

    // Lắng nghe sự kiện hoàn thành capture
    SecuGenBLE.addListener('captureComplete', (result: any) => {
      console.log('✅ Capture complete:', result);
      // Lưu kết quả capture để UI có thể lấy
      this.lastCaptureResult = result;
      // Emit complete event
      this.captureCompleteSubject.next(result);
    });

    // Lắng nghe dữ liệu thô nhận được từ thiết bị
    SecuGenBLE.addListener('dataReceived', (data: { command: string; data: any }) => {
      console.log('📡 Data received:', data);
    });
  }

  /**
   * Khởi tạo SecuGen BLE plugin
   * Phải gọi trước khi sử dụng các chức năng khác
   */
  async initialize(): Promise<ServiceResult> {
    try {
      const result = await SecuGenBLE.initialize();
      if (result.success) {
        this.isInitialized = true;
      }
      return result;
    } catch (error) {
      console.error('Initialize error:', error);
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Match fingerprint: compare current finger against a stored template (userID)
   * and return score from the device.
   */
  async match(userID: number): Promise<MatchResult & { userID?: number; score?: number }> {
    try {
      if (!this.connectedDevice) {
        throw new Error('No device connected');
      }

      if (userID < 1 || userID > 999) {
        throw new Error('User ID must be between 1-999');
      }

      const result: any = await (SecuGenBLE as any).match({ userID });
      return {
        success: !!result.success,
        message: result.message,
        userID: result.userID,
        score: result.score,
      };
    } catch (error) {
      console.error('Match error:', error);
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Match two fingerprint templates locally using FDxSDKPro matcher on Android.
   * Both templates are base64-encoded minutiae templates in the same format.
   */
  async matchTemplatesLocal(
    probeTemplate: string,
    candidateTemplate: string,
    threshold: number = 80,
  ): Promise<{ success: boolean; message?: string; matched?: boolean; score?: number; threshold?: number }> {
    try {
      if (!probeTemplate || !candidateTemplate) {
        throw new Error('Both probeTemplate and candidateTemplate are required');
      }

      const result: any = await (SecuGenBLE as any).match({
        probeTemplate,
        candidateTemplate,
        threshold,
      });

      return {
        success: !!result.success,
        message: result.message,
        matched: result.matched,
        score: result.score,
        threshold: result.threshold,
      };
    } catch (error) {
      console.error('Local template match error:', error);
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Kiểm tra Bluetooth có được bật hay không
   * @returns true nếu Bluetooth đã bật, false nếu chưa
   */
  async isBluetoothEnabled(): Promise<boolean> {
    try {
      const result = await SecuGenBLE.isBluetoothEnabled();
      return result.enabled;
    } catch (error) {
      console.error('Bluetooth check error:', error);
      return false;
    }
  }

  /**
   * Quét tìm các thiết bị SecuGen Unity 20 BLE
   * Kết quả sẽ được nhận qua deviceFound event
   * @param timeoutMs Thời gian timeout (mặc định 10 giây)
   */
  async scan(timeoutMs: number = 10000): Promise<ScanResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('Plugin chưa được khởi tạo');
      }

      // Xóa danh sách thiết bị cũ
      this.discoveredDevices = [];

      // Bắt đầu scan
      const result = await SecuGenBLE.scan({ timeoutMs });

      // Wait a bit for devices to be discovered via events
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Return discovered devices
      return {
        devices: this.discoveredDevices,
      };
    } catch (error) {
      console.error('Scan error:', error);
      return { devices: [] };
    }
  }

  /**
   * Get currently discovered devices
   */
  getDiscoveredDevices(): DeviceInfo[] {
    return this.discoveredDevices;
  }

  /**
   * Get last capture result
   */
  getLastCaptureResult(): any {
    return this.lastCaptureResult;
  }

  /**
   * Lưu thiết bị vào danh sách thiết bị ưa thích
   * @param device Thông tin thiết bị cần lưu
   */
  savePreferredDevice(device: DeviceInfo): void {
    try {
      const preferredDevices = this.getPreferredDevices();

      // Check if device already exists in the list
      const existingIndex = preferredDevices.findIndex((d) => d.id === device.id || d.address === device.address);

      if (existingIndex >= 0) {
        // Update existing device
        preferredDevices[existingIndex] = device;
        console.log('📝 Updated preferred device:', device.name);
      } else {
        // Add new device to the list
        preferredDevices.push(device);
        console.log('💾 Added new preferred device:', device.name);
      }

      localStorage.setItem('secugen_preferred_devices', JSON.stringify(preferredDevices));
      console.log(`📱 Total preferred devices: ${preferredDevices.length}`);
    } catch (error) {
      console.error('Error saving preferred device:', error);
    }
  }

  /**
   * Lấy thiết bị đầu tiên từ danh sách ưa thích (backward compatibility)
   * @returns DeviceInfo đầu tiên hoặc null nếu chưa có
   */
  getPreferredDevice(): DeviceInfo | null {
    const devices = this.getPreferredDevices();
    return devices.length > 0 ? devices[0] : null;
  }

  /**
   * Lấy danh sách tất cả thiết bị ưa thích
   * @returns Mảng DeviceInfo đã lưu
   */
  getPreferredDevices(): DeviceInfo[] {
    try {
      const saved = localStorage.getItem('secugen_preferred_devices');
      if (saved) {
        const devices = JSON.parse(saved);
        console.log(`📱 Loaded ${devices.length} preferred devices`);
        return devices;
      }
    } catch (error) {
      console.error('Error loading preferred devices:', error);
    }
    return [];
  }

  /**
   * Xóa thiết bị khỏi danh sách ưa thích
   * @param deviceId ID của thiết bị cần xóa
   */
  removePreferredDevice(deviceId: string): void {
    try {
      const preferredDevices = this.getPreferredDevices();
      const filteredDevices = preferredDevices.filter((d) => d.id !== deviceId && d.address !== deviceId);

      localStorage.setItem('secugen_preferred_devices', JSON.stringify(filteredDevices));
      console.log(`🗑️ Removed preferred device: ${deviceId}`);
      console.log(`📱 Remaining preferred devices: ${filteredDevices.length}`);
    } catch (error) {
      console.error('Error removing preferred device:', error);
    }
  }

  /**
   * Xóa tất cả thiết bị ưa thích
   */
  clearPreferredDevice(): void {
    try {
      localStorage.removeItem('secugen_preferred_devices');
      console.log('🗑️ Cleared all preferred devices');
    } catch (error) {
      console.error('Error clearing preferred devices:', error);
    }
  }

  /**
   * Tự động kết nối với thiết bị đã lưu nếu tìm thấy trong danh sách scan
   * @returns Promise<boolean> true nếu kết nối thành công
   */
  async autoConnectPreferredDevice(): Promise<boolean> {
    const preferred = this.getPreferredDevice();
    if (!preferred) {
      console.log('🔍 No preferred device saved');
      return false;
    }

    // Tìm thiết bị trong danh sách discovered
    const foundDevice = this.discoveredDevices.find((d) => d.id === preferred.id || d.address === preferred.address);

    if (foundDevice) {
      console.log('🎯 Found preferred device, auto-connecting...');
      try {
        const result = await this.connect(foundDevice.id);
        if (result.connected) {
          console.log('✅ Auto-connected to preferred device');
          return true;
        }
      } catch (error) {
        console.error('❌ Auto-connect failed:', error);
      }
    } else {
      console.log('🔍 Preferred device not found in scan results');
    }

    return false;
  }

  /**
   * Stop scanning for devices
   */
  async stopScan(): Promise<ServiceResult> {
    try {
      return await SecuGenBLE.stopScan();
    } catch (error) {
      console.error('Stop scan error:', error);
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Connect to a specific device
   */
  async connect(deviceId: string): Promise<ConnectionResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('Plugin not initialized');
      }

      const result = await SecuGenBLE.connect({ deviceId });
      if (result.connected && result.deviceInfo) {
        this.connectedDevice = result.deviceInfo;
      }
      return result;
    } catch (error) {
      console.error('Connect error:', error);
      return { connected: false };
    }
  }

  /**
   * Disconnect from the current device
   */
  async disconnect(): Promise<ServiceResult> {
    try {
      const result = await SecuGenBLE.disconnect();
      if (result.success) {
        this.connectedDevice = null;
      }
      return result;
    } catch (error) {
      console.error('Disconnect error:', error);
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Check if device is connected
   */
  async isConnected(): Promise<boolean> {
    try {
      const result = await SecuGenBLE.isConnected();
      return result.connected;
    } catch (error) {
      console.error('Connection check error:', error);
      return false;
    }
  }

  /**
   * Get device version information
   */
  async getVersion(): Promise<ServiceResult> {
    try {
      if (!this.connectedDevice) {
        throw new Error('No device connected');
      }

      const result = await SecuGenBLE.getVersion();
      return {
        success: result.success,
        message: result.message || 'Version retrieved',
      };
    } catch (error) {
      console.error('Get version error:', error);
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Capture fingerprint image and/or template
   */
  async capture(
    fullSize: boolean = true,
    wsqFormat: boolean = true,
    timeoutMs: number = 15000,
  ): Promise<CaptureResult> {
    try {
      if (!this.connectedDevice) {
        throw new Error('No device connected');
      }

      return await SecuGenBLE.capture({
        fullSize,
        wsqFormat,
        timeoutMs,
      });
    } catch (error) {
      console.error('Capture error:', error);
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Capture fingerprint with size option (full, half, small, tiny)
   */
  async captureWithSizeOption(
    sizeOption: 'full' | 'half' | 'small' | 'tiny' = 'full',
    wsqFormat: boolean = true,
    timeoutMs: number = 15000,
  ): Promise<CaptureResult> {
    try {
      if (!this.connectedDevice) {
        throw new Error('No device connected');
      }

      // Convert sizeOption to fullSize for backward compatibility
      const fullSize = sizeOption === 'full';

      console.log(`📏 Capture with size option: ${sizeOption} (fullSize: ${fullSize})`);

      return await SecuGenBLE.capture({
        fullSize,
        wsqFormat,
        timeoutMs,
        sizeOption,
      });
    } catch (error) {
      console.error('Capture error:', error);
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Start fingerprint registration for a user
   */
  async register(userID: number, isAdmin: boolean = false): Promise<ServiceResult> {
    try {
      if (!this.connectedDevice) {
        throw new Error('No device connected');
      }

      if (userID < 1 || userID > 999) {
        throw new Error('User ID must be between 1-999');
      }

      return await SecuGenBLE.register({ userID, isAdmin });
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Complete fingerprint registration
   */
  async completeRegistration(): Promise<ServiceResult> {
    try {
      if (!this.connectedDevice) {
        throw new Error('No device connected');
      }

      return await SecuGenBLE.completeRegistration();
    } catch (error) {
      console.error('Complete registration error:', error);
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Request fingerprint template for a given user and wait for native event
   * This uses the iOS getTemplate() method (CMD_GET_TEMPLATE) and listens
   * for the 'templateReceived' event emitted by the native plugin.
   */
  async getTemplate(userID: number): Promise<{ success: boolean; template?: string; message?: string }> {
    try {
      if (!this.connectedDevice) {
        throw new Error('No device connected');
      }

      if (userID < 1 || userID > 999) {
        throw new Error('User ID must be between 1-999');
      }

      // Native iOS side resolves the getTemplate() Promise directly with
      // { success, template, size } when transfer completes.
      const nativeResult = await (SecuGenBLE as any).getTemplate({ userID: userID });

      if (nativeResult && nativeResult.success && nativeResult.template) {
        return { success: true, template: nativeResult.template };
      }

      return {
        success: false,
        message: nativeResult?.message || 'Failed to get template',
      };
    } catch (error) {
      console.error('Get template error:', error);
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Verify fingerprint against registered user
   */
  async verify(userID: number): Promise<MatchResult> {
    try {
      if (!this.connectedDevice) {
        throw new Error('No device connected');
      }

      if (userID < 1 || userID > 999) {
        throw new Error('User ID must be between 1-999');
      }

      return await SecuGenBLE.verify({ userID });
    } catch (error) {
      console.error('Verify error:', error);
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Identify fingerprint against all registered users
   */
  async identify(): Promise<MatchResult> {
    try {
      if (!this.connectedDevice) {
        throw new Error('No device connected');
      }

      return await SecuGenBLE.identify();
    } catch (error) {
      console.error('Identify error:', error);
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Delete registered fingerprint for a user
   */
  async deleteFingerprint(userID: number): Promise<ServiceResult> {
    try {
      if (!this.connectedDevice) {
        throw new Error('No device connected');
      }

      if (userID < 1 || userID > 999) {
        throw new Error('User ID must be between 1-999');
      }

      return await SecuGenBLE.deleteFingerprint({ userID });
    } catch (error) {
      console.error('Delete fingerprint error:', error);
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * One-touch helper: Register fingerprint, complete registration and fetch template
   * for a given user ID in a single call.
   */
  async registerAndGetTemplate(
    startUserID: number,
    isAdmin: boolean = false,
  ): Promise<{ success: boolean; template?: string; userID?: number; messages: string[]; message?: string }> {
    const messages: string[] = [];

    try {
      if (!this.connectedDevice) {
        return { success: false, messages: ['No device connected'], message: 'No device connected' };
      }

      // Xác định currentUserID dựa trên localStorage để tránh for nhiều lần.
      let currentUserID = startUserID;
      if (currentUserID < 1 || currentUserID > 999) {
        currentUserID = 1;
      }

      try {
        const saved = localStorage.getItem('secugen_last_user_id');
        if (saved) {
          const n = parseInt(saved, 10);
          if (!isNaN(n) && n >= 1 && n <= 999) {
            currentUserID = n + 1;
            if (currentUserID > 999) {
              currentUserID = 1;
            }
          }
        }
      } catch (e) {
        console.error('Error reading secugen_last_user_id from localStorage:', e);
      }

      // Step 1: start registration for currentUserID
      const regStart = await this.register(currentUserID, isAdmin);
      messages.push(regStart.message || `Register start executed for userID ${currentUserID}`);

      if (!regStart.success) {
        const msg = regStart.message || '';
        const fatal = msg.toLowerCase().includes('no device connected') || msg.toLowerCase().includes('plugin');

        if (!fatal) {
          // Lưu lại userID cuối cùng thử không thành công để lần sau +1
          try {
            localStorage.setItem('secugen_last_user_id', String(currentUserID));
          } catch (e) {
            console.error('Error saving secugen_last_user_id to localStorage:', e);
          }

          return { success: false, messages, message: regStart.message };
        }

        // Fatal errors -> dừng hẳn
        return { success: false, messages, message: regStart.message };
      }

      // Step 2: complete registration
      const regEnd = await this.completeRegistration();
      messages.push(regEnd.message || `Register end executed for userID ${currentUserID}`);
      if (!regEnd.success) {
        const endMsg = regEnd.message || '';

        const fatalEnd = endMsg.toLowerCase().includes('no device connected') || endMsg.toLowerCase().includes('plugin');
        if (!fatalEnd) {
          try {
            localStorage.setItem('secugen_last_user_id', String(currentUserID));
          } catch (e) {
            console.error('Error saving secugen_last_user_id to localStorage (end):', e);
          }
        }

        return { success: false, messages, message: regEnd.message };
      }

      // Step 3: fetch template
      const tmplResult = await this.getTemplate(currentUserID);
      messages.push(tmplResult.message || (tmplResult.success ? 'Template fetched' : 'Template fetch failed'));

      if (!tmplResult.success || !tmplResult.template) {
        try {
          localStorage.setItem('secugen_last_user_id', String(currentUserID));
        } catch (e) {
          console.error('Error saving secugen_last_user_id to localStorage (template):', e);
        }

        return { success: false, messages, message: tmplResult.message || 'Failed to get template' };
      }

      // Thành công: lưu lại userID đã dùng để lần sau có thể +1 nếu cần
      try {
        localStorage.setItem('secugen_last_user_id', String(currentUserID));
      } catch (e) {
        console.error('Error saving secugen_last_user_id to localStorage (success):', e);
      }

      return {
        success: true,
        template: tmplResult.template,
        userID: currentUserID,
        messages,
        message: 'Register, complete and template retrieval succeeded',
      };
    } catch (error) {
      console.error('One-touch registerAndGetTemplate error:', error);
      messages.push(error instanceof Error ? error.message : String(error));
      return { success: false, messages, message: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get current connected device info
   */
  getConnectedDevice(): DeviceInfo | null {
    return this.connectedDevice;
  }

  /**
   * Get initialization status
   */
  getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  /**
   * Cleanup service
   */
  cleanup(): void {
    SecuGenBLE.removeAllListeners();
    this.isInitialized = false;
    this.connectedDevice = null;
  }

  /**
   * Process raw image buffer from device capture
   * Converts base64 to raw buffer, displays on canvas, or scales as needed
   * @param captureResult Result from capture() containing base64 imageData
   * @param canvas Optional canvas element to display on
   * @param targetWidth Optional target width for scaling
   * @param targetHeight Optional target height for scaling
   */
  processRawImage(
    captureResult: any,
    canvas?: HTMLCanvasElement,
    targetWidth?: number,
    targetHeight?: number,
  ): { buffer: Uint8Array; imageData?: ImageData } {
    // Import helper functions

    const base64Data = captureResult.imageData;
    const width = captureResult.width;
    const height = captureResult.height;

    if (!base64Data) {
      throw new Error('No image data in capture result');
    }

    // Convert base64 to raw buffer
    const rawBuffer = new Uint8Array(base64ToArrayBuffer(base64Data));

    // If canvas provided, draw image
    if (canvas) {
      if (targetWidth && targetHeight && (targetWidth !== width || targetHeight !== height)) {
        // Scale and draw
        const scaledImageData = scaleImageFast(width, height, rawBuffer, targetWidth, targetHeight);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          ctx.putImageData(scaledImageData, 0, 0);
        }
      } else {
        // Draw without scaling
        drawImageOnCanvas(canvas, rawBuffer, width, height);
      }
    }

    // Return buffer and optional scaled ImageData
    if (targetWidth && targetHeight && (targetWidth !== width || targetHeight !== height)) {
      const scaledImageData = scaleImageFast(width, height, rawBuffer, targetWidth, targetHeight);
      return { buffer: rawBuffer, imageData: scaledImageData };
    }

    return { buffer: rawBuffer };
  }

  /**
   * Get image statistics for quality assessment
   * @param captureResult Result from capture()
   */
  getImageQualityStats(captureResult: any): any {
    const base64Data = captureResult.imageData;
    if (!base64Data) {
      throw new Error('No image data');
    }

    const rawBuffer = new Uint8Array(base64ToArrayBuffer(base64Data));
    const stats = getImageStats(rawBuffer);

    return {
      ...stats,
      width: captureResult.width,
      height: captureResult.height,
      size: captureResult.size,
    };
  }

  /**
   * Thiết lập thời gian tắt nguồn cho thiết bị (wake-up feature)
   * @param timeoutMinutes Thời gian tắt nguồn tính bằng phút (mặc định 30 phút)
   */
  async setPowerOffTime(timeoutMinutes: number = 30): Promise<ServiceResult> {
    try {
      console.log(`⚡ Setting power off time: ${timeoutMinutes} minutes`);

      const result = await SecuGenBLE.setPowerOffTime({
        timeoutMinutes: timeoutMinutes,
      });

      console.log('✅ Power off time set successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to set power off time:', error);
      throw error;
    }
  }

  /**
   * Wake up and connect to preferred device
   * This will scan for the preferred device and attempt to connect
   */
  async wakeUpAndConnectPreferred(): Promise<ServiceResult> {
    try {
      const preferred = this.getPreferredDevice();
      if (!preferred) {
        return { success: false, message: 'No preferred device saved' };
      }

      console.log('🔋 Attempting to wake up and connect to preferred device:', preferred.name);

      // Initialize if not already done
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Start scanning for the preferred device
      console.log('🔍 Scanning for preferred device...');
      await this.scan(10000); // Scan for 10 seconds

      // Wait a bit for scan results
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Try to find and connect to the preferred device
      const foundDevice = this.discoveredDevices.find((d) => d.id === preferred.id || d.address === preferred.address);

      if (foundDevice) {
        console.log('📱 Found preferred device, attempting connection...');
        const connectResult = await this.connect(foundDevice.id);

        if (connectResult.connected) {
          console.log('✅ Successfully woke up and connected to preferred device');
          return { success: true, message: `Connected to ${foundDevice.name}` };
        } else {
          return { success: false, message: 'Found device but connection failed' };
        }
      } else {
        return { success: false, message: 'Preferred device not found in scan results' };
      }
    } catch (error) {
      console.error('Wake up and connect error:', error);
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }
}
