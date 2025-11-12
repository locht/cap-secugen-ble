//
//  FMSPacket.h
//  u20_ios_bluetooth_demo
//
//  Created by sb yu on 27/02/2019.
//  Copyright © 2019 sb yu. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "FMSDefine.h"
#import "FMSHeader.h"

@interface FMSPacket : NSObject

@property (strong, nonatomic) FMSHeader *sgheader;

// Obtain a packet to forward to the SecuGen's Bluetooth module
-(uint8_t*) getVersion;
-(uint8_t*) getImageWithParam:(uint16_t)param1 withParam2: (uint16_t)param2;

-(uint8_t*) fpRegisterStartWithUserID:(uint16_t)userID withMaster: (uint8_t)isMaster;
-(uint8_t*) fpRegisterEnd;
-(uint8_t*) fpVerifyWithUserID:(uint16_t)userID;
-(uint8_t*) fpIdentify;
-(uint8_t*) fpDeleteWithUserID:(uint16_t)userID;
-(uint8_t*) fpDeleteAll;

-(uint8_t*) autoIdentifyStart;
-(uint8_t*) autoIdentifyStop;

-(uint8_t*) getPacket;
-(uint8_t*) getPacketWithCommand:(uint8_t)command withParam1: (uint16_t)param1 withParam2: (uint16_t)param2 withDataSize: (uint32_t)datasize;

// Get the information that analyzed the packet received from the SecuGen's Bluetooth module.
-(uint8_t) getCommand:(uint8_t*)packet;
-(uint16_t) getParam1:(uint8_t*)packet;
-(uint16_t) getParam2:(uint8_t*)packet;
-(uint32_t) getExtendedDataSize:(uint8_t*)packet;
-(uint8_t) getError:(uint8_t*)packet;
-(uint8_t) getCheckSum:(uint8_t*)packet;

// Get raw buffer from wsq
-(int32_t) getRawBufFromWSQ:(uint8_t**)rawBufOut withWidth:(int *)width withHeight:(int *)height withPixelDepth:(int *)pixelDepth withPPI:(int *)ppi withLossyFlag:(int *)lossyFlag withWsqBuf:(unsigned char *)wsqBufIn withWsqLength:(int)wsqImageLength;

@end

