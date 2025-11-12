//
//  FMSDefine.h
//  u20_ios_bluetooth_demo
//
//  Created by sb yu on 27/02/2019.
//  Copyright © 2019 sb yu. All rights reserved.
//

//#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

// default
#define PACKET_HEADER_SIZE          12
#define TEMPLATE_SIZE_OF_SG400      400  // The SG400 format is SecuGen proprietary and is compatible with all SecuGen SDKs that support 400 byte templates.

#define WSQ_BITRATE_5_TO_1          0x01 // It means 2.25. This is the high byte of param2 in the CMD_GET_IMAGE command, and the high byte of param1 should be set to 0x01.
#define WSQ_BITRATE_15_TO_1         0x02 // It means 0.75. This is the high byte of param2 in the CMD_GET_IMAGE command, and the high byte of param1 should be set to 0x01.

// COMMAND
#define CMD_GET_VERSION             0x05
#define CMD_SET_SYSTEM_INFO         0x20
#define CMD_GET_SYSTEM_INFO         0x30
#define CMD_GET_TEMPLATE            0x40
#define CMD_GET_IMAGE               0x43
#define CMD_FP_REGISTER_START       0x50
#define CMD_FP_REGISTER_END         0x51
#define CMD_FP_DELETE               0x54
#define CMD_FP_VERIFY               0x55
#define CMD_FP_IDENTIFY             0x56
#define CMD_GET_AUTO_ON             0x6F
#define CMD_DB_GET_RECCOUNT         0x70
#define CMD_DB_ADD_REC              0x71
#define CMD_DB_GET_REC              0x73
#define CMD_DB_GET_FIRSTREC         0x74
#define CMD_DB_GET_NEXTREC          0x75
#define CMD_DB_DELETE_ALL           0x76
#define CMD_DB_GET_CURRENTREC       0x77
#define CMD_DB_VERIFY               0x78
#define CMD_DB_IDENTIFY             0x79
#define CMD_FP_AUTO_IDENTIFY_START  0xA1
#define CMD_FP_AUTO_IDENTIFY_STOP   0xA2
#define CMD_FP_AUTO_IDENTIFY        0xA3
#define CMD_INSTANT_VERIFY          0xD0
#define CMD_REQUEST_CONNECT         0xF0
#define CMD_SET_POWER_OFF_TIME      0xF7
#define CMD_GET_MATCH_SCORE         0xF9
#define CMD_LOAD_MATCH_TEMPLATE     0xFA

//ERROR CODES
typedef enum : uint8_t {
    ERR_NONE = 0x00,                // Normal operation
    ERR_FLASH_OPEN = 0x01,          //  Flash memory error
    ERR_SENSOR_OPEN = 0x02,         //  Sensor initialization failed
    ERR_REGISTER_FAILED = 0x03,     //  Fingerprint registration failed
    ERR_VERIFY_FAILED = 0x04,       //  Fingerprint verification failed
    ERR_ALREADY_REGISTERED_USER = 0x05, //  User ID already exists
    ERR_USER_NOT_FOUND = 0x06,      //  User ID is not found
    ERR_TIME_OUT = 0x08,            //  Failed to capture fingerprint in preset time
    ERR_DB_FULL = 0x09,             //  SDA database is full
    ERR_WRONG_USERID = 0x0A,        //  Wrong user ID
    ERR_DB_NO_DATA = 0x0B,          //  SDA database is empty
    ERR_FUNCTION_FAIL = 0x10,       //  Wrong usage of command packet
    ERR_INSUFFICIENT_DATA = 0x11,   //  Wrong length value of Extra Data
    ERR_FLASH_WRITE_ERROR = 0x12,   //  Flash write error
    ERR_INVALID_PARAM = 0x14,       //  Parameter value is not invalid
    ERR_AUTHENTICATION_FAIL = 0x17, //  Master identification failed or needs to master authentication
    ERR_IDENTIFY_FAILED = 0x1B,     //  Fingerprint identification failed
    ERR_CHECKSUM_ERR = 0x28,        //  Wrong check sum
    ERR_INVALID_FPRECORD = 0x30,    //  Record format is invalid
    ERR_UNKNOWN_COMMAND = 0xFF,//  Unknown command
} FMSError;

typedef struct _tagPacket {
    //12 bytes information
    uint8_t  pkt_class;
    uint8_t  pkt_command;
    uint16_t pkt_param1;
    uint16_t pkt_param2;
    uint16_t pkt_datasize1;
    uint16_t pkt_datasize2;
    uint8_t  pkt_error;
    uint8_t  pkt_checksum;
} sgPacket;
