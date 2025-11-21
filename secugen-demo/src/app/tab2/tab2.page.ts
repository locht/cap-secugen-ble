import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef, NgZone } from '@angular/core';
import { SecuGenService } from '../services/secugen.service';
import { DeviceInfo, CaptureResult, VersionResult } from '@myduchospital/cap-secugen-ble';
import { Clipboard } from '@capacitor/clipboard';
import {
  base64ToArrayBuffer,
  drawImageOnCanvas,
  scaleImageFast,
  enhanceContrast,
  getImageStats,
} from '../services/image-utils';

/**
 * Interface định nghĩa cấu trúc thông báo hiển thị trong UI
 */
interface Message {
  text: string; // Nội dung thông báo
  type: 'success' | 'error' | 'info' | 'warning'; // Loại thông báo để styling
  timestamp: Date; // Thời gian tạo thông báo
}

/**
 * Interface định nghĩa các cài đặt cho việc chụp vân tay
 */
interface CaptureSettings {
  sizeOption: 'full' | 'half' | 'small' | 'tiny'; // full: 300x400, half: 150x200, small: 90x120, tiny: 60x80
  fullSize: boolean; // Backward compatibility - True: 300x400, False: 150x200
  wsqFormat: boolean; // True: nén WSQ, False: raw image
  timeoutSeconds: number; // Thời gian timeout cho capture
}

/**
 * Component Tab2 - Quản lý chức năng chụp vân tay
 * Hiển thị trạng thái kết nối, cài đặt capture, và kết quả chụp vân tay
 */
