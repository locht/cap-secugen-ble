require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name             = 'MyduchospitalCapSecugenBle'
  s.version          = package['version']
  s.summary          = 'Capacitor plugin for SecuGen BLE fingerprint scanner'
  s.license          = package['license'] || 'MIT'
  s.homepage         = 'https://github.com/locht/cap-secugen-ble'
  s.author           = package['author'] || 'MyDuc Hospital'
  s.source           = { :git => 'https://github.com/locht/cap-secugen-ble.git', :tag => s.version.to_s }
  s.source_files     = 'ios/Plugin/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target  = '13.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
  
  # Use vendored framework instead of static library
  s.vendored_frameworks = 'ios/Vendor/FMSProtocol.framework'
  
  # Framework search paths
  s.xcconfig = {
    'FRAMEWORK_SEARCH_PATHS' => '$(inherited) $(SRCROOT)/../node_modules/@myduchospital/cap-secugen-ble/ios/Vendor',
    'HEADER_SEARCH_PATHS' => '$(inherited) $(SRCROOT)/../node_modules/@myduchospital/cap-secugen-ble/ios/Plugin'
  }
  
  # Public header files
  s.public_header_files = 'ios/Plugin/**/*.h'
end
