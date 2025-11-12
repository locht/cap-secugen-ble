//
//  FMSPacketStub.m
//  iTina
//
//  Stub implementation for FMSPacket SDK methods
//

#import "FMSPacket.h"

@implementation FMSPacket

@synthesize sgheader;

- (instancetype)init {
    self = [super init];
    if (self) {
        self.sgheader = [[FMSHeader alloc] init];
    }
    return self;
}

// Stub implementations - replace with actual SDK logic when available
- (uint8_t*)getVersion {
    static uint8_t cmd[12] = {0x4E, 0x47, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x47};
    return cmd;
}

- (uint8_t*)getImageWithParam:(uint16_t)param1 withParam2:(uint16_t)param2 {
    static uint8_t cmd[12] = {0x4E, 0x43, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00};
    
    // Set parameters
    cmd[2] = param1 & 0xFF;
    cmd[3] = (param1 >> 8) & 0xFF;
    cmd[4] = param2 & 0xFF;
    cmd[5] = (param2 >> 8) & 0xFF;
    
    // Calculate checksum
    uint8_t checksum = 0;
    for (int i = 0; i < 11; i++) {
        checksum += cmd[i];
    }
    cmd[11] = checksum;
    
    return cmd;
}

- (uint8_t*)fpRegisterStartWithUserID:(uint16_t)userID withMaster:(uint8_t)isMaster {
    static uint8_t cmd[12] = {0x4E, 0x52, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00};
    
    cmd[2] = userID & 0xFF;
    cmd[3] = (userID >> 8) & 0xFF;
    cmd[4] = isMaster;
    
    uint8_t checksum = 0;
    for (int i = 0; i < 11; i++) {
        checksum += cmd[i];
    }
    cmd[11] = checksum;
    
    return cmd;
}

- (uint8_t*)fpRegisterEnd {
    static uint8_t cmd[12] = {0x4E, 0x53, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x53};
    return cmd;
}

- (uint8_t*)fpVerifyWithUserID:(uint16_t)userID {
    static uint8_t cmd[12] = {0x4E, 0x56, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00};
    
    cmd[2] = userID & 0xFF;
    cmd[3] = (userID >> 8) & 0xFF;
    
    uint8_t checksum = 0;
    for (int i = 0; i < 11; i++) {
        checksum += cmd[i];
    }
    cmd[11] = checksum;
    
    return cmd;
}

- (uint8_t*)fpIdentify {
    static uint8_t cmd[12] = {0x4E, 0x49, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x49};
    return cmd;
}

- (uint8_t*)fpDeleteWithUserID:(uint16_t)userID {
    static uint8_t cmd[12] = {0x4E, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00};
    
    cmd[2] = userID & 0xFF;
    cmd[3] = (userID >> 8) & 0xFF;
    
    uint8_t checksum = 0;
    for (int i = 0; i < 11; i++) {
        checksum += cmd[i];
    }
    cmd[11] = checksum;
    
    return cmd;
}

- (uint8_t*)fpDeleteAll {
    static uint8_t cmd[12] = {0x4E, 0x45, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x45};
    return cmd;
}

// Stub WSQ decoding - returns success for now
- (int32_t)getRawBufFromWSQ:(uint8_t**)rawBufOut 
                  withWidth:(int *)width 
                 withHeight:(int *)height 
             withPixelDepth:(int *)pixelDepth 
                    withPPI:(int *)ppi 
               withLossyFlag:(int *)lossyFlag 
                 withWsqBuf:(unsigned char *)wsqBufIn 
              withWsqLength:(int)wsqImageLength {
    
    // For now, just copy the input buffer (assume it's raw data)
    *rawBufOut = wsqBufIn;
    *width = 300;  // Default UN20 width
    *height = 400; // Default UN20 height
    *pixelDepth = 8;
    *ppi = 500;
    *lossyFlag = 0;
    
    NSLog(@"🗜️ WSQ decode stub: %dx%d, %d bytes", *width, *height, wsqImageLength);
    
    return 0; // Success
}

// Other stub methods
- (uint8_t*)autoIdentifyStart {
    static uint8_t cmd[12] = {0x4E, 0x41, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x42};
    return cmd;
}

- (uint8_t*)autoIdentifyStop {
    static uint8_t cmd[12] = {0x4E, 0x41, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x41};
    return cmd;
}

- (uint8_t*)getPacket {
    static uint8_t cmd[12] = {0};
    return cmd;
}

- (uint8_t*)getPacketWithCommand:(uint8_t)command 
                      withParam1:(uint16_t)param1 
                      withParam2:(uint16_t)param2 
                    withDataSize:(uint32_t)datasize {
    static uint8_t cmd[12] = {0};
    cmd[0] = 0x4E;
    cmd[1] = command;
    cmd[2] = param1 & 0xFF;
    cmd[3] = (param1 >> 8) & 0xFF;
    cmd[4] = param2 & 0xFF;
    cmd[5] = (param2 >> 8) & 0xFF;
    
    uint8_t checksum = 0;
    for (int i = 0; i < 11; i++) {
        checksum += cmd[i];
    }
    cmd[11] = checksum;
    
    return cmd;
}

// Packet parsing methods
- (uint8_t)getCommand:(uint8_t*)packet {
    return packet[1];
}

- (uint16_t)getParam1:(uint8_t*)packet {
    return packet[2] | (packet[3] << 8);
}

- (uint16_t)getParam2:(uint8_t*)packet {
    return packet[4] | (packet[5] << 8);
}

- (uint32_t)getExtendedDataSize:(uint8_t*)packet {
    return packet[4] | (packet[5] << 8) | (packet[6] << 16) | (packet[7] << 24);
}

- (uint8_t)getError:(uint8_t*)packet {
    return packet[2];
}

- (uint8_t)getCheckSum:(uint8_t*)packet {
    return packet[11];
}

@end
