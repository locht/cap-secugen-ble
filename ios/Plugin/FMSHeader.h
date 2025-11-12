//
//  FMSHeader.h
//  u20_ios_bluetooth_demo
//
//  Created by sb yu on 27/02/2019.
//  Copyright © 2019 sb yu. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "FMSDefine.h"

@interface FMSHeader : NSObject
{
    sgPacket header;
    uint8_t *pHeaderInfo;
}

@property (nonatomic, assign) sgPacket header;
@property (nonatomic, assign) uint8_t *pHeaderInfo;

-(uint8_t)getClass;
-(uint8_t)getCommand;
-(uint16_t)getParam1;
-(uint16_t)getParam2;
-(uint16_t)getDataSize1;
-(uint16_t)getDataSize2;
-(uint8_t)getError;
-(uint8_t)getCheckSum;

-(void)setClass:(uint8_t) pkt_class;
-(void)setCommand:(uint8_t) pkt_command;
-(void)setParam1:(uint16_t) pkt_param1;
-(void)setParam2:(uint16_t) pkt_param2;
-(void)setDataSize1:(uint16_t) pkt_datasize1;
-(void)setDataSize2:(uint16_t) pkt_datasize2;

-(id) initWithPacket:(uint8_t*)packet;
-(uint8_t*) getHeader;
-(void) setHeaderWithPacket:(uint8_t*)packet;
-(uint8_t) getCheckSum:(uint8_t*)packet withLength: (uint32_t) buffLength;
-(void) resetHeader;

@end
