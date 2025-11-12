# iOS Device Setup Guide

## Yêu cầu:
- iOS device với iOS 13.0+
- Xcode installed
- Apple Developer Account (để sign app)
- Device registered trong Developer Portal

## Bước 1: Chuẩn bị Xcode project
```bash
cd secugen-demo
npx cap open ios
```

## Bước 2: Configure signing trong Xcode
1. Mở project trong Xcode
2. Select "App" target
3. Signing & Capabilities tab
4. Chọn Team và Bundle Identifier
5. Đảm bảo "Automatically manage signing" được bật

## Bước 3: Thêm Bluetooth permissions
File `ios/App/App/Info.plist` đã có:
```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app uses Bluetooth to connect to SecuGen fingerprint scanners</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>This app uses Bluetooth to connect to SecuGen fingerprint scanners</string>
```

## Bước 4: Build và run
```bash
# Cách 1: Qua Capacitor CLI
npx cap run ios

# Cách 2: Qua Xcode
# Click Run button trong Xcode (⌘+R)
```

## Bước 5: Trust Developer trên device
1. Settings > General > VPN & Device Management
2. Tìm Developer App section
3. Trust developer profile

## Bước 6: Test với SecuGen device
1. Mở app → Tab "Scanner"
2. Click "Initialize Plugin"
3. Click "Check Bluetooth"
4. Click "Start Scan"
5. Kết nối với SecuGen Unity 20 BLE device
6. Chuyển sang tab "Capture" để test chụp vân tay

## Troubleshooting:
- Nếu build failed: Kiểm tra signing configuration
- Nếu không scan được: Kiểm tra Bluetooth permissions
- Nếu app không install: Kiểm tra device registration