@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page implements OnInit, OnDestroy {
  // === CANVAS REFERENCES ===
  @ViewChild('captureCanvas') captureCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('scaledCanvas') scaledCanvas!: ElementRef<HTMLCanvasElement>;

  // Thông tin thiết bị đang kết nối
  connectedDevice: DeviceInfo | null = null;

  // Trạng thái đang chụp vân tay
  isCapturing = false;

  // Kết quả chụp vân tay (bao gồm hình ảnh và metadata)
  captureResult: CaptureResult | null = null;

  // userID được dùng khi đăng ký/xác thực (lưu state trên màn hình)
  enrolledUserId: number | null = null;

  // Template vân tay đã lấy (từ getTemplate) để dùng làm "chứng chỉ" so sánh với DB
  enrolledTemplate: string | null = null;

  // Thông tin phiên bản thiết bị
  versionInfo: VersionResult | null = null;

  // Danh sách thông báo hiển thị cho người dùng
  messages: Message[] = [];

  // === IMAGE PROCESSING PROPERTIES ===
  // Thống kê chất lượng hình ảnh
  imageStats: any = null;

  // Trạng thái enhancement
  isEnhanced = false;

  // === DEVICE SELECTOR PROPERTIES ===
  // Danh sách thiết bị có sẵn để chọn
  availableDevices: DeviceInfo[] = [];

  // ID thiết bị được chọn trong dropdown
  selectedDeviceId: string | null = null;

  // Thiết bị ưa thích đã lưu (backward compatibility)
  preferredDevice: DeviceInfo | null = null;

  // Danh sách thiết bị ưa thích
  preferredDevices: DeviceInfo[] = [];

  // Trạng thái đang scan
  isScanning = false;

  // Trạng thái đang kết nối
  isConnecting = false;

  // Timer cho capture progress
  private captureTimer: any;

  // === CAPTURE MODAL PROPERTIES ===
  // Hiển thị modal capture progress
  showCaptureModal = false;

  // Thông tin tiến trình capture
  captureProgress = {
    status: 'capturing', // 'capturing' | 'downloading' | 'complete'
    progress: 0, // 0-100%
    message: 'Đặt ngón tay lên cảm biến',
    startTime: 0, // Thời gian bắt đầu capture
    elapsedTime: 0, // Thời gian đã trôi qua (giây)
  };

  // Cài đặt mặc định cho việc chụp vân tay
  captureSettings: CaptureSettings = {
    sizeOption: 'full', // Chụp full size (300x400)
    fullSize: true, // Backward compatibility
    wsqFormat: true, // Sử dụng nén WSQ
    timeoutSeconds: 15, // Timeout 15 giây
  };

  // === QUICK CAPTURE PROPERTIES ===
  // Trạng thái đang chụp nhanh vân tay
  quickCaptureLoading = false;

  // Kết quả chụp nhanh vân tay
  quickCaptureResult: CaptureResult | null = null;

  // Thông báo trong quá trình chụp nhanh
  quickCaptureMessage = 'Đặt ngón tay lên cảm biến';

  // Thời gian đã chụp (giây)
  quickCaptureElapsedTime = 0;

  // Timer cho quick capture elapsed time
  private quickCaptureTimer: any;

  // Thông tin debug các template đang lưu trong localStorage (1:N local)
  localTemplatesCount = 0;
  localTemplatesInfo: string[] = [];

  // Biến tạm cho test match 1-1 trực tiếp
  template1: string | null = null;
  template2: string | null = null;

  // Inject service để giao tiếp với SecuGen plugin
  private secuGenService = inject(SecuGenService);
  private zone = inject(NgZone);

  /**
   * Khởi tạo component - Thiết lập timer để cập nhật trạng thái định kỳ
   */
  ngOnInit() {
    this.loadPreferredDevice();
    this.updateDeviceStatus();
    this.loadAvailableDevices();
    this.setupCaptureEventSubscriptions();

    // Kiểm tra trạng thái thiết bị và kết quả capture mỗi 2 giây
    setInterval(() => {
      this.updateDeviceStatus();
      this.checkCaptureResult();
      this.loadAvailableDevices();
    }, 2000);

    // Thử auto-connect với preferred device nếu có
    this.tryAutoConnect();
  }

  /**
   * Thiết lập subscription cho capture events
   */
  private setupCaptureEventSubscriptions() {
    // Subscribe capture progress
    this.secuGenService.captureProgress$.subscribe((progress) => {
      const currentTime = Date.now();
      const elapsedSeconds =
        this.captureProgress.startTime > 0 ? Math.round((currentTime - this.captureProgress.startTime) / 1000) : 0;

      this.captureProgress = {
        status: progress.status || 'capturing',
        progress: progress.progress || 0,
        message: progress.message || 'Đang xử lý...',
        startTime: this.captureProgress.startTime,
        elapsedTime: elapsedSeconds,
      };
    });

    // Subscribe capture complete
    this.secuGenService.captureComplete$.subscribe((result) => {
      console.log('🎉 Capture complete received:', result);

      const currentTime = Date.now();
      const totalElapsedSeconds =
        this.captureProgress.startTime > 0 ? Math.round((currentTime - this.captureProgress.startTime) / 1000) : 0;

      this.captureProgress = {
        status: 'complete',
        progress: 100,
        message: `Hoàn thành trong ${totalElapsedSeconds}s!`,
        startTime: this.captureProgress.startTime,
        elapsedTime: totalElapsedSeconds,
      };

      // Đóng modal sau 2 giây và hiển thị kết quả
      setTimeout(() => {
        this.showCaptureModal = false;
        this.addMessage(`Chụp vân tay thành công trong ${totalElapsedSeconds} giây!`, 'success');

        // Force update capture result để hiển thị hình ảnh
        this.checkCaptureResult();

        // Display image on canvas
        this.displayCaptureImage(result);

        // Get image statistics
        try {
          this.imageStats = this.secuGenService.getImageQualityStats(result);
          console.log('📊 Image stats:', this.imageStats);
        } catch (error) {
          console.error('Error getting stats:', error);
        }
      }, 2000);
    });
  }

  /**
   * Kiểm tra kết quả capture mới từ service và cập nhật UI
   * Tự động convert raw data thành PNG để hiển thị
   */
  private checkCaptureResult() {
    const result = this.secuGenService.getLastCaptureResult();
    if (result && result !== this.captureResult) {
      this.captureResult = {
        ...result,
        // Convert raw image data thành PNG base64 để hiển thị
        pngBase64: this.convertRawToPng(result.imageData, result.width, result.height),
      };
      this.addMessage('Chụp vân tay thành công!', 'success');
    }
  }

  /**
   * Cleanup khi component bị destroy
   */
  ngOnDestroy() {
    // Có thể thêm cleanup logic nếu cần
    console.log('Tab2 component destroyed');
  }

  /**
   * Thêm thông báo mới vào danh sách messages
   * @param text Nội dung thông báo
   * @param type Loại thông báo (success, error, info, warning)
   */
  private addMessage(text: string, type: Message['type'] = 'info') {
    this.messages.push({
      text,
      type,
      timestamp: new Date(),
    });
  }

  /**
   * Cập nhật trạng thái thiết bị kết nối từ service
   */
  private async updateDeviceStatus() {
    this.connectedDevice = this.secuGenService.getConnectedDevice();
  }

  /**
   * Thực hiện chụp vân tay với các cài đặt hiện tại
   * Gọi SecuGen plugin để bắt đầu quá trình capture
   */
  async captureFingerprint() {
    if (!this.connectedDevice) {
      this.addMessage('Không có thiết bị kết nối', 'error');
      return;
    }

    try {
      // Hiển thị modal và reset progress với timing
      this.showCaptureModal = true;
      const startTime = Date.now();
      this.captureProgress = {
        status: 'capturing',
        progress: 0,
        message: 'Đặt ngón tay lên cảm biến',
        startTime: startTime,
        elapsedTime: 0,
      };

      this.isCapturing = true;
      this.addMessage('Đang bắt đầu chụp vân tay...', 'info');

      // Start timer to update elapsed time every second
      this.startCaptureTimer();

      // Debug log settings
      console.log('📋 Capture settings:', this.captureSettings);

      // Gọi service với các tham số từ captureSettings
      const result = await this.secuGenService.captureWithSizeOption(
        this.captureSettings.sizeOption, // Kích thước ảnh: 'full', 'half', 'tiny'
        this.captureSettings.wsqFormat, // Định dạng nén
        this.captureSettings.timeoutSeconds * 1000, // Timeout (convert sang ms)
      );

      console.log('📸 Capture result:', result);

      this.captureResult = result;

      if (!result.success) {
        this.addMessage(`Chụp thất bại: ${result.message}`, 'error');
        this.showCaptureModal = false;
      }
    } catch (error) {
      this.addMessage(`Lỗi chụp vân tay: ${error}`, 'error');
      this.captureResult = { success: false, message: error instanceof Error ? error.message : String(error) };
      this.showCaptureModal = false;
    } finally {
      this.isCapturing = false; // Luôn reset trạng thái capturing
      this.stopCaptureTimer(); // Stop timer
    }
  }

  async startRegistration() {
    if (!this.connectedDevice) {
      this.addMessage('Không có thiết bị kết nối', 'error');
      return;
    }

    this.addMessage('Bắt đầu phiên đăng ký vân tay', 'info');
    console.log('▶️ startRegistration called');
    // TODO: Gọi service/plugin để bắt đầu quy trình đăng ký nếu có

    // Thực tế: gửi lệnh register xuống thiết bị với userID hiện tại (mặc định 1)
    try {
      const userID = this.enrolledUserId ?? 1;
      this.enrolledUserId = userID;

      const result = await this.secuGenService.register(userID, false);
      console.log('🔐 register result:', result);

      if (result.success) {
        this.addMessage(result.message || `Đã gửi lệnh đăng ký cho userID ${userID}`, 'success');
      } else {
        this.addMessage(result.message || 'Đăng ký vân tay thất bại', 'error');
      }
    } catch (error) {
      console.error('Register error in Tab2:', error);
      this.addMessage(`Lỗi đăng ký vân tay: ${error}`, 'error');
    }
  }

  async endRegistration() {
    if (!this.connectedDevice) {
      this.addMessage('Không có thiết bị kết nối', 'error');
      return;
    }

    this.addMessage('Kết thúc phiên đăng ký vân tay', 'info');
    console.log('⏹ endRegistration called');
    // TODO: Gọi service/plugin để kết thúc và lưu template đăng ký

    // Thực tế: gọi completeRegistration để firmware lưu template vào DB
    try {
      const result = await this.secuGenService.completeRegistration();
      console.log('🔐 completeRegistration result:', result);

      if (result.success) {
        this.addMessage(result.message || 'Hoàn tất đăng ký vân tay', 'success');
      } else {
        this.addMessage(result.message || 'Hoàn tất đăng ký thất bại', 'error');
      }
    } catch (error) {
      console.error('Complete registration error in Tab2:', error);
      this.addMessage(`Lỗi hoàn tất đăng ký vân tay: ${error}`, 'error');
    }
  }

  async verifyFingerprint() {
    if (!this.connectedDevice) {
      this.addMessage('Không có thiết bị kết nối', 'error');
      return;
    }

    if (!this.enrolledUserId) {
      this.addMessage('Chưa có userID đã đăng ký. Vui lòng đăng ký vân tay trước.', 'warning');
      return;
    }

    this.addMessage(`Bắt đầu xác thực vân tay cho userID ${this.enrolledUserId}`, 'info');
    console.log('✅ verifyFingerprint called, userID =', this.enrolledUserId);

    try {
      const result = await this.secuGenService.verify(this.enrolledUserId);
      console.log('verify result', result);

      if (result.success) {
        this.addMessage(result.message || 'Xác thực vân tay thành công', 'success');
      } else {
        this.addMessage(result.message || 'Xác thực vân tay thất bại', 'error');
      }
    } catch (error) {
      console.error('Verify error in Tab2:', error);
      this.addMessage(`Lỗi xác thực vân tay: ${error}`, 'error');
    }
  }

  async matchFingerprint() {
    if (!this.connectedDevice) {
      this.addMessage('Không có thiết bị kết nối', 'error');
      return;
    }

    if (!this.enrolledUserId) {
      this.addMessage('Chưa có userID đã đăng ký. Vui lòng đăng ký vân tay trước.', 'warning');
      return;
    }

    this.addMessage(`Bắt đầu MATCH vân tay cho userID ${this.enrolledUserId}`, 'info');
    console.log('✅ matchFingerprint called, userID =', this.enrolledUserId);

    try {
      const result = await this.secuGenService.match(this.enrolledUserId);
      console.log('match result', result);

      if (result.success) {
        const scoreText = typeof result.score === 'number' ? ` (score: ${result.score})` : '';
        this.addMessage(result.message || `Match thành công${scoreText}`, 'success');
      } else {
        const scoreText = typeof result.score === 'number' ? ` (score: ${result.score})` : '';
        this.addMessage(result.message || `Match thất bại${scoreText}`, 'error');
      }
    } catch (error) {
      console.error('Match error in Tab2:', error);
      this.addMessage(`Lỗi match vân tay: ${error}`, 'error');
    }
  }

  async identifyFingerprint() {
    if (!this.connectedDevice) {
      this.addMessage('Không có thiết bị kết nối', 'error');
      return;
    }

    this.addMessage('Bắt đầu nhận dạng vân tay trong toàn bộ DB', 'info');
    console.log('✅ identifyFingerprint called');

    try {
      const result = await this.secuGenService.identify();
      console.log('identify result', result);

      if (result.success) {
        this.addMessage(result.message || 'Nhận dạng vân tay thành công', 'success');
      } else {
        this.addMessage(result.message || 'Nhận dạng vân tay thất bại', 'error');
      }
    } catch (error) {
      console.error('Identify error in Tab2:', error);
      this.addMessage(`Lỗi nhận dạng vân tay: ${error}`, 'error');
    }
  }

  async oneTouchRegisterAndGetTemplate() {
    if (!this.connectedDevice) {
      this.addMessage('Không có thiết bị kết nối', 'error');
      return;
    }

    // Xác định startUserID theo cùng logic với service (dựa trên localStorage)
    let startUserID = this.enrolledUserId ?? 1;
    if (startUserID < 1 || startUserID > 999) {
      startUserID = 1;
    }

    try {
      const saved = localStorage.getItem('secugen_last_user_id');
      if (saved) {
        const n = parseInt(saved, 10);
        if (!isNaN(n) && n >= 1 && n <= 999) {
          startUserID = n + 1;
          if (startUserID > 999) {
            startUserID = 1;
          }
        }
      }
    } catch (e) {
      console.error('Error reading secugen_last_user_id from localStorage in Tab2:', e);
    }

    this.enrolledUserId = startUserID;

    this.addMessage(`Bắt đầu đăng ký 1 chạm, userID bắt đầu từ ${startUserID}`, 'info');
    console.log('▶️ oneTouchRegisterAndGetTemplate called, startUserID =', startUserID);

    try {
      const result = await this.secuGenService.registerAndGetTemplate(startUserID, false);
      console.log('oneTouchRegisterAndGetTemplate result', result);

      // Hiển thị tất cả message con nếu có
      if (result.messages && Array.isArray(result.messages)) {
        for (const msg of result.messages) {
          if (msg) {
            this.addMessage(msg, 'info');
          }
        }
      }

      if (result.success && result.template) {
        // Cập nhật lại userID thực sự đã dùng (có thể khác startUserID nếu bị trùng)
        if (result.userID) {
          this.enrolledUserId = result.userID;
        }
        // Lưu template vào state hiện tại
        this.enrolledTemplate = result.template;

        if (!this.captureResult) {
          this.captureResult = { success: true } as any;
        }
        (this.captureResult as any).template = result.template;

        // Tự động lưu template này vào localStorage để dùng cho match local (1:N)
        // Append vào mảng secugen_local_templates
        try {
          const saved = localStorage.getItem('secugen_local_templates');
          let templates: string[] = [];

          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed)) {
                templates = parsed as string[];
              } else if (typeof parsed === 'string') {
                templates = [parsed];
              } else {
                templates = [saved];
              }
            } catch {
              templates = [saved];
            }
          }

          templates.push(result.template);
          localStorage.setItem('secugen_local_templates', JSON.stringify(templates));
          this.addMessage(`Đã auto-append template vào localStorage (tổng ${templates.length} template).`, 'info');
        } catch (e) {
          console.error('Error auto-appending template to localStorage:', e);
        }

        this.addMessage(
          result.message || `Đăng ký 1 chạm và lấy template thành công (userID ${this.enrolledUserId})`,
          'success',
        );
      } else {
        this.addMessage(result.message || 'Đăng ký 1 chạm thất bại', 'error');
      }
    } catch (error) {
      console.error('oneTouchRegisterAndGetTemplate error in Tab2:', error);
      this.addMessage(`Lỗi đăng ký 1 chạm: ${error}`, 'error');
    }
  }

  /**
   * Hủy bỏ quá trình capture
   */
  cancelCapture() {
    console.log('🚫 Cancel capture clicked');
    this.showCaptureModal = false;
    this.isCapturing = false;
    this.stopCaptureTimer();
    this.addMessage('Đã hủy chụp vân tay', 'warning');
    // TODO: Có thể thêm logic để stop capture ở native side nếu cần
  }

  /**
   * Xử lý khi modal bị đóng
   */
  onModalDismiss() {
    console.log('🚫 Modal dismissed');
    this.showCaptureModal = false;
    this.isCapturing = false;
    this.stopCaptureTimer();
  }

  /**
   * Quick Capture - Chụp nhanh vân tay mà không cần modal
   * Kết quả hiển thị trực tiếp, chỉ có loading indicator
   * Sử dụng cùng logic như captureFingerprint nhưng UI khác
   */
  async quickCaptureFingerprint() {
    if (!this.connectedDevice) {
      this.addMessage('Không có thiết bị kết nối', 'error');
      return;
    }

    try {
      // Bắt đầu loading
      this.quickCaptureLoading = true;
      this.quickCaptureMessage = 'Đặt ngón tay lên cảm biến';
      this.quickCaptureElapsedTime = 0;
      const startTime = Date.now();

      // Start timer to update elapsed time
      this.startQuickCaptureTimer(startTime);

      this.addMessage('⚡ Bắt đầu chụp nhanh vân tay...', 'info');

      // Gọi service chụp vân tay
      const result = await this.secuGenService.captureWithSizeOption(
        'tiny', // Quick capture luôn dùng tiny size
        this.captureSettings.wsqFormat,
        this.captureSettings.timeoutSeconds * 1000,
      );

      console.log('⚡ Quick capture result:', result);

      // Lưu kết quả với timestamp
      this.quickCaptureResult = {
        ...result,
        timestamp: new Date(),
      } as any;

      if (result.success) {
        this.addMessage('✓ Chụp vân tay thành công!', 'success');
      } else {
        this.addMessage(`✗ Chụp thất bại: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('⚡ Quick capture error:', error);
      this.quickCaptureResult = {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
      this.addMessage(`⚡ Lỗi chụp nhanh: ${error}`, 'error');
    } finally {
      this.quickCaptureLoading = false;
      this.stopQuickCaptureTimer();
    }
  }

  /**
   * Xóa kết quả quick capture
   */
  clearQuickCaptureResult() {
    this.quickCaptureResult = null;
    this.quickCaptureMessage = 'Đặt ngón tay lên cảm biến';
    this.quickCaptureElapsedTime = 0;
    this.addMessage('Đã xóa kết quả chụp nhanh', 'info');
  }

  /**
   * Bắt đầu timer cho quick capture
   */
  private startQuickCaptureTimer(startTime: number) {
    this.quickCaptureTimer = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      this.quickCaptureElapsedTime = elapsed;
      this.quickCaptureMessage = `Đang chụp... ${elapsed}s`;
    }, 100);
  }

  /**
   * Dừng timer cho quick capture
   */
  private stopQuickCaptureTimer() {
    if (this.quickCaptureTimer) {
      clearInterval(this.quickCaptureTimer);
      this.quickCaptureTimer = null;
    }
  }

  /**
   * Lấy thông tin phiên bản của thiết bị SecuGen
   * Hiển thị firmware và các thông tin kỹ thuật khác
   */
  async getDeviceVersion() {
    if (!this.connectedDevice) {
      this.addMessage('Không có thiết bị kết nối', 'error');
      return;
    }

    try {
      this.addMessage('Đang lấy thông tin phiên bản...', 'info');

      const result = await this.secuGenService.getVersion();

      if (result.success) {
        this.versionInfo = result as VersionResult;
        this.addMessage('Lấy thông tin phiên bản thành công', 'success');
      } else {
        this.addMessage(`Thất bại: ${result.message}`, 'error');
      }
    } catch (error) {
      this.addMessage(`Lỗi phiên bản: ${error}`, 'error');
    }
  }

  /**
   * Sao chép template vân tay vào clipboard
   * Template là dữ liệu đã xử lý có thể dùng để so sánh
   */
  async getFingerprintTemplate() {
    if (!this.connectedDevice) {
      this.addMessage('Không có thiết bị kết nối', 'error');
      return;
    }

    // Tạm thời dùng userID mặc định 1, sau này có thể cho nhập từ UI
    const userID = this.enrolledUserId ?? 1;
    this.enrolledUserId = userID;
    this.addMessage(`Đang lấy template vân tay cho userID ${userID}...`, 'info');

    try {
      const result = await this.secuGenService.getTemplate(userID);

      if (result.success && result.template) {
        // Lưu template vào captureResult để UI hoặc chỗ khác có thể dùng
        if (!this.captureResult) {
          this.captureResult = { success: true } as any;
        }
        (this.captureResult as any).template = result.template;

        // Lưu lại template này làm "chứng chỉ" để so sánh với DB sau này
        this.enrolledTemplate = result.template;

        // Lưu N template vào localStorage để làm "candidates" cho bài test 1:N local
        try {
          const saved = localStorage.getItem('secugen_local_templates');
          let templates: string[] = [];

          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed)) {
                templates = parsed as string[];
              } else if (typeof parsed === 'string') {
                templates = [parsed];
              } else {
                // Dữ liệu cũ không đúng dạng, fallback về 1 phần tử raw
                templates = [saved];
              }
            } catch {
              // Nếu parse JSON lỗi (ví dụ giá trị cũ là string thuần), coi như 1 phần tử
              templates = [saved];
            }
          }

          templates.push(result.template);
          localStorage.setItem('secugen_local_templates', JSON.stringify(templates));
          this.addMessage(`Đã lưu template vào localStorage (tổng ${templates.length} template).`, 'info');
        } catch (e) {
          console.error('Error saving template list to localStorage:', e);
        }

        this.addMessage('Lấy template vân tay thành công', 'success');
        console.log('📄 Fingerprint template:', result.template);
      } else {
        this.addMessage(result.message || 'Lấy template vân tay thất bại', 'error');
      }
    } catch (error) {
      this.addMessage(`Lỗi lấy template vân tay: ${error}`, 'error');
    }
  }

  /**
   * Lưu template hiện tại (template đã đăng ký / vừa lấy) vào localStorage
   * để dùng làm probe trong bài test match local 2 template.
   */
  saveCurrentTemplateForLocalMatch() {
    const template = this.enrolledTemplate || (this.captureResult as any)?.template;
    if (!template) {
      this.addMessage('Chưa có template nào để lưu. Hãy đăng ký và lấy template trước.', 'warning');
      return;
    }

    try {
      localStorage.setItem('secugen_local_probe_template', template);
      this.addMessage('Đã lưu template hiện tại để dùng làm probe cho match local.', 'success');

      // Đồng thời append template này vào danh sách secugen_local_templates để dùng cho 1:N
      try {
        const saved = localStorage.getItem('secugen_local_templates');
        let templates: string[] = [];

        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              templates = parsed as string[];
            } else if (typeof parsed === 'string') {
              templates = [parsed];
            } else {
              templates = [saved];
            }
          } catch {
            templates = [saved];
          }
        }

        templates.push(template);
        localStorage.setItem('secugen_local_templates', JSON.stringify(templates));
        this.addMessage(`Đã append template vào danh sách local (tổng ${templates.length} template).`, 'info');
      } catch (e) {
        console.error('Error appending template to secugen_local_templates:', e);
      }
    } catch (error) {
      console.error('Error saving local probe template:', error);
      this.addMessage(`Lỗi lưu template local: ${error}`, 'error');
    }
  }

  /**
   * So sánh template REALTIME (đọc trực tiếp từ máy bằng getTemplate)
   * với N template đã lưu trong localStorage (1:N) bằng FDxSDKPro trên Android.
   *
   * - N templates được lưu bằng hàm getFingerprintTemplate vào key 'secugen_local_templates'.
   * - Khi gọi matchLocalTemplates:
   *   + Lấy userID hiện tại
   *   + Gọi lại getTemplate(userID) để lấy probe realtime
   *   + Loop qua tất cả templates trong localStorage và dùng matchTemplatesLocal
   */
  async matchLocalTemplates() {
    if (!this.connectedDevice) {
      this.addMessage('Không có thiết bị kết nối', 'error');
      return;
    }

    // Xác định userID để đọc template realtime
    const userID = this.enrolledUserId ?? 1;
    this.enrolledUserId = userID;

    // Load danh sách N template đã lưu trong localStorage
    let candidates: string[] = [];
    try {
      const saved = localStorage.getItem('secugen_local_templates');
      if (saved) {
        candidates = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading local templates from storage:', e);
    }

    if (!candidates || candidates.length === 0) {
      this.addMessage('Chưa có template nào trong localStorage. Hãy dùng chức năng "Lấy template vân tay" để lưu trước.', 'warning');
      return;
    }

    this.addMessage(
      `Bắt đầu match LOCAL 1:N: so sánh template realtime (userID ${userID}) với ${candidates.length} template local...`,
      'info',
    );

    try {
      // 1) Lấy template realtime hiện tại từ thiết bị
      const current = await this.secuGenService.getTemplate(userID);
      if (!current.success || !current.template) {
        this.addMessage(current.message || 'Không lấy được template realtime để match.', 'error');
        return;
      }

      const probe = current.template;
      const threshold = 80;

      let bestScore = -1;
      let bestIndex = -1;
      let anyMatched = false;

      // 2) So sánh 1:N bằng cách loop qua từng candidate
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        if (!candidate) continue;

        const res = await this.secuGenService.matchTemplatesLocal(probe, candidate, threshold);
        console.log(`matchTemplatesLocal result for candidate[${i}]`, res);

        if (!res.success) {
          continue;
        }

        const score = typeof res.score === 'number' ? res.score : -1;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }

        if (res.matched) {
          anyMatched = true;
        }
      }

      if (bestIndex === -1) {
        this.addMessage('Match local 1:N thất bại (không có candidate hợp lệ).', 'error');
        return;
      }

      const scoreText = bestScore >= 0 ? ` (best score: ${bestScore}, threshold: ${threshold})` : '';
      if (anyMatched) {
        this.addMessage(
          `KẾT QUẢ MATCH LOCAL 1:N: TRÙNG với candidate index ${bestIndex}${scoreText}.`,
          'success',
        );
      } else {
        this.addMessage(`KẾT QUẢ MATCH LOCAL 1:N: KHÔNG TRÙNG${scoreText}.`, 'warning');
      }
    } catch (error) {
      console.error('matchLocalTemplates error:', error);
      this.addMessage(`Lỗi match local template: ${error}`, 'error');
    }
  }

  // /**
  //  * Đọc danh sách template đang lưu trong localStorage (secugen_local_templates)
  //  * và cập nhật localTemplatesCount/localTemplatesInfo để hiển thị lên UI.
  //  */
  // refreshLocalTemplates() {
  //   try {
  //     const saved = localStorage.getItem('secugen_local_templates');
  //     let templates: string[] = [];

  //     if (saved) {
  //       try {
  //         const parsed = JSON.parse(saved);
  //         if (Array.isArray(parsed)) {
  //           templates = parsed as string[];
  //         } else if (typeof parsed === 'string') {
  //           templates = [parsed];
  //         } else {
  //           templates = [saved];
  //         }
  //       } catch {
  //         templates = [saved];
  //       }
  //     }

  //     this.localTemplatesCount = templates.length;
  //     this.localTemplatesInfo = templates.map((t, idx) => `#${idx} - length=${t?.length ?? 0}`);

  //     this.addMessage(`Đã load ${this.localTemplatesCount} template từ localStorage.`, 'info');
  //   } catch (error) {
  //     console.error('Error refreshing local templates:', error);
  //     this.addMessage(`Lỗi đọc templates local: ${error}`, 'error');
  //   }
  // }

  // /**
  //  * Xóa toàn bộ templates lưu trong localStorage cho bài test 1:N local.
  //  */
  // clearLocalTemplates() {
  //   try {
  //     localStorage.removeItem('secugen_local_templates');
  //     this.localTemplatesCount = 0;
  //     this.localTemplatesInfo = [];
  //     this.addMessage('Đã xóa tất cả templates trong localStorage (secugen_local_templates).', 'warning');
  //   } catch (error) {
  //     console.error('Error clearing local templates:', error);
  //     this.addMessage(`Lỗi xóa templates local: ${error}`, 'error');
  //   }
  // }

  // === TEST MATCH 1-1 TRỰC TIẾP ===

  // async registerForTemplate1() {
  //   this.addMessage('Bắt đầu đăng ký cho template 1 (userID=1)...', 'info');
  //   const regStart = await this.secuGenService.register(999, false);
  //   if (!regStart.success) {
  //     this.addMessage(`Đăng ký (start) cho userID 1 thất bại: ${regStart.message}`, 'error');
  //     return;
  //   }
  //   this.addMessage('Đặt ngón tay lên cảm biến...', 'info');
  //   // Giả định người dùng đặt ngón tay và chờ complete
  //   setTimeout(async () => {
  //     const regEnd = await this.secuGenService.completeRegistration();
  //     if (regEnd.success) {
  //       this.addMessage('Đăng ký cho userID 1 thành công.', 'success');
  //     } else {
  //       this.addMessage(`Đăng ký (end) cho userID 1 thất bại: ${regEnd.message}`, 'error');
  //     }
  //   }, 3000); // Chờ 3s để người dùng đặt ngón tay
  // }

  // async registerForTemplate2() {
  //   this.addMessage('Bắt đầu đăng ký cho template 2 (userID=2)...', 'info');
  //   const regStart = await this.secuGenService.register(998, false);
  //   if (!regStart.success) {
  //     this.addMessage(`Đăng ký (start) cho userID 2 thất bại: ${regStart.message}`, 'error');
  //     return;
  //   }
  //   this.addMessage('Đặt ngón tay lên cảm biến...', 'info');
  //   setTimeout(async () => {
  //     const regEnd = await this.secuGenService.completeRegistration();
  //     if (regEnd.success) {
  //       this.addMessage('Đăng ký cho userID 2 thành công.', 'success');
  //     } else {
  //       this.addMessage(`Đăng ký (end) cho userID 2 thất bại: ${regEnd.message}`, 'error');
  //     }
  //   }, 3000);
  // }

  // async getTemplate1() {
  //   this.addMessage('Bắt đầu lấy template 1 (từ userID=1)...', 'info');
  //   const result = await this.secuGenService.getTemplate(999);
  //   if (result.success && result.template) {
  //     this.zone.run(() => {
  //       this.template1 = result.template || null;
  //       this.addMessage('Đã lấy template 1 thành công.', 'success');
  //     });
  //   } else {
  //     this.addMessage(`Lấy template 1 thất bại: ${result.message}`, 'error');
  //   }
  // }

  // async getTemplate2() {
  //   this.addMessage('Bắt đầu lấy template 2 (từ userID=2)...', 'info');
  //   const result = await this.secuGenService.getTemplate(998);
  //   if (result.success && result.template) {
  //     this.zone.run(() => {
  //       this.template2 = result.template || null;
  //       this.addMessage('Đã lấy template 2 thành công.', 'success');
  //     });
  //   } else {
  //     this.addMessage(`Lấy template 2 thất bại: ${result.message}`, 'error');
  //   }
  // }

  // async compareTemplates() {
  //   // if (!this.template1 || !this.template2) {
  //   //   this.addMessage('Chưa có đủ 2 template để so sánh.', 'warning');
  //   //   return;
  //   // }

  //   this.addMessage('Bắt đầu so sánh template 1 và 2...', 'info');
  //   try {
  //     const template1 = `0xF470C1AC2CAB8064E78F33D7A777DE86417CBE23DA977497C9FA5DF6626BDFDA8770779DD0E6AE387863A89E7B1FC0B1EA2EADCA62C47D46A15B16D7EADD351E2D7227ECDBBE7F591130C5592B8735FFA38D80EBF19BB63B1889A8ED6078228C07EAED0C94166488828979A69CBF2045CA330B2C772758078C80D871ECE49DE1DA39B60F9F528064B464FFCD9D01FD2E79054B84E8B1529BB084E9804F898E9C34FEB116ECB58425F446C3F54E5CDC55785AC4B88805E3F7C216BB17E066CFB4DF1E4AD23DC71B76B3B47FED08EB4001661F3A58D284D33A7F983126EB7431E296F2A7121791223A556F8DD7F04EBF601B2DC9EBAF0D5F602A64FF47F06CF97C1B2DC9EBAF0D5F602A64FF47F06CF97C1B2DC9EBAF0D5F602A64FF47F06CF97C1B2DC9EBAF0D5F602A64FF47F06CF97C1B2DC9EBAF0D5F602A64FF47F06CF97C1B2DC9EBAF0D5F602A64FF47F06CF97C1B2DC9EBAF0D5F602A64FF47F06CF97C1B2DC9EBAF0D5F602A64FF47F06CF97C1B2DC9EBAF0D5F602A64FF47F06CF97C1B2DC9EBAF0D5F602A64FF47F06CF97C`
  //     const template2 = `0xADBE1328B8BDBD9AE6C12B944FC08F801BB1D3C2F7F682AD243F4DE5EC98F92136ECB1624BF7994B4E6422547187E25872042B14A897308D48824FAFB1B678706F6C4A99544A2A83B7AF4763EA01C57F0DE7E0BA399A647F3DA000947861ACD0C4EA0A5A68DC5431210EACFB53FD6331A8834D2961CE310D4325723281E1A5389E12B2246B1337E140C02A4CA6168743ACA0A1BEF18A169B2A4A289451221E6468BBECCE6462C15ACD5EAEF21679841593CC02D6144FC6285C39009E320563FCB764EDE943FF525E80AFD1BCDC93A27D559799EB658F0E65F3E1ED6B668871DED4A73BF3B7AB81A0D5FC97498F084773BB1E17AC092E4705FDCC11EF73B588B8313531E460A910ADA6ACFFCF42B4B9833DD4A2BCB964FD22EC2140357B1EA8081B2DC9EBAF0D5F602A64FF47F06CF97C1B2DC9EBAF0D5F602A64FF47F06CF97C1B2DC9EBAF0D5F602A64FF47F06CF97C1B2DC9EBAF0D5F602A64FF47F06CF97C1B2DC9EBAF0D5F602A64FF47F06CF97C1B2DC9EBAF0D5F602A64FF47F06CF97C1B2DC9EBAF0D5F602A64FF47F06CF97C`

  //     const res = await this.secuGenService.matchTemplatesLocal(template1, template2, 80);
  //     if (!res.success) {
  //       this.addMessage(res.message || 'So sánh thất bại', 'error');
  //       return;
  //     }

  //     const scoreText = typeof res.score === 'number' ? ` (score: ${res.score}, threshold: ${res.threshold})` : '';
  //     if (res.matched) {
  //       this.addMessage(`KẾT QUẢ: TRÙNG${scoreText}`, 'success');
  //     } else {
  //       this.addMessage(`KẾT QUẢ: KHÔNG TRÙNG${scoreText}`, 'warning');
  //     }
  //   } catch (error) {
  //     console.error('compareTemplates error:', error);
  //     this.addMessage(`Lỗi so sánh: ${error}`, 'error');
  //   }
  // }

  /**
   * Xóa tất cả kết quả capture và thông tin phiên bản
   */
  clearResults() {
    this.captureResult = null;
    this.versionInfo = null;
    this.addMessage('Đã xóa kết quả', 'info');
  }

  /**
   * Xóa tất cả thông báo trong danh sách
   */
  clearMessages() {
    this.messages = [];
  }

  /**
   * Chuyển đổi dữ liệu raw grayscale thành PNG base64 để hiển thị
   * @param base64Data Dữ liệu raw image dạng base64 từ SecuGen
   * @param width Chiều rộng ảnh (pixels)
   * @param height Chiều cao ảnh (pixels)
   * @returns PNG base64 string để hiển thị trong <img> tag
   */
  private convertRawToPng(base64Data: string, width: number, height: number): string {
    try {
      // Tạo canvas để xử lý dữ liệu ảnh
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) return base64Data;

      canvas.width = width;
      canvas.height = height;

      // Giải mã base64 thành binary data
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Tạo ImageData từ raw grayscale bytes
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      // Chuyển đổi từng pixel từ grayscale sang RGBA
      for (let i = 0; i < bytes.length; i++) {
        const pixelIndex = i * 4;
        const grayValue = bytes[i];

        // Đặt RGB cùng giá trị để tạo grayscale
        data[pixelIndex] = grayValue; // Red
        data[pixelIndex + 1] = grayValue; // Green
        data[pixelIndex + 2] = grayValue; // Blue
        data[pixelIndex + 3] = 255; // Alpha (độ trong suốt)
      }

      // Vẽ image data lên canvas
      ctx.putImageData(imageData, 0, 0);

      // Chuyển canvas thành PNG base64
      return canvas.toDataURL('image/png').split(',')[1];
    } catch (error) {
      console.error('Lỗi chuyển đổi raw data sang PNG:', error);
      return base64Data; // Trả về dữ liệu gốc nếu conversion thất bại
    }
  }

  // === DEVICE SELECTOR METHODS ===

  /**
   * Load thiết bị ưa thích từ localStorage
   */
  private loadPreferredDevice() {
    this.preferredDevice = this.secuGenService.getPreferredDevice();
    this.preferredDevices = this.secuGenService.getPreferredDevices();
  }

  /**
   * Load danh sách thiết bị có sẵn từ service
   */
  private loadAvailableDevices() {
    this.availableDevices = this.secuGenService.getDiscoveredDevices();
  }

  /**
   * Thử auto-connect với preferred device
   */
  private async tryAutoConnect() {
    if (this.preferredDevice && !this.connectedDevice) {
      this.addMessage('Đang thử kết nối với thiết bị ưa thích...', 'info');

      // Scan trước để tìm thiết bị
      await this.scanForDevices();

      // Thử auto-connect
      const success = await this.secuGenService.autoConnectPreferredDevice();
      if (success) {
        this.addMessage('Đã tự động kết nối với thiết bị ưa thích!', 'success');
      } else {
        this.addMessage('Không thể tự động kết nối. Vui lòng chọn thiết bị thủ công.', 'warning');
      }
    }
  }

  /**
   * Quét tìm thiết bị SecuGen
   */
  async scanForDevices() {
    if (this.isScanning) return;

    try {
      this.isScanning = true;
      this.addMessage('Đang quét thiết bị...', 'info');

      await this.secuGenService.initialize();
      const result = await this.secuGenService.scan(10000);

      this.loadAvailableDevices();

      if (this.availableDevices.length > 0) {
        this.addMessage(`Tìm thấy ${this.availableDevices.length} thiết bị`, 'success');
      } else {
        this.addMessage('Không tìm thấy thiết bị nào', 'warning');
      }
    } catch (error) {
      this.addMessage(`Lỗi quét thiết bị: ${error}`, 'error');
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Xử lý khi người dùng chọn thiết bị từ dropdown
   */
  onDeviceSelected(event: any) {
    this.selectedDeviceId = event.detail.value;
    const selectedDevice = this.availableDevices.find((d) => d.id === this.selectedDeviceId);
    if (selectedDevice) {
      this.addMessage(`Đã chọn: ${selectedDevice.name}`, 'info');
    }
  }

  /**
   * Kết nối với thiết bị đã chọn
   */
  async connectToSelectedDevice() {
    if (!this.selectedDeviceId) {
      this.addMessage('Vui lòng chọn thiết bị trước', 'warning');
      return;
    }

    try {
      this.isConnecting = true;
      this.addMessage('Đang kết nối...', 'info');

      const result = await this.secuGenService.connect(this.selectedDeviceId);

      if (result.connected) {
        this.addMessage('Kết nối thành công!', 'success');
        this.updateDeviceStatus();
      } else {
        this.addMessage('Kết nối thất bại', 'error');
      }
    } catch (error) {
      this.addMessage(`Lỗi kết nối: ${error}`, 'error');
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Ngắt kết nối khỏi thiết bị hiện tại
   */
  async disconnectDevice() {
    if (!this.connectedDevice) {
      this.addMessage('Không có thiết bị nào để ngắt kết nối', 'warning');
      return;
    }

    try {
      this.addMessage('Đang ngắt kết nối thiết bị...', 'info');

      const result = await this.secuGenService.disconnect();

      if (result.success) {
        this.addMessage('Đã ngắt kết nối thiết bị', 'success');
        await this.updateDeviceStatus();
      } else {
        this.addMessage(result.message || 'Ngắt kết nối thất bại', 'error');
      }
    } catch (error) {
      this.addMessage(`Lỗi ngắt kết nối: ${error}`, 'error');
    }
  }

  /**
   * Lưu thiết bị hiện tại làm thiết bị ưa thích
   */
  saveCurrentAsPreferred() {
    if (this.connectedDevice) {
      this.secuGenService.savePreferredDevice(this.connectedDevice);
      this.loadPreferredDevice();
      this.addMessage('Đã lưu thiết bị làm ưa thích!', 'success');
    }
  }

  /**
   * Xóa thiết bị ưa thích
   */
  clearPreferredDevice() {
    this.secuGenService.clearPreferredDevice();
    this.preferredDevice = null;
    this.preferredDevices = [];
    this.addMessage('Đã xóa tất cả thiết bị ưa thích', 'info');
  }

  /**
   * Xóa một thiết bị cụ thể khỏi danh sách ưa thích
   */
  removePreferredDevice(deviceId: string) {
    this.secuGenService.removePreferredDevice(deviceId);
    this.loadPreferredDevice(); // Reload the list
    this.addMessage('Đã xóa thiết bị khỏi danh sách ưa thích', 'info');
  }

  /**
   * Xử lý thay đổi cài đặt capture
   */
  onSettingsChange(setting: string, event: any) {
    const value = event.detail.value;
    console.log(`🔧 Settings changed: ${setting} = ${value}`);

    if (setting === 'sizeOption') {
      this.captureSettings.sizeOption = value;
      // Update fullSize for backward compatibility
      this.captureSettings.fullSize = value === 'full';

      const sizeLabels = {
        full: 'Full Size (300x400)',
        half: 'Half Size (150x200)',
        small: 'Small Size (90x120)',
        tiny: 'Tiny Size (60x80)',
      };
      this.addMessage(`Đã chọn: ${sizeLabels[value as keyof typeof sizeLabels]}`, 'info');
    } else if (setting === 'wsqFormat') {
      this.captureSettings.wsqFormat = value;
      this.addMessage(`Đã chọn: ${value ? 'WSQ Compressed' : 'Raw Image'}`, 'info');
    }

    console.log('📋 Current settings:', this.captureSettings);
  }

  /**
   * Thiết lập thời gian wake-up cho thiết bị
   */
  async setPowerOffTime() {
    if (!this.connectedDevice) {
      this.addMessage('Không có thiết bị kết nối', 'error');
      return;
    }

    try {
      this.addMessage('Đang thiết lập wake-up time...', 'info');

      const result = await this.secuGenService.setPowerOffTime(30); // 30 phút

      if (result.success) {
        this.addMessage('✅ Đã thiết lập wake-up time: 30 phút', 'success');
      } else {
        this.addMessage(`❌ Thiết lập thất bại: ${result.message}`, 'error');
      }
    } catch (error) {
      this.addMessage(`❌ Lỗi thiết lập wake-up: ${error}`, 'error');
    }
  }

  /**
   * Wake up and connect to preferred device
   */
  async wakeUpAndConnect() {
    if (this.isConnecting) return;

    try {
      this.isConnecting = true;
      this.addMessage('🔋 Đang đánh thức và kết nối thiết bị ưa thích...', 'info');

      const result = await this.secuGenService.wakeUpAndConnectPreferred();

      if (result.success) {
        this.addMessage(`✅ ${result.message}`, 'success');
        this.updateDeviceStatus();
      } else {
        this.addMessage(`❌ ${result.message}`, 'error');
      }
    } catch (error) {
      this.addMessage(`❌ Lỗi đánh thức thiết bị: ${error}`, 'error');
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Start timer to track capture progress
   */
  private startCaptureTimer() {
    this.stopCaptureTimer(); // Clear any existing timer

    this.captureTimer = setInterval(() => {
      if (this.captureProgress.startTime > 0) {
        const currentTime = Date.now();
        const elapsedSeconds = Math.round((currentTime - this.captureProgress.startTime) / 1000);
        this.captureProgress.elapsedTime = elapsedSeconds;
      }
    }, 1000); // Update every second
  }

  /**
   * Stop capture timer
   */
  private stopCaptureTimer() {
    if (this.captureTimer) {
      clearInterval(this.captureTimer);
      this.captureTimer = null;
    }
  }

  /**
   * Display captured raw image on canvas with scaling
   */
  displayCaptureImage(captureResult: any) {
    if (!this.captureCanvas || !this.scaledCanvas) {
      console.warn('⚠️ Canvas refs not ready');
      return;
    }

    const canvas = this.captureCanvas.nativeElement;
    const scaledCanvas = this.scaledCanvas.nativeElement;

    try {
      // Convert base64 to raw buffer
      const rawBuffer = new Uint8Array(base64ToArrayBuffer(captureResult.imageData));
      const width = captureResult.width;
      const height = captureResult.height;

      // Display original on first canvas
      drawImageOnCanvas(canvas, rawBuffer, width, height);
      console.log(`✅ Tab2: Displayed ${width}x${height} image`);

      // Display scaled version (100x150) on second canvas
      const scaledImageData = scaleImageFast(width, height, rawBuffer, 100, 150);
      scaledCanvas.width = 100;
      scaledCanvas.height = 150;
      const ctx = scaledCanvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(scaledImageData, 0, 0);
        console.log('✅ Tab2: Displayed scaled 100x150 image');
      }
    } catch (error) {
      console.error('Tab2: Error displaying image:', error);
    }
  }

  /**
   * Enhance image contrast and redisplay
   */
  enhanceImageContrast() {
    if (!this.captureResult) {
      console.warn('❌ No capture result');
      return;
    }

    try {
      const imageData = (this.captureResult as any).imageData;
      const width = (this.captureResult as any).width;
      const height = (this.captureResult as any).height;

      const rawBuffer = new Uint8Array(base64ToArrayBuffer(imageData));
      const enhanced = enhanceContrast(rawBuffer);

      const canvas = this.captureCanvas.nativeElement;
      drawImageOnCanvas(canvas, enhanced, width, height);
      console.log('✅ Tab2: Image contrast enhanced');
      this.isEnhanced = true;
    } catch (error) {
      console.error('Tab2: Error enhancing contrast:', error);
    }
  }

  /**
   * Reset enhancement
   */
  resetEnhancement() {
    if (this.captureResult) {
      this.displayCaptureImage(this.captureResult);
      this.isEnhanced = false;
    }
  }
}
