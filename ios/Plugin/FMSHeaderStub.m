//
//  FMSHeaderStub.m
//  iTina
//
//  Stub implementation for FMSHeader SDK class
//

#import "FMSHeader.h"

@implementation FMSHeader

@synthesize header;
@synthesize pHeaderInfo;

- (instancetype)init {
    self = [super init];
    if (self) {
        [self resetHeader];
    }
    return self;
}

- (id)initWithPacket:(uint8_t*)packet {
    self = [super init];
    if (self) {
        [self setHeaderWithPacket:packet];
    }
    return self;
}

// Getter methods
- (uint8_t)getClass {
    return header.pkt_class;
}

- (uint8_t)getCommand {
    return header.pkt_command;
}

- (uint16_t)getParam1 {
    return header.pkt_param1;
}

- (uint16_t)getParam2 {
    return header.pkt_param2;
}

- (uint16_t)getDataSize1 {
    return header.pkt_datasize1;
}

- (uint16_t)getDataSize2 {
    return header.pkt_datasize2;
}

- (uint8_t)getError {
    return header.pkt_param1 & 0xFF; // Error is in param1
}

- (uint8_t)getCheckSum {
    return header.pkt_checksum;
}

// Setter methods
- (void)setClass:(uint8_t)pkt_class {
    header.pkt_class = pkt_class;
}

- (void)setCommand:(uint8_t)pkt_command {
    header.pkt_command = pkt_command;
}

- (void)setParam1:(uint16_t)pkt_param1 {
    header.pkt_param1 = pkt_param1;
}

- (void)setParam2:(uint16_t)pkt_param2 {
    header.pkt_param2 = pkt_param2;
}

- (void)setDataSize1:(uint16_t)pkt_datasize1 {
    header.pkt_datasize1 = pkt_datasize1;
}

- (void)setDataSize2:(uint16_t)pkt_datasize2 {
    header.pkt_datasize2 = pkt_datasize2;
}

// Utility methods
- (uint8_t*)getHeader {
    static uint8_t headerBytes[12];
    headerBytes[0] = header.pkt_class;
    headerBytes[1] = header.pkt_command;
    headerBytes[2] = header.pkt_param1 & 0xFF;
    headerBytes[3] = (header.pkt_param1 >> 8) & 0xFF;
    headerBytes[4] = header.pkt_param2 & 0xFF;
    headerBytes[5] = (header.pkt_param2 >> 8) & 0xFF;
    headerBytes[6] = header.pkt_datasize1 & 0xFF;
    headerBytes[7] = (header.pkt_datasize1 >> 8) & 0xFF;
    headerBytes[8] = header.pkt_datasize2 & 0xFF;
    headerBytes[9] = (header.pkt_datasize2 >> 8) & 0xFF;
    headerBytes[10] = 0x00; // Reserved
    headerBytes[11] = header.pkt_checksum;
    
    return headerBytes;
}

- (void)setHeaderWithPacket:(uint8_t*)packet {
    if (packet) {
        header.pkt_class = packet[0];
        header.pkt_command = packet[1];
        header.pkt_param1 = packet[2] | (packet[3] << 8);
        header.pkt_param2 = packet[4] | (packet[5] << 8);
        header.pkt_datasize1 = packet[6] | (packet[7] << 8);
        header.pkt_datasize2 = packet[8] | (packet[9] << 8);
        header.pkt_checksum = packet[11];
    }
}

- (uint8_t)getCheckSum:(uint8_t*)packet withLength:(uint32_t)buffLength {
    uint8_t checksum = 0;
    for (uint32_t i = 0; i < buffLength - 1; i++) {
        checksum += packet[i];
    }
    return checksum;
}

- (void)resetHeader {
    memset(&header, 0, sizeof(sgPacket));
    header.pkt_class = 0x4E; // Default class
}

@end
