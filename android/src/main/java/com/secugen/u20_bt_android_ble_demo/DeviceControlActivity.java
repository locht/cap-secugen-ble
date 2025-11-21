package com.secugen.u20_bt_android_ble_demo;

/**
 * Minimal stub of SDK's DeviceControlActivity used only for WSQ decoding.
 * This provides the same native method signature as the original demo
 * so that libsgwsq-jni.so can be reused without pulling in the full UI.
 */
public class DeviceControlActivity {

    public static class WSQInfoClass {
        public int width = 0;
        public int height = 0;
        public int pixelDepth = 0;
        public int ppi = 0;
        public int lossyFlag = 0;
    }

    static {
        System.loadLibrary("sgwsq-jni");
    }

    // Native WSQ decode implemented in jniSgWSQ.cpp (libsgwsq-jni.so)
    public native byte[] jniSgWSQDecode(WSQInfoClass info, byte[] wsqImage, int wsqImageLength);
}
