import { WebPlugin } from '@capacitor/core';

import type {
  SecuGenBLEPlugin,
  ServiceResult,
  ScanResult,
  ScanOptions,
  ConnectOptions,
  ConnectionResult,
  CaptureOptions,
  CaptureResult,
  RegisterOptions,
  VerifyOptions,
  MatchResult,
  MatchOptions,
  DeleteOptions,
  VersionResult,
} from './definitions';

export class SecuGenBLEWeb extends WebPlugin implements SecuGenBLEPlugin {
  async initialize(): Promise<ServiceResult> {
    console.log('SecuGenBLE Web: initialize');
    return {
      success: false,
      message: 'SecuGen BLE plugin is not supported on web platform',
    };
  }

  async isBluetoothEnabled(): Promise<{ enabled: boolean }> {
    console.log('SecuGenBLE Web: isBluetoothEnabled');
    return { enabled: false };
  }

  async scan(_options?: ScanOptions): Promise<ScanResult> {
    console.log('SecuGenBLE Web: scan');
    return { devices: [] };
  }

  async stopScan(): Promise<ServiceResult> {
    console.log('SecuGenBLE Web: stopScan');
    return {
      success: false,
      message: 'Not supported on web',
    };
  }

  async connect(_options: ConnectOptions): Promise<ConnectionResult> {
    console.log('SecuGenBLE Web: connect');
    return { connected: false };
  }

  async disconnect(): Promise<ServiceResult> {
    console.log('SecuGenBLE Web: disconnect');
    return {
      success: false,
      message: 'Not supported on web',
    };
  }

  async isConnected(): Promise<{ connected: boolean }> {
    console.log('SecuGenBLE Web: isConnected');
    return { connected: false };
  }

  async getVersion(): Promise<VersionResult> {
    console.log('SecuGenBLE Web: getVersion');
    return {
      success: false,
      message: 'Not supported on web',
    };
  }

  async capture(_options?: CaptureOptions): Promise<CaptureResult> {
    console.log('SecuGenBLE Web: capture');
    return {
      success: false,
      message: 'Not supported on web',
    };
  }

  async register(_options: RegisterOptions): Promise<ServiceResult> {
    console.log('SecuGenBLE Web: register');
    return {
      success: false,
      message: 'Not supported on web',
    };
  }

  async completeRegistration(): Promise<ServiceResult> {
    console.log('SecuGenBLE Web: completeRegistration');
    return {
      success: false,
      message: 'Not supported on web',
    };
  }

  async verify(_options: VerifyOptions): Promise<MatchResult> {
    console.log('SecuGenBLE Web: verify');
    return {
      success: false,
      message: 'Not supported on web',
    };
  }

  async identify(): Promise<MatchResult> {
    console.log('SecuGenBLE Web: identify');
    return {
      success: false,
      message: 'Not supported on web',
    };
  }

  async match(_options: MatchOptions): Promise<MatchResult> {
    console.log('SecuGenBLE Web: match');
    return {
      success: false,
      message: 'Not supported on web',
    };
  }

  async deleteFingerprint(_options: DeleteOptions): Promise<ServiceResult> {
    console.log('SecuGenBLE Web: deleteFingerprint');
    return {
      success: false,
      message: 'Not supported on web',
    };
  }

  async setPowerOffTime(_options: { timeoutMinutes: number }): Promise<ServiceResult> {
    console.log('SecuGenBLE Web: setPowerOffTime');
    return {
      success: false,
      message: 'Not supported on web',
    };
  }

  /**
   * Handle data received from device (internal use)
   */
  onDataReceived?(data: { command: string; data: any }): void {
    console.log('SecuGenBLE Web: onDataReceived', data);
  }
}
