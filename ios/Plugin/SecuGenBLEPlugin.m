#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Define the plugin using the CAP_PLUGIN Macro, and
// each method the plugin supports using the CAP_PLUGIN_METHOD macro.
CAP_PLUGIN(SecuGenFingerprint, "SecuGenBLE",
           CAP_PLUGIN_METHOD(initialize, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(isBluetoothEnabled, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(scan, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stopScan, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(connect, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(disconnect, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(isConnected, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getVersion, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(capture, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(register, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(completeRegistration, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(verify, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(identify, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getTemplate, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(match, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(deleteFingerprint, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(setPowerOffTime, CAPPluginReturnPromise);
)
