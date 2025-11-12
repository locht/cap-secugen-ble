# Android Device Setup Guide

## Yêu cầu:
- Android device với API level 23+ (Android 6.0+)
- USB debugging enabled
- Android Studio installed

## Bước 1: Chuẩn bị device
```bash
# Enable Developer Options và USB Debugging trên device
# Settings > About Phone > Build Number (tap 7 lần)
# Settings > Developer Options > USB Debugging (ON)
```

## Bước 2: Kiểm tra device connection
```bash
cd secugen-demo
adb devices
# Phải thấy device trong danh sách
```

## Bước 3: Chạy app trên device
```bash
# Cách 1: Qua Capacitor CLI
npx cap run android

# Cách 2: Qua Android Studio
npx cap open android
# Sau đó click Run trong Android Studio
```

## Bước 4: Cấp quyền cho app
Khi app chạy lần đầu, cần cấp các quyền:
- ✅ Location (cho BLE scanning)
- ✅ Bluetooth
- ✅ Nearby devices (Android 12+)

## Bước 5: Test với SecuGen device
1. Mở app → Tab "Scanner"
2. Click "Initialize Plugin"
3. Click "Check Bluetooth" 
4. Click "Start Scan"
5. Kết nối với SecuGen Unity 20 BLE device
6. Chuyển sang tab "Capture" để test chụp vân tay

## Troubleshooting:
- Nếu không scan được device: Kiểm tra quyền Location
- Nếu không connect được: Kiểm tra device có đúng firmware 0.712D+
- Nếu app crash: Xem logcat với `adb logcat`
