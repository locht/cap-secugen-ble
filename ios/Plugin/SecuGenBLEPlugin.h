//
//  SecuGenBLEPlugin.h
//  Capacitor plugin for SecuGen Unity 20 SDK
//  Uses original SDK ProtocolTestViewController logic
//

#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>
#import <CoreBluetooth/CoreBluetooth.h>

// Import SDK headers (local copies)
#import "FMSProtocol.h"
#import "FMSPacket.h"
#import "FMSHeader.h"
#import "FMSDefine.h"

NS_ASSUME_NONNULL_BEGIN

@interface SecuGenFingerprint : CAPPlugin <CBCentralManagerDelegate, CBPeripheralDelegate>

// SDK Integration Properties (from ProtocolTestViewController)
@property (nonatomic, strong) CBCentralManager *centralManager;
@property (nonatomic, strong) CBPeripheral *connectedPeripheral;
@property (nonatomic, strong) CBCharacteristic *writeCharacteristic;
@property (nonatomic, strong) CBCharacteristic *notifyCharacteristic;

// SDK Data Management (like original SDK)
@property (nonatomic, strong) NSMutableData *ImageData;
@property (nonatomic, assign) int total_receive_size;
@property (nonatomic, assign) int remaining_data_size;
@property (nonatomic, assign) int imgsize;
@property (nonatomic, assign) int wsqbitrate;
@property (nonatomic, assign) BOOL isWSQ;

// SDK UUIDs (from original SDK)
@property (nonatomic, strong) CBUUID *serviceUUID;
@property (nonatomic, strong) CBUUID *writeCharacteristicUUID;
@property (nonatomic, strong) CBUUID *notifyCharacteristicUUID;

// Connection state
@property (nonatomic, assign) BOOL isConnected;
@property (nonatomic, assign) BOOL isScanning;

// SDK Command tracking (like original SDK)
@property (nonatomic, assign) uint16_t currentCommand;
@property (nonatomic, strong) CAPPluginCall *currentCall;

// Image scaling properties
@property (nonatomic, assign) int targetWidth;
@property (nonatomic, assign) int targetHeight;
@property (nonatomic, assign) int originalWidth;
@property (nonatomic, assign) int originalHeight;
@property (nonatomic, assign) BOOL needsScaling;

// SDK Methods
- (void)initializeSDK;

@end

NS_ASSUME_NONNULL_END
